import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { X, Loader2, Copy, ChevronLeft, ChevronRight } from "lucide-react"
import type { ClassSession } from "@/types/session"

const GREEK_DAYS = ["Κυρ", "Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ"]

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6)
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
  return `${fmt(monday)} – ${fmt(sunday)}/${sunday.getFullYear()}`
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })
}

function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ─── Week picker ──────────────────────────────────────────────────────────────

function WeekPicker({ label, monday, onChange }: {
  label: string
  monday: Date
  onChange: (d: Date) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-muted shrink-0">{label}</span>
      <button
        onClick={() => onChange(addDays(monday, -7))}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/30 text-muted hover:text-text transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[160px] text-center text-sm font-medium">{weekLabel(monday)}</span>
      <button
        onClick={() => onChange(addDays(monday, 7))}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/30 text-muted hover:text-text transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  tenantId: string
  onClose: () => void
  onCopied: () => void
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function CopyWeekModal({ open, tenantId, onClose, onCopied }: Props) {
  const today = new Date()
  const [sourceMonday, setSourceMonday] = useState(() => getMondayOf(today))
  const [targetMonday, setTargetMonday] = useState(() => addDays(getMondayOf(today), 7))

  const [sourceSessions, setSourceSessions] = useState<ClassSession[]>([])
  const [loadingSource, setLoadingSource] = useState(false)
  const [copying, setCopying] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErr(null)
    loadSource()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceMonday, tenantId])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  async function loadSource() {
    setLoadingSource(true)
    const from = new Date(sourceMonday)
    const to = addDays(sourceMonday, 6)
    to.setHours(23, 59, 59)

    const { data, error } = await supabase
      .from("class_sessions")
      .select(`
        id, teacher_id, class_id, starts_at, ends_at, status,
        teacher:teacher(name, last_name),
        class_session_students(student_id, student:students(name, lastname))
      `)
      .eq("tenant_id", tenantId)
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString())
      .order("starts_at")

    if (error) { setErr(error.message); setLoadingSource(false); return }

    const normalized: ClassSession[] = (data ?? []).map((s: any) => ({
      ...s,
      teacher: Array.isArray(s.teacher) ? s.teacher[0] ?? null : s.teacher ?? null,
      class_session_students: (s.class_session_students ?? []).map((css: any) => ({
        ...css,
        student: Array.isArray(css.student) ? css.student[0] ?? null : css.student ?? null,
      })),
    }))

    setSourceSessions(normalized)
    setLoadingSource(false)
  }

  // Day diff (always a multiple of 7 in normal use)
  const daysDiff = useMemo(() =>
    Math.round((targetMonday.getTime() - sourceMonday.getTime()) / 86_400_000),
    [sourceMonday, targetMonday]
  )

  const sameWeek = daysDiff === 0

  // Group source sessions by day key
  const byDay = useMemo(() => {
    const map: Record<string, ClassSession[]> = {}
    sourceSessions.forEach((s) => {
      const k = s.starts_at.slice(0, 10)
      if (!map[k]) map[k] = []
      map[k].push(s)
    })
    return map
  }, [sourceSessions])

  const sortedDays = useMemo(() =>
    Object.keys(byDay).sort(),
    [byDay]
  )

  async function doCopy() {
    if (sameWeek || sourceSessions.length === 0) return
    setCopying(true)
    setErr(null)

    try {
      for (const session of sourceSessions) {
        const { data: newSess, error: sessErr } = await supabase
          .from("class_sessions")
          .insert({
            tenant_id: tenantId,
            teacher_id: session.teacher_id,
            class_id: session.class_id,
            starts_at: shiftIso(session.starts_at, daysDiff),
            ends_at: shiftIso(session.ends_at, daysDiff),
            status: "scheduled",
          })
          .select("id")
          .single()

        if (sessErr || !newSess) continue

        const students = session.class_session_students ?? []
        if (students.length > 0) {
          await supabase.from("class_session_students").insert(
            students.map((s) => ({ session_id: newSess.id, student_id: s.student_id }))
          )
        }
      }

      onCopied()
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? "Σφάλμα κατά την αντιγραφή.")
    }

    setCopying(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-border bg-panel shadow-xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <div className="font-semibold">Αντιγραφή εβδομάδας</div>
              <div className="text-xs text-muted">Αντιγράφει όλες τις συνεδρίες από την πηγή στον στόχο</div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-border/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Week pickers */}
          <div className="space-y-3 border-b border-border/40 px-5 py-4">
            <WeekPicker label="Πηγή" monday={sourceMonday} onChange={setSourceMonday} />
            <WeekPicker label="Στόχος" monday={targetMonday} onChange={setTargetMonday} />
            {sameWeek && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                Η πηγή και ο στόχος είναι η ίδια εβδομάδα.
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="max-h-[40vh] overflow-y-auto px-5 py-4">
            {loadingSource ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              </div>
            ) : sourceSessions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted">
                Δεν υπάρχουν συνεδρίες στην επιλεγμένη εβδομάδα πηγής.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-medium text-muted uppercase tracking-wide">
                  Θα αντιγραφούν {sourceSessions.length} συνεδρίες
                </div>
                {sortedDays.map((dk) => {
                  const d = new Date(dk + "T00:00:00")
                  const targetD = addDays(d, daysDiff)
                  const sessions = byDay[dk]
                  return (
                    <div key={dk} className="rounded-xl border border-border bg-bg px-3 py-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold">
                          {GREEK_DAYS[d.getDay()]} {fmtDate(d)}
                        </span>
                        {!sameWeek && (
                          <span className="text-muted">
                            → {GREEK_DAYS[targetD.getDay()]} {fmtDate(targetD)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {sessions.map((s) => {
                          const studentCount = (s.class_session_students ?? []).length
                          const teacherName = s.teacher
                            ? `${s.teacher.last_name} ${s.teacher.name}`
                            : "—"
                          return (
                            <div key={s.id} className="flex items-center justify-between text-xs text-muted">
                              <span className="font-medium text-text">{teacherName}</span>
                              <span>
                                {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                                {studentCount > 0 && (
                                  <span className="ml-2 rounded-full bg-border/20 px-1.5 py-0.5">
                                    {studentCount} μαθ.
                                  </span>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {err && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {err}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border/40 px-5 py-3">
            <button className="btn text-sm" disabled={copying} onClick={onClose}>
              Ακύρωση
            </button>
            <button
              className="btn btn-primary flex items-center gap-2 text-sm"
              disabled={copying || sameWeek || sourceSessions.length === 0 || loadingSource}
              onClick={doCopy}
            >
              {copying
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Copy className="h-4 w-4" />}
              {copying ? "Αντιγραφή…" : `Αντιγραφή ${sourceSessions.length} συνεδριών`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
