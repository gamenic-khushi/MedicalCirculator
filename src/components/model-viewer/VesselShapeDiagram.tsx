interface VesselShapeDiagramProps {
  proximalDiameter: number
  minDiameter: number
  distalDiameter: number
  // Drawn to the same mm-per-pixel scale as the diameters, so editing the
  // length visibly stretches or shortens the narrowed stretch.
  stenosisLength?: number
}

const MIN_LESION_WIDTH = 24
const WIDTH = 320
const HEIGHT = 110
const X_MARGIN = 16
const MAX_HALF_HEIGHT = 40
const MIN_HALF_HEIGHT = 4
const CENTER_Y = HEIGHT / 2

function halfHeightFor(diameter: number, maxDiameter: number) {
  if (!Number.isFinite(diameter) || diameter <= 0 || maxDiameter <= 0) return MIN_HALF_HEIGHT
  const ratio = diameter / maxDiameter
  return Math.max(MIN_HALF_HEIGHT, ratio * MAX_HALF_HEIGHT)
}

export function VesselShapeDiagram({
  proximalDiameter,
  minDiameter,
  distalDiameter,
  stenosisLength,
}: VesselShapeDiagramProps) {
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
      </svg>
      <div className="flex w-full justify-between px-1 text-[11px] font-medium text-gray-500">
        <span>近位側</span>
        <span>狭窄中心</span>
        <span>遠位側</span>
      </div>
      <p className="text-center text-[10px] text-gray-400">入力値に基づき滑らかにつながる形状を生成</p>
    </div>
  )
}
