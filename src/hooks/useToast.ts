import { useRef, useState } from 'react'

const TOAST_DURATION_MS = 1800

export interface ToastState {
  message: string
  variant: 'success' | 'error'
  persistent: boolean
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // persistent toasts stay until dismissToast is called — for messages the
  // user needs time to read (e.g. the FFR out-of-range error listing ranges).
  function showToast(
    message: string,
    variant: ToastState['variant'] = 'success',
    options: { persistent?: boolean } = {},
  ) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    const persistent = options.persistent ?? false
    setToast({ message, variant, persistent })
    timeoutRef.current = persistent ? null : setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  function dismissToast() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setToast(null)
  }

  return { toast, showToast, dismissToast }
}
