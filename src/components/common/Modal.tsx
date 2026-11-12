import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { fade, pop } from '@/lib/motion'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  panelStyle?: CSSProperties
}

// Animates in on its own; to animate out too, render it inside <AnimatePresence>.
export function Modal({ title, onClose, children, panelStyle }: ModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Into <body>, outside the page: a page rising in as it opens never moves it.
  return createPortal(
    <motion.div
      {...fade}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <motion.div
        {...pop}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={panelStyle}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between bg-indigo-50/40 px-8 py-5">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-8 py-6">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
