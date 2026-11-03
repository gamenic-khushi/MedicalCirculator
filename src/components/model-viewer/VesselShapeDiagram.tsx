import type { PlaneOutline } from '@/lib/slicePlane'
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
  // The cut at the cutting line seen face-on (the transverse cross-section),
  // drawn under the lengthwise diagram, with its area in mm². Null shows none.
  crossSection?: PlaneOutline | null
  crossSectionArea?: number | null
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

const SECTION_SIZE = 120
// The horizontal line of the 3D view is grey there; the lengthwise section is
// drawn in the same grey wherever it shows.
const SECTION_LINE_COLOR = '#4b5563'
const SECTION_MARGIN = 14

// The cut at the cutting line seen face-on, in the same indigo as the line. The
// frame is square so the outline keeps its true proportions; its size is fitted
// to the cut, with the sizes across it written underneath.
function TransverseSection({
  outline,
  area,
  connectorLeft,
}: {
  outline: PlaneOutline
  area?: number | null
  // Where the cutting line stands along the diagram above, in percent of its
  // width, so a short stem can lead from the line down to this picture.
  connectorLeft: number | null
}) {
  const reach = Math.max(outline.width, outline.height, 1e-9)
  const scale = (SECTION_SIZE - SECTION_MARGIN * 2) / reach
  const centre = SECTION_SIZE / 2
  const path = `M ${outline.points
    .map(([x, y]) => `${(centre + x * scale).toFixed(2)} ${(centre - y * scale).toFixed(2)}`)
    .join(' L ')} Z`

  return (
    <div className="relative mt-3 flex flex-col items-center gap-1 rounded-lg bg-gray-50 px-2 pb-2 pt-3">
      {connectorLeft != null && (
        <span
          className="absolute -top-3 h-3 w-px bg-indigo-500"
          style={{ left: `${connectorLeft}%` }}
          aria-hidden
        />
      )}
      <p className="text-[11px] font-semibold text-indigo-600">切断面の横断面</p>
      <svg viewBox={`0 0 ${SECTION_SIZE} ${SECTION_SIZE}`} className="h-28 w-28">
        <rect
          x={1}
          y={1}
          width={SECTION_SIZE - 2}
          height={SECTION_SIZE - 2}
          rx={4}
          fill="#ffffff"
          stroke="#c7d2fe"
        />
        <path d={path} fill="#dbe4f0" stroke="#6366f1" strokeWidth={1.5} strokeLinejoin="round" />
        {/* The lengthwise section, seen edge-on: the vertical line through the
            middle of the cut, the plane of the lengthwise diagram above. */}
        <line
          x1={centre}
          y1={4}
          x2={centre}
          y2={SECTION_SIZE - 4}
          stroke={SECTION_LINE_COLOR}
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <text x={centre + 3} y={12} fontSize={8} fontWeight={600} fill={SECTION_LINE_COLOR}>
          縦断面
        </text>
      </svg>
      <p className="text-center text-[10px] text-gray-500">
        {area != null && <span className="block font-semibold text-gray-700">断面積 {area.toFixed(2)} mm²</span>}
        <span className="block">
          上下 {formatLength(outline.height)} mm × 奥行 {formatLength(outline.width)} mm
        </span>
      </p>
    </div>
  )
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
function MeasuredShape({
  shape,
  cutFraction,
  crossSection,
  crossSectionArea,
}: {
  shape: LesionShape
  cutFraction?: number | null
  crossSection?: PlaneOutline | null
  crossSectionArea?: number | null
}) {
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
  // The horizontal line of the 3D view, at its height above the middle of the
  // vessel where the cutting line crosses it.
  const lineOffset = crossSection?.sectionLine?.y
  const yHorizontal =
    lineOffset != null
      ? Math.min(
          Math.max(CENTER_Y - lineOffset * yPerMm, CENTER_Y - MAX_HALF_HEIGHT - 6),
          CENTER_Y + MAX_HALF_HEIGHT + 6,
        )
      : null
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
          strokeWidth={1}
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
        {yHorizontal != null && (
          <g>
            <line
              x1={x0}
              y1={yHorizontal}
              x2={x1}
              y2={yHorizontal}
              stroke={SECTION_LINE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            <text x={x1 - 2} y={yHorizontal - 3} textAnchor="end" fontSize={8} fontWeight={600} fill={SECTION_LINE_COLOR}>
              横線
            </text>
          </g>
        )}
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
              strokeWidth={1}
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
      {crossSection && (
        <div className="w-full">
          <TransverseSection
            outline={crossSection}
            area={crossSectionArea}
            connectorLeft={xCut != null ? (xCut / WIDTH) * 100 : null}
          />
        </div>
      )}
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
          strokeWidth={1}
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

export function VesselShapeDiagram({
  shape,
  cutFraction,
  crossSection,
  crossSectionArea,
  ...numbers
}: VesselShapeDiagramProps) {
  const lastArc = shape ? shape.samples[shape.samples.length - 1]?.arc : 0
  if (shape && shape.samples.length >= 2 && lastArc > 0) {
    return (
      <MeasuredShape
        shape={shape}
        cutFraction={cutFraction}
        crossSection={crossSection}
        crossSectionArea={crossSectionArea}
      />
    )
  }
  return (
    <div className="flex flex-col items-center">
      <GeneratedShape {...numbers} />
      {crossSection && (
        <div className="w-full">
          <TransverseSection outline={crossSection} area={crossSectionArea} connectorLeft={null} />
        </div>
      )}
    </div>
  )
}
