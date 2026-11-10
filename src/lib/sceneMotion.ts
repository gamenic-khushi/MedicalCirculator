import { animate } from 'motion'
import * as THREE from 'three'

import { EASE_OUT } from '@/lib/motion'

// Animations of the 3D view, driven by Motion's animate() and written straight
// into the three.js objects each frame.

export const MODEL_FADE_SECONDS = 0.5
export const ZOOM_GLIDE_SECONDS = 0.22

/** Whether the screen is set to reduce motion; 3D animations then jump to their end. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * Fades a freshly loaded model in. Only its opacity changes: moving or scaling
 * it would shift any measurement taken while the fade plays. The materials are
 * made opaque again when it ends or is stopped, so drawing order and depth work
 * exactly as before.
 */
export function fadeInModel(root: THREE.Object3D) {
  const materials: THREE.Material[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh)
      materials.push(...(Array.isArray(child.material) ? child.material : [child.material]))
  })
  const setOpacity = (opacity: number) => {
    for (const material of materials) material.opacity = opacity
  }
  const setTransparent = (transparent: boolean) => {
    for (const material of materials) {
      material.transparent = transparent
      material.needsUpdate = true
    }
  }
  const finish = () => {
    setOpacity(1)
    setTransparent(false)
  }
  // Hidden straight away: the animation's first frame comes a frame later, and
  // the model would flash fully drawn in between.
  setOpacity(0)
  setTransparent(true)
  const animation = animate(0, 1, {
    duration: prefersReducedMotion() ? 0 : MODEL_FADE_SECONDS,
    ease: EASE_OUT,
    onUpdate: setOpacity,
    onComplete: finish,
  })
  return {
    finished: animation.finished,
    stop() {
      animation.stop()
      finish()
    },
  }
}

/**
 * Plays a zoom by `factor` (the camera's distance to what it looks at is
 * multiplied by it) as a short glide: `step` is called each frame with that
 * frame's share, and the shares multiply up to exactly `factor`. `stop()` ends
 * it early and returns the share not yet applied, so the next zoom can take it
 * on and a quick run of clicks ends exactly where the same clicks would without
 * the glide.
 */
export function glideZoom(factor: number, step: (frameFactor: number) => void) {
  let reached = 0
  const animation = animate(0, 1, {
    duration: prefersReducedMotion() ? 0 : ZOOM_GLIDE_SECONDS,
    ease: EASE_OUT,
    onUpdate: (progress) => {
      step(factor ** (progress - reached))
      reached = progress
    },
  })
  return {
    finished: animation.finished,
    stop() {
      animation.stop()
      return factor ** (1 - reached)
    },
  }
}
