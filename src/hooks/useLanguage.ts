import { useSyncExternalStore } from 'react'

import { DEFAULT_LANGUAGE, getLanguage, setLanguage, subscribeLanguage } from '@/lib/language'

export function useLanguage() {
  // Rendered on a server (a test, say) there is no browser setting: Japanese.
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => DEFAULT_LANGUAGE)
  return { language, setLanguage }
}
