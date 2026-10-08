export interface PercentPoint {
  x: number
  y: number
  worldPoint?: [number, number, number]
}

export interface LesionSweepMeasurement {
  proximalDiameter: number
  distalDiameter: number
  minArea: number
  minDiameter: number
  length: number
  narrowestFraction: number
  narrowestPoint: PercentPoint | null
  narrowestWorld?: [number, number, number]
  narrowestDirection?: [number, number, number]
}

export interface LesionMeasurementCanvas {
  // True 3D measurement along the vessel's centre line between two surface
  // points. Preferred when both points carry a worldPoint; the screen-based
  // width methods below remain the fallback when it can't follow the vessel.
  getWorldPoint?: (xPercent: number, yPercent: number) => [number, number, number] | null
  measureLesionSweep?: (
    proximalWorld: [number, number, number],
    distalWorld: [number, number, number],
  ) => LesionSweepMeasurement | null
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
  /** True area of the narrowest cut, when measured in 3D. */
  narrowestArea?: number
  /** Where (and along which direction) the narrowest cut sits, in world space. */
  focus?: { point: [number, number, number]; direction: [number, number, number] }
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

  if (proximal.worldPoint && distal.worldPoint && canvas.measureLesionSweep) {
    const sweep = canvas.measureLesionSweep(proximal.worldPoint, distal.worldPoint)
    if (sweep && sweep.narrowestPoint) {
      const sweepRatio = sweep.narrowestFraction
      return {
        proximal,
        distal,
        proximalWidth: sweep.proximalDiameter,
        distalWidth: sweep.distalDiameter,
        narrowestWidth: sweep.minDiameter,
        narrowestPoint: sweep.narrowestPoint,
        narrowestArea: sweep.minArea,
        focus:
          sweep.narrowestWorld && sweep.narrowestDirection
            ? { point: sweep.narrowestWorld, direction: sweep.narrowestDirection }
            : undefined,
        segmentLength: sweep.length,
        lesionPosition: sweepRatio < 1 / 3 ? '近位' : sweepRatio > 2 / 3 ? '遠位' : '中間',
      }
    }
  }

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

  // Even without the 3D sweep, give the slice tool somewhere sensible to start:
  // the surface point under the narrowest sample, cutting along the line
  // between the two picked points.
  const narrowestWorld = canvas.getWorldPoint?.(narrowestPoint.x, narrowestPoint.y) ?? null
  let focus: TwoPointLesionResult['focus']
  if (narrowestWorld && proximal.worldPoint && distal.worldPoint) {
    const d = [
      distal.worldPoint[0] - proximal.worldPoint[0],
      distal.worldPoint[1] - proximal.worldPoint[1],
      distal.worldPoint[2] - proximal.worldPoint[2],
    ]
    const length = Math.hypot(d[0], d[1], d[2])
    if (length > 0) {
      focus = { point: narrowestWorld, direction: [d[0] / length, d[1] / length, d[2] / length] }
    }
  }

  return {
    proximal,
    distal,
    proximalWidth,
    distalWidth,
    narrowestWidth,
    narrowestPoint,
    focus,
    segmentLength,
    lesionPosition,
  }
}
