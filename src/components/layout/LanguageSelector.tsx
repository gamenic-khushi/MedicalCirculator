import { useLanguage } from '@/hooks/useLanguage'
import { LANGUAGE_OPTIONS } from '@/lib/language'

interface LanguageSelectorProps {
  /** `light` for the white dropdown, `dark` for the blue mobile drawer. */
  tone: 'light' | 'dark'
}

// 言語: 日本語 / English, shown in the user menu to everyone, next to 文字サイズ.
export function LanguageSelector({ tone }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage()
  const isDark = tone === 'dark'

  return (
    <div className="px-3 py-2">
      <p className={`pb-1.5 text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-400'}`}>
        言語
      </p>
      <div role="radiogroup" aria-label="言語" className="flex gap-1">
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = option.value === language
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLanguage(option.value)}
              className={`min-w-0 flex-1 whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium transition ${
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
