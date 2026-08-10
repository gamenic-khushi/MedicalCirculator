import { Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  message,
  confirmLabel = '消去',
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <Trash2 className="h-6 w-6 text-red-500" />
        </div>

        <p className="mt-4 text-sm font-medium text-gray-900">{message}</p>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-gray-100 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-full bg-red-400 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
