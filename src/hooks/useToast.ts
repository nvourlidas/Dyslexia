// src/hooks/useToast.ts
import { useCallback, useState } from "react";

export type ToastVariant = "error" | "success" | "info";

export type Toast = {
  id: string;
  title: string;
  message?: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
};

export function useToast(defaultDurationMs = 4500) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (t: Omit<Toast, "id">, ms?: number) => {
      const id =
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? crypto.randomUUID()
          : String(Date.now());

      setToasts((prev) => [...prev, { id, ...t }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, ms ?? defaultDurationMs);
    },
    [defaultDurationMs],
  );

  const clearToasts = useCallback(() => setToasts([]), []);

  return { toasts, pushToast, dismissToast, clearToasts };
}