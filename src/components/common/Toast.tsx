import { CheckCircle2, X, XCircle } from 'lucide-react'

interface ToastProps {
  message: string
  variant?: 'success' | 'error'
  // When set, the toast shows a close button and no longer blocks the page
  // behind it, since it stays visible until the user dismisses it.
  onDismiss?: () => void
}

export function Toast({ message, variant = 'success', onDismiss }: ToastProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        onDismiss ? 'pointer-events-none' : 'bg-black/10'
      }`}
    >
      <div className="pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-xl bg-white px-5 py-3 shadow-lg">
        {variant === 'error' ? (
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        )}
        <span className="text-sm font-medium text-gray-900">{message}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="閉じる"
            title="閉じる"
            className="ml-2 shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
