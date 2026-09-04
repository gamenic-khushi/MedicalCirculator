// Automatic (no manual clicks) lesion-measurement heuristic, run directly
// against VTK.js polydata point coordinates.
//
// This mirrors the math of the production two-point algorithm
// (src/lib/twoPointLesionMeasurement.ts) — same stenosis-rate formula, same
// 近位/中間/遠位 position classification — but automates the two steps that
// are manual there: (1) picking the proximal/distal points, and (2)
// measuring the local vessel width at each sample.
//
// Path tracing mirrors the production highlightSegment
// (src/components/model-viewer/ModelCanvas.tsx): walk step by step from the
// start point toward the target, re-aiming from wherever we actually
// snapped to last time, instead of trusting a straight line between two
// endpoints. A straight line cuts across curved/branching vessels and
// lands in empty space — walk-and-snap keeps every sample point on the
// real mesh surface.
//
// This is still a ROUGH ESTIMATE by design (per Aki-san's stated
// requirement), not a clinical-grade centerline extraction:
//
//  - Point selection: takes the single mesh point farthest from the overall
//    centroid as the "distal tip" of one branch, then walks back toward the
//    centroid. It does not distinguish between separate arteries — on a
//    tree with multiple similar-length branches it will simply follow
//    whichever one happens to have the single farthest point.
//  - Snapping to "nearest mesh point" isn't the same as snapping to the
//    centerline — it can drift toward whichever side of the tube is
//    nearest, especially at sharp bends.
//  - Width estimate: at each snapped sample point, collects nearby surface
//    points (adaptive radius search) and uses 2x the max distance from
//    their local centroid as the local diameter.
//
// A production version would need real centerline/skeleton extraction
// (e.g. voxelize + distance-transform ridge tracing) and per-branch
// segmentation — out of scope for this feasibility prototype.

const SCAN_STEPS = 30
const WALK_STEP_FRACTION_OF_DIAG = 0.006
const WALK_MAX_STEPS = 400
const STUCK_STREAK_LIMIT = 5
const SKIP_FRACTION = 0.35
const NEIGHBOR_TARGET_MIN = 8
const MAX_RADIUS_ITERATIONS = 12

function boundsDiagonal(bounds) {
  const dx = bounds[1] - bounds[0]
  const dy = bounds[3] - bounds[2]
  const dz = bounds[5] - bounds[4]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function computeCentroid(coords) {
  const n = coords.length / 3
  let sx = 0
  let sy = 0
  let sz = 0
  for (let i = 0; i < n; i++) {
    sx += coords[i * 3]
    sy += coords[i * 3 + 1]
    sz += coords[i * 3 + 2]
  }
  return [sx / n, sy / n, sz / n]
}

function findFarthestPoint(coords, from) {
  const n = coords.length / 3
  let maxDist2 = -1
  let best = [from[0], from[1], from[2]]
  for (let i = 0; i < n; i++) {
    const x = coords[i * 3]
    const y = coords[i * 3 + 1]
    const z = coords[i * 3 + 2]
    const dx = x - from[0]
    const dy = y - from[1]
    const dz = z - from[2]
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 > maxDist2) {
      maxDist2 = d2
      best = [x, y, z]
    }
  }
  return best
}

function findNearestMeshPoint(coords, from) {
  const n = coords.length / 3
  let minDist2 = Infinity
  let best = [from[0], from[1], from[2]]
  for (let i = 0; i < n; i++) {
    const x = coords[i * 3]
    const y = coords[i * 3 + 1]
    const z = coords[i * 3 + 2]
    const dx = x - from[0]
    const dy = y - from[1]
    const dz = z - from[2]
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 < minDist2) {
      minDist2 = d2
      best = [x, y, z]
    }
  }
  return best
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function distance3(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function pathLength(path) {
  let total = 0
  for (let i = 1; i < path.length; i++) total += distance3(path[i - 1], path[i])
  return total
}

// Walk from `start` toward `target`, re-aiming from the actual current
// position each time and snapping every step to the nearest real mesh
// vertex — same idea as the production highlightSegment. Unlike
// highlightSegment (a short, already-adjacent two-point case), this walk
// can span a large chamber-to-branch-tip distance, so it uses a small
// FIXED physical step size and iterates until it's close to the target or
// hits maxSteps, rather than dividing the total distance by a fixed step
// count — dividing by count means long walks take tiny, unreliable steps
// whenever real per-step progress falls short of the naive geometric
// distance (e.g. while still crossing a wide chamber).
function walkAndSnap(coords, start, target, stepSize, maxSteps) {
  const path = [findNearestMeshPoint(coords, start)]
  let current = path[0]
  let stuckStreak = 0

  for (let step = 0; step < maxSteps; step++) {
    const remaining = [target[0] - current[0], target[1] - current[1], target[2] - current[2]]
    const remainingDistance = Math.hypot(remaining[0], remaining[1], remaining[2])
    if (remainingDistance < stepSize) break

    const guess = [
      current[0] + (remaining[0] / remainingDistance) * stepSize,
      current[1] + (remaining[1] / remainingDistance) * stepSize,
      current[2] + (remaining[2] / remainingDistance) * stepSize,
    ]
    const next = findNearestMeshPoint(coords, guess)

    // Nearest-vertex snapping can trap the walk oscillating around the
    // same spot with no net progress (common on a sparse or awkwardly
    // triangulated patch). Stop instead of burning the rest of the step
    // budget going nowhere, which used to pad the tail with duplicate
    // points and collapse the analyzed segment to zero length.
    if (distance3(next, current) < stepSize * 0.2) {
      stuckStreak++
      if (stuckStreak >= STUCK_STREAK_LIMIT) break
    } else {
      stuckStreak = 0
    }

    current = next
    path.push(current)
  }

  return path
}

// Adaptive-radius local diameter estimate at a single 3D sample point.
function estimateLocalDiameter(coords, point, initialRadius) {
  const n = coords.length / 3
  let radius = initialRadius

  for (let iteration = 0; iteration < MAX_RADIUS_ITERATIONS; iteration++) {
    const r2 = radius * radius
    let count = 0
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < n; i++) {
      const x = coords[i * 3]
      const y = coords[i * 3 + 1]
      const z = coords[i * 3 + 2]
      const dx = x - point[0]
      const dy = y - point[1]
      const dz = z - point[2]
      if (dx * dx + dy * dy + dz * dz <= r2) {
        count++
        sx += x
        sy += y
        sz += z
      }
    }

    // Only expand — never shrink. Shrinking after an expansion can bounce
    // back and forth across a sparse-to-dense boundary and never converge,
    // which used to make this give up entirely on some meshes.
    if (count < NEIGHBOR_TARGET_MIN) {
      radius *= 2
      continue
    }

    const cx = sx / count
    const cy = sy / count
    const cz = sz / count
    let maxR = 0
    for (let i = 0; i < n; i++) {
      const x = coords[i * 3]
      const y = coords[i * 3 + 1]
      const z = coords[i * 3 + 2]
      const dx = x - point[0]
      const dy = y - point[1]
      const dz = z - point[2]
      if (dx * dx + dy * dy + dz * dz <= r2) {
        const lx = x - cx
        const ly = y - cy
        const lz = z - cz
        const r = Math.sqrt(lx * lx + ly * ly + lz * lz)
        if (r > maxR) maxR = r
      }
    }
    return { diameter: maxR * 2, sampleCount: count, radiusUsed: radius }
  }

  return { diameter: null, sampleCount: 0, radiusUsed: radius }
}

export function measureLesionAutomatically(polyData) {
  const points = polyData.getPoints()
  const coords = points.getData()
  const bounds = polyData.getBounds()
  const diag = boundsDiagonal(bounds)

  const centroid = computeCentroid(coords)
  const tip = findFarthestPoint(coords, centroid)

  // Pull in 5% from the very tip to avoid the degenerate zero-width point
  // right at the branch end.
  const target = lerp3(centroid, tip, 0.95)
  const walkStepSize = diag * WALK_STEP_FRACTION_OF_DIAG

  // Two different guesses for where to start the walk both turn out to
  // work only some of the time, depending on this particular mesh's
  // proportions: (a) a point already inside the vessel-ish region (30% of
  // the way from centroid to tip, snapped onto the surface) can trap the
  // walk near its start if it's actually still inside the wide chamber;
  // (b) starting from the surface point nearest the centroid guarantees a
  // real surface start, but can trap the walk wandering the chamber's own
  // outer skin if the aim direction cuts through solid geometry. Run both
  // and keep whichever one actually travelled farther — a stuck walk's
  // total travelled distance stays small, so this is a simple, robust way
  // to tell which start worked for this particular model.
  const candidateStarts = [lerp3(centroid, tip, 0.3), centroid]
  const candidatePaths = candidateStarts.map((start) =>
    walkAndSnap(coords, start, target, walkStepSize, WALK_MAX_STEPS),
  )
  const fullPath = candidatePaths.reduce((best, candidate) =>
    pathLength(candidate) > pathLength(best) ? candidate : best,
  )

  const initialRadius = diag * 0.01
  const fullWidths = fullPath.map((p) => estimateLocalDiameter(coords, p, initialRadius))

  // Skip the first fraction of the walk — it's still crossing the wide
  // main chamber, not the vessel itself. (An attempt at detecting the
  // chamber/vessel boundary from the width profile directly turned out
  // less reliable than this fixed fraction across different meshes, so
  // this stays deliberately simple.)
  const entryIndex = Math.min(Math.floor(fullPath.length * SKIP_FRACTION), fullPath.length - 2)

  // The walk takes many small fixed-size steps, so the vessel segment from
  // entryIndex to the end of the walk can hold far more than SCAN_STEPS
  // points — downsample it to SCAN_STEPS+1 evenly spaced points so the
  // analysis covers the whole detected vessel length, not just the first
  // few fine-grained steps after entry.
  const vesselPath = fullPath.slice(entryIndex)
  const vesselWidths = fullWidths.slice(entryIndex)
  const lastIndex = vesselPath.length - 1
  const path = []
  const widths = []
  for (let i = 0; i <= SCAN_STEPS; i++) {
    const idx = lastIndex > 0 ? Math.round((i / SCAN_STEPS) * lastIndex) : 0
    path.push(vesselPath[idx])
    widths.push(vesselWidths[idx])
  }
  const proximal = path[0]
  const distal = path[path.length - 1]
  const proximalWidth = widths[0].diameter
  const distalWidth = widths[widths.length - 1].diameter

  if (!proximalWidth || !distalWidth) {
    return {
      ok: false,
      reason: '血管の幅を推定できませんでした（近位・遠位点で近傍点が見つかりません）',
      debug: { centroid, tip, proximal, distal, initialRadius, widths },
    }
  }

  let narrowestWidth = proximalWidth
  let narrowestPoint = proximal
  let narrowestStep = 0
  widths.forEach((w, step) => {
    if (w.diameter && w.diameter < narrowestWidth) {
      narrowestWidth = w.diameter
      narrowestPoint = path[step]
      narrowestStep = step
    }
  })

  const segmentLength = distance3(proximal, distal)
  const referenceDiameter = (proximalWidth + distalWidth) / 2
  const rawStenosisRate = referenceDiameter > 0 ? (1 - narrowestWidth / referenceDiameter) * 100 : 0
  const stenosisRate = Math.min(Math.max(rawStenosisRate, 0), 99)
  const mld = referenceDiameter * (1 - stenosisRate / 100)
  const mla = Math.PI * (mld / 2) ** 2

  const ratio = narrowestStep / SCAN_STEPS
  const lesionPosition = ratio < 1 / 3 ? '近位' : ratio > 2 / 3 ? '遠位' : '中間'

  return {
    ok: true,
    centroid,
    tip,
    proximal,
    distal,
    proximalWidth,
    distalWidth,
    narrowestWidth,
    narrowestPoint,
    segmentLength,
    stenosisRate,
    mld,
    mla,
    lesionPosition,
    path,
    widths: widths.map((w) => w.diameter),
    debug: {
      fullPathLength: fullPath.length,
      entryIndex,
      target,
      candidatePathLengths: candidatePaths.map(pathLength),
    },
  }
}
