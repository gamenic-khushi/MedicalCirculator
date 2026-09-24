import { useState } from 'react'

const STORAGE_PREFIX = 'guidance-dismissed:'

// A blocked/unavailable localStorage (private browsing, disabled storage)
// should never break the app — it just means the hint keeps showing instead
// of remembering it was seen, which is the safe direction to fail in.
function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === '1'
  } catch (error) {
    console.error(error)
    return false
  }
}

function writeDismissed(key: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, '1')
  } catch (error) {
    console.error(error)
  }
}

export function useGuidanceDismissed(key: string) {
  const [isDismissed, setIsDismissed] = useState(() => readDismissed(key))

  function dismiss() {
    setIsDismissed(true)
    writeDismissed(key)
  }

  return { isDismissed, dismiss }
}
