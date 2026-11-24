import type { ReactNode } from 'react'

// The block name as an index tab (Aki's wireframe, 2026/11/24): a blue tab sized to its
// name, written vertically, hanging from the top of the block's left edge
// (3Dビュアー, 選択病変 形状, 測定, 保存一覧), in place of a heading row on top. The rest
// of the left edge stays plain, like the sheet.
export function SideLabel({ children }: { children: ReactNode }) {
  return (
    <div className="w-8 shrink-0">
      <div className="flex w-full items-center justify-center rounded-br-xl border-b border-r border-blue-300 bg-blue-200 px-1 text-xs font-semibold text-blue-900 [text-orientation:upright] [writing-mode:vertical-rl]">
        <span className="py-3 tracking-widest">{children}</span>
      </div>
    </div>
  )
}
