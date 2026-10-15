import { Maximize, Move, RefreshCw, Rotate3d, Scissors } from 'lucide-react'
import { useEffect } from 'react'

import { GuidanceBubble } from '@/components/common/GuidanceBubble'
import { useGuidanceDismissed } from '@/hooks/useGuidanceDismissed'

import type { ViewerTool } from './ModelCanvas'

interface ViewerToolbarProps {
  activeTool: ViewerTool
  // Whether dragging currently moves the model rather than turning it. Passed
  // in because while slicing, activeTool is 'slice' and can't say which.
  isPanning: boolean
  onToolChange: (tool: ViewerTool) => void
  onToggleFullscreen: () => void
  onReset: () => void
  // Slicing is only wired up on pages that pass showSlice (currently just the
  // lesion-measurement viewer) — omit it elsewhere and the scissors button
  // doesn't render at all.
  showSlice?: boolean
  // The guidance bubbles for these buttons are held back until the page says
  // the user has finished the first step, so a freshly loaded model only
  // shows the one hint about what to do first.
  showHints?: boolean
}

export function ViewerToolbar({
  activeTool,
  isPanning,
  onToolChange,
  onToggleFullscreen,
  onReset,
  showSlice = false,
  showHints = true,
}: ViewerToolbarProps) {
  // Self-contained (not lifted into the page) since this component already
  // decides on its own whether the slice button renders at all based on
  // showSlice — the hint about that button belongs with it, so pages
  // that don't wire up slicing (e.g. ModelViewerPage) never show it either.
  const { isDismissed: isSliceHintDismissed, dismiss: dismissSliceHint } =
    useGuidanceDismissed('slice-mode-hint')
  // The rotate/pan toggle used to be two separate buttons — this hint only
  // exists to explain that they're now combined into one, so it should get
  // out of the way the moment the button has actually been used once, same
  // as the slice hint below.
  const { isDismissed: isRotatePanHintDismissed, dismiss: dismissRotatePanHint } =
    useGuidanceDismissed('rotate-pan-toggle-hint')

  useEffect(() => {
    if (activeTool === 'slice' && !isSliceHintDismissed) dismissSliceHint()
  }, [activeTool, isSliceHintDismissed, dismissSliceHint])

  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
      {/* Stacked with a fixed pixel gap rather than both sitting flush against
          the toolbar — with both hints visible at once (a fresh session that
          hasn't touched either button yet), flush positioning put them at
          the same height and they overlapped each other. */}
      {showHints && showSlice && activeTool !== 'slice' && !isSliceHintDismissed && (
        <GuidanceBubble
          anchor="bottom-left"
          className="bottom-full left-1/2 -translate-x-1/2"
          style={{ marginBottom: isRotatePanHintDismissed ? '0.5rem' : '4.5rem' }}
          message="血管を輪切りにして断面積を確認できます"
          onDismiss={dismissSliceHint}
        />
      )}
      {showHints && !isRotatePanHintDismissed && (
        <GuidanceBubble
          anchor="bottom-left"
          className="bottom-full left-0 mb-2"
          message="「回転」と「移動」が1つのボタンにまとまりました。クリックで切り替えられます"
          onDismiss={dismissRotatePanHint}
        />
      )}
      <button
        type="button"
        onClick={onReset}
        title="リセットして選択をやり直す"
        className="rounded-full p-2 text-gray-500 transition hover:bg-gray-50"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          onToolChange(isPanning ? 'rotate' : 'pan')
          if (!isRotatePanHintDismissed) dismissRotatePanHint()
        }}
        aria-pressed
        title={isPanning ? 'クリックして回転モードに切り替え' : 'クリックして移動モードに切り替え'}
        className="rounded-full bg-indigo-50 p-2 text-indigo-600 transition"
      >
        {isPanning ? <Move className="h-4 w-4" /> : <Rotate3d className="h-4 w-4" />}
      </button>
      {showSlice && (
        <button
          type="button"
          onClick={() => onToolChange('slice')}
          aria-pressed={activeTool === 'slice'}
          title="断面を表示"
          className={`rounded-full p-2 transition ${
            activeTool === 'slice' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Scissors className="h-4 w-4" />
        </button>
      )}
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
