import { useSyncExternalStore } from 'react'

import { getFontSize, setFontSize, subscribeFontSize } from '@/lib/fontSize'

export function useFontSize() {
  const fontSize = useSyncExternalStore(subscribeFontSize, getFontSize)
  return { fontSize, setFontSize }
}
