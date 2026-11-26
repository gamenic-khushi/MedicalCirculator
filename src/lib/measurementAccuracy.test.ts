import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { describe, expect, it } from 'vitest'

import { measureVesselSweep } from '@/lib/vesselSweep'

// Accuracy of the measurement against a vessel whose true dimensions are known exactly.
//
// The vessel is a tube along y (30 mm long) whose radius is a known function,
//   r(y) = 2.5 - 1.7 * exp(-(((y - 15) / spread) ** 2))   (mm),
// built as a closed mesh of 60 rings of 24 segments (the same shape the browser tests use). Every
// "true" value below is worked out from that formula, not from the code under test:
//  - a ring of the mesh is a regular 24-gon of circumradius r, so its area is 12 r² sin(15°)
//    (1.1% under the circle's: the mesh is a polygon, not a circle) and the equivalent diameter
//    is 2 sqrt(area / pi);
//  - the narrowest cut is at y = 15, r = 0.8 mm;
//  - the stenosis length is where the area stays within 1.5 times the minimum: r <= sqrt(1.5) * 0.8.
const LENGTH = 30
const RINGS = 60
const SEGMENTS = 24
const radiusAt = (y: number, spread: number) => 2.5 - 1.7 * Math.exp(-(((y - LENGTH / 2) / spread) ** 2))
const equivalentDiameter = (area: number) => 2 * Math.sqrt(area / Math.PI)

function buildVessel(spread: number): THREE.Group {
  const positions: number[] = []
  const point = (ring: number, segment: number): [number, number, number] => {
    const y = (ring / RINGS) * LENGTH
    const angle = (segment / SEGMENTS) * Math.PI * 2
    const r = radiusAt(y, spread)
    return [r * Math.cos(angle), y, r * Math.sin(angle)]
  }
  const triangle = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c)
  for (let ring = 0; ring < RINGS; ring++) {
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const next = (segment + 1) % SEGMENTS
      triangle(point(ring, segment), point(ring, next), point(ring + 1, next))
      triangle(point(ring, segment), point(ring + 1, next), point(ring + 1, segment))
    }
  }
  for (let segment = 0; segment < SEGMENTS; segment++) {
    const next = (segment + 1) % SEGMENTS
    triangle([0, 0, 0], point(0, next), point(0, segment))
    triangle([0, LENGTH, 0], point(RINGS, segment), point(RINGS, next))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  ;(geometry as unknown as { boundsTree: MeshBVH }).boundsTree = new MeshBVH(geometry)
  const group = new THREE.Group()
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()))
  group.updateMatrixWorld(true)
  return group
}

// A point on the surface the way a click gives one: the centre of a facet, between two rings (a
// point exactly on a ring of vertices would make the cutting plane lie in the plane of that ring
// of the artificial mesh, which no scanned model does). It is 1/6 mm above ring `ring`.
const RING_STEP = LENGTH / RINGS
function facetCentre(ring: number, spread: number): THREE.Vector3 {
  const at = (r: number, segment: number) => {
    const y = r * RING_STEP
    const angle = (segment / SEGMENTS) * Math.PI * 2
    const radius = radiusAt(y, spread)
    return new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle))
  }
  return at(ring, 0).add(at(ring, 1)).add(at(ring + 1, 1)).multiplyScalar(1 / 3)
}
// The true area of the mesh cut by the plane at height y, worked out here on its own: the plane
// is cut with every triangle, the crossing points are ordered round the axis and the polygon they
// make is measured (shoelace). The cut of this star-shaped tube is one such polygon.
function meshSectionArea(y: number, spread: number): number {
  const vertices = (ring: number, segment: number) => {
    const yy = ring * RING_STEP
    const angle = (segment / SEGMENTS) * Math.PI * 2
    const radius = radiusAt(yy, spread)
    return [radius * Math.cos(angle), yy, radius * Math.sin(angle)]
  }
  const crossings: [number, number][] = []
  const edge = (p: number[], q: number[]) => {
    if ((p[1] - y) * (q[1] - y) < 0) {
      const t = (y - p[1]) / (q[1] - p[1])
      crossings.push([p[0] + t * (q[0] - p[0]), p[2] + t * (q[2] - p[2])])
    }
  }
  for (let ring = 0; ring < RINGS; ring++) {
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const next = (segment + 1) % SEGMENTS
      const a = vertices(ring, segment)
      const b = vertices(ring, next)
      const c = vertices(ring + 1, next)
      const d = vertices(ring + 1, segment)
      for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
        edge(p, q)
        edge(q, r)
        edge(r, p)
      }
    }
  }
  // Each crossing point of a shared edge was found by two triangles: keep one of each.
  const unique = crossings.filter((point, index) => crossings.findIndex((other) => Math.hypot(other[0] - point[0], other[1] - point[1]) < 1e-9) === index)
  unique.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]))
  let twice = 0
  for (let i = 0; i < unique.length; i++) {
    const [x1, z1] = unique[i]
    const [x2, z2] = unique[(i + 1) % unique.length]
    twice += x1 * z2 - x2 * z1
  }
  return Math.abs(twice) / 2
}
// The true narrowest cut of the mesh: the smallest section area over the whole vessel (every 0.01 mm).
function trueMinSectionArea(spread: number): number {
  let smallest = Infinity
  // (Not exactly on a ring of vertices, where a plane has no crossing points to count.)
  for (let y = 5.0003; y <= 25; y += 0.005) smallest = Math.min(smallest, meshSectionArea(y, spread))
  return smallest
}

// Where the area is within 1.5 times the minimum around the narrowest point, from the formula.
function trueStenosisLength(spread: number): number {
  const limitRadius = Math.sqrt(1.5) * 0.8
  const ratio = (2.5 - limitRadius) / 1.7
  return 2 * spread * Math.sqrt(-Math.log(ratio))
}

// ① and ② are the centres of facets at rings (y = ring / 2 mm, plus 1/6 mm).
const CASES: { spread: number; ring1: number; ring2: number }[] = [
  { spread: 3, ring1: 18, ring2: 42 },
  { spread: 3, ring1: 10, ring2: 50 },
  { spread: 3, ring1: 23, ring2: 39 },
  { spread: 14, ring1: 6, ring2: 54 },
  { spread: 1.4, ring1: 20, ring2: 40 },
]

describe('the measurement against a vessel of known dimensions', () => {
  const rows: Record<string, string | number>[] = []

  for (const { spread, ring1, ring2 } of CASES) {
    const y1 = ring1 * RING_STEP + RING_STEP / 3
    const y2 = ring2 * RING_STEP + RING_STEP / 3
    it(`spread ${spread}, ① at y=${y1.toFixed(2)}, ② at y=${y2.toFixed(2)}`, () => {
      const result = measureVesselSweep(buildVessel(spread), facetCentre(ring1, spread), facetCentre(ring2, spread))
      expect(result).not.toBeNull()
      const r = result!

      const trueProximal = equivalentDiameter(meshSectionArea(y1, spread))
      const trueDistal = equivalentDiameter(meshSectionArea(y2, spread))
      const trueMinArea = trueMinSectionArea(spread)
      const trueMinDiameter = equivalentDiameter(trueMinArea)
      const trueLength = y2 - y1
      const trueStenosis = trueStenosisLength(spread)

      rows.push({
        case: `s${spread} ${y1.toFixed(1)}-${y2.toFixed(1)}`,
        'prox true': +trueProximal.toFixed(3),
        'prox got': +r.proximalDiameter.toFixed(3),
        'dist true': +trueDistal.toFixed(3),
        'dist got': +r.distalDiameter.toFixed(3),
        'minA true': +trueMinArea.toFixed(3),
        'minA got': +r.minArea.toFixed(3),
        'minD true': +trueMinDiameter.toFixed(3),
        'minD got': +r.minDiameter.toFixed(3),
        'len true': trueLength,
        'len got': +r.length.toFixed(3),
        'sten true': +trueStenosis.toFixed(3),
        'sten got': +r.stenosisLength.toFixed(3),
        'narrowest at': +r.narrowestFraction.toFixed(3),
      })

      console.log('ACC ' + JSON.stringify(rows[rows.length - 1]))
      // Diameters at the two points (the cut is square to the vessel): within 2% of the true value.
      // Within 1% where the vessel is nearly straight; on the steep flank of the narrowing (① at
      // 3.3 mm from the narrowest cut) the plane measured is a fraction of a millimetre from the
      // clicked point and the width changes fast there, so up to about 1.6% off.
      expect(Math.abs(r.proximalDiameter - trueProximal) / trueProximal).toBeLessThan(0.02)
      expect(Math.abs(r.distalDiameter - trueDistal) / trueDistal).toBeLessThan(0.02)
      // Minimum area and diameter: the sweep cuts about every 0.15 of a diameter (0.24 mm at the
      // narrowest), so it can miss the exact narrowest cut: within 3% / 1.5% for a stenosis a few mm
      // long; for one as short as the mesh's own ring spacing (0.5 mm, spread 1.4) within 8% / 4%.
      const shortStenosis = spread < 2
      expect(Math.abs(r.minArea - trueMinArea) / trueMinArea).toBeLessThan(shortStenosis ? 0.08 : 0.03)
      expect(Math.abs(r.minDiameter - trueMinDiameter) / trueMinDiameter).toBeLessThan(shortStenosis ? 0.04 : 0.015)
      // Length of the centre line between the points: the sweep stops within half a step (0.075 of a
      // diameter, 0.4 mm here) before ②, so it can be that much short: within 4%.
      expect(Math.abs(r.length - trueLength) / trueLength).toBeLessThan(0.04)
      // Where the narrowest cut is, as a share of the way from ① to ②.
      expect(Math.abs(r.narrowestFraction - (15 - y1) / (y2 - y1))).toBeLessThan(0.03)
      // The stenosis length (area within 1.5 times the minimum): within 0.3 mm.
      expect(Math.abs(r.stenosisLength - trueStenosis)).toBeLessThan(0.3)
    })
  }

  it('prints the comparison', () => {
    // The table of true and measured values, for the report of the test.
    console.log('ACCURACY TABLE\n' + JSON.stringify(rows))
    expect(rows.length).toBe(CASES.length)
  })
})
