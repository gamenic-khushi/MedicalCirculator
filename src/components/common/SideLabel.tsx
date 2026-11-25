import type { ReactNode } from 'react'

import { useLanguage } from '@/hooks/useLanguage'

// The block name as an index tab (Aki's wireframe, 2026/11/24): a blue tab sized to its
// name, written vertically, hanging from the top of the block's left edge
// (3Dビュアー, 計測値・形状, 測定, 解析結果一覧), in place of a heading row on top. The rest
// of the left edge stays plain, like the sheet. Japanese stands upright, one character
// under the other; English is turned on its side and read from top to bottom.
export function SideLabel({ children, below }: { children: ReactNode; below?: ReactNode }) {
  const { language } = useLanguage()
  return (
    <div className="w-8 shrink-0">
      <div
        className={`flex w-full items-center justify-center rounded-br-xl border-b border-r border-blue-300 bg-blue-200 px-1 text-xs font-semibold text-blue-900 [writing-mode:vertical-rl] ${
          language === 'en' ? '[text-orientation:mixed]' : '[text-orientation:upright]'
        }`}
      >
        <span className={`py-3 ${language === 'en' ? 'whitespace-nowrap tracking-wide' : 'tracking-widest'}`}>
          {children}
        </span>
      </div>
      {/* The empty strip under the tab: room for an icon button (the PDF download). */}
      {below && <div className="mt-2 flex justify-center">{below}</div>}
    </div>
  )
}
