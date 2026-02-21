// src/components/doc-opinion/DocOpinionConfirmModal.tsx
import React, { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function DocOpinionConfirmModal({
  open,
  title,
  message,
  confirmText = "Επιβεβαίωση",
  cancelText = "Ακύρωση",
  danger = false,
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
        aria-label="Close confirm"
        className="absolute inset-0 bg-black/60"
        onClick={() => (!busy ? onClose() : null)}
      />

      <div className="relative mx-auto mt-24 w-[92%] max-w-md">
        <div className="rounded-2xl border border-border bg-panel shadow-xl">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="text-sm font-semibold text-text">{title}</div>
          </div>

          <div className="px-4 py-4">
            <div className="text-sm text-text">{message}</div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
            <button className="btn" onClick={onClose} disabled={busy}>
              {cancelText}
            </button>

            <button
              className={danger ? "btn btn-danger" : "btn btn-primary"}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "…" : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}