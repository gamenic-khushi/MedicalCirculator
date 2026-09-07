// Automatic (no manual clicks) lesion-measurement heuristic, run directly
// against VTK.js polydata point coordinates.
//
// This mirrors the math of the production two-point algorithm
// (src/lib/twoPointLesionMeasurement.ts) — same stenosis-rate formula, same
// 近位/中間/遠位 position classification — but automates the two steps that
// are manual there: (1) picking the proximal/distal points, and (2)
// measuring the local vessel width at each sample.
//
// Path tracing follows the LOCAL direction of travel (like tracing a wire
// with your finger) rather than aiming at one fixed distant target. An
// earlier version aimed each step at the single mesh point farthest from
// the centroid in straight-line distance — that breaks on a COILED vessel,
// where the true tip can be geometrically close to the centroid despite
// being far away along the curving path, so the walk aimed at the wrong
// place entirely and stalled at the first junction. Tangent-following
// doesn't care where the tip ends up in space; it just keeps advancing
// along whatever surface is locally ahead, so it follows a curl correctly.
//
// Since we don't know up front which of possibly several branches is the
// one worth analyzing, several candidate starting directions are tried
// (via farthest-point sampling from the body) and whichever walk covers
// the most real distance before getting stuck is kept as "the" branch.
//
// This is still a ROUGH ESTIMATE by design (per Aki-san's stated
// requirement), not a clinical-grade centerline extraction:
//
//  - It does not distinguish between separate arteries — on a tree with
//    multiple long branches it follows whichever one the winning candidate
//    direction happened to reach.
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

const WALK_STEP_FRACTION_OF_DIAG = 0.006
const WALK_MAX_STEPS = 600
const STUCK_STREAK_LIMIT = 5
const DIRECTION_SMOOTHING = 0.65 // weight kept from the previous direction each step
const NUM_CANDIDATE_DIRECTIONS = 8
const SKIP_FRACTION = 0.35
const NEIGHBOR_TARGET_MIN = 8
const MAX_RADIUS_ITERATIONS = 12
const WIDTH_SAMPLE_COUNT = 80 // width profile points per candidate branch
const LOCAL_WINDOW = 8 // samples each side, for "how much narrower than its own neighborhood"
const SEGMENT_HALF_WIDTH = 10 // samples each side of the narrowest point, for the reported segment

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

// Picks `k` mesh points spread across the model's extremities: repeatedly
// choose whichever point is farthest from every point picked so far. Unlike
// a single "farthest from centroid" point, this reliably lands near the tip
// of several different branches even when some of those branches coil back
// close to the body — each candidate becomes a starting direction to try.
function farthestPointSample(coords, seed, k) {
  const n = coords.length / 3
  const picked = [seed]
  for (let iteration = 0; iteration < k; iteration++) {
    let bestDist2 = -1
    let bestPoint = null
    for (let i = 0; i < n; i++) {
      const x = coords[i * 3]
      const y = coords[i * 3 + 1]
      const z = coords[i * 3 + 2]
      let minDist2ToPicked = Infinity
      for (const p of picked) {
        const dx = x - p[0]
        const dy = y - p[1]
        const dz = z - p[2]
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 < minDist2ToPicked) minDist2ToPicked = d2
      }
      if (minDist2ToPicked > bestDist2) {
        bestDist2 = minDist2ToPicked
        bestPoint = [x, y, z]
      }
    }
    if (!bestPoint) break
    picked.push(bestPoint)
  }
  return picked.slice(1)
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2])
  if (len < 1e-9) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
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

// Walk from `start`, continuing in whatever direction the path has been
// heading — re-derived from the last real step, not aimed at a fixed
// target — so it follows a curving or coiled vessel instead of cutting
// toward a point that may not even be the true tip.
function walkFollowingTangent(coords, start, initialDirection, stepSize, maxSteps) {
  const path = [findNearestMeshPoint(coords, start)]
  let current = path[0]
  let direction = normalize3(initialDirection)
  let stuckStreak = 0

  for (let step = 0; step < maxSteps; step++) {
    if (direction[0] === 0 && direction[1] === 0 && direction[2] === 0) break

    const guess = [
      current[0] + direction[0] * stepSize,
      current[1] + direction[1] * stepSize,
      current[2] + direction[2] * stepSize,
    ]
    const next = findNearestMeshPoint(coords, guess)
    const moved = distance3(next, current)

    if (moved < stepSize * 0.2) {
      stuckStreak++
      if (stuckStreak >= STUCK_STREAK_LIMIT) break
      continue
    }
    stuckStreak = 0

    const newDirection = normalize3([next[0] - current[0], next[1] - current[1], next[2] - current[2]])
    direction = normalize3([
      direction[0] * DIRECTION_SMOOTHING + newDirection[0] * (1 - DIRECTION_SMOOTHING),
      direction[1] * DIRECTION_SMOOTHING + newDirection[1] * (1 - DIRECTION_SMOOTHING),
      direction[2] * DIRECTION_SMOOTHING + newDirection[2] * (1 - DIRECTION_SMOOTHING),
    ])
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
  const bodyStart = findNearestMeshPoint(coords, centroid)
  const walkStepSize = diag * WALK_STEP_FRACTION_OF_DIAG
  const initialRadius = diag * 0.01

  // Try several different starting directions (toward several well-spread
  // extremities of the mesh, not just the single farthest point) — a real
  // vessel tree has multiple branches, and the induced lesion in a test
  // file could be on any of them.
  const candidateTargets = farthestPointSample(coords, centroid, NUM_CANDIDATE_DIRECTIONS)

  // For each branch, walk it, skip the part still crossing the main
  // chamber, then sample its width profile. Instead of just reporting
  // "whatever's narrowest along the branch we happened to walk farthest
  // on" (which tends to land on incidental anatomy, not the actual
  // lesion), score every sampled point by how much narrower it is than
  // its OWN local neighborhood — a real stenosis is a local dip, not
  // just the thinnest point on an arbitrarily long walk. The best local
  // dip found across every branch is taken as the lesion.
  let best = null
  const branchDebug = []

  candidateTargets.forEach((target, branchIndex) => {
    const fullPath = walkFollowingTangent(
      coords,
      bodyStart,
      [target[0] - bodyStart[0], target[1] - bodyStart[1], target[2] - bodyStart[2]],
      walkStepSize,
      WALK_MAX_STEPS,
    )
    const entryIndex = Math.min(Math.floor(fullPath.length * SKIP_FRACTION), Math.max(fullPath.length - 2, 0))
    const vesselPath = fullPath.slice(entryIndex)
    branchDebug.push({ branchIndex, fullPathLength: fullPath.length, vesselPathLength: vesselPath.length })
    if (vesselPath.length < LOCAL_WINDOW * 2) return

    const sampleCount = Math.min(WIDTH_SAMPLE_COUNT, vesselPath.length)
    const samplePath = []
    for (let i = 0; i < sampleCount; i++) {
      const idx = sampleCount > 1 ? Math.round((i / (sampleCount - 1)) * (vesselPath.length - 1)) : 0
      samplePath.push(vesselPath[idx])
    }
    const sampleWidths = samplePath.map((p) => estimateLocalDiameter(coords, p, initialRadius).diameter)

    for (let j = 0; j < sampleWidths.length; j++) {
      const d = sampleWidths[j]
      if (!d) continue
      const lo = Math.max(0, j - LOCAL_WINDOW)
      const hi = Math.min(sampleWidths.length - 1, j + LOCAL_WINDOW)
      let localMax = 0
      for (let k = lo; k <= hi; k++) {
        if (sampleWidths[k] && sampleWidths[k] > localMax) localMax = sampleWidths[k]
      }
      if (localMax <= 0) continue
      const score = 1 - d / localMax
      if (!best || score > best.score) {
        best = { branchIndex, samplePath, sampleWidths, narrowIndex: j, score, localMax }
      }
    }
  })

  if (!best) {
    return {
      ok: false,
      reason: '血管の幅を推定できませんでした（有効な分岐が見つかりません）',
      debug: { centroid, bodyStart, branchDebug },
    }
  }

  const { samplePath, sampleWidths, narrowIndex, branchIndex, score } = best
  const proxIdx = Math.max(0, narrowIndex - SEGMENT_HALF_WIDTH)
  const distIdx = Math.min(sampleWidths.length - 1, narrowIndex + SEGMENT_HALF_WIDTH)

  const path = samplePath.slice(proxIdx, distIdx + 1)
  const widths = sampleWidths.slice(proxIdx, distIdx + 1)
  const proximal = path[0]
  const distal = path[path.length - 1]
  const proximalWidth = widths[0]
  const distalWidth = widths[widths.length - 1]
  const narrowestWidth = sampleWidths[narrowIndex]
  const narrowestPoint = samplePath[narrowIndex]

  if (!proximalWidth || !distalWidth || !narrowestWidth) {
    return {
      ok: false,
      reason: '血管の幅を推定できませんでした（近位・遠位点で近傍点が見つかりません）',
      debug: { centroid, bodyStart, proximal, distal, branchIndex, branchDebug },
    }
  }

  const segmentLength = distance3(proximal, distal)
  const referenceDiameter = (proximalWidth + distalWidth) / 2
  const rawStenosisRate = referenceDiameter > 0 ? (1 - narrowestWidth / referenceDiameter) * 100 : 0
  const stenosisRate = Math.min(Math.max(rawStenosisRate, 0), 99)
  const mld = referenceDiameter * (1 - stenosisRate / 100)
  const mla = Math.PI * (mld / 2) ** 2

  const narrowestStep = narrowIndex - proxIdx
  const totalSteps = distIdx - proxIdx
  const ratio = totalSteps > 0 ? narrowestStep / totalSteps : 0.5
  const lesionPosition = ratio < 1 / 3 ? '近位' : ratio > 2 / 3 ? '遠位' : '中間'

  return {
    ok: true,
    centroid,
    bodyStart,
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
    widths,
    debug: {
      winningBranch: branchIndex,
      narrowingScore: score,
      branchDebug,
    },
  }
}
