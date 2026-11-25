import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { createPortal } from 'react-dom'

import { fade, pop } from '@/lib/motion'

interface ToastProps {
  message: string
  variant?: 'success' | 'error' | 'info'
  // When set, the toast shows a close button and no longer blocks the page
  // behind it, since it stays visible until the user dismisses it.
  onDismiss?: () => void
}

// Animates in on its own; to animate out too, render it inside <AnimatePresence>.
export function Toast({ message, variant = 'success', onDismiss }: ToastProps) {
  // Into <body>, outside the page: a page rising in as it opens never moves it.
  return createPortal(
    <motion.div
      {...fade}
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        // A hint (info) doesn't block the page, since the user is expected to keep working.
        onDismiss || variant === 'info' ? 'pointer-events-none' : 'bg-black/10'
      }`}
    >
      <motion.div
        {...pop}
        className={`flex max-w-[90vw] items-center gap-2 rounded-xl bg-white px-5 py-3 shadow-lg ${
          // A hint (info) lets clicks through too: the user keeps working on the model under it.
          variant === 'info' ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        {variant === 'error' ? (
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        ) : variant === 'info' ? (
          <Info className="h-5 w-5 shrink-0 text-indigo-500" />
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
      </motion.div>
    </motion.div>,
    document.body,
  )
}
