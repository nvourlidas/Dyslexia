import React, { useRef, useState } from "react"
import { GripVertical, Plus, Minus, X, Columns2 } from "lucide-react"
import type { DashboardLayout, WidgetId } from "@/hooks/useDashboardLayout"

export const WIDGET_LABELS: Record<WidgetId, string> = {
  kpi_students: "Μαθητές για γιατρό",
  kpi_teachers: "Παραπεμπτικά προς λήξη",
  kpi_sessions: "Συνεδρίες Σήμερα",
  kpi_expiring: "Γνωματεύσεις προς αποστολή",
  kpi_no_code: "Παραπεμπτικό χωρίς κωδικό γονέα",
  notepad: "Σημειωματάριο",
  pending: "Εκκρεμότητες",
  execution_referrals: "Παραπεμπτικά Εκτέλεσης",
}

const ALL_WIDGETS: Array<{ id: WidgetId; label: string }> = Object.entries(WIDGET_LABELS).map(
  ([id, label]) => ({ id: id as WidgetId, label }),
)

function gridClass(count: number): string {
  if (count === 1) return "grid-cols-1"
  if (count === 2) return "grid-cols-1 sm:grid-cols-2"
  if (count === 3) return "grid-cols-1 sm:grid-cols-3"
  return "grid-cols-2 sm:grid-cols-4"
}

export type EditOps = {
  moveRow: (from: number, to: number) => void
  setWidget: (rowId: string, cellId: string, widgetId: WidgetId | null) => void
  swapCells: (srcRowId: string, srcCellIdx: number, dstRowId: string, dstCellIdx: number) => void
  addColumn: (rowId: string) => void
  removeColumn: (rowId: string) => void
  addRow: () => void
  removeRow: (rowId: string) => void
}

type CellPos = { rowId: string; cellIdx: number }

type Props = {
  layout: DashboardLayout
  isEditing: boolean
  editOps: EditOps
  renderWidget: (widgetId: WidgetId | null) => React.ReactNode
}

export default function DashboardGrid({ layout, isEditing, editOps, renderWidget }: Props) {
  // ── Row drag state ──
  const rowDragIdxRef = useRef<number>(-1)
  const [rowDropTarget, setRowDropTarget] = useState<number | null>(null)

  // ── Cell drag state ──
  const cellDragSrcRef = useRef<CellPos | null>(null)
  const [cellDropTarget, setCellDropTarget] = useState<CellPos | null>(null)

  // ── Row drag handlers ──
  function onRowDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (rowDragIdxRef.current >= 0 && rowDragIdxRef.current !== idx) setRowDropTarget(idx)
  }
  function onRowDrop(toIdx: number) {
    if (rowDragIdxRef.current >= 0 && rowDragIdxRef.current !== toIdx) {
      editOps.moveRow(rowDragIdxRef.current, toIdx)
    }
    rowDragIdxRef.current = -1
    setRowDropTarget(null)
  }
  function onRowDragEnd() {
    rowDragIdxRef.current = -1
    setRowDropTarget(null)
  }

  // ── Cell drag handlers ──
  function onCellDragStart(e: React.DragEvent, pos: CellPos) {
    e.stopPropagation()
    cellDragSrcRef.current = pos
    e.dataTransfer.effectAllowed = "move"
  }
  function onCellDragOver(e: React.DragEvent, pos: CellPos) {
    e.preventDefault()
    e.stopPropagation()
    const cur = cellDropTarget
    if (!cur || cur.rowId !== pos.rowId || cur.cellIdx !== pos.cellIdx) {
      setCellDropTarget(pos)
    }
  }
  function onCellDrop(e: React.DragEvent, pos: CellPos) {
    e.stopPropagation()
    const src = cellDragSrcRef.current
    if (src) {
      editOps.swapCells(src.rowId, src.cellIdx, pos.rowId, pos.cellIdx)
    }
    cellDragSrcRef.current = null
    setCellDropTarget(null)
  }
  function onCellDragEnd() {
    cellDragSrcRef.current = null
    setCellDropTarget(null)
  }

  /* ── EDIT MODE ── */
  if (isEditing) {
    return (
      <div className="space-y-2">
        {layout.rows.map((row, rowIdx) => (
          <div
            key={row.id}
            onDragOver={(e) => {
              // Only handle row-level dragover (not cell)
              if (cellDragSrcRef.current) return
              onRowDragOver(e, rowIdx)
            }}
            onDrop={() => {
              if (cellDragSrcRef.current) return
              onRowDrop(rowIdx)
            }}
            onDragEnd={onRowDragEnd}
            className={[
              "flex items-center gap-2 rounded-2xl border-2 border-dashed p-2 transition-colors select-none",
              rowDropTarget === rowIdx && !cellDragSrcRef.current
                ? "border-accent bg-accent/5"
                : "border-border/30 bg-panel/50",
            ].join(" ")}
          >
            {/* Row drag handle — initiates row reorder */}
            <div
              className="cursor-grab shrink-0 text-muted active:cursor-grabbing"
              draggable
              onDragStart={(e) => {
                e.stopPropagation()
                // Fake a row drag using the grip
                rowDragIdxRef.current = rowIdx
                e.dataTransfer.effectAllowed = "move"
              }}
            >
              <GripVertical className="h-5 w-5" />
            </div>

            {/* Cells — draggable left/right */}
            <div className="flex-1 flex flex-wrap gap-2">
              {row.cells.map((cell, cellIdx) => {
                const pos: CellPos = { rowId: row.id, cellIdx }
                const isTarget =
                  cellDropTarget?.rowId === row.id && cellDropTarget?.cellIdx === cellIdx
                return (
                  <div
                    key={cell.id}
                    draggable
                    onDragStart={(e) => onCellDragStart(e, pos)}
                    onDragOver={(e) => onCellDragOver(e, pos)}
                    onDrop={(e) => onCellDrop(e, pos)}
                    onDragEnd={onCellDragEnd}
                    className={[
                      "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-4 text-center min-w-[130px] flex-1 cursor-grab transition-colors",
                      isTarget
                        ? "border-accent bg-accent/10"
                        : "border-border/40 bg-bg",
                    ].join(" ")}
                  >
                    <span className="text-xs text-muted font-medium">
                      {cell.widgetId ? WIDGET_LABELS[cell.widgetId] : "— Κενό —"}
                    </span>
                    <select
                      className="input h-8 w-full max-w-[180px] text-xs cursor-pointer"
                      value={cell.widgetId ?? ""}
                      onChange={(e) =>
                        editOps.setWidget(row.id, cell.id, (e.target.value as WidgetId) || null)
                      }
                      onMouseDown={(e) => e.stopPropagation()}
                      onDragStart={(e) => e.stopPropagation()}
                    >
                      <option value="">— Κενό —</option>
                      {ALL_WIDGETS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>

            {/* Row controls */}
            <div className="flex shrink-0 flex-col gap-1">
              {row.cells.length < 4 && (
                <button
                  onClick={() => editOps.addColumn(row.id)}
                  title="Προσθήκη στήλης"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/30 bg-bg text-muted hover:text-text transition-colors"
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
              )}
              {row.cells.length > 1 && (
                <button
                  onClick={() => editOps.removeColumn(row.id)}
                  title="Αφαίρεση τελευταίας στήλης"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/30 bg-bg text-muted hover:text-text transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => editOps.removeRow(row.id)}
                title="Διαγραφή γραμμής"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 bg-bg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Add row */}
        <button
          onClick={editOps.addRow}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/30 py-3 text-sm text-muted hover:border-accent hover:text-accent transition-colors"
        >
          <Plus className="h-4 w-4" />
          Προσθήκη γραμμής
        </button>
      </div>
    )
  }

  /* ── NORMAL MODE ── */
  return (
    <div className="space-y-3">
      {layout.rows.map((row) => {
        if (row.cells.every((c) => c.widgetId === null)) return null
        return (
          <div key={row.id} className={`grid gap-3 ${gridClass(row.cells.length)}`}>
            {row.cells.map((cell) => {
              const content = renderWidget(cell.widgetId)
              if (content === null) return null
              return <div key={cell.id}>{content}</div>
            })}
          </div>
        )
      })}
    </div>
  )
}
