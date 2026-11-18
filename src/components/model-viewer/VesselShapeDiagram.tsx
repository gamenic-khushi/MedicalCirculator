import { SLICE_DEPTH_LIMIT, type PlaneOutline } from '@/lib/slicePlane'
import type { LesionProfileSample, LesionShape } from '@/lib/twoPointLesionMeasurement'

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
  // How far the depth slider has slid the model away (0 to SLICE_DEPTH_LIMIT mm),
  // null when it is not in use.
  depth?: number | null
  // The lesion cut lengthwise at that depth behind the surface the horizontal
  // line lies on; drawn instead of the centre-line outline, which stays faint.
  depthCut?: LesionProfileSample[][] | null
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

// Room above the lengthwise drawing for the 切断面 label, which stands over the cutting
// line (the drawing's own coordinates are unchanged: the view just starts higher).
const LABEL_ROOM = 14
const LENGTHWISE_VIEW_BOX = `0 ${-LABEL_ROOM} ${WIDTH} ${HEIGHT + LABEL_ROOM}`
const CUT_LABEL_COLOR = '#4f46e5'

// The name of the lengthwise drawing, one line tall in every state of the block.
function LengthwiseHeading() {
  return <p className="h-4 w-full text-xs font-semibold text-indigo-600">縦断面</p>
}

const SECTION_WIDTH = 300
const SECTION_HEIGHT = 150
// Share of the picture's height (or width, for a cut wider than tall) the cut fills.
const SECTION_FILL = 0.7
// The horizontal line of the 3D view is grey there; the lengthwise section is
// drawn in the same grey wherever it shows.
const SECTION_LINE_COLOR = '#4b5563'
const DEPTH_RANGE_COLOR = '#6366f1'

// The cut at the cutting line seen face-on, in the same indigo as the line, with
// the depth (away from the viewer) to the right. One scale both ways keeps the
// outline's true proportions; the cut is drawn large in the middle of the
// picture, with the sizes across it underneath. The SLICE_DEPTH_LIMIT mm behind
// the surface the horizontal line lies on (the range the cut and the depth slider
// reach) is drawn to the same scale; a small cut leaves the far end of it past
// the right edge, which then says so with an arrow, and so does the 奥行き line (the
// lengthwise section's place along the depth, which the depth slider moves).
function TransverseSection({
  outline,
  area,
  depth,
  connectorLeft,
}: {
  // Null until there is a cut to show: the frame is drawn all the same, so the
  // block keeps its size when the cut arrives.
  outline: PlaneOutline | null
  area?: number | null
  depth?: number | null
  // Where the cutting line stands along the diagram above, in percent of its
  // width, so a short stem can lead from the line down to this picture.
  connectorLeft: number | null
}) {
  const line = outline?.sectionLine
  // Where the horizontal line meets the vessel's surface: the front of the range.
  const front = line?.x ?? null
  // The outline is centred on its own middle, so x = y = 0 is the picture's centre.
  const scale = outline
    ? Math.min(
        (SECTION_WIDTH * SECTION_FILL) / Math.max(outline.width, 1e-9),
        (SECTION_HEIGHT * SECTION_FILL) / Math.max(outline.height, 1e-9),
      )
    : 1
  const xOf = (x: number) => SECTION_WIDTH / 2 + x * scale
  const yOf = (y: number) => SECTION_HEIGHT / 2 - y * scale
  const path = outline && `M ${outline.points.map(([x, y]) => `${xOf(x).toFixed(2)} ${yOf(y).toFixed(2)}`).join(' L ')} Z`
  // The horizontal line's plane seen edge-on, across the frame.
  const halfSpan = (SECTION_WIDTH / 2 - 4) / scale
  const horizontal =
    line && line.dx > 1e-6
      ? [-halfSpan, halfSpan].map((x) => [xOf(x), yOf(line.y + ((x - line.x) / line.dx) * line.dy)])
      : null
  // The range runs from the surface to the right edge at most.
  const rightEdge = SECTION_WIDTH - 4
  const rangeEnd = front != null ? xOf(front + SLICE_DEPTH_LIMIT) : null
  const rangeCut = rangeEnd != null && rangeEnd > rightEdge
  // The lengthwise section (the diagram above) at the depth slider's depth.
  const shownDepth = front != null && depth != null ? Math.min(Math.max(depth, 0), SLICE_DEPTH_LIMIT) : null
  const depthAt = shownDepth != null && front != null ? xOf(front + shownDepth) : null
  const depthPastEdge = depthAt != null && depthAt > rightEdge
  const depthX = depthAt != null ? Math.min(depthAt, rightEdge) : null

  return (
    <div className="relative mt-3 flex flex-col items-center gap-1 rounded-lg bg-gray-50 px-2 pb-2 pt-3">
      {connectorLeft != null && (
        <span
          className="absolute -top-3 h-3 w-px bg-indigo-500"
          style={{ left: `${connectorLeft}%` }}
          aria-hidden
        />
      )}
      {/* The name, with the area of the cut beside it (one line tall with or without it). */}
      <div className="flex h-4 w-full items-baseline gap-3 px-1">
        <p className="text-xs font-semibold text-indigo-600">横断面</p>
        {area != null && (
          <p className="text-xs font-semibold text-gray-700">断面積 {area.toFixed(2)} mm²</p>
        )}
      </div>
      <svg viewBox={`0 0 ${SECTION_WIDTH} ${SECTION_HEIGHT}`} className="w-full">
        <rect
          x={1}
          y={1}
          width={SECTION_WIDTH - 2}
          height={SECTION_HEIGHT - 2}
          rx={4}
          fill="#ffffff"
          stroke="#c7d2fe"
        />
        {front != null && rangeEnd != null && (
          <g>
            <rect
              x={xOf(front)}
              y={4}
              width={Math.min(rangeEnd, rightEdge) - xOf(front)}
              height={SECTION_HEIGHT - 8}
              fill={DEPTH_RANGE_COLOR}
              fillOpacity={0.06}
              stroke={DEPTH_RANGE_COLOR}
              strokeOpacity={0.5}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <text x={xOf(front) + 2} y={SECTION_HEIGHT - 7} fontSize={10} fill={DEPTH_RANGE_COLOR}>
              手前
            </text>
            <text
              x={Math.min(rangeEnd, rightEdge) - 2}
              y={SECTION_HEIGHT - 7}
              textAnchor="end"
              fontSize={10}
              fill={DEPTH_RANGE_COLOR}
            >
              奥 {SLICE_DEPTH_LIMIT} mm{rangeCut && ' →'}
            </text>
          </g>
        )}
        {path && <path d={path} fill="#dbe4f0" stroke="#6366f1" strokeWidth={1.5} strokeLinejoin="round" />}
        {!outline && (
          <text
            x={SECTION_WIDTH / 2}
            y={SECTION_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fill="#9ca3af"
          >
            病変指定箇所が表示されます
          </text>
        )}
        {horizontal && (
          <g>
            <line
              x1={horizontal[0][0]}
              y1={horizontal[0][1]}
              x2={horizontal[1][0]}
              y2={horizontal[1][1]}
              stroke={SECTION_LINE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            <text
              x={horizontal[1][0] - 2}
              y={horizontal[1][1] - 3}
              textAnchor="end"
              fontSize={10}
              fontWeight={600}
              fill={SECTION_LINE_COLOR}
            >
              水平線
            </text>
          </g>
        )}
        {/* The lengthwise section, seen edge-on: it moves with the depth slider. */}
        {depthX != null && (
          <g>
            <line
              x1={depthX}
              y1={4}
              x2={depthX}
              y2={SECTION_HEIGHT - 4}
              stroke={SECTION_LINE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            {/* Past the right edge it waits there, pointing on to where it is. */}
            <text
              x={depthPastEdge ? depthX - 3 : depthX + 3}
              y={12}
              textAnchor={depthPastEdge ? 'end' : 'start'}
              fontSize={10}
              fontWeight={600}
              fill={SECTION_LINE_COLOR}
            >
              奥行き（スライダーで調整）{depthPastEdge && ' →'}
            </text>
          </g>
        )}
      </svg>
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
  depth,
  depthCut,
}: {
  shape: LesionShape
  cutFraction?: number | null
  crossSection?: PlaneOutline | null
  crossSectionArea?: number | null
  depth?: number | null
  depthCut?: LesionProfileSample[][] | null
}) {
  const { samples } = shape
  const lastArc = samples[samples.length - 1].arc
  const x0 = X_MARGIN
  const x1 = WIDTH - X_MARGIN
  const xPerMm = (x1 - x0) / lastArc
  const maxReach = Math.max(
    ...[samples, ...(depthCut ?? [])].flat().map((sample) => Math.max(sample.top, sample.bottom)),
    1e-9,
  )
  // The same scale along and across the vessel whenever the picture is tall
  // enough for it; a vessel too wide for its length is squeezed vertically.
  const yPerMm = Math.min(xPerMm, MAX_HALF_HEIGHT / maxReach)

  // Clamped: the depth cut can come from a newer measurement than `shape`.
  const xOf = (arc: number) => x0 + Math.min(Math.max(arc, 0), lastArc) * xPerMm
  const outlineOf = (run: LesionProfileSample[]) => {
    const upper = run.map((sample) => `${xOf(sample.arc)} ${CENTER_Y - sample.top * yPerMm}`)
    const lower = run
      .slice()
      .reverse()
      .map((sample) => `${xOf(sample.arc)} ${CENTER_Y + sample.bottom * yPerMm}`)
    return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`
  }
  const outline = outlineOf(samples)
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
      <LengthwiseHeading />
      <svg viewBox={LENGTHWISE_VIEW_BOX} className="w-full">
        {depthCut ? (
          <>
            {/* The centre-line outline stays as a faint guide behind the cut. */}
            <path
              d={outline}
              fill="none"
              stroke="#c3d0e3"
              strokeWidth={1}
              strokeDasharray="3 2"
              strokeLinejoin="round"
            />
            {depthCut.map((run, index) => (
              <path
                key={index}
                d={outlineOf(run)}
                fill="#dbe4f0"
                stroke="#9db3d1"
                strokeWidth={1}
                strokeLinejoin="round"
              />
            ))}
          </>
        ) : (
          <path d={outline} fill="#dbe4f0" stroke="#9db3d1" strokeWidth={1} strokeLinejoin="round" />
        )}
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
            {/* Ends short of the ② circle, which sits on the line's right end. */}
            <text x={x1 - MARKER_RADIUS - 3} y={yHorizontal - 3} textAnchor="end" fontSize={10} fontWeight={600} fill={SECTION_LINE_COLOR}>
              水平線
            </text>
          </g>
        )}
        <EndMarker x={x0} color={PROXIMAL_COLOR} label="①" />
        <EndMarker x={x1} color={DISTAL_COLOR} label="②" />
        {xCut != null && (
          <g>
            {/* The cutting line's name stands over its top. */}
            <text
              x={Math.min(Math.max(xCut, 20), WIDTH - 20)}
              y={-3}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill={CUT_LABEL_COLOR}
            >
              切断面
            </text>
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
      <div className="relative h-4 w-full px-1 text-[0.6875rem] font-medium text-gray-500">
        <span className="absolute left-1 top-0">① 近位側</span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(xNarrowest / WIDTH) * 100}%` }}
        >
          最小
        </span>
        <span className="absolute right-1 top-0">② 遠位側</span>
      </div>
      <div className="w-full">
        <TransverseSection
          outline={crossSection ?? null}
          area={crossSectionArea}
          depth={depth}
          connectorLeft={crossSection && xCut != null ? (xCut / WIDTH) * 100 : null}
        />
      </div>
    </div>
  )
}

// The block before there is anything to draw in it (no lesion selected yet, or it
// is being measured): the same pictures at the same sizes as when it is filled, with
// ① and ② at the ends and the reason it is empty written across the middle. The
// right-hand column therefore keeps its height when the measurement arrives.
export function VesselShapePlaceholder({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <LengthwiseHeading />
      <div className="relative w-full">
        <svg viewBox={LENGTHWISE_VIEW_BOX} className="w-full">
          <line
            x1={X_MARGIN}
            y1={CENTER_Y}
            x2={WIDTH - X_MARGIN}
            y2={CENTER_Y}
            stroke="#4f7fee"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <EndMarker x={X_MARGIN} color={PROXIMAL_COLOR} label="①" />
          <EndMarker x={WIDTH - X_MARGIN} color={DISTAL_COLOR} label="②" />
        </svg>
        <p className="absolute inset-x-10 top-[55%] -translate-y-1/2 rounded bg-white/80 px-2 py-1 text-center text-xs text-gray-400">
          {message}
        </p>
      </div>
      <div className="relative h-4 w-full px-1 text-[0.6875rem] font-medium text-gray-500">
        <span className="absolute left-1 top-0">① 近位側</span>
        <span className="absolute right-1 top-0">② 遠位側</span>
      </div>
      <div className="w-full">
        <TransverseSection outline={null} connectorLeft={null} />
      </div>
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
      <LengthwiseHeading />
      <svg viewBox={LENGTHWISE_VIEW_BOX} className="w-full">
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
      <div className="flex w-full justify-between px-1 text-[0.6875rem] font-medium text-gray-500">
        <span>① 近位側</span>
        <span>狭窄中心</span>
        <span>② 遠位側</span>
      </div>
      <p className="text-center text-[0.6875rem] text-gray-400">入力値に基づき滑らかにつながる形状を生成</p>
    </div>
  )
}

export function VesselShapeDiagram({
  shape,
  cutFraction,
  crossSection,
  crossSectionArea,
  depth,
  depthCut,
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
        depth={depth}
        depthCut={depthCut}
      />
    )
  }
  return (
    <div className="flex flex-col items-center">
      <GeneratedShape {...numbers} />
      <div className="w-full">
        <TransverseSection outline={crossSection ?? null} area={crossSectionArea} depth={depth} connectorLeft={null} />
      </div>
    </div>
  )
}
