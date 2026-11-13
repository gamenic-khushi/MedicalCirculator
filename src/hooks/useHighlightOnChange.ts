import { useEffect, useRef } from 'react'

// A soft blue glow that comes and goes within a second, to show a value just
// changed. The value itself is exact from the start: only its background glows.
const GLOW = { backgroundColor: '#dbeafe', offset: 0.2 } // blue-100
const GLOW_MS = 1000

/**
 * Put the returned ref on the element showing `value`: it glows whenever the
 * value changes, but not when it first shows, when it is cleared, or while the
 * element has focus (whoever is typing in it knows it changed). `delayMs`
 * staggers values that change together, so they light up one after another.
 */
export function useHighlightOnChange<T extends HTMLElement>(value: string, delayMs = 0) {
  const ref = useRef<T>(null)
  const previous = useRef(value)
  useEffect(() => {
    if (value === previous.current) return
    previous.current = value
    const element = ref.current
    if (!element || value === '' || element === document.activeElement) return
    // From and back to the element's own background (the keyframes left out).
    element.animate?.([GLOW], { duration: GLOW_MS, delay: delayMs, easing: 'ease-out' })
  }, [value, delayMs])
  return ref
}
