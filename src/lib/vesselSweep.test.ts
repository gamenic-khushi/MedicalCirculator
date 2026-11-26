import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { describe, expect, it } from 'vitest'

import { extendVesselSweep } from '@/lib/vesselSweep'

// A closed tube along y from -5 to 5 with a radius of 1.
function tube(): THREE.Group {
  const group = new THREE.Group()
  const geometry = new THREE.CylinderGeometry(1, 1, 10, 24, 1, false)
  // The cross-sections need the mesh's bounds tree, as the viewer's models have.
  ;(geometry as unknown as { boundsTree: MeshBVH }).boundsTree = new MeshBVH(geometry)
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()))
  group.updateMatrixWorld(true)
  return group
}

describe('extendVesselSweep', () => {
  it('follows the vessel on from a point until the vessel ends', () => {
    const stations = extendVesselSweep(tube(), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))
    expect(stations.length).toBeGreaterThan(10)
    // Further and further along, and all the way to about the end of the tube (5 from the start).
    for (let i = 1; i < stations.length; i += 1) expect(stations[i].arc).toBeGreaterThan(stations[i - 1].arc)
    const last = stations[stations.length - 1]
    expect(last.centre.y).toBeGreaterThan(4)
    expect(last.centre.y).toBeLessThan(5.1)
    // Each station is on the centre line and reads the wall's reach as the tube's radius.
    for (const station of stations) {
      expect(Math.hypot(station.centre.x, station.centre.z)).toBeLessThan(0.05)
      expect((station.top + station.bottom) / 2).toBeCloseTo(1, 1)
    }
  })

  it('goes the other way too, and gives nothing without a direction or without a model', () => {
    const down = extendVesselSweep(tube(), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0))
    expect(down[down.length - 1].centre.y).toBeLessThan(-4)
    expect(extendVesselSweep(tube(), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0))).toEqual([])
    expect(extendVesselSweep(new THREE.Group(), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))).toEqual([])
  })
})
