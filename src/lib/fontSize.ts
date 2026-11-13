// The 文字サイズ (font size) setting. Tailwind sizes everything in rem, so
// changing the size of the page's root text scales the whole app together.
// The choice is remembered in this browser (localStorage), so it stays after
// logging out and in again.

export type FontSize = 'large' | 'medium' | 'small'

export const DEFAULT_FONT_SIZE: FontSize = 'medium'

// 中 is the browser's normal 16px, i.e. the app as it looked before the setting.
export const FONT_SIZE_OPTIONS: { value: FontSize; label: string; px: number }[] = [
  { value: 'large', label: '大', px: 18 },
  { value: 'medium', label: '中', px: 16 },
  { value: 'small', label: '小', px: 14 },
]

const STORAGE_KEY = 'font-size'

export function isFontSize(value: unknown): value is FontSize {
  return FONT_SIZE_OPTIONS.some((option) => option.value === value)
}

// A blocked/unavailable localStorage (private browsing, disabled storage) must
// never break the app: the setting then simply does not stick.
export function readFontSize(): FontSize {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isFontSize(stored) ? stored : DEFAULT_FONT_SIZE
  } catch (error) {
    console.error(error)
    return DEFAULT_FONT_SIZE
  }
}

export function applyFontSize(size: FontSize): void {
  const px = FONT_SIZE_OPTIONS.find((option) => option.value === size)?.px ?? 16
  document.documentElement.style.fontSize = `${px}px`
}

const listeners = new Set<() => void>()
let current: FontSize | null = null

export function getFontSize(): FontSize {
  current ??= readFontSize()
  return current
}

export function setFontSize(size: FontSize): void {
  current = size
  applyFontSize(size)
  try {
    window.localStorage.setItem(STORAGE_KEY, size)
  } catch (error) {
    console.error(error)
  }
  listeners.forEach((listener) => listener())
}

export function subscribeFontSize(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Apply the remembered size once, before the first screen is drawn. */
export function initFontSize(): void {
  applyFontSize(getFontSize())
}
