import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { floorPlacement } from '@/lib/floorPlacement'

// A vessel 20 mm long and 4 mm wide, lying along x.
const vessel = new THREE.Box3(new THREE.Vector3(-10, -2, -2), new THREE.Vector3(10, 2, 2))

describe('floorPlacement', () => {
  it('puts the floor just under the model, centred below it', () => {
    const floor = floorPlacement(vessel, new THREE.Vector3(0, 1, 0))
    expect(floor.position.x).toBeCloseTo(0)
    expect(floor.position.z).toBeCloseTo(0)
    // Below the vessel's lowest point (y = -2), but close to it: within 5 mm.
    expect(floor.position.y).toBeLessThan(-2)
    expect(floor.position.y).toBeGreaterThan(-7)
  })

  it('follows the camera when its up direction turns, wherever the model is', () => {
    // The same vessel at CT coordinates, seen with +z as up (as after the view
    // is turned to lay the vessel flat across the screen).
    const placed = vessel.clone().translate(new THREE.Vector3(100, 50, -30))
    const floor = floorPlacement(placed, new THREE.Vector3(0, 0, 1))
    expect(floor.position.x).toBeCloseTo(100)
    expect(floor.position.y).toBeCloseTo(50)
    expect(floor.position.z).toBeLessThan(-32)
    expect(floor.position.z).toBeGreaterThan(-37)
    // The floor's own up (+y) is turned onto the camera's up.
    const floorUp = new THREE.Vector3(0, 1, 0).applyQuaternion(floor.quaternion)
    expect(floorUp.x).toBeCloseTo(0)
    expect(floorUp.y).toBeCloseTo(0)
    expect(floorUp.z).toBeCloseTo(1)
  })

  it('reaches well past the model, and at least 3 tiles of 1 cm for a small one', () => {
    const up = new THREE.Vector3(0, 1, 0)
    // A 100 mm heart model: the floor reaches past its 50 mm half-length.
    const heart = new THREE.Box3(new THREE.Vector3(-50, -40, -40), new THREE.Vector3(50, 40, 40))
    expect(floorPlacement(heart, up).radius).toBeGreaterThan(100)
    // A 4 mm segment: still 30 mm of floor around it.
    const segment = new THREE.Box3(new THREE.Vector3(-2, -1, -1), new THREE.Vector3(2, 1, 1))
    expect(floorPlacement(segment, up).radius).toBeGreaterThanOrEqual(30)
  })

  it('makes a 1 cm grid square of 10 units for a model in mm', () => {
    expect(floorPlacement(vessel, new THREE.Vector3(0, 1, 0)).tileSize).toBe(10)
  })

  it('keeps the grid dense for a model exported in metres', () => {
    // The same 100 mm heart, written as 0.1 (metres).
    const heart = new THREE.Box3(
      new THREE.Vector3(-0.05, -0.04, -0.04),
      new THREE.Vector3(0.05, 0.04, 0.04),
    )
    const floor = floorPlacement(heart, new THREE.Vector3(0, 1, 0))
    expect(floor.tileSize).toBe(0.01)
    // Still reaches well past the model, and not 30 units (30 m) wide.
    expect(floor.radius).toBeGreaterThan(0.1)
    expect(floor.radius).toBeLessThan(1)
  })

  it('gives the shadow enough reach to take in the whole model', () => {
    const floor = floorPlacement(vessel, new THREE.Vector3(0, 1, 0))
    // From the floor up to the vessel's top (y = 2).
    expect(floor.height).toBeGreaterThanOrEqual(2 - floor.position.y)
  })
})
