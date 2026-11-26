import {
  ArrowRight,
  Check,
  Maximize,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { type ReactNode } from 'react'

import type { ViewerTool } from './ModelCanvas'

// The steps of the work, in order (Aki's wireframe, 2026/11/25); the control for the
// step the user is on glows.
//   1 ① 近位径（病変始点）   2 ② 遠位径（病変終点）   3 ③ 病変調整
//   4 奥行きスライダー（③の中）   5 ④ 計測
export type GuideStep = 1 | 2 | 3 | 4 | 5

// The four steps of the bar, as the buttons number them.
export type WorkStep = 1 | 2 | 3 | 4

interface LesionViewerControlsProps {
  activeTool: ViewerTool
  // Whether dragging currently moves the model rather than turning it. Passed
  // in because while slicing, activeTool is 'slice' and can't say which.
  isPanning: boolean
  // ① or ② is still to be chosen: the 回転 / 移動 buttons show under ①.
  showViewTools: boolean
  isAnnotating: boolean
  // How many points are placed (0, 1 or 2): ② opens after ①, ③ and ④ after ②.
  pointCount: number
  // The step the user is on, and the last one finished (0 for none).
  currentStep: WorkStep
  doneUpTo: number
  // The step the glow is on; null for none (a saved capture, or the work is done).
  guideStep: GuideStep | null
  // A saved capture is open: the steps are not used.
  readOnly?: boolean
  // Clicking a step: the one the user is on selects its points, an earlier one goes back.
  onStep: (step: WorkStep) => void
  // 回転 / 移動: leaves the choosing of a point and sets what dragging does.
  onViewTool: (tool: 'rotate' | 'pan') => void
  onReset: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleFullscreen: () => void
  // The hint over ①, shown by the page (it is dismissed for good once used).
  pointerHint?: ReactNode
  // The hint over ③ once both points are chosen.
  adjustHint?: ReactNode
  // The hint under ④ once the lesion is measured: enter the blood pressure, calculate the FFR.
  measureHint?: ReactNode
}

// Every control sits on the dark view, so they are white; the one to touch next glows.
const ROUND = 'rounded-full border border-gray-100 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50'

function glow(on: boolean) {
  return on ? { 'data-guided': 'true', className: 'guide-glow' } : { 'data-guided': undefined, className: '' }
}

// A small arrow between the steps, as in the wireframe.
function StepArrow() {
  return <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-white/70" />
}

interface ViewToolButtonProps {
  label: string
  title: string
  pressed: boolean
  onClick: () => void
}

// 回転 / 移動: what dragging on the model does; the one that is on is lit.
function ViewToolButton({ label, title, pressed, onClick }: ViewToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={pressed}
      className={`flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition ${
        pressed
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

interface StepButtonProps {
  step: WorkStep
  label: string
  caption?: string
  title: string
  currentStep: WorkStep
  doneUpTo: number
  enabled: boolean
  glowing: boolean
  pressed?: boolean
  onClick: () => void
}

// One step of the bar: its number, its name and, once done, a tick. The step the user is on
// is lit; a step already done can be clicked to go back to it.
function StepButton({ step, label, caption, title, currentStep, doneUpTo, enabled, glowing, pressed, onClick }: StepButtonProps) {
  const isCurrent = step === currentStep
  const isDone = step <= doneUpTo && !isCurrent
  const g = glow(glowing)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      title={title}
      aria-current={isCurrent ? 'step' : undefined}
      aria-pressed={pressed}
      data-guided={g['data-guided']}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isCurrent
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : isDone
            ? 'border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50'
            : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'
      } ${g.className}`}
    >
      {isDone && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="flex flex-col leading-tight">
        <span>{label}</span>
        {caption && <span className="text-[0.625rem] font-normal opacity-70">{caption}</span>}
      </span>
    </button>
  )
}

/**
 * The controls over the 3D view of the lesion page, laid out as Aki's wireframe of
 * 2026/11/25: along the top リセット and the four steps ① 近位径（病変始点）→ ② 遠位径
 * （病変終点）→ ③ 病変調整 → ④ 計測; down the right ＋ ／ －, 全画面 (the 奥行きスライダー, once ③ is on, is placed in
 * an empty spot of the view by the page; the ① ② swap button was taken out on 2026/11/26: Aki, no longer needed). A step
 * already done can be clicked to go back to it. Everything here is tagged data-ffr-keep-clear: left
 * out of the saved picture, and kept clear of by the FFR card.
 */
export function LesionViewerControls({
  isPanning,
  showViewTools,
  isAnnotating,
  pointCount,
  currentStep,
  doneUpTo,
  guideStep,
  readOnly = false,
  onStep,
  onViewTool,
  onReset,
  onZoomIn,
  onZoomOut,
  onToggleFullscreen,
  pointerHint,
  adjustHint,
  measureHint,
  activeTool,
}: LesionViewerControlsProps) {
  const common = { currentStep, doneUpTo }

  return (
    <>
      {/* z-10: over the slice lines' drag handles, which run the full height of the view. */}
      <div data-ffr-keep-clear className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-5.5rem)] flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {/* Back to the start: the points, the lines and the view. */}
          <button
            type="button"
            onClick={onReset}
            title="リセットして選択をやり直す"
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50"
          >
            リセット
          </button>

          <StepArrow />

          {/* ① the lesion's first point (the start, nearer the heart). */}
          <div className="relative">
            <StepButton
              {...common}
              step={1}
              label="① 近位径"
              caption="病変始点"
              title="病変の始点（心臓に近い側）を選択"
              enabled={!readOnly}
              glowing={guideStep === 1}
              onClick={() => onStep(1)}
            />
            {pointerHint}
            {/* 回転 / 移動 under ① (Aki 11/25): while ① or ② is still to be chosen, the user
                can turn or move the model between the two clicks; ① / ② go back to choosing. */}
            {showViewTools && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1.5 flex flex-col gap-1">
                <ViewToolButton
                  label="回転"
                  title="ドラッグでモデルを回転"
                  pressed={!isAnnotating && !isPanning}
                  onClick={() => onViewTool('rotate')}
                />
                <ViewToolButton
                  label="移動"
                  title="ドラッグでモデルを移動"
                  pressed={!isAnnotating && isPanning}
                  onClick={() => onViewTool('pan')}
                />
              </div>
            )}
          </div>

          <StepArrow />

          {/* ② the second point (the end). */}
          <StepButton
            {...common}
            step={2}
            label="② 遠位径"
            caption="病変終点"
            title="病変の終点（遠い側）を選択"
            enabled={!readOnly && pointCount >= 1}
            glowing={guideStep === 2}
            onClick={() => onStep(2)}
          />

          <StepArrow />

          {/* ③ lay the vessel along the crosshair: the lines and the depth slider appear. */}
          <div className="relative">
            <StepButton
              {...common}
              step={3}
              label="③ 病変調整"
              title="整列して断面を表示（線と奥行きを調整）"
              enabled={!readOnly && pointCount === 2}
              glowing={guideStep === 3}
              pressed={activeTool === 'slice'}
              onClick={() => onStep(3)}
            />
            {adjustHint}
          </div>

          <StepArrow />

          {/* ④ measure from where the points and lines are now. */}
          <div className="relative">
            <StepButton
              {...common}
              step={4}
              label="④ 計測"
              title="選択した2点から計測し直します（手動で修正した値は自動計測値に戻ります）"
              enabled={!readOnly && pointCount === 2}
              glowing={guideStep === 5}
              onClick={() => onStep(4)}
            />
            {measureHint}
          </div>
        </div>
      </div>

      <div data-ffr-keep-clear className="absolute right-4 top-4 z-10 flex flex-col items-center gap-2">
        {/* The same space between all the icon buttons (Aki 11/26): they are not grouped any more. */}
        <button type="button" onClick={onZoomIn} title="拡大" className={ROUND}>
          <ZoomIn className="h-4 w-4" />
        </button>
        <button type="button" onClick={onZoomOut} title="縮小" className={ROUND}>
          <ZoomOut className="h-4 w-4" />
        </button>
        <button type="button" onClick={onToggleFullscreen} className={ROUND} title="全画面">
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </>
  )
}
