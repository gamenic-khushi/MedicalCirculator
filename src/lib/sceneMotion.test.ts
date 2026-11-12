// @vitest-environment jsdom
// (Motion's frame loop needs requestAnimationFrame, which jsdom provides.)
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { fadeInModel, glideZoom } from '@/lib/sceneMotion'

describe('glideZoom', () => {
  it('applies shares that multiply up to exactly the zoom asked for', async () => {
    let applied = 1
    let frames = 0
    await glideZoom(0.85, (share) => {
      applied *= share
      frames++
    }).finished
    expect(applied).toBeCloseTo(0.85, 10)
    expect(frames).toBeGreaterThan(1)
  })

  it('hands back the share not yet applied when stopped, so nothing is lost', async () => {
    let applied = 1
    const glide = glideZoom(0.5, (share) => (applied *= share))
    await new Promise((resolve) => setTimeout(resolve, 60))
    const rest = glide.stop()
    expect(applied).not.toBeCloseTo(1, 3)
    expect(applied * rest).toBeCloseTo(0.5, 10)
  })
})

describe('fadeInModel', () => {
  const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())

  it('starts the model see-through and leaves it opaque at the end', async () => {
    const model = mesh()
    const fade = fadeInModel(model)
    expect(model.material.transparent).toBe(true)
    expect(model.material.opacity).toBeLessThan(1)
    await fade.finished
    expect(model.material.opacity).toBe(1)
    expect(model.material.transparent).toBe(false)
  })

  it('leaves the model opaque when stopped part way', async () => {
    const model = mesh()
    const fade = fadeInModel(model)
    await new Promise((resolve) => setTimeout(resolve, 60))
    fade.stop()
    expect(model.material.opacity).toBe(1)
    expect(model.material.transparent).toBe(false)
  })
})
