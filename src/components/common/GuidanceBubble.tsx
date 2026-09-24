import { X } from 'lucide-react'
import type { CSSProperties } from 'react'

export type GuidanceAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface GuidanceBubbleProps {
  message: string
  onDismiss: () => void
  anchor: GuidanceAnchor
  style?: CSSProperties
  className?: string
}

// Which edge of the bubble the pointer "nub" sits on, so it reads as
// pointing back at whatever it's anchored next to.
const NUB_POSITION: Record<GuidanceAnchor, string> = {
  'top-left': '-bottom-1 left-4 rotate-45',
  'top-right': '-bottom-1 right-4 rotate-45',
  'bottom-left': '-top-1 left-4 rotate-45',
  'bottom-right': '-top-1 right-4 rotate-45',
}

// A one-off attention-grabbing callout, distinct from the app's usual
// light/white card chrome (Toast, tooltips, panels) since this specifically
// needs to be noticed the first time, unlike everything else that's meant to
// blend in. The nub is a plain rotated square rather than an icon so the
// same component works pointing in any of the four directions without
// needing a different icon per direction.
export function GuidanceBubble({ message, onDismiss, anchor, style, className = '' }: GuidanceBubbleProps) {
  return (
    <div
      role="status"
      style={style}
      // A fixed width, not max-width: Japanese text has no spaces for the
      // browser's shrink-to-fit sizing to break on, so an "auto" width with
      // only a cap collapses to one character per line instead of filling
      // the available space.
      className={`absolute z-10 w-56 rounded-2xl border border-indigo-100 bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm ${className}`}
    >
      <div className={`absolute h-2 w-2 border border-indigo-100 bg-indigo-600 ${NUB_POSITION[anchor]}`} />
      <div className="flex items-start gap-2">
        <p className="leading-snug">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="ヒントを閉じる"
          className="-mr-1 -mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-indigo-100 transition hover:bg-indigo-500 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
