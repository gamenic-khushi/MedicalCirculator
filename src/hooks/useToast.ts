import { useRef, useState } from 'react'

const TOAST_DURATION_MS = 1800

export interface ToastState {
  message: string
  variant: 'success' | 'error'
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(message: string, variant: ToastState['variant'] = 'success') {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToast({ message, variant })
    timeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  return { toast, showToast }
}
