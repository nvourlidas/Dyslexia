import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { X, Loader2, UserCheck, Trash2, MessageSquare } from "lucide-react"

type StudentRow = {
  user_id: string
  name: string
  lastname: string
  doctor_visit: boolean
  doctor_name: string | null
}

type DismissedMap = Record<string, { comment: string | null }>

type Props = {
  open: boolean
  tenantId: string
  onClose: () => void
  onCountChange: (n: number) => void
}

export default function DoctorListModal({ open, tenantId, onClose, onCountChange }: Props) {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [dismissed, setDismissed] = useState<DismissedMap>({})
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [doctorName, setDoctorName] = useState("")
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  async function load() {
    setLoading(true)
    const [studRes, dimRes] = await Promise.all([
      supabase
        .from("students")
        .select("user_id, name, lastname, doctor_visit, doctor_name")
        .eq("tenant_id", tenantId)
        .eq("doctor_visit", false),
      supabase
        .from("dashboard_doctor_dismissed")
        .select("student_id, comment")
        .eq("tenant_id", tenantId),
    ])
    const dimMap: DismissedMap = {}
    for (const r of dimRes.data ?? []) dimMap[r.student_id] = { comment: r.comment }
    setDismissed(dimMap)
    const visible = ((studRes.data ?? []) as StudentRow[]).filter((s) => !dimMap[s.user_id])
    setStudents(visible)
    onCountChange(visible.length)
    setLoading(false)
  }

  // visible list = students not dismissed
  const list = students.filter((s) => !dismissed[s.user_id])

  function startEdit(s: StudentRow) {
    setEditingId(s.user_id)
    setDoctorName(s.doctor_name ?? "")
    setComment("")
  }

  function cancelEdit() {
    setEditingId(null)
    setDoctorName("")
    setComment("")
  }

  async function saveVisit(student: StudentRow) {
    setSaving(student.user_id)
    await supabase
      .from("students")
      .update({ doctor_visit: true, doctor_name: doctorName || null })
      .eq("user_id", student.user_id)
    // update local state
    setStudents((prev) =>
      prev.map((s) =>
        s.user_id === student.user_id
          ? { ...s, doctor_visit: true, doctor_name: doctorName || null }
          : s,
      ),
    )
    cancelEdit()
    setSaving(null)
  }

  async function dismiss(studentId: string, cmt?: string) {
    setSaving(studentId)
    await supabase.from("dashboard_doctor_dismissed").upsert({
      tenant_id: tenantId,
      student_id: studentId,
      comment: cmt ?? comment ?? null,
    })
    setDismissed((prev) => ({ ...prev, [studentId]: { comment: cmt ?? comment ?? null } }))
    setStudents((prev) => prev.filter((s) => s.user_id !== studentId))
    onCountChange(list.length - 1)
    cancelEdit()
    setSaving(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-panel shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-panel px-5 py-3">
            <div>
              <div className="font-semibold">Μαθητές για γιατρό</div>
              <div className="text-xs text-muted">{list.length} χωρίς εγγεγραμμένο γιατρό</div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-border/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : list.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">
                Όλοι οι μαθητές έχουν γιατρό ή έχουν αφαιρεθεί.
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((s) => {
                  const isEditing = editingId === s.user_id
                  const fullName = `${s.name} ${s.lastname}`.trim()
                  return (
                    <div
                      key={s.user_id}
                      className="rounded-xl border border-border bg-bg p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{fullName}</div>
                          {s.doctor_name && (
                            <div className="text-xs text-muted">Γιατρός: {s.doctor_name}</div>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              onClick={() => startEdit(s)}
                              title="Επεξεργασία / Πήγε σε γιατρό"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/30 text-muted hover:text-primary hover:border-primary/30 transition-colors"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => dismiss(s.user_id, "")}
                              disabled={saving === s.user_id}
                              title="Αφαίρεση από λίστα"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              {saving === s.user_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded edit panel */}
                      {isEditing && (
                        <div className="mt-3 space-y-2 border-t border-border/20 pt-3">
                          <div>
                            <label className="mb-1 block text-xs text-muted">Όνομα γιατρού</label>
                            <input
                              className="input"
                              placeholder="π.χ. Παπαδόπουλος Νίκος"
                              value={doctorName}
                              onChange={(e) => setDoctorName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> Σχόλιο
                            </label>
                            <textarea
                              className="input h-16 resize-none py-1.5"
                              placeholder="Προαιρετικό σχόλιο..."
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-primary text-xs flex-1"
                              disabled={saving === s.user_id}
                              onClick={() => saveVisit(s)}
                            >
                              {saving === s.user_id ? "..." : "Αποθήκευση γιατρού"}
                            </button>
                            <button
                              className="btn btn-danger text-xs flex-1"
                              disabled={saving === s.user_id}
                              onClick={() => dismiss(s.user_id, comment)}
                            >
                              Αφαίρεση από λίστα
                            </button>
                            <button className="btn text-xs" onClick={cancelEdit}>
                              Ακύρωση
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
