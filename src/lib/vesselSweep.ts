import * as THREE from 'three'

import { computeCrossSection } from '@/lib/slicePlane'

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
}

interface LoopStats {
  area: number
  centroid: THREE.Vector3
  /** Distance from the query point to the closest vertex of the loop. */
  nearestVertexDistance: number
}

const MAX_STEPS = 600
const STEP_FRACTION_OF_DIAMETER = 0.15
// The cut is considered to have "lost" the vessel when the next centre jumps
// farther than this many diameters from the previous one.
const MAX_CENTRE_JUMP_DIAMETERS = 1.2

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
  return { area, centroid, nearestVertexDistance: nearest }
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

/**
 * Measures the vessel between two points picked on its surface by sweeping a
 * cutting plane along the vessel's own centre line, so the result depends on
 * the real 3D shape and not on the camera angle or on exactly which pixel was
 * clicked. Each cut gives a true cross-section area; the diameters are the
 * equivalent circle of that area. Returns null when the sweep can't follow the
 * vessel (open mesh, point off the vessel), so the caller can fall back.
 */
export function measureVesselSweep(
  modelRoot: THREE.Object3D,
  proximalSurfacePoint: THREE.Vector3,
  distalSurfacePoint: THREE.Vector3,
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

  const profile: { area: number; centre: THREE.Vector3; arc: number; direction: THREE.Vector3 }[] = []
  let arc = 0

  for (let i = 0; i < MAX_STEPS; i++) {
    profile.push({ area: stats.area, centre: stats.centroid.clone(), arc, direction: direction.clone() })

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

  return {
    proximalDiameter: equivalentDiameter(first.area),
    distalDiameter: equivalentDiameter(last.area),
    minArea: narrowest.area,
    minDiameter: equivalentDiameter(narrowest.area),
    length: totalArc,
    narrowestFraction: totalArc > 0 ? narrowest.arc / totalArc : 0.5,
    narrowestPoint: narrowest.centre.clone(),
    narrowestDirection: narrowest.direction.clone(),
  }
}
