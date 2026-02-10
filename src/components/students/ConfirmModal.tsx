import React from 'react'

type ConfirmModalProps = {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Διαγραφή',
  cancelText = 'Ακύρωση',
  danger = true,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center overflow-auto p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-panel p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-semibold">{title}</div>
            <button className="btn" onClick={onClose} disabled={busy}>
              Κλείσιμο
            </button>
          </div>

          <div className="mt-3 whitespace-pre-line text-sm text-muted">
            {message}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button className="btn" onClick={onClose} disabled={busy}>
              {cancelText}
            </button>
            <button
              className={danger ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? '…' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
