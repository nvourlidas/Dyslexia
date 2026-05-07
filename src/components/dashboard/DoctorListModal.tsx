import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { X, Loader2, UserCheck, Trash2, MessageSquare, SlidersHorizontal } from "lucide-react"

type ColKey = "amka" | "birthdate" | "phone" | "email" | "city" | "parent_name" | "parent_phone1" | "parent_phone2"

const COL_LABELS: Record<ColKey, string> = {
  amka: "ΑΜΚΑ",
  birthdate: "Ημ. Γέννησης",
  phone: "Τηλέφωνο",
  email: "Email",
  city: "Πόλη",
  parent_name: "Γονέας",
  parent_phone1: "Τηλ. Γονέα 1",
  parent_phone2: "Τηλ. Γονέα 2",
}

const ALL_COLS: ColKey[] = ["amka", "parent_name", "parent_phone1", "parent_phone2", "phone", "email", "birthdate", "city"]
const DEFAULT_COLS = new Set<ColKey>(["amka", "parent_name", "parent_phone1"])

type StudentRow = {
  user_id: string
  name: string
  lastname: string
  doctor_visit: boolean
  doctor_name: string | null
  amka: string | null
  birthdate: string | null
  phone: string | null
  email: string | null
  city: string | null
  parent_name: string | null
  parent_phone1: string | null
  parent_phone2: string | null
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
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS))
  const [colMenuOpen, setColMenuOpen] = useState(false)

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  function toggleCol(col: ColKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })
  }

  async function load() {
    setLoading(true)
    const [studRes, dimRes] = await Promise.all([
      supabase
        .from("students")
        .select("user_id, name, lastname, doctor_visit, doctor_name, amka, birthdate, phone, email, city, parent_name, parent_phone1, parent_phone2")
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

  function colValue(s: StudentRow, col: ColKey): string | null {
    return s[col] ?? null
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
            <div className="flex items-center gap-2">
              {/* Column filter */}
              <div className="relative">
                <button
                  onClick={() => setColMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1 text-xs hover:border-border/60 transition-colors"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Στήλες
                </button>
                {colMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setColMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-[170px] rounded-xl border border-border bg-panel p-1.5 shadow-xl">
                      {ALL_COLS.map((col) => (
                        <label
                          key={col}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-border/10"
                        >
                          <input
                            type="checkbox"
                            checked={visibleCols.has(col)}
                            onChange={() => toggleCol(col)}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          {COL_LABELS[col]}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-border/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[65vh] overflow-y-auto p-4">
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

                  // Collect visible extra fields
                  const extraFields = ALL_COLS
                    .filter((col) => visibleCols.has(col))
                    .map((col) => ({ col, value: colValue(s, col) }))
                    .filter(({ value }) => !!value)

                  return (
                    <div
                      key={s.user_id}
                      className="rounded-xl border border-border bg-bg p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{fullName}</div>
                          {s.doctor_name && (
                            <div className="text-xs text-muted">Γιατρός: {s.doctor_name}</div>
                          )}
                          {/* Extra columns */}
                          {extraFields.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                              {extraFields.map(({ col, value }) => (
                                <span key={col}>
                                  <span className="text-muted/70">{COL_LABELS[col]}:</span>{" "}
                                  <span className={col === "amka" || col.startsWith("parent_phone") || col === "phone" ? "font-mono" : ""}>
                                    {value}
                                  </span>
                                </span>
                              ))}
                            </div>
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
                            <label className="mb-1 flex items-center gap-1 text-xs text-muted">
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
