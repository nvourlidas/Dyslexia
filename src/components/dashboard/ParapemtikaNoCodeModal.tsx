import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { fmtDate } from "@/lib/dateUtils"
import { X, Loader2, MessageSquare, Check, Trash2, CheckSquare, Square, Hash } from "lucide-react"

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
type EditMode = { id: string; type: "note" | "code" }

type Props = {
  open: boolean
  tenantId: string
  onClose: () => void
  onCountChange: (n: number) => void
}

export default function ParapemtikaNoCodeModal({ open, tenantId, onClose, onCountChange }: Props) {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null)
  const [removing, setRemoving] = useState(false)

  const [editMode, setEditMode] = useState<EditMode | null>(null)
  const [editText, setEditText] = useState("")
  const [saving, setSaving] = useState(false)

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
    const { data, error } = await supabase
      .from("parapemtiko")
      .select("id, title, code, code_diagnosis, end_date, notes, student:students(name, lastname, amka)")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .or("code.is.null,code.eq.")
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
    onCountChange(rows.length)
    setSelected(new Set())
    setEditMode(null)
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

  const allIds = items.map((i) => i.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = allIds.some((id) => selected.has(id))

  function toggleAll() { setSelected(allSelected ? new Set() : new Set(allIds)) }
  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function startEdit(item: Row, type: "note" | "code") {
    setEditMode({ id: item.id, type })
    setEditText(type === "note" ? (item.notes ?? "") : (item.code ?? ""))
  }

  function cancelEdit() { setEditMode(null); setEditText("") }

  async function saveEdit() {
    if (!editMode) return
    setSaving(true)

    if (editMode.type === "note") {
      const { error } = await supabase
        .from("parapemtiko")
        .update({ notes: editText || null })
        .eq("id", editMode.id)
      if (!error) {
        setItems((prev) => prev.map((i) => i.id === editMode.id ? { ...i, notes: editText || null } : i))
        cancelEdit()
      }
    } else {
      // Save code — item leaves the "no code" list
      const { error } = await supabase
        .from("parapemtiko")
        .update({ code: editText.trim() || null })
        .eq("id", editMode.id)
      if (!error && editText.trim()) {
        setItems((prev) => {
          const next = prev.filter((i) => i.id !== editMode.id)
          onCountChange(next.length)
          return next
        })
        setSelected((prev) => { const n = new Set(prev); n.delete(editMode.id); return n })
        cancelEdit()
      }
    }
    setSaving(false)
  }

  async function doRemove() {
    if (!confirmIds?.length) return
    setRemoving(true)
    await supabase.from("parapemtiko").update({ status: "completed" }).in("id", confirmIds)
    const removed = new Set(confirmIds)
    setItems((prev) => {
      const next = prev.filter((i) => !removed.has(i.id))
      onCountChange(next.length)
      return next
    })
    setSelected((prev) => { const n = new Set(prev); removed.forEach((id) => n.delete(id)); return n })
    if (editMode && removed.has(editMode.id)) cancelEdit()
    setConfirmIds(null)
    setRemoving(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-panel shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-panel px-5 py-3">
            <div>
              <div className="font-semibold">Παραπεμπτικό χωρίς κωδικό γονέα</div>
              <div className="text-xs text-muted">{items.length} παραπεμπτικά χωρίς κωδικό</div>
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
                <div className="ml-auto">
                  <button
                    onClick={() => setConfirmIds([...selected])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Αφαίρεση ({selected.size})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto p-4">
            {err && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div>
            )}
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">
                Όλα τα παραπεμπτικά έχουν κωδικό γονέα.
              </div>
            ) : (
              <div className="space-y-5">
                {monthGroups.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</span>
                      <span className="text-xs text-muted">({group.items.length})</span>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const isEditingNote = editMode?.id === item.id && editMode.type === "note"
                        const isEditingCode = editMode?.id === item.id && editMode.type === "code"
                        const isExpanded = isEditingNote || isEditingCode

                        return (
                          <div
                            key={item.id}
                            className={[
                              "rounded-xl border px-3 py-2.5 transition-colors",
                              selected.has(item.id) ? "border-primary/30 bg-primary/5" : "border-border bg-bg",
                            ].join(" ")}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selected.has(item.id)}
                                onChange={() => toggleOne(item.id)}
                                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="text-sm font-medium">{item.student_name}</div>
                                <div className="text-xs font-medium text-muted">{item.title}</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                                  {item.amka && <span>ΑΜΚΑ: <span className="font-mono">{item.amka}</span></span>}
                                  {item.code_diagnosis && <span>Κωδ. Διάγν.: <span className="font-mono">{item.code_diagnosis}</span></span>}
                                  {item.end_date && <span>Λήξη: {fmtDate(item.end_date)}</span>}
                                </div>
                                {!isExpanded && item.notes && (
                                  <div className="mt-1 rounded-lg bg-panel/60 px-2.5 py-1.5 text-xs text-muted">
                                    <span className="font-medium">Σημείωση:</span> {item.notes}
                                  </div>
                                )}
                              </div>

                              {/* Action buttons — hidden when expanded */}
                              {!isExpanded && (
                                <div className="mt-0.5 flex shrink-0 gap-1.5">
                                  <button
                                    onClick={() => startEdit(item, "code")}
                                    title="Συμπλήρωση κωδικού"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/30 text-muted hover:border-primary/40 hover:text-primary transition-colors"
                                  >
                                    <Hash className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => startEdit(item, "note")}
                                    title={item.notes ? "Επεξεργασία σημείωσης" : "Προσθήκη σημείωσης"}
                                    className={[
                                      "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
                                      item.notes
                                        ? "border-primary/30 text-primary hover:bg-primary/10"
                                        : "border-border/30 text-muted hover:border-border/60 hover:text-text",
                                    ].join(" ")}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmIds([item.id])}
                                    title="Αφαίρεση (→ completed)"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Expanded edit area */}
                            {isExpanded && (
                              <div className="mt-3 space-y-2 border-t border-border/20 pt-3">
                                {isEditingCode ? (
                                  <>
                                    <label className="block text-xs text-muted">Κωδικός γονέα</label>
                                    <input
                                      autoFocus
                                      className="input text-sm"
                                      placeholder="π.χ. ΑΒ1234"
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <label className="block text-xs text-muted">Σημείωση</label>
                                    <textarea
                                      autoFocus
                                      className="input h-20 resize-none py-1.5 text-xs"
                                      placeholder="Σημείωση / σχόλιο..."
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                    />
                                  </>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    className="btn btn-primary flex items-center gap-1.5 text-xs"
                                    disabled={saving || (isEditingCode && !editText.trim())}
                                    onClick={saveEdit}
                                  >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Αποθήκευση
                                  </button>
                                  <button className="btn text-xs" disabled={saving} onClick={cancelEdit}>
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
      </div>

      {/* Confirmation dialog */}
      {confirmIds !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-5 shadow-xl">
            <div className="font-semibold">Επιβεβαίωση αφαίρεσης</div>
            <div className="mt-2 text-sm text-muted">
              {confirmIds.length === 1
                ? "Αφαίρεση 1 παραπεμπτικού; Το status θα αλλάξει σε completed."
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
