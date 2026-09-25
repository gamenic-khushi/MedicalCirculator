import { useState } from 'react'

const STORAGE_PREFIX = 'guidance-dismissed:'

// sessionStorage, not localStorage: a hint dismissed permanently on first
// ever use looked like it was randomly appearing and disappearing to anyone
// testing repeatedly across sessions — it had actually already been
// dismissed for good the first time they tried the feature, weeks or tabs
// earlier, with no way to tell why it was now gone. Scoping it to the tab's
// session instead gives predictable, repeatable behavior: it reliably shows
// once per fresh session until used, and reliably stays quiet for the rest
// of that same session once it has been.
//
// A blocked/unavailable sessionStorage (private browsing, disabled storage)
// should never break the app — it just means the hint keeps showing instead
// of remembering it was seen, which is the safe direction to fail in.
function readDismissed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + key) === '1'
  } catch (error) {
    console.error(error)
    return false
  }
}

function writeDismissed(key: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, '1')
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
