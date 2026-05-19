import { Fragment, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { fmtDate } from "@/lib/dateUtils"
import { X, Loader2, Trash2, CheckSquare, Square, MessageSquare, Check } from "lucide-react"

type Row = {
  id: string
  title: string
  code: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  student_name: string
}

type Props = {
  open: boolean
  tenantId: string
  onClose: () => void
  onCountChange: (n: number) => void
}

export default function ParapemtikaExpiring30Modal({ open, tenantId, onClose, onCountChange }: Props) {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null)
  const [removing, setRemoving] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)

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

  async function load() {
    setLoading(true)
    setErr(null)
    setSelected(new Set())

    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from("parapemtiko")
      .select("id, title, code, start_date, end_date, notes, student:students(name, lastname)")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .not("end_date", "is", null)
      .gte("end_date", today)
      .lte("end_date", in30)
      .order("end_date", { ascending: true })

    if (error) {
      setErr(error.message)
      setLoading(false)
      return
    }

    const rows: Row[] = (data ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      code: p.code ?? null,
      start_date: p.start_date ?? null,
      end_date: p.end_date ?? null,
      notes: p.notes ?? null,
      student_name: p.student ? `${p.student.name} ${p.student.lastname}`.trim() : "(Άγνωστος)",
    }))

    setItems(rows)
    onCountChange(rows.length)
    setLoading(false)
  }

  const allIds = items.map((i) => i.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = allIds.some((id) => selected.has(id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function doRemove() {
    if (!confirmIds || confirmIds.length === 0) return
    setRemoving(true)
    await supabase.from("parapemtiko").update({ status: "completed" }).in("id", confirmIds)
    const removed = new Set(confirmIds)
    setItems((prev) => {
      const next = prev.filter((i) => !removed.has(i.id))
      onCountChange(next.length)
      return next
    })
    setSelected((prev) => {
      const n = new Set(prev)
      removed.forEach((id) => n.delete(id))
      return n
    })
    if (editingNoteId && removed.has(editingNoteId)) setEditingNoteId(null)
    setConfirmIds(null)
    setRemoving(false)
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-panel shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-panel px-5 py-3">
            <div>
              <div className="font-semibold">Παραπεμπτικά προς λήξη (30 μέρες)</div>
              <div className="text-xs text-muted">Αναλυτική λίστα για ενέργειες/επικοινωνία.</div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-border/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Toolbar */}
          {!loading && items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-5 py-2">
              <button
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors"
              >
                {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allSelected ? "Αποεπιλογή όλων" : "Επιλογή όλων"}
              </button>
              {someSelected && (
                <button
                  onClick={() => setConfirmIds([...selected])}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Αφαίρεση ({selected.size})
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="max-h-[65vh] overflow-y-auto">
            {err && (
              <div className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div>
            )}
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">
                Δεν υπάρχουν παραπεμπτικά προς λήξη εντός 30 ημερών.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 border-b border-border bg-panel">
                  <tr>
                    <th className="w-8 p-3" />
                    <th className="p-3">Μαθητής</th>
                    <th className="p-3">Τίτλος</th>
                    <th className="p-3">Κωδικός</th>
                    <th className="p-3">Έναρξη</th>
                    <th className="p-3">Λήξη</th>
                    <th className="w-20 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <Fragment key={r.id}>
                      <tr
                        className={[
                          "border-b border-border/50 transition-colors",
                          selected.has(r.id) ? "bg-primary/5" : "hover:bg-bg/60",
                        ].join(" ")}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleOne(r.id)}
                            className="h-4 w-4 cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="p-3 font-medium">{r.student_name}</td>
                        <td className="p-3">{r.title}</td>
                        <td className="p-3 font-mono text-xs">{r.code || "-"}</td>
                        <td className="p-3">{fmtDate(r.start_date)}</td>
                        <td className="p-3">{fmtDate(r.end_date)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() =>
                                editingNoteId === r.id
                                  ? (setEditingNoteId(null), setNoteText(""))
                                  : startEditNote(r)
                              }
                              title={r.notes ? "Επεξεργασία σημείωσης" : "Προσθήκη σημείωσης"}
                              className={[
                                "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
                                r.notes
                                  ? "border-primary/30 text-primary hover:bg-primary/10"
                                  : editingNoteId === r.id
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border/30 text-muted hover:border-border/60 hover:text-text",
                              ].join(" ")}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmIds([r.id])}
                              title="Αφαίρεση (→ completed)"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Note preview row */}
                      {editingNoteId !== r.id && r.notes && (
                        <tr className="border-b border-border/30">
                          <td />
                          <td colSpan={6} className="pb-2 pt-0 px-3">
                            <div className="rounded-lg bg-bg/50 px-2.5 py-1.5 text-xs text-muted">
                              <span className="font-medium">Σημ.:</span> {r.notes}
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Note editing row */}
                      {editingNoteId === r.id && (
                        <tr className="border-b border-border/50 bg-bg/30">
                          <td />
                          <td colSpan={6} className="px-3 pb-3 pt-2">
                            <div className="space-y-1.5">
                              <textarea
                                autoFocus
                                className="input h-20 resize-none py-1.5 text-xs"
                                placeholder="Σημείωση / σχόλιο..."
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button
                                  className="btn btn-primary flex items-center gap-1.5 text-xs"
                                  disabled={savingNoteId === r.id}
                                  onClick={() => saveNote(r.id)}
                                >
                                  {savingNoteId === r.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Check className="h-3 w-3" />}
                                  Αποθήκευση
                                </button>
                                <button
                                  className="btn text-xs"
                                  disabled={savingNoteId === r.id}
                                  onClick={() => { setEditingNoteId(null); setNoteText("") }}
                                >
                                  Ακύρωση
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmIds !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-5 shadow-xl">
            <div className="font-semibold">Επιβεβαίωση αφαίρεσης</div>
            <div className="mt-2 text-sm text-muted">
              {confirmIds.length === 1
                ? "Αφαίρεση 1 παραπεμπτικού από τη λίστα; Το status θα αλλάξει σε completed."
                : `Αφαίρεση ${confirmIds.length} παραπεμπτικών; Το status θα αλλάξει σε completed.`}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn text-xs" disabled={removing} onClick={() => setConfirmIds(null)}>
                Ακύρωση
              </button>
              <button className="btn btn-danger text-xs" disabled={removing} onClick={doRemove}>
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Αφαίρεση"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
