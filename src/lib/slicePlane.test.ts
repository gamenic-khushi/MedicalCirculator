import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { describe, expect, it } from 'vitest'

import { lengthwiseCut, lengthwiseCutAtDepth } from '@/lib/slicePlane'

const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
const rect = (s0: number, s1: number, t0: number, t1: number) => [v(s0, t0), v(s1, t0), v(s1, t1), v(s0, t1)]
// The viewer looks along -z: up the screen is +y, across it +x.
const UP = v(0, 1)
const SIDE = v(1, 0)

describe('lengthwiseCut', () => {
  const station = (s: number, arc: number) => ({ centre: v(s, 0), arc, top: 1, bottom: 1 })

  it('reads the cut above and below each station, in runs split where the plane misses', () => {
    const runs = lengthwiseCut([rect(0, 10, -0.5, 0.5)], [station(1, 0), station(2, 1), station(12, 2), station(4, 3)], UP, SIDE)
    expect(runs.map((run) => run.map((sample) => sample.arc))).toEqual([[0, 1], [3]])
    for (const sample of runs.flat()) {
      expect(sample.top).toBeCloseTo(0.5)
      expect(sample.bottom).toBeCloseTo(0.5)
    }
  })

  it('leaves out another vessel the plane crosses', () => {
    const runs = lengthwiseCut([rect(0, 10, -0.5, 0.5), rect(0, 10, 2, 3)], [station(5, 0)], UP, SIDE)
    expect(runs).toHaveLength(1)
    expect(runs[0][0].top).toBeCloseTo(0.5)
    expect(lengthwiseCut([rect(0, 10, 2, 3)], [station(5, 0)], UP, SIDE)).toEqual([])
  })
})

describe('lengthwiseCutAtDepth', () => {
  // A straight vessel of radius 1.5 lying left to right, its front surface at z = 1.5.
  // Turned a little (0.01 rad) so no ring of its vertices lies exactly on a cut:
  // computeCrossSection loses a cut that runs exactly through vertices.
  const RADIUS = 1.5
  const geometry = new THREE.CylinderGeometry(RADIUS, RADIUS, 10, 128, 1, false, 0.01).rotateZ(Math.PI / 2)
  geometry.boundsTree = new MeshBVH(geometry)
  const mesh = new THREE.Mesh(geometry)
  mesh.updateMatrixWorld()
  const front = v(0, 0, RADIUS)
  const stations = [-3, 0, 3].map((x, index) => ({ centre: v(x, 0), arc: index * 3, top: RADIUS, bottom: RADIUS }))

  it.each([0.5, 1.5, 2.5])('%s mm behind the surface, cuts the vessel as wide as it is at that depth', (depth) => {
    const halfWidth = Math.sqrt(RADIUS ** 2 - (RADIUS - depth) ** 2)
    const runs = lengthwiseCutAtDepth([mesh], front, depth, UP, SIDE, stations)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toHaveLength(3)
    for (const sample of runs[0]) {
      expect(sample.top).toBeCloseTo(halfWidth, 2)
      expect(sample.bottom).toBeCloseTo(halfWidth, 2)
    }
  })

  it('cuts nothing once the depth is past the back of the vessel', () => {
    expect(lengthwiseCutAtDepth([mesh], front, 3.5, UP, SIDE, stations)).toEqual([])
  })
})
