export interface PercentPoint {
  x: number
  y: number
}

export interface LesionMeasurementCanvas {
  measureVesselWidth: (xPercent: number, yPercent: number) => number | null
  measureDistance3D: (
    x1Percent: number,
    y1Percent: number,
    x2Percent: number,
    y2Percent: number,
  ) => number | null
}

export interface TwoPointLesionResult {
  proximal: PercentPoint
  distal: PercentPoint
  proximalWidth: number
  distalWidth: number
  narrowestWidth: number
  narrowestPoint: PercentPoint
  segmentLength: number | null
  lesionPosition: '近位' | '中間' | '遠位'
}

const SCAN_STEPS = 30

/**
 * Evenly samples points along the line from pointA to pointB (inclusive of
 * both ends).
 */
function interpolatePoints(
  pointA: PercentPoint,
  pointB: PercentPoint,
  steps: number = SCAN_STEPS,
): PercentPoint[] {
  const points: PercentPoint[] = []
  for (let step = 0; step <= steps; step++) {
    const t = step / steps
    points.push({
      x: pointA.x + (pointB.x - pointA.x) * t,
      y: pointA.y + (pointB.y - pointA.y) * t,
    })
  }
  return points
}

/**
 * Given two user-picked boundary points, finds the narrowest point of the vessel
 * between them by sampling along the line connecting them. Point order matters:
 * pointA is always treated as proximal (①, near-heart) and pointB as distal (②)
 * — the caller (LesionAnalysisPage) is responsible for ordering them by which
 * one sits on the wider part of the vessel, since screen position alone isn't
 * a reliable proxy for heart-proximity once the vessel curves or the camera
 * rotates.
 */
export function measureTwoPointLesion(
  canvas: LesionMeasurementCanvas,
  pointA: PercentPoint,
  pointB: PercentPoint,
): TwoPointLesionResult | null {
  const proximal = pointA
  const distal = pointB

  const proximalWidth = canvas.measureVesselWidth(proximal.x, proximal.y)
  const distalWidth = canvas.measureVesselWidth(distal.x, distal.y)
  if (!proximalWidth || !distalWidth) return null

  const path = interpolatePoints(proximal, distal, SCAN_STEPS)

  let narrowestWidth = proximalWidth
  let narrowestPoint = proximal
  let narrowestStep = 0

  path.forEach((point, step) => {
    if (step === 0) return
    const width = canvas.measureVesselWidth(point.x, point.y)
    if (width && width < narrowestWidth) {
      narrowestWidth = width
      narrowestPoint = point
      narrowestStep = step
    }
  })

  const segmentLength = canvas.measureDistance3D(proximal.x, proximal.y, distal.x, distal.y)

  const ratio = narrowestStep / SCAN_STEPS
  const lesionPosition = ratio < 1 / 3 ? '近位' : ratio > 2 / 3 ? '遠位' : '中間'

  return {
    proximal,
    distal,
    proximalWidth,
    distalWidth,
    narrowestWidth,
    narrowestPoint,
    segmentLength,
    lesionPosition,
  }
}
