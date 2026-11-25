// The 言語 (display language) setting: 日本語 or English. The app's own text is Japanese;
// English is shown by swapping it for the translation (see domTranslation.ts). The
// choice is remembered in this browser (localStorage), like 文字サイズ, so it stays after
// logging out and in again.

export type Language = 'ja' | 'en'

export const DEFAULT_LANGUAGE: Language = 'ja'

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
]

const STORAGE_KEY = 'language'

export function isLanguage(value: unknown): value is Language {
  return LANGUAGE_OPTIONS.some((option) => option.value === value)
}

// A blocked/unavailable localStorage (private browsing, disabled storage) must never
// break the app: the setting then simply does not stick.
export function readLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch (error) {
    console.error(error)
    return DEFAULT_LANGUAGE
  }
}

const listeners = new Set<() => void>()
let current: Language | null = null

export function getLanguage(): Language {
  current ??= readLanguage()
  return current
}

export function applyLanguage(language: Language): void {
  document.documentElement.lang = language
}

export function setLanguage(language: Language): void {
  current = language
  applyLanguage(language)
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch (error) {
    console.error(error)
  }
  listeners.forEach((listener) => listener())
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Apply the remembered language once, before the first screen is drawn. */
export function initLanguage(): void {
  applyLanguage(getLanguage())
}
