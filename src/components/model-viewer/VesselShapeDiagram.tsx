import type { LesionShape } from '@/lib/twoPointLesionMeasurement'

interface VesselShapeDiagramProps {
  proximalDiameter: number
  minDiameter: number
  distalDiameter: number
  // Drawn to the same mm-per-pixel scale as the diameters, so editing the
  // length visibly stretches or shortens the narrowed stretch.
  stenosisLength?: number
  // The model's own outline between ① and ②. When given it is drawn as it is,
  // ① at the left end and ② at the right end; without it (a saved capture, or
  // a measurement that could not follow the vessel) a smooth shape is made up
  // from the numbers above.
  shape?: LesionShape | null
  // Where the cutting line of the 3D view crosses the vessel, 0 at ① to 1 at ②
  // (null when it is outside ①〜②). Drawn on the model's own outline only.
  cutFraction?: number | null
}

const MIN_LESION_WIDTH = 24
const WIDTH = 320
const HEIGHT = 110
const X_MARGIN = 16
const MAX_HALF_HEIGHT = 40
const MIN_HALF_HEIGHT = 4
const CENTER_Y = HEIGHT / 2
const MARKER_RADIUS = 7
// ① and ② are coloured like their markers on the 3D view.
const PROXIMAL_COLOR = '#ef4444'
const DISTAL_COLOR = '#3b82f6'
// The cutting line is the same indigo as on the 3D view.
const CUT_COLOR = '#6366f1'

function halfHeightFor(diameter: number, maxDiameter: number) {
  if (!Number.isFinite(diameter) || diameter <= 0 || maxDiameter <= 0) return MIN_HALF_HEIGHT
  const ratio = diameter / maxDiameter
  return Math.max(MIN_HALF_HEIGHT, ratio * MAX_HALF_HEIGHT)
}

function formatLength(length: number) {
  return length < 10 ? length.toFixed(2) : length.toFixed(1)
}

function EndMarker({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <g>
      <line
        x1={x}
        y1={CENTER_Y - MAX_HALF_HEIGHT - 6}
        x2={x}
        y2={CENTER_Y + MAX_HALF_HEIGHT + 6}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.6}
      />
      <circle cx={x} cy={CENTER_Y} r={MARKER_RADIUS} fill={color} fillOpacity={0.75} stroke={color} />
      <text
        x={x}
        y={CENTER_Y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#ffffff"
      >
        {label}
      </text>
    </g>
  )
}

// The vessel exactly as the model has it: the wall above and below the centre
// line at every step from ① to ②, with the length across the full width.
function MeasuredShape({ shape, cutFraction }: { shape: LesionShape; cutFraction?: number | null }) {
  const { samples } = shape
  const lastArc = samples[samples.length - 1].arc
  const x0 = X_MARGIN
  const x1 = WIDTH - X_MARGIN
  const xPerMm = (x1 - x0) / lastArc
  const maxReach = Math.max(...samples.map((sample) => Math.max(sample.top, sample.bottom)), 1e-9)
  // The same scale along and across the vessel whenever the picture is tall
  // enough for it; a vessel too wide for its length is squeezed vertically.
  const yPerMm = Math.min(xPerMm, MAX_HALF_HEIGHT / maxReach)
  const squeezed = yPerMm < xPerMm * 0.999

  const xOf = (arc: number) => x0 + arc * xPerMm
  const upper = samples.map((sample) => `${xOf(sample.arc)} ${CENTER_Y - sample.top * yPerMm}`)
  const lower = samples
    .slice()
    .reverse()
    .map((sample) => `${xOf(sample.arc)} ${CENTER_Y + sample.bottom * yPerMm}`)
  const outline = `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`
  const xNarrowest = x0 + shape.narrowestFraction * (x1 - x0)
  const xCut = cutFraction != null ? x0 + Math.min(Math.max(cutFraction, 0), 1) * (x1 - x0) : null

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        <path d={outline} fill="#dbe4f0" stroke="#9db3d1" strokeWidth={1} strokeLinejoin="round" />
        <line
          x1={x0}
          y1={CENTER_Y}
          x2={x1}
          y2={CENTER_Y}
          stroke="#4f7fee"
          strokeWidth={1.5}
          strokeDasharray="2 3"
        />
        <line
          x1={xNarrowest}
          y1={CENTER_Y - MAX_HALF_HEIGHT - 6}
          x2={xNarrowest}
          y2={CENTER_Y + MAX_HALF_HEIGHT + 6}
          stroke="#6b7280"
          strokeWidth={1}
          strokeDasharray="1 3"
        />
        <EndMarker x={x0} color={PROXIMAL_COLOR} label="①" />
        <EndMarker x={x1} color={DISTAL_COLOR} label="②" />
        {xCut != null && (
          <g>
            <line
              x1={xCut}
              y1={CENTER_Y - MAX_HALF_HEIGHT - 8}
              x2={xCut}
              y2={CENTER_Y + MAX_HALF_HEIGHT + 8}
              stroke={CUT_COLOR}
              strokeWidth={2}
            />
            <circle cx={xCut} cy={CENTER_Y} r={3.5} fill="#ffffff" stroke={CUT_COLOR} strokeWidth={1.5} />
          </g>
        )}
      </svg>
      <div className="relative h-4 w-full px-1 text-[11px] font-medium text-gray-500">
        <span className="absolute left-1 top-0">① 近位側</span>
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(xNarrowest / WIDTH) * 100}%` }}
        >
          最小
        </span>
        <span className="absolute right-1 top-0">② 遠位側</span>
        {xCut != null && (
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-semibold text-indigo-600"
            style={{ left: `${(xCut / WIDTH) * 100}%` }}
          >
            切断面
          </span>
        )}
      </div>
      <p className="text-center text-[10px] text-gray-400">
        3Dモデルの断面形状（①〜②の中心線に沿って・長さ {formatLength(lastArc)} mm）
        {squeezed && '。縦方向は縮めて表示しています'}
      </p>
    </div>
  )
}

function GeneratedShape({
  proximalDiameter,
  minDiameter,
  distalDiameter,
  stenosisLength,
}: Omit<VesselShapeDiagramProps, 'shape'>) {
  const maxDiameter = Math.max(proximalDiameter, distalDiameter, minDiameter, 0.001)
  const hProximal = halfHeightFor(proximalDiameter, maxDiameter)
  const hMin = halfHeightFor(minDiameter, maxDiameter)
  const hDistal = halfHeightFor(distalDiameter, maxDiameter)

  const x0 = X_MARGIN
  const xMid = WIDTH / 2
  const x1 = WIDTH - X_MARGIN
  const fullWidth = x1 - x0
  const pxPerMm = (MAX_HALF_HEIGHT * 2) / maxDiameter
  const lesionWidth =
    stenosisLength && stenosisLength > 0
      ? Math.min(fullWidth, Math.max(MIN_LESION_WIDTH, stenosisLength * pxPerMm))
      : fullWidth
  const xa = xMid - lesionWidth / 2
  const xb = xMid + lesionWidth / 2
  const leftBend = xa + (xMid - xa) * 0.6
  const midLeftBend = xMid - (xMid - xa) * 0.6
  const midRightBend = xMid + (xb - xMid) * 0.6
  const rightBend = xb - (xb - xMid) * 0.6

  const outline = [
    `M ${x0} ${CENTER_Y - hProximal}`,
    `L ${xa} ${CENTER_Y - hProximal}`,
    `C ${leftBend} ${CENTER_Y - hProximal}, ${midLeftBend} ${CENTER_Y - hMin}, ${xMid} ${CENTER_Y - hMin}`,
    `C ${midRightBend} ${CENTER_Y - hMin}, ${rightBend} ${CENTER_Y - hDistal}, ${xb} ${CENTER_Y - hDistal}`,
    `L ${x1} ${CENTER_Y - hDistal}`,
    `L ${x1} ${CENTER_Y + hDistal}`,
    `L ${xb} ${CENTER_Y + hDistal}`,
    `C ${rightBend} ${CENTER_Y + hDistal}, ${midRightBend} ${CENTER_Y + hMin}, ${xMid} ${CENTER_Y + hMin}`,
    `C ${midLeftBend} ${CENTER_Y + hMin}, ${leftBend} ${CENTER_Y + hProximal}, ${xa} ${CENTER_Y + hProximal}`,
    `L ${x0} ${CENTER_Y + hProximal}`,
    'Z',
  ].join(' ')

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        <path d={outline} fill="#dbe4f0" stroke="#c3d0e3" strokeWidth={1} />
        <line
          x1={x0}
          y1={CENTER_Y}
          x2={x1}
          y2={CENTER_Y}
          stroke="#4f7fee"
          strokeWidth={1.5}
          strokeDasharray="2 3"
        />
        <EndMarker x={x0} color={PROXIMAL_COLOR} label="①" />
        <EndMarker x={x1} color={DISTAL_COLOR} label="②" />
      </svg>
      <div className="flex w-full justify-between px-1 text-[11px] font-medium text-gray-500">
        <span>① 近位側</span>
        <span>狭窄中心</span>
        <span>② 遠位側</span>
      </div>
      <p className="text-center text-[10px] text-gray-400">入力値に基づき滑らかにつながる形状を生成</p>
    </div>
  )
}

export function VesselShapeDiagram({ shape, cutFraction, ...numbers }: VesselShapeDiagramProps) {
  const lastArc = shape ? shape.samples[shape.samples.length - 1]?.arc : 0
  if (shape && shape.samples.length >= 2 && lastArc > 0) {
    return <MeasuredShape shape={shape} cutFraction={cutFraction} />
  }
  return <GeneratedShape {...numbers} />
}
