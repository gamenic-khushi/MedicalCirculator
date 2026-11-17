import * as THREE from 'three'

import { gridTileSize } from '@/lib/modelUnits'

export interface FloorPlacement {
  // The floor's centre, just under the model.
  position: THREE.Vector3
  // Turns the floor's own up (+y) onto the camera's up.
  quaternion: THREE.Quaternion
  // How far the floor reaches from its centre, in model units (mm).
  radius: number
  // The side of one grid square (1 cm), in model units.
  tileSize: number
  // At least from the floor to the model's top: how far up the contact shadow
  // looks. Like `radius`, it depends only on the model's size, not on `up`, so
  // neither changes while the view turns.
  height: number
}

// At least 3 tiles of 1 cm reach out from the centre.
const MIN_FLOOR_TILES = 3

// Where the viewer's floor goes: under the model, as seen with `up` pointing up.
export function floorPlacement(box: THREE.Box3, up: THREE.Vector3): FloorPlacement {
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getBoundingSphere(new THREE.Sphere()).radius
  const tileSize = gridTileSize(
    box
      .getSize(new THREE.Vector3())
      .toArray()
      .reduce((a, b) => Math.max(a, b)),
  )
  // The box's lowest corner along `up` (a little lower than the model itself
  // when `up` runs across the box, which only widens the gap).
  let lowest = 0
  for (let i = 0; i < 8; i++) {
    const corner = new THREE.Vector3(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    )
    lowest = Math.min(lowest, corner.sub(center).dot(up))
  }
  const gap = size * 0.1
  return {
    position: center.clone().addScaledVector(up, lowest - gap),
    quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up),
    radius: Math.max(size * 3, MIN_FLOOR_TILES * tileSize),
    tileSize,
    // No corner is further than `size` from the centre, above or below it.
    height: 2 * size + gap,
  }
}
