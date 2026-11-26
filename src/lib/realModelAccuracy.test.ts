/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { MeshBVH } from 'three-mesh-bvh'
import { describe, expect, it } from 'vitest'

import { extendVesselSweep, locateVesselAt, measureVesselSweep } from '@/lib/vesselSweep'

// Accuracy of the measurement on a REAL model (a coronary tree scanned in mm, 210,822 triangles).
// A real scan has no known true size, so this is checked without one:
//  1. the cross-section areas the measurement reports are worked out again here, on their own, from the
//     raw triangles (plane against every triangle, loops chained, shoelace area);
//  2. the narrowest cut it found is compared with the narrowest cut of a 10 times finer sampling along
//     the same centre line (how much the coarse sweep can miss);
//  3. the model is turned and moved (three arbitrary placements): the numbers must not change;
//  4. the two clicked points are moved along the vessel (nine pairs): the numbers must hardly change.
// The test is skipped on a computer without the model file.
const FILE = process.env.REAL_STL ?? 'D:/Company work/resized_test_files_mm/NC6_V1P2_KyosakuTest1_mm.stl'
const present = existsSync(FILE)

// --- the independent section area ------------------------------------------------------------------
type V3 = [number, number, number]

function basisOf(normal: THREE.Vector3) {
  const helper = Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(normal, helper).normalize()
  const v = new THREE.Vector3().crossVectors(normal, u).normalize()
  return { u, v }
}

/** The loops the plane through `centre` with `normal` makes with the triangles (raw, brute force). */
function sectionLoops(positions: ArrayLike<number>, centre: THREE.Vector3, normal: THREE.Vector3): V3[][] {
  const n = normal.clone().normalize()
  const offset = n.dot(centre)
  const count = positions.length / 9
  const key = (p: V3) => `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`
  const adjacency = new Map<string, { to: V3; used: boolean }[]>()
  const segments: { a: V3; b: V3; used: boolean }[] = []
  const cut = (p: V3, dp: number, q: V3, dq: number): V3 => {
    // The same edge always gives the same point, whichever triangle it is reached from.
    const first = p[0] < q[0] || (p[0] === q[0] && (p[1] < q[1] || (p[1] === q[1] && p[2] < q[2])))
    const [a, da, b, db] = first ? [p, dp, q, dq] : [q, dq, p, dp]
    const t = da / (da - db)
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]
  }
  for (let i = 0; i < count; i++) {
    const o = i * 9
    const p: V3[] = [
      [positions[o], positions[o + 1], positions[o + 2]],
      [positions[o + 3], positions[o + 4], positions[o + 5]],
      [positions[o + 6], positions[o + 7], positions[o + 8]],
    ]
    const d = p.map((q) => {
      const value = n.x * q[0] + n.y * q[1] + n.z * q[2] - offset
      return Math.abs(value) < 1e-9 ? 1e-9 : value
    })
    const hits: V3[] = []
    for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) {
      if (d[x] > 0 !== d[y] > 0) hits.push(cut(p[x], d[x], p[y], d[y]))
    }
    if (hits.length === 2) segments.push({ a: hits[0], b: hits[1], used: false })
  }
  const link = (from: V3, to: V3) => {
    const k = key(from)
    if (!adjacency.has(k)) adjacency.set(k, [])
    adjacency.get(k)!.push({ to, used: false })
  }
  for (const s of segments) {
    link(s.a, s.b)
    link(s.b, s.a)
  }
  const loops: V3[][] = []
  const done = new Set<string>()
  for (const s of segments) {
    if (done.has(key(s.a))) continue
    const loop: V3[] = [s.a]
    done.add(key(s.a))
    let current = s.b
    let guard = 0
    while (guard++ < 100000) {
      const k = key(current)
      if (done.has(k)) break
      done.add(k)
      loop.push(current)
      const next = adjacency.get(k)?.find((e) => !done.has(key(e.to)))
      if (!next) break
      current = next.to
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

function loopArea(loop: V3[], normal: THREE.Vector3): { area: number; centroid: THREE.Vector3 } {
  const { u, v } = basisOf(normal.clone().normalize())
  let twice = 0
  const centroid = new THREE.Vector3()
  for (let i = 0; i < loop.length; i++) {
    const p = new THREE.Vector3(...loop[i])
    const q = new THREE.Vector3(...loop[(i + 1) % loop.length])
    twice += p.dot(u) * q.dot(v) - q.dot(u) * p.dot(v)
    centroid.add(p)
  }
  return { area: Math.abs(twice) / 2, centroid: centroid.multiplyScalar(1 / loop.length) }
}

/** Area of the vessel's cut at a plane: the loop whose middle is nearest `centre`. */
function sectionArea(positions: ArrayLike<number>, centre: THREE.Vector3, normal: THREE.Vector3) {
  let best: { area: number; centroid: THREE.Vector3; loop: V3[] } | null = null
  for (const loop of sectionLoops(positions, centre, normal)) {
    const { area, centroid } = loopArea(loop, normal)
    if (area < 1e-6) continue
    if (!best || centroid.distanceTo(centre) < best.centroid.distanceTo(centre)) best = { area, centroid, loop }
  }
  return best
}

const eqDiameter = (area: number) => 2 * Math.sqrt(area / Math.PI)

// --- loading ---------------------------------------------------------------------------------------
function load(transform?: THREE.Matrix4) {
  const buffer = readFileSync(FILE)
  const geometry = new STLLoader().parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  if (transform) geometry.applyMatrix4(transform)
  ;(geometry as unknown as { boundsTree: MeshBVH }).boundsTree = new MeshBVH(geometry)
  const group = new THREE.Group()
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()))
  group.updateMatrixWorld(true)
  return { group, positions: geometry.attributes.position.array as Float32Array }
}

interface Setup {
  /** Stations of the vessel, from its start to its end, with the vessel's direction at each. */
  stations: { centre: THREE.Vector3; direction: THREE.Vector3; arc: number }[]
  /** The station of a real narrowing (the area is at most 75% of what it is 3 to 8 mm either side), if the vessel has one. */
  dip: number | null
  /** How narrow it is: its area over the smaller of the two wider areas. */
  dipRatio: number
}

// A real narrowing along the vessel: the area, worked out independently, drops to 75% or less of the
// larger areas both 3 to 8 mm before and after it.
function findDip(positions: Float32Array, stations: Setup['stations']): { dip: number | null; ratio: number } {
  const total = stations[stations.length - 1].arc
  const areas: (number | null)[] = stations.map((s, i) => (i % 3 === 0 ? (sectionArea(positions, s.centre, s.direction)?.area ?? null) : null))
  let best: { dip: number; ratio: number } | null = null
  for (let i = 0; i < stations.length; i += 3) {
    const here = areas[i]
    if (here === null || stations[i].arc < 9 || stations[i].arc > total - 9) continue
    const around = (from: number, to: number) => {
      let widest = 0
      for (let j = 0; j < stations.length; j += 3) {
        const a = areas[j]
        const distance = stations[j].arc - stations[i].arc
        if (a !== null && distance >= from && distance <= to) widest = Math.max(widest, a)
      }
      return widest
    }
    const before = around(-8, -3)
    const after = around(3, 8)
    if (before === 0 || after === 0) continue
    const ratio = here / Math.min(before, after)
    if (!best || ratio < best.ratio) best = { dip: i, ratio }
  }
  return best && best.ratio <= 0.75 ? { dip: best.dip, ratio: best.ratio } : { dip: null, ratio: best?.ratio ?? 1 }
}

// A long vessel with a real narrowing, found from surface points on 3 to 5 mm vessels (every 997th
// triangle). If none of the first few has a narrowing, the one with the strongest dip is used.
function findVessel(model: ReturnType<typeof load>): Setup {
  const position = (model.group.children[0] as THREE.Mesh).geometry.attributes.position
  let fallback: Setup | null = null
  let tried = 0
  for (let tri = 3 * 997; tri < position.count / 3 && tried < 10; tri += 997) {
    const c = new THREE.Vector3()
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3().fromBufferAttribute(position, tri * 3 + k))
    c.multiplyScalar(1 / 3)
    const at = locateVesselAt(model.group, c)
    if (!at) continue
    const d = eqDiameter(at.area)
    if (d < 3 || d > 5) continue
    const forward = extendVesselSweep(model.group, at.point, at.direction, 400)
    const back = extendVesselSweep(model.group, at.point, at.direction.clone().negate(), 400)
    if (forward.length + back.length < 120) continue
    tried += 1
    const centres = [...back.map((s) => s.centre).reverse(), at.point.clone(), ...forward.map((s) => s.centre)]
    const stations: Setup['stations'] = []
    let arc = 0
    for (let i = 0; i < centres.length; i++) {
      if (i > 0) arc += centres[i].distanceTo(centres[i - 1])
      const direction = centres[Math.min(i + 2, centres.length - 1)].clone().sub(centres[Math.max(i - 2, 0)]).normalize()
      stations.push({ centre: centres[i], direction, arc })
    }
    const { dip, ratio } = findDip(model.positions, stations)
    const setup: Setup = { stations, dip, dipRatio: ratio }
    if (dip !== null) return setup
    if (!fallback || ratio < fallback.dipRatio) fallback = setup
  }
  if (fallback) return fallback
  throw new Error('no vessel found')
}

// A point on the surface at a station: a vertex of the independent loop there.
function surfacePointAt(positions: Float32Array, station: Setup['stations'][number], side: number): THREE.Vector3 {
  const hit = sectionArea(positions, station.centre, station.direction)!
  const { u, v } = basisOf(station.direction)
  const wanted = u.clone().multiplyScalar(Math.cos(side)).addScaledVector(v, Math.sin(side))
  let best = hit.loop[0]
  let score = -Infinity
  for (const p of hit.loop) {
    const s = new THREE.Vector3(...p).sub(hit.centroid).dot(wanted)
    if (s > score) {
      score = s
      best = p
    }
  }
  return new THREE.Vector3(...best)
}

describe.skipIf(!present)('the measurement on a real coronary model', { timeout: 300_000 }, () => {
  const rows: Record<string, number | string>[] = []
  const model = present ? load() : null
  const vessel = present ? findVessel(model!) : null

  // The narrowing, and the two points 5 mm either side of it.
  const plan = (() => {
    if (!model || !vessel) return null
    const { stations } = vessel
    const narrowest = vessel.dip ?? Math.floor(stations.length / 2)
    const at = (arc: number) => {
      let best = 0
      for (let i = 0; i < stations.length; i++) if (Math.abs(stations[i].arc - arc) < Math.abs(stations[best].arc - arc)) best = i
      return best
    }
    return { narrowest, at, narrowArc: stations[narrowest].arc }
  })()

  const pointsFor = (offset1: number, offset2: number, positions: Float32Array, map: (p: THREE.Vector3) => THREE.Vector3 = (p) => p) => {
    const { stations } = vessel!
    const s1 = stations[plan!.at(plan!.narrowArc - 5 + offset1)]
    const s2 = stations[plan!.at(plan!.narrowArc + 5 + offset2)]
    return [map(surfacePointAt(positions, s1, 0.7)), map(surfacePointAt(positions, s2, 0.7))] as const
  }

  it('the model has a vessel with a real narrowing to measure', () => {
    console.log('REAL ' + JSON.stringify({ check: 'lesion', 'dip ratio': +vessel!.dipRatio.toFixed(2), 'vessel stations': vessel!.stations.length, 'vessel length (mm)': +vessel!.stations[vessel!.stations.length - 1].arc.toFixed(1) }))
    expect(vessel!.dip).not.toBeNull()
  })

  it('the areas it reports are the areas of the mesh: checked against an independent calculation', () => {
    const [p1, p2] = pointsFor(0, 0, model!.positions)
    const result = measureVesselSweep(model!.group, p1, p2)
    expect(result).not.toBeNull()
    const r = result!
    // The narrowest cut it reports, worked out again from the raw triangles at the same plane.
    const again = sectionArea(model!.positions, r.narrowestPoint, r.narrowestDirection)!
    // The diameters at ① and ②: the plane through each end centre, square to the centre line there.
    const span = Math.min(6, r.centres.length - 1)
    const dirStart = r.centres[span].clone().sub(r.centres[0]).normalize()
    const dirEnd = r.centres[r.centres.length - 1].clone().sub(r.centres[r.centres.length - 1 - span]).normalize()
    const startAgain = sectionArea(model!.positions, r.centres[0], dirStart)!
    const endAgain = sectionArea(model!.positions, r.centres[r.centres.length - 1], dirEnd)!
    // The narrowest cut over a 10 times finer sampling of the same centre line.
    let fineMin = Infinity
    for (let i = 0; i < r.centres.length - 1; i++) {
      for (let k = 0; k < 10; k++) {
        const t = k / 10
        const c = r.centres[i].clone().lerp(r.centres[i + 1], t)
        const dir = r.centres[Math.min(i + 2, r.centres.length - 1)].clone().sub(r.centres[Math.max(i - 1, 0)]).normalize()
        const hit = sectionArea(model!.positions, c, dir)
        if (hit && hit.area < fineMin) fineMin = hit.area
      }
    }
    const row = {
      check: 'independent areas',
      'lesion found (area / wider areas)': vessel!.dip === null ? 'none: gently tapering vessel' : +vessel!.dipRatio.toFixed(2),
      'vessel eq. D at the narrowest (mm)': +eqDiameter(again.area).toFixed(3),
      'min area reported': +r.minArea.toFixed(4),
      'min area, same plane, independent': +again.area.toFixed(4),
      'min area, 10x finer sampling': +fineMin.toFixed(4),
      'prox D reported': +r.proximalDiameter.toFixed(3),
      'prox D independent': +eqDiameter(startAgain.area).toFixed(3),
      'dist D reported': +r.distalDiameter.toFixed(3),
      'dist D independent': +eqDiameter(endAgain.area).toFixed(3),
      'centre line (mm)': +r.length.toFixed(2),
      'stenosis length (mm)': +r.stenosisLength.toFixed(2),
    }
    rows.push(row)
    console.log('REAL ' + JSON.stringify(row))
    expect(Math.abs(r.minArea - again.area) / again.area).toBeLessThan(0.005)
    expect(Math.abs(r.proximalDiameter - eqDiameter(startAgain.area)) / eqDiameter(startAgain.area)).toBeLessThan(0.01)
    expect(Math.abs(r.distalDiameter - eqDiameter(endAgain.area)) / eqDiameter(endAgain.area)).toBeLessThan(0.01)
    // The coarse sweep cannot find a smaller area than the finer sampling; it may be a little higher.
    expect(r.minArea / fineMin).toBeGreaterThan(0.995)
    expect(r.minArea / fineMin).toBeLessThan(1.06)
  })

  it('turning and moving the model does not change the numbers', () => {
    const base = (() => {
      const [p1, p2] = pointsFor(0, 0, model!.positions)
      return measureVesselSweep(model!.group, p1, p2)!
    })()
    const placements = [
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.7, 1.9, -0.4)).setPosition(12, -340, 55),
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-2.3, 0.35, 1.1)).setPosition(-80, 20, 600),
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(3.0, -1.2, 2.2)).setPosition(5, 5, -5),
    ]
    const [b1, b2] = pointsFor(0, 0, model!.positions)
    placements.forEach((matrix, index) => {
      const moved = load(matrix)
      const r = measureVesselSweep(moved.group, b1.clone().applyMatrix4(matrix), b2.clone().applyMatrix4(matrix))
      expect(r).not.toBeNull()
      const row = {
        check: `placement ${index + 1}`,
        'min area': +r!.minArea.toFixed(4),
        'min area (original)': +base.minArea.toFixed(4),
        'min D': +r!.minDiameter.toFixed(3),
        'prox D': +r!.proximalDiameter.toFixed(3),
        'prox D (original)': +base.proximalDiameter.toFixed(3),
        'dist D': +r!.distalDiameter.toFixed(3),
        'dist D (original)': +base.distalDiameter.toFixed(3),
        'stenosis length': +r!.stenosisLength.toFixed(2),
        'stenosis length (original)': +base.stenosisLength.toFixed(2),
      }
      rows.push(row)
      console.log('REAL ' + JSON.stringify(row))
      expect(Math.abs(r!.minArea - base.minArea) / base.minArea).toBeLessThan(0.04)
      expect(Math.abs(r!.proximalDiameter - base.proximalDiameter) / base.proximalDiameter).toBeLessThan(0.02)
      expect(Math.abs(r!.distalDiameter - base.distalDiameter) / base.distalDiameter).toBeLessThan(0.02)
      expect(Math.abs(r!.stenosisLength - base.stenosisLength)).toBeLessThan(0.4)
    })
  })

  it('moving the two clicked points along the vessel hardly changes the narrowest cut', () => {
    const offsets = [-1.2, 0, 1.2]
    const minAreas: number[] = []
    const minDiameters: number[] = []
    const stenosisLengths: number[] = []
    for (const o1 of offsets) {
      for (const o2 of offsets) {
        const [p1, p2] = pointsFor(o1, o2, model!.positions)
        const r = measureVesselSweep(model!.group, p1, p2)
        expect(r).not.toBeNull()
        minAreas.push(r!.minArea)
        minDiameters.push(r!.minDiameter)
        stenosisLengths.push(r!.stenosisLength)
      }
    }
    const spread = (values: number[]) => (Math.max(...values) - Math.min(...values)) / (values.reduce((a, b) => a + b, 0) / values.length)
    const row = {
      check: '9 pairs of clicked points (±1.2 mm)',
      'min area range (mm²)': `${Math.min(...minAreas).toFixed(4)} to ${Math.max(...minAreas).toFixed(4)}`,
      'min area spread %': +(spread(minAreas) * 100).toFixed(2),
      'min D range (mm)': `${Math.min(...minDiameters).toFixed(3)} to ${Math.max(...minDiameters).toFixed(3)}`,
      'min D spread %': +(spread(minDiameters) * 100).toFixed(2),
      'stenosis length range (mm)': `${Math.min(...stenosisLengths).toFixed(2)} to ${Math.max(...stenosisLengths).toFixed(2)}`,
    }
    rows.push(row)
    console.log('REAL ' + JSON.stringify(row))
    expect(spread(minAreas)).toBeLessThan(0.04)
    expect(spread(minDiameters)).toBeLessThan(0.02)
    expect(Math.max(...stenosisLengths) - Math.min(...stenosisLengths)).toBeLessThan(0.6)
  })
})
