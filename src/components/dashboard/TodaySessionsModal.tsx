import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { callFunction } from "@/lib/api"
import { X, Loader2 } from "lucide-react"
import { PALETTE, toTimeStr, groupByTeacher, formatDayLabel } from "@/lib/session.utils"
import type { ClassSession, AttendanceStatus } from "@/types/session"

const SESSION_SELECT = `
  id, tenant_id, class_id, teacher_id, starts_at, ends_at, status, notes, created_at, updated_at,
  teacher:teacher(name, last_name),
  class_session_students(session_id, student_id, status, marked_at,
    student:students(name, lastname)
  )
`.trim()

function loadColorMap(tenantId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`sessions_color_map_v1_${tenantId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

type Props = {
  open: boolean
  tenantId: string
  onClose: () => void
}

export default function TodaySessionsModal({ open, tenantId, onClose }: Props) {
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(false)
  const [colorMap, setColorMap] = useState<Record<string, number>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const todayKey = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (open) {
      setColorMap(loadColorMap(tenantId))
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from("class_sessions")
      .select(SESSION_SELECT)
      .eq("tenant_id", tenantId)
      .gte("starts_at", `${todayKey}T00:00:00`)
      .lte("starts_at", `${todayKey}T23:59:59`)
      .order("starts_at")

    if (!error && data) {
      setSessions(
        data.map((s: any) => ({
          ...s,
          teacher: Array.isArray(s.teacher) ? s.teacher[0] ?? null : s.teacher ?? null,
          class_session_students: (s.class_session_students ?? []).map((css: any) => ({
            ...css,
            student: Array.isArray(css.student) ? css.student[0] ?? null : css.student ?? null,
          })),
        })) as ClassSession[]
      )
    }
    setLoading(false)
  }

  async function markAttendance(sessionId: string, status: AttendanceStatus) {
    setBusyId(sessionId)
    try {
      await callFunction("session-attendance", { session_id: sessionId, status })
      setSessions((prev) =>
        prev.map((s) =>
          s.id !== sessionId
            ? s
            : {
                ...s,
                class_session_students: s.class_session_students?.map((css) => ({
                  ...css,
                  status,
                })) ?? [],
              }
        )
      )
    } finally {
      setBusyId(null)
    }
  }

  const groups = groupByTeacher(sessions, colorMap)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-panel shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-panel px-5 py-3">
            <div>
              <div className="font-semibold">Σημερινό Πρόγραμμα</div>
              <div className="text-xs text-muted">
                {formatDayLabel(todayKey)} · {sessions.length} συνεδρία{sessions.length !== 1 ? "ες" : ""}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-border/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : groups.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">
                Δεν υπάρχουν συνεδρίες για σήμερα.
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => {
                  const pal = PALETTE[group.colorIdx % PALETTE.length]
                  return (
                    <div key={group.teacher_id} className="overflow-hidden rounded-xl border border-border">
                      {/* Teacher header */}
                      <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{ background: pal.bg, color: pal.text }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: pal.dot }} />
                          <span className="text-sm font-semibold">{group.teacher_name}</span>
                        </div>
                        <span className="text-xs opacity-60">
                          {group.slots.length} slot{group.slots.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Slots */}
                      <div className="divide-y divide-border/10">
                        {group.slots.map((slot) => {
                          const ss = slot.class_session_students?.[0]
                          const studentName = ss?.student
                            ? `${ss.student.lastname} ${ss.student.name}`
                            : null
                          const currentStatus = ss?.status as AttendanceStatus | undefined
                          const busy = busyId === slot.id

                          return (
                            <div key={slot.id} className="flex items-center gap-3 bg-bg px-3 py-2.5">
                              <span className="w-24 shrink-0 font-mono text-xs text-muted">
                                {toTimeStr(slot.starts_at)} – {toTimeStr(slot.ends_at)}
                              </span>
                              <span className={`flex-1 text-sm ${studentName ? "" : "italic text-muted"}`}>
                                {studentName ?? "χωρίς μαθητή"}
                              </span>
                              {ss && (
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <button
                                    disabled={busy}
                                    onClick={() => markAttendance(slot.id, "present")}
                                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                                      currentStatus === "present"
                                        ? "border-green-300 bg-green-500/15 text-green-700"
                                        : "border-border/20 text-muted hover:bg-green-500/10"
                                    }`}
                                  >
                                    {busy && currentStatus !== "present"
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : "Παρών"}
                                  </button>
                                  <button
                                    disabled={busy}
                                    onClick={() => markAttendance(slot.id, "absent")}
                                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                                      currentStatus === "absent"
                                        ? "border-red-300 bg-red-500/15 text-red-700"
                                        : "border-border/20 text-muted hover:bg-red-500/10"
                                    }`}
                                  >
                                    {busy && currentStatus !== "absent"
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : "Απών"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
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
