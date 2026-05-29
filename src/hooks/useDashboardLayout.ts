import { useState } from "react"

export type WidgetId =
  | "kpi_students"
  | "kpi_teachers"
  | "kpi_sessions"
  | "kpi_expiring"
  | "kpi_no_code"
  | "notepad"
  | "pending"
  | "execution_referrals"

export interface LayoutCell {
  id: string
  widgetId: WidgetId | null
}

export interface LayoutRow {
  id: string
  cells: LayoutCell[]  // 1–4 cells
}

export interface DashboardLayout {
  rows: LayoutRow[]
}

const STORAGE_KEY = "dashboard_layout_v2"

const DEFAULT_LAYOUT: DashboardLayout = {
  rows: [
    {
      id: "row-kpis",
      cells: [
        { id: "cell-kpi-students", widgetId: "kpi_students" },
        { id: "cell-kpi-teachers", widgetId: "kpi_teachers" },
        { id: "cell-kpi-sessions", widgetId: "kpi_sessions" },
        { id: "cell-kpi-expiring", widgetId: "kpi_expiring" },
      ],
    },
    {
      id: "row-main",
      cells: [
        { id: "cell-notepad", widgetId: "notepad" },
        { id: "cell-pending", widgetId: "pending" },
      ],
    },
    {
      id: "row-execution",
      cells: [
        { id: "cell-execution", widgetId: "execution_referrals" },
      ],
    },
  ],
}

function loadLayout(): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardLayout
      if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) return parsed
    }
  } catch (e) {
    console.warn("[useDashboardLayout] Failed to load layout from localStorage:", e)
  }
  return DEFAULT_LAYOUT
}

function uid() {
  return crypto.randomUUID()
}

export function useDashboardLayout() {
  const [saved, setSaved] = useState<DashboardLayout>(loadLayout)
  const [draft, setDraft] = useState<DashboardLayout | null>(null)

  const isEditing = draft !== null
  const layout = draft ?? saved

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(saved)))
  }

  function cancelEdit() {
    setDraft(null)
  }

  function saveEdit() {
    if (!draft) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setSaved(draft)
    setDraft(null)
  }

  function moveRow(fromIdx: number, toIdx: number) {
    if (!draft || fromIdx === toIdx) return
    const rows = [...draft.rows]
    const [removed] = rows.splice(fromIdx, 1)
    rows.splice(toIdx, 0, removed)
    setDraft({ ...draft, rows })
  }

  function setWidget(rowId: string, cellId: string, widgetId: WidgetId | null) {
    if (!draft) return
    setDraft({
      ...draft,
      rows: draft.rows.map((row) => {
        if (row.id !== rowId) return row
        return {
          ...row,
          cells: row.cells.map((cell) =>
            cell.id === cellId ? { ...cell, widgetId } : cell,
          ),
        }
      }),
    })
  }

  function addColumn(rowId: string) {
    if (!draft) return
    setDraft({
      ...draft,
      rows: draft.rows.map((row) => {
        if (row.id !== rowId || row.cells.length >= 4) return row
        return { ...row, cells: [...row.cells, { id: uid(), widgetId: null }] }
      }),
    })
  }

  function removeColumn(rowId: string) {
    if (!draft) return
    setDraft({
      ...draft,
      rows: draft.rows.map((row) => {
        if (row.id !== rowId || row.cells.length < 2) return row
        return { ...row, cells: row.cells.slice(0, -1) }
      }),
    })
  }

  function addRow() {
    if (!draft) return
    const newRow: LayoutRow = {
      id: uid(),
      cells: [{ id: uid(), widgetId: null }],
    }
    setDraft({ ...draft, rows: [...draft.rows, newRow] })
  }

  function removeRow(rowId: string) {
    if (!draft) return
    setDraft({
      ...draft,
      rows: draft.rows.filter((r) => r.id !== rowId),
    })
  }

  function swapCells(
    srcRowId: string,
    srcCellIdx: number,
    dstRowId: string,
    dstCellIdx: number,
  ) {
    if (!draft) return
    if (srcRowId === dstRowId && srcCellIdx === dstCellIdx) return

    const rows = draft.rows.map((r) => ({
      ...r,
      cells: r.cells.map((c) => ({ ...c })),
    }))
    const srcRow = rows.find((r) => r.id === srcRowId)
    const dstRow = rows.find((r) => r.id === dstRowId)
    if (!srcRow || !dstRow) return

    const srcWidget = srcRow.cells[srcCellIdx]?.widgetId ?? null
    const dstWidget = dstRow.cells[dstCellIdx]?.widgetId ?? null
    if (srcRow.cells[srcCellIdx]) srcRow.cells[srcCellIdx].widgetId = dstWidget
    if (dstRow.cells[dstCellIdx]) dstRow.cells[dstCellIdx].widgetId = srcWidget

    setDraft({ ...draft, rows })
  }

  return {
    layout,
    isEditing,
    startEdit,
    cancelEdit,
    saveEdit,
    moveRow,
    setWidget,
    swapCells,
    addColumn,
    removeColumn,
    addRow,
    removeRow,
  }
}
