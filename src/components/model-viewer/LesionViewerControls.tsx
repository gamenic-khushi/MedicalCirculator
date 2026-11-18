import {
  ArrowLeftRight,
  ArrowRight,
  Maximize,
  MousePointerClick,
  Move,
  RefreshCw,
  Rotate3d,
  Scissors,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

import { GuidanceBubble } from '@/components/common/GuidanceBubble'
import { useGuidanceDismissed } from '@/hooks/useGuidanceDismissed'

import type { ViewerTool } from './ModelCanvas'

// The steps of the work, in order; the control for the step the user is on glows.
//   1 回転・移動・＋・－ (get the vessel in view)   2 病変指定   3 整列
//   4 奥行きスライダー                            5 測定範囲更新
export type GuideStep = 1 | 2 | 3 | 4 | 5

interface LesionViewerControlsProps {
  activeTool: ViewerTool
  // Whether dragging currently moves the model rather than turning it. Passed
  // in because while slicing, activeTool is 'slice' and can't say which.
  isPanning: boolean
  // The model is held where 整列 put it, so turning and moving are off.
  locked: boolean
  isAnnotating: boolean
  // Both points are chosen: the ① ② swap and the hint for 整列 apply.
  hasTwoPoints: boolean
  // The step the glow is on; null for none (a saved capture, or the work is done).
  guideStep: GuideStep | null
  onToolChange: (tool: ViewerTool) => void
  onToggleAnnotating: () => void
  onSwap: () => void
  onUpdateRange: () => void
  onReset: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleFullscreen: () => void
  // The hint over 病変指定, shown by the page (it is dismissed for good once used).
  pointerHint?: ReactNode
  // The depth slider: it appears under the fullscreen button once 整列 is on.
  depthControl?: ReactNode
}

// Every control sits on the dark view, so they are white; the one to touch next glows.
const BUTTON =
  'flex items-center gap-1.5 rounded-full border border-gray-100 bg-white text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50'
const ROUND = 'rounded-full border border-gray-100 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50'
const ACTIVE = 'bg-indigo-50 text-indigo-600'

function glow(on: boolean) {
  return on ? { 'data-guided': 'true', className: 'guide-glow' } : { 'data-guided': undefined, className: '' }
}

// A small arrow between the steps, as in the wireframe.
function StepArrow() {
  return <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-white/70" />
}

/**
 * The controls over the 3D view of the lesion page, laid out in the order of the work
 * (Aki's wireframe, 2026/11/18): along the top 回転・移動 → 病変指定 → 整列 → 測定範囲を更新;
 * down the right リセット, ＋ ／ －, 全画面, and under it 奥行きスライダー once 整列 is on.
 * Everything here is tagged data-ffr-keep-clear: left out of the saved picture, and
 * kept clear of by the FFR card.
 */
export function LesionViewerControls({
  activeTool,
  isPanning,
  locked,
  isAnnotating,
  hasTwoPoints,
  guideStep,
  onToolChange,
  onToggleAnnotating,
  onSwap,
  onUpdateRange,
  onReset,
  onZoomIn,
  onZoomOut,
  onToggleFullscreen,
  pointerHint,
  depthControl,
}: LesionViewerControlsProps) {
  // The hint over 整列 goes for good once the scissors has been used.
  const { isDismissed: isSliceHintDismissed, dismiss: dismissSliceHint } =
    useGuidanceDismissed('slice-mode-hint')
  useEffect(() => {
    if (activeTool === 'slice' && !isSliceHintDismissed) dismissSliceHint()
  }, [activeTool, isSliceHintDismissed, dismissSliceHint])

  const lockedTitle = 'モデルの位置を固定しています（整列をもう一度クリックすると解除されます）'
  const view = glow(guideStep === 1)
  const select = glow(guideStep === 2)
  const align = glow(guideStep === 3)
  const update = glow(guideStep === 5)

  return (
    <>
      <div data-ffr-keep-clear className="absolute left-4 top-4 flex max-w-[calc(100%-5.5rem)] flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {/* 1: turn or move the model; one pair, the one in use lit. */}
          <div className="flex rounded-full border border-gray-100 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              disabled={locked}
              onClick={() => onToolChange('rotate')}
              aria-pressed={!isPanning}
              title={locked ? lockedTitle : 'ドラッグでモデルを回転'}
              data-guided={view['data-guided']}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:text-gray-300 ${
                !isPanning && !locked ? ACTIVE : 'text-gray-600 hover:bg-gray-50'
              } ${view.className}`}
            >
              <Rotate3d className="h-4 w-4" />
              回転
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => onToolChange('pan')}
              aria-pressed={isPanning}
              title={locked ? lockedTitle : 'ドラッグでモデルを移動'}
              data-guided={view['data-guided']}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:text-gray-300 ${
                isPanning && !locked ? ACTIVE : 'text-gray-600 hover:bg-gray-50'
              } ${view.className}`}
            >
              <Move className="h-4 w-4" />
              移動
            </button>
          </div>

          <StepArrow />

          {/* 2: choose the lesion's two points. */}
          <div className="relative">
            <button
              type="button"
              onClick={onToggleAnnotating}
              title="2点をクリックして選択（①心臓に近い側 → ②遠い側）"
              data-guided={select['data-guided']}
              className={`${BUTTON} px-3 py-1.5 ${
                isAnnotating ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-50' : ''
              } ${select.className}`}
            >
              <MousePointerClick className="h-4 w-4" />
              病変指定
            </button>
            {pointerHint}
          </div>

          <StepArrow />

          {/* 3: lay the vessel along the crosshair (the scissors). */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onToolChange('slice')}
              aria-pressed={activeTool === 'slice'}
              title="整列して断面を表示"
              data-guided={align['data-guided']}
              className={`${BUTTON} px-3 py-1.5 ${activeTool === 'slice' ? `${ACTIVE} hover:bg-indigo-50` : ''} ${align.className}`}
            >
              <Scissors className="h-4 w-4" />
              整列
            </button>
            <AnimatePresence>
              {hasTwoPoints && activeTool !== 'slice' && !isSliceHintDismissed && (
                <GuidanceBubble
                  anchor="bottom-left"
                  className="left-1/2 top-full mt-2 -translate-x-1/2"
                  message="「整列」から病変位置の詳細を調整できます"
                  onDismiss={dismissSliceHint}
                />
              )}
            </AnimatePresence>
          </div>

          <StepArrow />

          {/* 5: measure again from where the points and lines are now. */}
          <button
            type="button"
            onClick={onUpdateRange}
            title="選択した2点から計測し直します（手動で修正した値は自動計測値に戻ります）"
            data-guided={update['data-guided']}
            className={`rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 ${update.className}`}
          >
            測定範囲を更新
          </button>
        </div>
      </div>

      <div data-ffr-keep-clear className="absolute right-4 top-4 flex flex-col items-center gap-2">
        <button type="button" onClick={onReset} className={ROUND} title="リセットして選択をやり直す">
          <RefreshCw className="h-4 w-4" />
        </button>
        {/* 1: ＋ and － are with 回転 and 移動. */}
        <div className="flex flex-col gap-1 rounded-full bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={onZoomIn}
            title="拡大"
            data-guided={view['data-guided']}
            className={`${ROUND} ${view.className}`}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            title="縮小"
            data-guided={view['data-guided']}
            className={`${ROUND} ${view.className}`}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={onToggleFullscreen} className={ROUND} title="全画面">
          <Maximize className="h-4 w-4" />
        </button>
        {/* Once both points are chosen (Aki's markup, 2026/11/18): the ① ② swap, in this
            column under the fullscreen button, above the depth slider. */}
        {hasTwoPoints && (
          <button type="button" onClick={onSwap} className={ROUND} title="①と②を入れ替える（心臓に近い側を修正）">
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        )}
        {/* 4: under the swap, after 整列. */}
        {depthControl}
      </div>
    </>
  )
}
