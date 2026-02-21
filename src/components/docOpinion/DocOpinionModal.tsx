// src/components/doc-opinion/DocOpinionModal.tsx
import React, { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  lockClose?: boolean;
  maxWidthClass?: string;
};

export default function DocOpinionModal({
  open,
  title,
  children,
  onClose,
  lockClose = false,
  maxWidthClass = "max-w-2xl",
}: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lockClose) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, lockClose, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/60"
        onClick={() => (!lockClose ? onClose() : null)}
      />

      <div className="relative mx-auto mt-10 w-[92%] sm:mt-16">
        <div
          className={[
            "mx-auto rounded-2xl border border-border bg-panel shadow-xl",
            maxWidthClass,
          ].join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-text">{title}</div>
              <div className="text-xs text-muted">Συμπλήρωσε τα στοιχεία</div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() => (!lockClose ? onClose() : null)}
              disabled={lockClose}
              aria-label="Close"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}