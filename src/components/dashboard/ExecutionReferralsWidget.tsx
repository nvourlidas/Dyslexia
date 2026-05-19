import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { fmtDate } from "@/lib/dateUtils"
import { Loader2, MessageSquare, Check, CheckCircle2 } from "lucide-react"

const GREEK_MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
]

type Row = {
  id: string
  title: string
  code: string | null
  code_diagnosis: string | null
  end_date: string | null
  notes: string | null
  student_name: string
  amka: string | null
}

type MonthGroup = { key: string; label: string; items: Row[] }

type Props = {
  tenantId: string
  onCountChange?: (n: number) => void
}

export default function ExecutionReferralsWidget({ tenantId, onCountChange }: Props) {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function load() {
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase
      .from("parapemtiko")
      .select("id, title, code, code_diagnosis, end_date, notes, student:students(name, lastname, amka)")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("end_date", { ascending: true, nullsFirst: false })

    if (error) { setErr(error.message); setLoading(false); return }

    const rows: Row[] = (data ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      code: p.code ?? null,
      code_diagnosis: p.code_diagnosis ?? null,
      end_date: p.end_date ?? null,
      notes: p.notes ?? null,
      amka: p.student?.amka ?? null,
      student_name: p.student ? `${p.student.name} ${p.student.lastname}`.trim() : "(Άγνωστος)",
    }))

    setItems(rows)
    onCountChange?.(rows.length)
    setLoading(false)
  }

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const dated = items.filter((i) => i.end_date)
    const undated = items.filter((i) => !i.end_date)

    const map = new Map<string, Row[]>()
    for (const item of dated) {
      const d = new Date(item.end_date!)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }

    const groups: MonthGroup[] = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, groupItems]) => {
        const [y, m] = key.split("-").map(Number)
        return { key, label: `${GREEK_MONTHS[m]} ${y}`, items: groupItems }
      })

    if (undated.length > 0)
      groups.push({ key: "nodate", label: "Χωρίς ημερομηνία λήξης", items: undated })

    return groups
  }, [items])

  async function markCompleted(id: string) {
    setCompletingId(id)
    const { error } = await supabase.from("parapemtiko").update({ status: "completed" }).eq("id", id)
    if (!error) {
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id)
        onCountChange?.(next.length)
        return next
      })
      if (editingNoteId === id) setEditingNoteId(null)
    }
    setCompletingId(null)
  }

  function startEditNote(item: Row) {
    setEditingNoteId(item.id)
    setNoteText(item.notes ?? "")
  }

  async function saveNote(id: string) {
    setSavingNoteId(id)
    const { error } = await supabase
      .from("parapemtiko")
      .update({ notes: noteText || null })
      .eq("id", id)
    if (!error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes: noteText || null } : i)))
      setEditingNoteId(null)
      setNoteText("")
    }
    setSavingNoteId(null)
  }

  return (
    <div className="rounded-2xl border border-border bg-panel p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-base font-semibold">Εκτέλεση Παραπεμπτικών</div>
          {!loading && (
            <div className="text-xs text-muted">{items.length} σε εκκρεμότητα</div>
          )}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[480px]">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs">{err}</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">
            Δεν υπάρχουν παραπεμπτικά σε εκκρεμότητα.
          </div>
        ) : (
          <div className="space-y-4">
            {monthGroups.map((group) => (
              <div key={group.key}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {group.label}
                  </span>
                  <span className="text-xs text-muted">({group.items.length})</span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const isEditingNote = editingNoteId === item.id
                    const savingNote = savingNoteId === item.id
                    const completing = completingId === item.id
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-bg px-3 py-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-medium">{item.student_name}</span>
                              {item.code && (
                                <span className="rounded bg-border/20 px-1.5 py-0.5 text-xs font-mono text-muted">
                                  {item.code}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                              {item.amka && (
                                <span>ΑΜΚΑ: <span className="font-mono">{item.amka}</span></span>
                              )}
                              {item.code_diagnosis && (
                                <span>Κωδ. Διάγν.: <span className="font-mono">{item.code_diagnosis}</span></span>
                              )}
                              {item.end_date && (
                                <span>Λήξη: {fmtDate(item.end_date)}</span>
                              )}
                            </div>
                            {!isEditingNote && item.notes && (
                              <div className="mt-1 rounded-lg bg-panel/60 px-2 py-1 text-xs text-muted">
                                <span className="font-medium">Σημ.:</span> {item.notes}
                              </div>
                            )}
                          </div>
                          {!isEditingNote && (
                            <div className="flex shrink-0 gap-1">
                              <button
                                onClick={() => startEditNote(item)}
                                title={item.notes ? "Επεξεργασία σημείωσης" : "Προσθήκη σημείωσης"}
                                className={[
                                  "inline-flex h-6 w-6 items-center justify-center rounded-lg border transition-colors",
                                  item.notes
                                    ? "border-primary/30 text-primary hover:bg-primary/10"
                                    : "border-border/30 text-muted hover:border-border/60 hover:text-text",
                                ].join(" ")}
                              >
                                <MessageSquare className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => markCompleted(item.id)}
                                disabled={completing}
                                title="Εκτελέστηκε"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                              >
                                {completing
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <CheckCircle2 className="h-3 w-3" />}
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditingNote && (
                          <div className="mt-2.5 space-y-1.5 border-t border-border/20 pt-2.5">
                            <textarea
                              autoFocus
                              className="input h-16 resize-none py-1.5 text-xs"
                              placeholder="Σημείωση / σχόλιο για αυτό το παραπεμπτικό..."
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                            />
                            <div className="flex gap-1.5">
                              <button
                                className="btn btn-primary flex items-center gap-1 text-xs"
                                disabled={savingNote}
                                onClick={() => saveNote(item.id)}
                              >
                                {savingNote
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Check className="h-3 w-3" />}
                                Αποθήκευση
                              </button>
                              <button
                                className="btn text-xs"
                                disabled={savingNote}
                                onClick={() => { setEditingNoteId(null); setNoteText("") }}
                              >
                                Ακύρωση
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
