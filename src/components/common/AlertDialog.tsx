import { Info, X } from 'lucide-react'

interface AlertDialogProps {
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

export function AlertDialog({ message, confirmLabel = 'OK', onConfirm }: AlertDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onConfirm}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <button
          type="button"
          onClick={onConfirm}
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
          <Info className="h-6 w-6 text-indigo-500" />
        </div>

        <p className="mt-4 text-sm font-medium text-gray-900">{message}</p>

        <div className="mt-5">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
