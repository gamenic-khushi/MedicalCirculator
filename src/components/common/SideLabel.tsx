import type { ReactNode } from 'react'

import { useLanguage } from '@/hooks/useLanguage'

// The block name as an index tab (Aki: the shape of an index tab, turned vertical, 2026/11/25;
// not a working tab, only the look): a tab with rounded outer corners that sticks out of the
// block's left edge, near the top, and is joined to the block (3Dビュアー, 計測値・形状, 測定,
// 解析結果一覧), in place of a heading row on top. Japanese stands upright, one character
// under the other; English is turned on its side and read from top to bottom.

/**
 * A block with its index tab. The block itself clips its content to its rounded corners, so
 * the tab sits outside it, in a wrapper, over the block's left edge. The wrapper takes the
 * grid's classes (such as the column span); the tab needs about 20 px at the left of it.
 */
export function TabbedBlock({
  label,
  below,
  className = '',
  children,
}: {
  label: string
  // Under the tab, outside the block: room for an icon button (the PDF download).
  below?: ReactNode
  className?: string
  children: ReactNode
}) {
  const { language } = useLanguage()
  return (
    <div data-block className={`relative ${className}`}>
      {/* Its right edge covers the block's border by 1 px, so tab and block are one shape. */}
      <div className="absolute right-[calc(100%-1px)] top-5 z-10 flex w-5 flex-col items-center gap-2">
        <div
          className={`flex w-full items-center justify-center rounded-l-xl border border-r-0 border-blue-300 bg-blue-100 text-xs font-semibold text-blue-900 [writing-mode:vertical-rl] ${
            language === 'en' ? '[text-orientation:mixed]' : '[text-orientation:upright]'
          }`}
        >
          <span className={`py-3 ${language === 'en' ? 'whitespace-nowrap tracking-wide' : 'tracking-widest'}`}>
            {label}
          </span>
        </div>
        {below}
      </div>
      <div className="flex h-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {children}
      </div>
    </div>
  )
}
