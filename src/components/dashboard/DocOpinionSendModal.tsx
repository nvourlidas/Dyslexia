import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { fmtDate } from "@/lib/dateUtils"
import { X, Loader2, Trash2, Download, CheckSquare, Square, SlidersHorizontal } from "lucide-react"

type ColKey = "amka" | "code_diagnosis" | "start_date" | "end_date"
const COL_LABELS: Record<ColKey, string> = {
  amka: "ΑΜΚΑ",
  code_diagnosis: "Κωδ. Διάγν.",
  start_date: "Έναρξη",
  end_date: "Λήξη",
}
const ALL_COLS: ColKey[] = ["amka", "code_diagnosis", "start_date", "end_date"]
const DEFAULT_COLS = new Set<ColKey>(["amka", "code_diagnosis", "end_date"])
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

const GREEK_MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
]

type DocOpinionRow = {
  id: string
  student_id: string
  start_date: string | null
  end_date: string | null
  notes: string | null
  student_name: string
  amka: string | null
  code_diagnosis: string | null
}

type MonthGroup = {
  key: string
  label: string
  items: DocOpinionRow[]
}

type Props = {
  open: boolean
  tenantId: string
  onClose: () => void
  onCountChange: (n: number) => void
}

export default function DocOpinionSendModal({ open, tenantId, onClose, onCountChange }: Props) {
  const [items, setItems] = useState<DocOpinionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null)
  const [removing, setRemoving] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS))
  const [colMenuOpen, setColMenuOpen] = useState(false)

  function toggleCol(col: ColKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })
  }

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

    const today = new Date()
    const in4Months = new Date(today.getFullYear(), today.getMonth() + 4, today.getDate())
    const todayStr = today.toISOString().slice(0, 10)
    const in2MonthsStr = in4Months.toISOString().slice(0, 10)

    const { data: doData, error: doErr } = await supabase
      .from("doc_opinion")
      .select("id, student_id, start_date, end_date, notes, student:students(name, lastname, amka), parapemptika:parapemtiko(code_diagnosis)")
      .eq("status", "pending")
      .not("end_date", "is", null)
      .gte("end_date", todayStr)
      .lte("end_date", in2MonthsStr)
      .order("end_date", { ascending: true })

    if (doErr) {
      setErr(doErr.message)
      setLoading(false)
      return
    }

    const rows: DocOpinionRow[] = (doData ?? []).map((d: any) => ({
      id: d.id,
      student_id: d.student_id,
      start_date: d.start_date ?? null,
      end_date: d.end_date ?? null,
      notes: d.notes ?? null,
      amka: d.student?.amka ?? null,
      student_name: d.student ? `${d.student.name} ${d.student.lastname}`.trim() : "(Άγνωστος)",
      code_diagnosis: (d.parapemptika ?? []).map((p: any) => p.code_diagnosis).filter(Boolean).join(", ") || null,
    }))

    setItems(rows)
    onCountChange(rows.length)
    setSelected(new Set())
    setLoading(false)
  }

  // Always show current month + next month
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const today = new Date()
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      return {
        key: `${y}-${m}`,
        label: `${GREEK_MONTHS[m]} ${y}`,
        items: items.filter((item) => {
          if (!item.end_date) return false
          const ed = new Date(item.end_date)
          return ed.getFullYear() === y && ed.getMonth() === m
        }),
      }
    })
  }, [items])

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
    await supabase.from("doc_opinion").update({ status: "completed" }).in("id", confirmIds)
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
    setConfirmIds(null)
    setRemoving(false)
  }

  function exportExcel() {
    const toExport = items.filter((i) => selected.has(i.id))
    if (toExport.length === 0) return
    const rows = toExport.map((i) => ({
      "Μαθητής": i.student_name,
      "ΑΜΚΑ": i.amka ?? "",
      "Κωδ. Διάγνωσης": i.code_diagnosis ?? "",
      "Ημ. Έναρξης": i.start_date ?? "",
      "Ημ. Λήξης": i.end_date ?? "",
      "Σημειώσεις": i.notes ?? "",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Γνωματεύσεις")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `gnwmateuseis_apostoli_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-panel shadow-xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-panel px-5 py-3">
            <div>
              <div className="font-semibold">Γνωματεύσεις προς αποστολή</div>
              <div className="text-xs text-muted">{items.length} γνωματεύσεις λήγουν εντός 4 μηνών</div>
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
              <div className="ml-auto flex items-center gap-2">
                {someSelected && (
                  <>
                    <button
                      onClick={() => setConfirmIds([...selected])}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Αφαίρεση ({selected.size})
                    </button>
                    <button
                      onClick={exportExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1 text-xs hover:border-border/60 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Export Excel ({selected.size})
                    </button>
                  </>
                )}
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
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] rounded-xl border border-border bg-panel p-1.5 shadow-xl">
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
              </div>
            </div>
          )}

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {err && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div>
            )}
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : (
              <div className="space-y-4">
                {monthGroups.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {group.label}
                      </span>
                      <span className="text-xs text-muted">
                        {group.items.length === 0 ? "— κανένα" : `(${group.items.length})`}
                      </span>
                    </div>
                    {group.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/40 px-3 py-2 text-xs text-muted italic">
                        Δεν υπάρχουν γνωματεύσεις για αυτόν τον μήνα.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className={[
                              "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                              selected.has(item.id)
                                ? "border-primary/30 bg-primary/5"
                                : "border-border bg-bg",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(item.id)}
                              onChange={() => toggleOne(item.id)}
                              className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="truncate text-sm font-medium">{item.student_name}</div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                                {visibleCols.has("amka") && item.amka && <span>ΑΜΚΑ: <span className="font-mono">{item.amka}</span></span>}
                                {visibleCols.has("code_diagnosis") && item.code_diagnosis && <span>Κωδ. Διάγν.: <span className="font-mono">{item.code_diagnosis}</span></span>}
                                {visibleCols.has("start_date") && item.start_date && <span>Έναρξη: {fmtDate(item.start_date)}</span>}
                                {visibleCols.has("end_date") && <span>Λήξη: {fmtDate(item.end_date)}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => setConfirmIds([item.id])}
                              title="Αφαίρεση (→ completed)"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
                ? "Αφαίρεση 1 γνωμάτευσης από τη λίστα; Το status θα αλλάξει σε completed."
                : `Αφαίρεση ${confirmIds.length} γνωματεύσεων; Το status θα αλλάξει σε completed.`}
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
