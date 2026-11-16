import type { ReactNode } from 'react'

// The block name written vertically in a strip at the left edge of a block
// (3Dビュアー, 選択病変 形状, 測定, 仮保存一覧), in place of a heading row on top.
export function SideLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-8 shrink-0 items-center justify-center border-r border-blue-100 bg-blue-50 px-1 text-xs font-semibold text-blue-700 [text-orientation:upright] [writing-mode:vertical-rl]">
      <span className="py-3 tracking-widest">{children}</span>
    </div>
  )
}
