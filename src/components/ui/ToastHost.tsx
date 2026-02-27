
export type Toast = {
  id: string;
  title: string;
  message?: string;
  variant?: "error" | "success" | "info";
  actionLabel?: string;
  onAction?: () => void;
};

export default function ToastHost({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-100 flex w-120 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "rounded-xl border border-border/15 bg-panel/95 backdrop-blur shadow-2xl shadow-black/20",
            "px-3 py-3",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className={[
                  "text-sm font-semibold",
                  t.variant === "error" ? "text-danger" : "",
                  t.variant === "success" ? "text-success" : "",
                ].join(" ")}
              >
                {t.title}
              </div>

              {t.message && (
                <div className="mt-1 text-xs text-muted">{t.message}</div>
              )}

              {t.actionLabel && t.onAction && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => t.onAction?.()}
                    className="h-8 rounded-md px-3 text-xs bg-primary hover:bg-primary/90 text-white"
                  >
                    {t.actionLabel}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-md border border-border/15 px-2 py-1 text-xs hover:bg-panel2/30"
              aria-label="Κλείσιμο"
              title="Κλείσιμο"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}