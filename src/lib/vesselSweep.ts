import * as THREE from 'three'

import { computeCrossSection } from '@/lib/slicePlane'
import type { LesionProfileSample } from '@/lib/twoPointLesionMeasurement'

export interface VesselSweepResult {
  proximalDiameter: number
  distalDiameter: number
  minArea: number
  minDiameter: number
  /** Length of the centre line between the two points. */
  length: number
  /** Where along the centre line the narrowest cut sits, 0 (proximal) to 1 (distal). */
  narrowestFraction: number
  narrowestPoint: THREE.Vector3
  /** Vessel direction at the narrowest cut (the cutting plane's normal there). */
  narrowestDirection: THREE.Vector3
  /** The vessel's outline along the centre line, from the proximal point to the distal one. */
  profile: LesionProfileSample[]
  /** The centre of the vessel at each entry of `profile`. */
  centres: THREE.Vector3[]
}

/**
 * Where along the centre line a plane crosses it, as a fraction of its length
 * (0 at the proximal point, 1 at the distal one); null when the plane does not
 * cross the centre line between the two points. `centres` and `arcs` are the
 * stations of the sweep and the centre-line length reached at each.
 */
export function centreLineFractionAtPlane(
  plane: THREE.Plane,
  centres: THREE.Vector3[],
  arcs: number[],
): number | null {
  const total = arcs[arcs.length - 1]
  if (centres.length < 2 || !(total > 0)) return null
  let previous = plane.distanceToPoint(centres[0])
  if (previous === 0) return 0
  for (let i = 1; i < centres.length; i++) {
    const current = plane.distanceToPoint(centres[i])
    if (previous * current < 0 || current === 0) {
      const t = previous / (previous - current)
      return (arcs[i - 1] + t * (arcs[i] - arcs[i - 1])) / total
    }
    previous = current
  }
  return null
}

interface LoopStats {
  area: number
  centroid: THREE.Vector3
  /** Distance from the query point to the closest vertex of the loop. */
  nearestVertexDistance: number
  loop: THREE.Vector3[]
}

const MAX_STEPS = 600
const STEP_FRACTION_OF_DIAMETER = 0.15
// The cut is considered to have "lost" the vessel when the next centre jumps
// farther than this many diameters from the previous one.
const MAX_CENTRE_JUMP_DIAMETERS = 1.2
// How many sweep steps (each 0.15 of a diameter) are used to find the vessel's
// direction at each end, for the square cut there.
const END_DIRECTION_STEPS = 6

function planeBasis(normal: THREE.Vector3) {
  const arbitrary = Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(normal, arbitrary).normalize()
  const v = new THREE.Vector3().crossVectors(normal, u).normalize()
  return { u, v }
}

function loopStats(loop: THREE.Vector3[], normal: THREE.Vector3, query: THREE.Vector3): LoopStats | null {
  const { u, v } = planeBasis(normal)
  let doubleArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < loop.length; i++) {
    const p1 = loop[i]
    const p2 = loop[(i + 1) % loop.length]
    const x1 = p1.dot(u)
    const y1 = p1.dot(v)
    const x2 = p2.dot(u)
    const y2 = p2.dot(v)
    const cross = x1 * y2 - x2 * y1
    doubleArea += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  if (Math.abs(doubleArea) < 1e-18) return null
  const area = Math.abs(doubleArea) / 2
  // Polygon centroid in the plane basis, rebuilt into 3D on the plane through
  // the loop's own first vertex.
  const gx = cx / (3 * doubleArea)
  const gy = cy / (3 * doubleArea)
  const origin = loop[0]
  const centroid = origin
    .clone()
    .addScaledVector(u, gx - origin.dot(u))
    .addScaledVector(v, gy - origin.dot(v))

  let nearest = Infinity
  for (const p of loop) nearest = Math.min(nearest, p.distanceTo(query))
  return { area, centroid, nearestVertexDistance: nearest, loop }
}

// The `up` direction used to read the vessel's outline at a station: the hint
// (the view's up) with the vessel's own direction taken out, so it lies in the
// cutting plane. Where the vessel runs along the hint, the previous station's
// `up` carries on, so the outline never flips between stations.
function stationUp(direction: THREE.Vector3, hint: THREE.Vector3 | undefined, previous: THREE.Vector3 | null) {
  for (const candidate of [hint, previous]) {
    if (!candidate) continue
    const up = candidate.clone().addScaledVector(direction, -candidate.dot(direction))
    if (up.lengthSq() >= 0.04 * candidate.lengthSq()) return up.normalize()
  }
  return planeBasis(direction).v
}

// How far the cut's outline reaches above and below the centre, along `up`.
function wallExtents(loop: THREE.Vector3[], centre: THREE.Vector3, up: THREE.Vector3) {
  let highest = -Infinity
  let lowest = Infinity
  for (const point of loop) {
    const offset = (point.x - centre.x) * up.x + (point.y - centre.y) * up.y + (point.z - centre.z) * up.z
    if (offset > highest) highest = offset
    if (offset < lowest) lowest = offset
  }
  return { top: highest, bottom: -lowest }
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })
  return meshes
}

function loopsAt(meshes: THREE.Mesh[], centre: THREE.Vector3, direction: THREE.Vector3) {
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(direction, centre)
  const loops: THREE.Vector3[][] = []
  for (const mesh of meshes) {
    const section = computeCrossSection(mesh, plane)
    if (section) loops.push(...section.loops)
  }
  return loops
}

// Picks the loop belonging to the vessel being measured: the one passing
// through the query point when it sits on the surface (the user's click), or
// the one whose centre is nearest otherwise (every later step of the sweep).
function pickLoop(
  loops: THREE.Vector3[][],
  direction: THREE.Vector3,
  query: THREE.Vector3,
  mode: 'surface' | 'centre',
): LoopStats | null {
  let best: LoopStats | null = null
  let bestScore = Infinity
  for (const loop of loops) {
    const stats = loopStats(loop, direction, query)
    if (!stats) continue
    const score = mode === 'surface' ? stats.nearestVertexDistance : stats.centroid.distanceTo(query)
    if (score < bestScore) {
      bestScore = score
      best = stats
    }
  }
  return best
}

function equivalentDiameter(area: number): number {
  return 2 * Math.sqrt(area / Math.PI)
}

function fibonacciDirections(count: number): THREE.Vector3[] {
  const directions: THREE.Vector3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    // Upper hemisphere only — a plane's normal and its opposite are the same cut.
    const y = (i + 0.5) / count
    const radius = Math.sqrt(1 - y * y)
    const theta = golden * i
    directions.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius))
  }
  return directions
}

const LOCATE_COARSE_DIRECTIONS = fibonacciDirections(64)

/**
 * Finds the centre and direction of the vessel at a point on its surface: the
 * cut through that point with the smallest area is the one square across the
 * vessel, and its normal is the vessel direction. Used to drop the slice plane
 * onto a spot the user clicked.
 */
export function locateVesselAt(
  modelRoot: THREE.Object3D,
  surfacePoint: THREE.Vector3,
): { point: THREE.Vector3; direction: THREE.Vector3; area: number } | null {
  const meshes = collectMeshes(modelRoot)
  if (meshes.length === 0) return null

  let best: { area: number; centroid: THREE.Vector3; direction: THREE.Vector3 } | null = null
  const tryDirection = (direction: THREE.Vector3) => {
    const stats = pickLoop(loopsAt(meshes, surfacePoint, direction), direction, surfacePoint, 'surface')
    if (!stats) return
    if (!best || stats.area < best.area) {
      best = { area: stats.area, centroid: stats.centroid, direction: direction.clone() }
    }
  }

  for (const direction of LOCATE_COARSE_DIRECTIONS) tryDirection(direction)
  if (!best) return null

  // Refine around the best coarse direction with a small cone of tilts.
  const coarse = (best as { direction: THREE.Vector3 }).direction
  const { u, v } = planeBasis(coarse)
  for (const tilt of [0.08, 0.16]) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const candidate = coarse
        .clone()
        .addScaledVector(u, Math.cos(angle) * tilt)
        .addScaledVector(v, Math.sin(angle) * tilt)
        .normalize()
      tryDirection(candidate)
    }
  }

  const result = best as { area: number; centroid: THREE.Vector3; direction: THREE.Vector3 }
  return { point: result.centroid, direction: result.direction, area: result.area }
}

/**
 * Measures the vessel between two points picked on its surface by sweeping a
 * cutting plane along the vessel's own centre line, so the result depends on
 * the real 3D shape and not on the camera angle or on exactly which pixel was
 * clicked. Each cut gives a true cross-section area; the diameters are the
 * equivalent circle of that area. Returns null when the sweep can't follow the
 * vessel (open mesh, point off the vessel), so the caller can fall back.
 *
 * `upHint` is the direction drawn as "up" in the outline returned in `profile`
 * (normally the view's up, so the outline is the vessel as seen on screen).
 */
export function measureVesselSweep(
  modelRoot: THREE.Object3D,
  proximalSurfacePoint: THREE.Vector3,
  distalSurfacePoint: THREE.Vector3,
  upHint?: THREE.Vector3,
): VesselSweepResult | null {
  const meshes = collectMeshes(modelRoot)
  if (meshes.length === 0) return null

  const initialDirection = new THREE.Vector3().subVectors(distalSurfacePoint, proximalSurfacePoint)
  if (initialDirection.lengthSq() === 0) return null
  initialDirection.normalize()

  const startLoop = pickLoop(
    loopsAt(meshes, proximalSurfacePoint, initialDirection),
    initialDirection,
    proximalSurfacePoint,
    'surface',
  )
  const endLoop = pickLoop(
    loopsAt(meshes, distalSurfacePoint, initialDirection),
    initialDirection,
    distalSurfacePoint,
    'surface',
  )
  if (!startLoop || !endLoop) return null

  const endCentre = endLoop.centroid
  let direction = new THREE.Vector3().subVectors(endCentre, startLoop.centroid).normalize()
  let centre = startLoop.centroid.clone()
  let stats: LoopStats = startLoop
  let previousCentre: THREE.Vector3 | null = null

  const profile: {
    area: number
    centre: THREE.Vector3
    arc: number
    direction: THREE.Vector3
    top: number
    bottom: number
  }[] = []
  let arc = 0
  let up: THREE.Vector3 | null = null

  for (let i = 0; i < MAX_STEPS; i++) {
    up = stationUp(direction, upHint, up)
    profile.push({
      area: stats.area,
      centre: stats.centroid.clone(),
      arc,
      direction: direction.clone(),
      ...wallExtents(stats.loop, stats.centroid, up),
    })

    const toEnd = new THREE.Vector3().subVectors(endCentre, stats.centroid)
    const diameter = equivalentDiameter(stats.area)
    const step = Math.max(diameter * STEP_FRACTION_OF_DIAMETER, 1e-9)
    if (toEnd.dot(direction) <= step * 0.5) break

    if (previousCentre) {
      const motion = new THREE.Vector3().subVectors(stats.centroid, previousCentre)
      if (motion.lengthSq() > 0) {
        direction = motion.normalize().multiplyScalar(0.6).addScaledVector(direction, 0.4).normalize()
      }
    }
    previousCentre = stats.centroid.clone()
    centre = stats.centroid.clone().addScaledVector(direction, step)

    const next = pickLoop(loopsAt(meshes, centre, direction), direction, centre, 'centre')
    if (!next) return null
    if (next.centroid.distanceTo(centre) > diameter * MAX_CENTRE_JUMP_DIAMETERS) return null
    arc += next.centroid.distanceTo(previousCentre)
    stats = next
  }

  if (profile.length < 2) return null

  let narrowest = profile[0]
  for (const entry of profile) if (entry.area < narrowest.area) narrowest = entry
  const first = profile[0]
  const last = profile[profile.length - 1]
  const totalArc = last.arc

  // The first cut was made square to the straight line from ① to ②, and the
  // last one square to the direction the sweep had reached, which is not the
  // vessel's own direction where it bends or where ①/② sit off that line — an
  // oblique cut reads too wide. Cut each end square to the vessel's direction
  // there, taken from the centre line just followed, so the proximal and distal
  // diameters are the vessel's true diameter at the two points.
  const span = Math.min(END_DIRECTION_STEPS, profile.length - 1)
  const squareCut = (centre: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3, fallback: (typeof profile)[number]) => {
    const direction = new THREE.Vector3().subVectors(to, from)
    if (direction.lengthSq() === 0) return fallback
    direction.normalize()
    const cut = pickLoop(loopsAt(meshes, centre, direction), direction, centre, 'centre')
    if (!cut) return fallback
    const endUp = stationUp(direction, upHint, fallback.direction)
    return { ...fallback, area: cut.area, ...wallExtents(cut.loop, cut.centroid, endUp) }
  }
  const proximalCut = squareCut(first.centre, first.centre, profile[span].centre, first)
  const distalCut = squareCut(last.centre, profile[profile.length - 1 - span].centre, last.centre, last)

  // The outline between the two points: the ends are the square cuts, so the
  // diameters at ① and ② are exactly the ones reported above.
  const outline: LesionProfileSample[] = profile.map((entry, index) => {
    const source = index === 0 ? proximalCut : index === profile.length - 1 ? distalCut : entry
    return { arc: entry.arc, top: source.top, bottom: source.bottom }
  })

  return {
    proximalDiameter: equivalentDiameter(proximalCut.area),
    distalDiameter: equivalentDiameter(distalCut.area),
    minArea: narrowest.area,
    minDiameter: equivalentDiameter(narrowest.area),
    length: totalArc,
    narrowestFraction: totalArc > 0 ? narrowest.arc / totalArc : 0.5,
    narrowestPoint: narrowest.centre.clone(),
    narrowestDirection: narrowest.direction.clone(),
    profile: outline,
    centres: profile.map((entry) => entry.centre.clone()),
  }
}
