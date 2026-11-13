import { useFontSize } from '@/hooks/useFontSize'
import { FONT_SIZE_OPTIONS } from '@/lib/fontSize'

interface FontSizeSelectorProps {
  /** `light` for the white dropdown, `dark` for the blue mobile drawer. */
  tone: 'light' | 'dark'
}

// 文字サイズ: 大 / 中 / 小, shown in the user menu to everyone.
export function FontSizeSelector({ tone }: FontSizeSelectorProps) {
  const { fontSize, setFontSize } = useFontSize()
  const isDark = tone === 'dark'

  return (
    <div className="px-3 py-2">
      <p className={`pb-1.5 text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-400'}`}>
        文字サイズ
      </p>
      <div role="radiogroup" aria-label="文字サイズ" className="flex gap-1">
        {FONT_SIZE_OPTIONS.map((option) => {
          const selected = option.value === fontSize
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFontSize(option.value)}
              className={`flex-1 rounded-full px-3 py-1 text-sm font-medium transition ${
                isDark
                  ? selected
                    ? 'bg-white text-blue-600'
                    : 'bg-white/10 text-white hover:bg-white/20'
                  : selected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
