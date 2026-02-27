import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";

type ColumnItem<K extends string> = { key: K; label: string };

export default function StudentsColumnsDropdown<K extends string>({
  columns,
  isColVisible,
  toggleCol,
  setAllCols,
  resetCols,
}: {
  columns: ColumnItem<K>[];
  isColVisible: (k: K) => boolean;
  toggleCol: (k: K) => void;
  setAllCols: () => void;
  resetCols: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  // outside click
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // positioning
  useEffect(() => {
    if (!open) return;

    const place = () => {
      const btn = btnRef.current;
      const panel = panelRef.current;
      if (!btn || !panel) return;

      const btnRect = btn.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || 288; // w-72 fallback
      const panelHeight = panel.offsetHeight || 200;

      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = btnRect.left;
      if (left + panelWidth + margin > vw) left = btnRect.right - panelWidth;
      left = Math.max(margin, Math.min(left, vw - panelWidth - margin));

      const belowTop = btnRect.bottom + 8;
      const aboveTop = btnRect.top - 8 - panelHeight;

      let top = belowTop;
      if (belowTop + panelHeight + margin > vh && aboveTop >= margin) top = aboveTop;
      top = Math.max(margin, Math.min(top, vh - panelHeight - margin));

      setPos({ left, top });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div className="relative flex items-center gap-2">
      <button
        ref={btnRef}
        type="button"
        className="h-9 rounded-md px-3 text-sm border border-border/15 text-text hover:bg-panel inline-flex items-center gap-2 cursor-pointer"
        onClick={() => setOpen((s) => !s)}
      >
        <Eye className="h-4 w-4" />
        Στήλες
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-50 w-72 rounded-xl border border-border/15 bg-bg/95 backdrop-blur shadow-2xl shadow-black/20 p-3"
          style={{ left: pos.left, top: pos.top }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-sm font-semibold text-text">Στήλες πίνακα</div>
            <button
              className="text-xs px-2 py-1 rounded-md border border-border/15 hover:bg-panel2/30 opacity-90"
              onClick={() => setOpen(false)}
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted">Επιλογή πεδίων</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md border border-border/15 hover:bg-panel2/30"
                onClick={setAllCols}
              >
                όλα
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md border border-border/15 hover:bg-panel2/30"
                onClick={resetCols}
              >
                reset
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-auto pr-1 space-y-1">
            {columns.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-panel2/45 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={isColVisible(c.key)}
                  onChange={() => toggleCol(c.key)}
                />
                <span className="text-sm text-text">{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}