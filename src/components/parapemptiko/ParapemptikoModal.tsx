import React, { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** προαιρετικό: όταν είναι true κλειδώνει κλείσιμο (π.χ. saving) */
  lockClose?: boolean;
  /** πλάτος modal */
  maxWidthClass?: string; // e.g. "max-w-2xl"
};

export default function ParapemptikoModal({
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* overlay */}
      <button
        type="button"
        aria-label="Close modal"
        className="fixed inset-0 bg-black/60"
        onClick={() => (!lockClose ? onClose() : null)}
      />

      {/* modal */}
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div
          className={[
            "relative w-full rounded-2xl border border-border bg-panel shadow-xl",
            maxWidthClass,
          ].join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3 bg-panel rounded-t-2xl">
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