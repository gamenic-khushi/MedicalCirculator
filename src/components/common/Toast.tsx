import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastProps {
  message: string
  variant?: 'success' | 'error'
}

export function Toast({ message, variant = 'success' }: ToastProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
      <div className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 shadow-lg">
        {variant === 'error' ? (
          <XCircle className="h-5 w-5 text-red-500" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
        <span className="text-sm font-medium text-gray-900">{message}</span>
      </div>
    </div>
  )
}
