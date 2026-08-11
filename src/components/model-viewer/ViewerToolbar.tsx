import { Maximize, Move, RotateCw } from 'lucide-react'

import type { ViewerTool } from './ModelCanvas'

interface ViewerToolbarProps {
  activeTool: ViewerTool
  onToolChange: (tool: ViewerTool) => void
  onToggleFullscreen: () => void
  onReset: () => void
}

export function ViewerToolbar({
  activeTool,
  onToolChange,
  onToggleFullscreen,
  onReset,
}: ViewerToolbarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => {
          onToolChange('rotate')
          onReset()
        }}
        aria-pressed={activeTool === 'rotate'}
        title="リセットして新しい位置に丸を描く"
        className={`rounded-full p-2 transition ${
          activeTool === 'rotate'
            ? 'bg-indigo-50 text-indigo-600'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        <RotateCw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onToolChange('pan')}
        aria-pressed={activeTool === 'pan'}
        className={`rounded-full p-2 transition ${
          activeTool === 'pan' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        <Move className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="rounded-full p-2 text-gray-500 transition hover:bg-gray-50"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  )
}
