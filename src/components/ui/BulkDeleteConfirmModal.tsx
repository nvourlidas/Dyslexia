// src/components/ui/BulkDeleteConfirmModal.tsx
import { useEffect } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  count: number;
  entityLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function BulkDeleteConfirmModal({
  open,
  count,
  entityLabel = "εγγραφές",
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Enter" && !busy) onConfirm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Κλείσιμο"
        className="absolute inset-0 bg-black/60"
        onClick={() => (!busy ? onClose() : null)}
      />

      <div className="relative mx-auto mt-24 w-[92%] max-w-md">
        <div className="rounded-2xl border border-border bg-panel shadow-xl">
          <div className="border-b border-border/60 px-4 py-3 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-400" />
            <div className="text-sm font-semibold text-text">Μαζική Διαγραφή</div>
          </div>

          <div className="px-4 py-4">
            <p className="text-sm text-text">
              Θέλεις σίγουρα να διαγράψεις{" "}
              <span className="font-semibold text-red-400">{count}</span>{" "}
              {entityLabel}; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
            <button className="btn" onClick={onClose} disabled={busy}>
              Ακύρωση
            </button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
              {busy ? "Διαγραφή..." : `Διαγραφή (${count})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
