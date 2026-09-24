import { Maximize, Move, RefreshCw, Rotate3d, Scissors } from 'lucide-react'
import { useEffect } from 'react'

import { GuidanceBubble } from '@/components/common/GuidanceBubble'
import { useGuidanceDismissed } from '@/hooks/useGuidanceDismissed'

import type { SliceAxis, SliceGizmoMode } from './SlicePlaneGizmo'
import type { ViewerTool } from './ModelCanvas'

const AXIS_OPTIONS: SliceAxis[] = ['x', 'y', 'z']
const GIZMO_MODE_LABELS: Record<SliceGizmoMode, string> = { translate: '移動', rotate: '回転' }

interface ViewerToolbarProps {
  activeTool: ViewerTool
  onToolChange: (tool: ViewerTool) => void
  onToggleFullscreen: () => void
  onReset: () => void
  // Slicing is only wired up on pages that pass onSliceAxisChange (currently
  // just the lesion-measurement viewer) — omit it elsewhere and the toggle
  // and axis buttons don't render at all.
  sliceAxis?: SliceAxis | null
  onSliceAxisChange?: (axis: SliceAxis) => void
  sliceGizmoMode?: SliceGizmoMode
  onSliceGizmoModeChange?: (mode: SliceGizmoMode) => void
}

export function ViewerToolbar({
  activeTool,
  onToolChange,
  onToggleFullscreen,
  onReset,
  sliceAxis = null,
  onSliceAxisChange,
  sliceGizmoMode = 'translate',
  onSliceGizmoModeChange,
}: ViewerToolbarProps) {
  // Self-contained (not lifted into the page) since this component already
  // decides on its own whether the slice button renders at all based on
  // onSliceAxisChange — the hint about that button belongs with it, so pages
  // that don't wire up slicing (e.g. ModelViewerPage) never show it either.
  const { isDismissed: isSliceHintDismissed, dismiss: dismissSliceHint } =
    useGuidanceDismissed('slice-mode-hint')

  useEffect(() => {
    if (activeTool === 'slice' && !isSliceHintDismissed) dismissSliceHint()
  }, [activeTool, isSliceHintDismissed, dismissSliceHint])

  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
      {onSliceAxisChange && activeTool !== 'slice' && !isSliceHintDismissed && (
        <GuidanceBubble
          anchor="bottom-left"
          className="bottom-full left-1/2 mb-2 -translate-x-1/2"
          message="血管を輪切りにして断面積を確認できます"
          onDismiss={dismissSliceHint}
        />
      )}
      <button
        type="button"
        onClick={onReset}
        title="リセットして新しい位置に丸を描く"
        className="rounded-full p-2 text-gray-500 transition hover:bg-gray-50"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onToolChange(activeTool === 'pan' ? 'rotate' : 'pan')}
        aria-pressed={activeTool !== 'slice'}
        title={activeTool === 'pan' ? 'クリックして回転モードに切り替え' : 'クリックして移動モードに切り替え'}
        className={`rounded-full p-2 transition ${
          activeTool === 'slice' ? 'text-gray-500 hover:bg-gray-50' : 'bg-indigo-50 text-indigo-600'
        }`}
      >
        {activeTool === 'pan' ? <Move className="h-4 w-4" /> : <Rotate3d className="h-4 w-4" />}
      </button>
      {onSliceAxisChange && (
        <>
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
          {activeTool === 'slice' && (
            <div className="flex items-center gap-1 border-l border-gray-100 pl-1">
              {AXIS_OPTIONS.map((axis) => (
                <button
                  key={axis}
                  type="button"
                  onClick={() => onSliceAxisChange(axis)}
                  aria-pressed={sliceAxis === axis}
                  title={`${axis.toUpperCase()}軸で切断`}
                  className={`h-8 w-8 rounded-full text-xs font-semibold uppercase transition ${
                    sliceAxis === axis
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {axis}
                </button>
              ))}
              {onSliceGizmoModeChange && (
                <div className="flex items-center gap-1 border-l border-gray-100 pl-1">
                  {(Object.keys(GIZMO_MODE_LABELS) as SliceGizmoMode[]).map((gizmoMode) => (
                    <button
                      key={gizmoMode}
                      type="button"
                      onClick={() => onSliceGizmoModeChange(gizmoMode)}
                      aria-pressed={sliceGizmoMode === gizmoMode}
                      className={`rounded-full px-2 py-1.5 text-xs font-medium transition ${
                        sliceGizmoMode === gizmoMode
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {GIZMO_MODE_LABELS[gizmoMode]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
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
