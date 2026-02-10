import React from 'react'

type ModalProps = {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}

export default function Modal({
  open,
  title,
  children,
  onClose,
}: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* modal */}
      <div className="absolute inset-0 flex items-start justify-center overflow-auto p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-border bg-panel p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-semibold">{title}</div>
            <button className="btn" onClick={onClose}>
              Κλείσιμο
            </button>
          </div>

          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
