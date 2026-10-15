import {
  forwardRef,
  Suspense,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { computeCrossSection, loopArea } from '@/lib/slicePlane'
import { measureVesselSweep } from '@/lib/vesselSweep'
import type { CameraState } from '@/types/viewerState'

import { Model3D } from './Model3D'
import { SliceCapMeshes } from './SliceCapMeshes'

export type ViewerTool = 'rotate' | 'pan' | 'slice'

export interface ModelCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  setTool: (tool: ViewerTool) => void
  capture: () => string | null
  measureVesselWidth: (xPercent: number, yPercent: number) => number | null
  measureAdaptiveReferenceWidth: (
    xPercent: number,
    yPercent: number,
    direction: 1 | -1,
  ) => { width: number; y: number } | null
  measureLesionPosition: (xPercent: number, yPercent: number) => string | null
  measureLesionSweep: (
    proximalWorld: [number, number, number],
    distalWorld: [number, number, number],
  ) => {
    proximalDiameter: number
    distalDiameter: number
    minArea: number
    minDiameter: number
    length: number
    narrowestFraction: number
    narrowestPoint: { x: number; y: number } | null
    narrowestWorld: [number, number, number]
    narrowestDirection: [number, number, number]
  } | null
  measureDistance3D: (
    x1Percent: number,
    y1Percent: number,
    x2Percent: number,
    y2Percent: number,
  ) => number | null
  determineProximalPoint: (
    x1Percent: number,
    y1Percent: number,
    x2Percent: number,
    y2Percent: number,
  ) => {
    decision: 'first' | 'second' | null
    reach1: { maxWidth: number; stepsCompleted: number; hitDecisiveWidth: boolean }
    reach2: { maxWidth: number; stepsCompleted: number; hitDecisiveWidth: boolean }
  } | null
  measureBifurcationAngle: (xPercent: number, yPercent: number) => number | null
  highlightAt: (xPercent: number, yPercent: number, referenceWidth?: number) => boolean
  highlightSegment: (
    x1Percent: number,
    y1Percent: number,
    x2Percent: number,
    y2Percent: number,
    referenceWidth?: number,
  ) => boolean
  clearSelection: () => void
  hideHighlight: () => void
  showHighlight: () => void
  getWorldPoint: (xPercent: number, yPercent: number) => [number, number, number] | null
  // Smoothly turns and moves the view so `center` is in the middle of the
  // screen and the vessel running along `direction` lies left-to-right.
  alignViewToVessel: (center: [number, number, number], direction: [number, number, number]) => void
  // Diameter of the vessel cut by a vertical plane through the screen column
  // at `xPercent` (on the horizontal axis), as the equivalent circle of the
  // cut's area. Null when nothing is there.
  measureDiameterAtScreenX: (xPercent: number) => { diameter: number; area: number } | null
  projectWorldPoint: (point: [number, number, number]) => { x: number; y: number } | null
  getCameraState: () => CameraState | null
}

interface ModelCanvasProps {
  url: string
  extension: string
  color: string
  controlsEnabled?: boolean
  initialCamera?: CameraState | null
  onCameraChange?: (state: CameraState) => void
  // Fires continuously while the camera is moving (every OrbitControls
  // 'change' tick), not just once it settles — lets a caller re-project any
  // world-anchored annotation markers every frame so they stay pinned to
  // the mesh instead of visibly drifting during the rotate/pan/zoom itself.
  onCameraMove?: () => void
  // While on, the cutting plane follows the vessel under the screen centre
  // (the page draws the crosshair there), so moving the model moves the cut.
  sliceMode?: boolean
  onSliceAreaChange?: (area: number | null) => void
}

interface ThreeState {
  camera: THREE.Camera
  scene: THREE.Scene
}

const FALLBACK_HIGHLIGHT_RADIUS = 0.28
// A highlight sized strictly to the vessel's real width becomes imperceptible
// (a handful of pixels) once the camera is framing the whole model — which is
// exactly when a narrow stenosis is most clinically interesting. Enforce a
// floor in screen-space pixels so the highlight is always clearly visible.
const MIN_HIGHLIGHT_RADIUS_PX = 12
// A segment highlight is a chain of overlapping discs, so each disc's own
// radius pads past the first/last sample point — kept smaller than the
// single-point highlight so the fill doesn't bulge past the ①/② markers.
const SEGMENT_MIN_HIGHLIGHT_RADIUS_PX = 6
const HIGHLIGHT_COLOR = new THREE.Color(0x39ff14)
const WHITE = new THREE.Color(1, 1, 1)
const EDGE_SCAN_STEP_PERCENT = 0.4
const EDGE_SCAN_MAX_PERCENT = 25
const BRANCH_SCAN_ANGLE_STEPS = 16
const BRANCH_SCAN_MAX_RADIUS_PERCENT = 20
const BRANCH_MIN_SEPARATION_STEPS = Math.round(BRANCH_SCAN_ANGLE_STEPS / 6)
const SNAP_SEARCH_RADII_PERCENT = [0.5, 1, 2, 3, 5]
const SNAP_SEARCH_ANGLE_STEPS = 8
const POSITION_SCAN_STEP_PERCENT = 1
const POSITION_SCAN_MAX_STEPS = 45
const POSITION_WIDTH_JUMP_RATIO = 1.6
const SEGMENT_HIGHLIGHT_STEPS = 30
// A reference (healthy) width used to be sampled at fixed screen-percentage
// offsets from the lesion — which brackets a different real segment length
// depending on how long the lesion is, and a different real distance
// depending on zoom. Walking outward until width stops changing instead
// finds the actual healthy vessel next to the lesion, regardless of either.
const REFERENCE_PLATEAU_STABLE_STEPS = 3
const REFERENCE_PLATEAU_TOLERANCE_RATIO = 0.08
const ALIGN_DURATION_MS = 500
// Heights (percent of the view, either side of the horizontal axis) tried in
// turn when looking for the vessel a diameter line cuts.
const LINE_SEARCH_OFFSETS_PERCENT = [0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12, 15, -15, 18, -18]
const HEART_PROXIMITY_STEP_PERCENT = 1
const HEART_PROXIMITY_MAX_STEPS = 20
const HEART_PROXIMITY_DECISIVE_WIDTH_RATIO = 1.4
// A branch's root can flare wider than its own tip right where it meets the
// trunk, then narrow again a few steps further out — crossing the decisive
// ratio for a single step there used to latch the decision immediately,
// confidently calling the branch "proximal" before the walk ever saw it
// narrow back down. Requiring the ratio to hold for several consecutive
// steps lets the walk see past that local flare before committing.
const HEART_PROXIMITY_DECISIVE_CONFIRM_STEPS = 3
// Below this relative gap between the two sides' widest real measurement,
// treat width as inconclusive rather than trusting a razor-thin difference
// that's as likely to be raycasting noise as a genuine signal.
const HEART_PROXIMITY_WIDTH_TIE_TOLERANCE = 0.1

function SceneAccessor({ stateRef }: { stateRef: MutableRefObject<ThreeState | null> }) {
  const three = useThree()
  useEffect(() => {
    stateRef.current = { camera: three.camera, scene: three.scene }
  })
  return null
}

function CameraTargetRestorer({
  target,
  controlsRef,
}: {
  target: CameraState['target'] | undefined
  controlsRef: MutableRefObject<OrbitControlsImpl | null>
}) {
  useEffect(() => {
    if (!target) return
    controlsRef.current?.target.set(...target)
    controlsRef.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export const ModelCanvas = forwardRef<ModelCanvasHandle, ModelCanvasProps>(function ModelCanvas(
  {
    url,
    extension,
    color,
    controlsEnabled = true,
    initialCamera,
    onCameraChange,
    onCameraMove,
    sliceMode = false,
    onSliceAreaChange,
  },
  ref,
) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const threeStateRef = useRef<ThreeState | null>(null)
  const paintedMeshRef = useRef<THREE.Mesh | null>(null)
  const lastHighlightRef = useRef<{ points: THREE.Vector3[]; radius: number } | null>(null)
  const modelGroupRef = useRef<THREE.Group>(null)
  const [slicePlane, setSlicePlane] = useState<THREE.Plane | null>(null)
  // Where the screen-centre line of sight meets the model; that surface point
  // lies on the cutting plane, so the cut through it is the vessel to measure.
  const [sliceFocusPoint, setSliceFocusPoint] = useState<[number, number, number] | null>(null)
  const sliceFrameRef = useRef<number | null>(null)
  const alignFrameRef = useRef<number | null>(null)
  const sliceModeRef = useRef(sliceMode)

  useEffect(() => {
    sliceModeRef.current = sliceMode
  }, [sliceMode])

  // The cutting plane is fixed to the screen: it is the vertical plane through
  // the middle of the view that contains the line of sight (seen edge-on, it is
  // the vertical line of the cross), so its normal is the camera's right
  // direction. The model is what moves under it (rotate / move / zoom change
  // which cut it makes), so it is recomputed whenever the camera changes.
  function updateSlice() {
    const camera = threeStateRef.current?.camera
    if (!camera) return
    camera.updateMatrixWorld()
    const normal = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    setSlicePlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal, camera.position))

    let focus: [number, number, number] | null = null
    const modelGroup = modelGroupRef.current
    if (modelGroup) {
      modelGroup.updateMatrixWorld(true)
      const hit = hitAt(50, 50, modelGroup)
      if (hit) focus = hit.point.toArray() as [number, number, number]
    }
    setSliceFocusPoint(focus)
  }

  // At most once per frame, however many camera changes arrive.
  function scheduleSliceUpdate() {
    if (sliceFrameRef.current !== null) return
    sliceFrameRef.current = requestAnimationFrame(() => {
      sliceFrameRef.current = null
      if (sliceModeRef.current) updateSlice()
    })
  }

  function handleControlsChange() {
    onCameraMove?.()
    if (sliceMode) scheduleSliceUpdate()
  }

  // Leaving slice mode removes the plane, which also restores the un-clipped
  // model rather than leaving a stale cut applied.
  useEffect(() => {
    if (!sliceMode) {
      if (sliceFrameRef.current !== null) {
        cancelAnimationFrame(sliceFrameRef.current)
        sliceFrameRef.current = null
      }
      setSlicePlane(null)
      setSliceFocusPoint(null)
      return
    }
    updateSlice()
    // updateSlice only reads refs, so it doesn't need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliceMode])

  function resetMeshColors(mesh: THREE.Mesh) {
    const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (!colorAttr) return
    ;(colorAttr.array as Float32Array).fill(1)
    colorAttr.needsUpdate = true
  }

  function paintVesselFill(mesh: THREE.Mesh, worldPoints: THREE.Vector3[], worldRadius: number) {
    const positionAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (!positionAttr || !colorAttr || worldPoints.length === 0) return

    const localPoints = worldPoints.map((point) => mesh.worldToLocal(point.clone()))
    const worldScale = mesh.getWorldScale(new THREE.Vector3())
    const avgScale = (worldScale.x + worldScale.y + worldScale.z) / 3 || 1
    const innerRadius = (worldRadius / avgScale) * 0.9
    const outerRadius = (worldRadius / avgScale) * 1.1

    const vertex = new THREE.Vector3()
    const blended = new THREE.Color()
    for (let i = 0; i < positionAttr.count; i += 1) {
      vertex.fromBufferAttribute(positionAttr, i)
      let minDistance = Infinity
      for (const localPoint of localPoints) {
        const distance = vertex.distanceTo(localPoint)
        if (distance < minDistance) minDistance = distance
      }
      const t = 1 - THREE.MathUtils.smoothstep(minDistance, innerRadius, outerRadius)
      blended.copy(WHITE).lerp(HIGHLIGHT_COLOR, t)
      colorAttr.setXYZ(i, blended.r, blended.g, blended.b)
    }
    colorAttr.needsUpdate = true
  }

  function emitCameraChange() {
    const controls = controlsRef.current
    if (!controls || !onCameraChange) return
    onCameraChange({
      position: controls.object.position.toArray() as [number, number, number],
      target: controls.target.toArray() as [number, number, number],
    })
  }

  function cancelAlign() {
    if (alignFrameRef.current !== null) {
      cancelAnimationFrame(alignFrameRef.current)
      alignFrameRef.current = null
    }
  }

  // OrbitControls bakes its "up" axis in once, at construction, so a camera
  // whose up has been turned has to tell it, or the next drag would snap back.
  function syncControlsUp(controls: OrbitControlsImpl) {
    const internal = controls as unknown as { _quat: THREE.Quaternion; _quatInverse: THREE.Quaternion }
    if (!internal._quat || !internal._quatInverse) return
    internal._quat.setFromUnitVectors(controls.object.up, new THREE.Vector3(0, 1, 0))
    internal._quatInverse.copy(internal._quat).invert()
  }

  // Puts the lesion in the middle of the view with the vessel running left to
  // right, looking at it from the side nearest the current view (so the model
  // turns as little as possible and never flips upside down). Keeps the user's
  // zoom distance. Slightly curved vessels only: the direction is the vessel's
  // direction at the lesion, so a strongly curved one is only straight there.
  function alignViewToVessel(center: [number, number, number], direction: [number, number, number]) {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object
    const target = new THREE.Vector3(...center)
    const vessel = new THREE.Vector3(...direction)
    if (vessel.lengthSq() < 1e-12) return
    vessel.normalize()

    const offset = camera.position.clone().sub(controls.target)
    const distance = offset.length() || 1
    // Look at the vessel from the side: remove the part of the current view
    // direction that runs along the vessel.
    const back = offset.clone().addScaledVector(vessel, -offset.dot(vessel))
    if (back.lengthSq() < 1e-8) {
      back.set(0, 0, 1)
      back.addScaledVector(vessel, -back.dot(vessel))
      if (back.lengthSq() < 1e-8) back.set(0, 1, 0).addScaledVector(vessel, -vessel.y)
    }
    back.normalize()

    // Screen-right is the vessel direction as given (the caller passes ① to
    // ②, so ① ends up on the left); look from whichever side keeps the
    // picture the right way up.
    let up = new THREE.Vector3().crossVectors(back, vessel)
    if (up.dot(camera.up) < 0) {
      back.negate()
      up = new THREE.Vector3().crossVectors(back, vessel)
    }
    up.normalize()
    const endQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(vessel, up, back))
    const startQuat = camera.quaternion.clone()
    const startTarget = controls.target.clone()

    cancelAlign()
    const startTime = performance.now()
    const step = (now: number) => {
      const raw = Math.min((now - startTime) / ALIGN_DURATION_MS, 1)
      const t = raw * raw * (3 - 2 * raw)
      const quat = startQuat.clone().slerp(endQuat, t)
      const nextTarget = startTarget.clone().lerp(target, t)
      camera.up.set(0, 1, 0).applyQuaternion(quat)
      camera.position.copy(nextTarget).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(quat), distance)
      controls.target.copy(nextTarget)
      syncControlsUp(controls)
      controls.update()
      onCameraMove?.()
      if (raw < 1) {
        alignFrameRef.current = requestAnimationFrame(step)
      } else {
        alignFrameRef.current = null
        emitCameraChange()
        if (sliceModeRef.current) updateSlice()
      }
    }
    alignFrameRef.current = requestAnimationFrame(step)
  }

  function dolly(factor: number) {
    const controls = controlsRef.current
    if (!controls || !controls.enabled) return
    const camera = controls.object
    camera.position.lerp(controls.target, 1 - factor)
    controls.update()
    emitCameraChange()
  }

  // `root` narrows the ray to one object (the model itself), so overlays such
  // as the slice plane can't be hit instead of the vessel behind them.
  function hitAt(xPct: number, yPct: number, root?: THREE.Object3D) {
    const camera = threeStateRef.current?.camera
    const scene = root ?? threeStateRef.current?.scene
    if (!camera || !scene || !(camera instanceof THREE.PerspectiveCamera)) return null

    // The canvas can resize (viewport change, layout shift from an annotation
    // marker appearing, etc.) faster than R3F's own resize handling updates
    // camera.aspect. Raycasting against a stale aspect ratio silently aims
    // the ray at the wrong point in 3D space — it doesn't error, it just
    // misses real geometry near the edges, which looked like intermittent
    // raycasting noise until traced back to this. Keep aspect in sync with
    // the actual rendered canvas size on every raycast, the same way
    // projectWorldPointToScreen already does before projecting a point back.
    const canvasElement = containerRef.current?.querySelector('canvas')
    if (canvasElement && canvasElement.clientHeight > 0) {
      const aspect = canvasElement.clientWidth / canvasElement.clientHeight
      if (camera.aspect !== aspect) {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      }
    }
    camera.updateMatrixWorld()

    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    ndc.set((xPct / 100) * 2 - 1, -((yPct / 100) * 2 - 1))
    raycaster.setFromCamera(ndc, camera)
    return raycaster.intersectObject(scene, true)[0] ?? null
  }

  function findNearestHit(xPercent: number, yPercent: number) {
    const direct = hitAt(xPercent, yPercent)
    if (direct) return { hit: direct, x: xPercent, y: yPercent }

    for (const radius of SNAP_SEARCH_RADII_PERCENT) {
      for (let i = 0; i < SNAP_SEARCH_ANGLE_STEPS; i++) {
        const angle = (i / SNAP_SEARCH_ANGLE_STEPS) * Math.PI * 2
        const x = xPercent + Math.cos(angle) * radius
        const y = yPercent + Math.sin(angle) * radius
        const hit = hitAt(x, y)
        if (hit) return { hit, x, y }
      }
    }
    return null
  }

  function getHitResult(xPercent: number, yPercent: number) {
    const found = findNearestHit(xPercent, yPercent)
    if (!found) return null

    const point = found.hit.point.clone()
    const normal = found.hit.face
      ? found.hit.face.normal.clone().transformDirection(found.hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 0, 1)

    return { point, normal, object: found.hit.object }
  }

  function projectWorldPointToScreen(point: THREE.Vector3) {
    const camera = threeStateRef.current?.camera
    const canvasElement = containerRef.current?.querySelector('canvas')
    if (!camera || !canvasElement) return null

    if (camera instanceof THREE.PerspectiveCamera && canvasElement.clientHeight > 0) {
      camera.aspect = canvasElement.clientWidth / canvasElement.clientHeight
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld(true)

    const ndc = point.clone().project(camera)
    return {
      x: ((ndc.x + 1) / 2) * 100,
      y: ((1 - ndc.y) / 2) * 100,
    }
  }

  function worldUnitsPerPixelAtDistance(distance: number) {
    const canvasElement = containerRef.current?.querySelector('canvas')
    const camera = threeStateRef.current?.camera
    if (!camera || !canvasElement || !(camera instanceof THREE.PerspectiveCamera)) {
      return null
    }
    const fovRad = (camera.fov * Math.PI) / 180
    const worldHeightAtDistance = 2 * distance * Math.tan(fovRad / 2)
    return worldHeightAtDistance / canvasElement.clientHeight
  }

  // Scanning strictly left-right only measures a true cross-section when the
  // vessel happens to run vertically on screen — anywhere else it cuts the
  // vessel wall obliquely and over-measures the diameter. Estimate the local
  // vessel direction from two nearby hits and scan perpendicular to that
  // instead, so the measurement holds regardless of camera angle.
  function estimateLocalDirectionPx(xPercent: number, yPercent: number, width: number, height: number) {
    const probeStep = 1
    const up = findNearestHit(xPercent, yPercent - probeStep)
    const down = findNearestHit(xPercent, yPercent + probeStep)
    if (up && down) {
      const dxPx = ((down.x - up.x) / 100) * width
      const dyPx = ((down.y - up.y) / 100) * height
      const len = Math.hypot(dxPx, dyPx)
      if (len > 1e-6) return { x: dxPx / len, y: dyPx / len }
    }
    return { x: 0, y: 1 }
  }

  function computeVesselWidth(xPercent: number, yPercent: number) {
    const canvasElement = containerRef.current?.querySelector('canvas')
    const camera = threeStateRef.current?.camera
    if (!camera || !canvasElement || !(camera instanceof THREE.PerspectiveCamera)) {
      return null
    }

    const width = canvasElement.clientWidth
    const height = canvasElement.clientHeight

    const center = findNearestHit(xPercent, yPercent)
    if (!center) return null

    const centerX = center.x
    const centerY = center.y
    const tangent = estimateLocalDirectionPx(center.x, center.y, width, height)
    const perpX = -tangent.y
    const perpY = tangent.x
    const stepPx = (EDGE_SCAN_STEP_PERCENT / 100) * width
    const maxPx = (EDGE_SCAN_MAX_PERCENT / 100) * width

    function offsetPercent(pixelDistance: number, sign: 1 | -1) {
      return {
        x: centerX + sign * (perpX * pixelDistance) * (100 / width),
        y: centerY + sign * (perpY * pixelDistance) * (100 / height),
      }
    }

    let nearEdgePx = 0
    for (let d = stepPx; d <= maxPx; d += stepPx) {
      const p = offsetPercent(d, -1)
      if (!hitAt(p.x, p.y)) break
      nearEdgePx = d
    }

    let farEdgePx = 0
    for (let d = stepPx; d <= maxPx; d += stepPx) {
      const p = offsetPercent(d, 1)
      if (!hitAt(p.x, p.y)) break
      farEdgePx = d
    }

    const widthPx = nearEdgePx + farEdgePx

    const worldUnitsPerPixel = worldUnitsPerPixelAtDistance(center.hit.distance)
    if (!worldUnitsPerPixel) return null

    return widthPx * worldUnitsPerPixel
  }

  // Walks along the vessel from (xPercent, yPercent) in screen space, following the
  // nearest surface point step by step, and stops either where the model ends (branch
  // tip) or where the vessel widens sharply into a larger parent vessel (a bifurcation).
  // Returns the 3D distance travelled, used to judge how far into the branch the lesion sits.
  function walkBranchDistance(
    xPercent: number,
    yPercent: number,
    direction: 1 | -1,
    baselineWidth: number,
  ) {
    let x = xPercent
    let y = yPercent
    let lastPoint: THREE.Vector3 | null = null
    let distance = 0

    for (let step = 0; step < POSITION_SCAN_MAX_STEPS; step++) {
      const nextY = y + direction * POSITION_SCAN_STEP_PERCENT
      if (nextY <= 1 || nextY >= 99) break

      const found = findNearestHit(x, nextY)
      if (!found) break

      const width = computeVesselWidth(found.x, found.y)
      if (width && width > baselineWidth * POSITION_WIDTH_JUMP_RATIO) break

      const point = found.hit.point.clone()
      if (lastPoint) distance += lastPoint.distanceTo(point)
      lastPoint = point
      x = found.x
      y = found.y
    }

    return distance
  }

  // Walks outward the same way walkBranchDistance does, but stops once width
  // has held steady (within REFERENCE_PLATEAU_TOLERANCE_RATIO) for
  // REFERENCE_PLATEAU_STABLE_STEPS in a row — i.e. once we've walked out of
  // the narrowing into stable, healthy vessel. Falls back to the last valid
  // sample if a bifurcation is hit or the walk runs out of model before a
  // plateau is found, rather than returning nothing.
  function walkToStableReferenceWidth(
    xPercent: number,
    yPercent: number,
    direction: 1 | -1,
    baselineWidth: number,
  ): { width: number; y: number } | null {
    let x = xPercent
    let y = yPercent
    let lastWidth: number | null = null
    let stableSteps = 0
    let lastValid: { width: number; y: number } | null = null

    for (let step = 0; step < POSITION_SCAN_MAX_STEPS; step++) {
      const nextY = y + direction * POSITION_SCAN_STEP_PERCENT
      if (nextY <= 1 || nextY >= 99) break

      const found = findNearestHit(x, nextY)
      if (!found) break

      const width = computeVesselWidth(found.x, found.y)
      if (!width) break
      if (width > baselineWidth * POSITION_WIDTH_JUMP_RATIO) break

      lastValid = { width, y: found.y }

      if (lastWidth != null) {
        const relativeChange = Math.abs(width - lastWidth) / lastWidth
        stableSteps = relativeChange <= REFERENCE_PLATEAU_TOLERANCE_RATIO ? stableSteps + 1 : 0
        if (stableSteps >= REFERENCE_PLATEAU_STABLE_STEPS) return lastValid
      }

      lastWidth = width
      x = found.x
      y = found.y
    }

    return lastValid
  }

  // Local vessel width at the two clicked points is a weak, often-flat signal
  // for "which one is closer to the heart" — a lesion's two boundary points
  // are usually chosen on healthy vessel of near-identical caliber either
  // side of the narrowing, so there's often no real width difference to
  // compare. Instead, walk away from each point (continuing past it, away
  // from the other point) and track the widest cross-section found along
  // the way, starting from the point's own width. Whichever side's walk
  // reaches the higher width is more proximal — this covers both a point
  // that gradually widens toward the trunk, and a point that's already
  // sitting on the trunk itself (nothing wider to find, but its own width
  // already wins). A point walking toward a branch tip instead just tapers
  // or dead-ends without ever beating the other side's width.
  //
  // The walk direction is re-derived from where each step actually lands,
  // not fixed to the original two-point line — a real vessel curves in
  // screen space, and a rigid straight-line walk runs off the mesh (and
  // dead-ends) after a step or two on anything but a straight segment.
  //
  // Width at each step is measured with the same full-precision
  // computeVesselWidth used for the final on-screen measurement, not a
  // cheap proxy — a cheaper perpendicular-hit-count proxy (tried first) used
  // the walk's own forward direction as a stand-in for the local tangent,
  // which is fine on an open stretch of vessel but badly underestimates
  // width right at a narrow neck opening into a much wider chamber, exactly
  // the spot this comparison most needs to get right. computeVesselWidth
  // re-estimates the true local tangent at every sample, so it catches that
  // opening; confirmed live against two real failing cases where the proxy
  // missed a >2x real width difference that computeVesselWidth found
  // cleanly. This is a real, unavoidable cost (each sample is expensive on
  // this mesh, which has no spatial acceleration structure) — the decisive
  // ratio break below exists specifically to stop walking as soon as one
  // side has a confident answer, rather than spending the full step budget
  // on both sides every time.
  //
  // Returns the widest real cross-section reached alongside how many steps
  // the walk actually completed before running off the model — a point near
  // a branch tip dead-ends in a step or two, while a trunk-ward point
  // usually has much more vessel left to walk, which is a useful tiebreaker
  // when neither side's width is decisive.
  function walkAwayFrom(
    fromXPercent: number,
    fromYPercent: number,
    towardsXPercent: number,
    towardsYPercent: number,
  ): { maxWidth: number; stepsCompleted: number; hitDecisiveWidth: boolean } {
    const dx0 = fromXPercent - towardsXPercent
    const dy0 = fromYPercent - towardsYPercent
    const length0 = Math.hypot(dx0, dy0) || 1
    let dirX = dx0 / length0
    let dirY = dy0 / length0

    let x = fromXPercent
    let y = fromYPercent
    const startingWidth = computeVesselWidth(x, y) ?? 0
    const decisiveThreshold = Math.max(startingWidth, 1e-6) * HEART_PROXIMITY_DECISIVE_WIDTH_RATIO
    let maxWidth = startingWidth
    let hitDecisiveWidth = false
    let consecutiveStepsAboveThreshold = 0

    let step = 0
    for (; step < HEART_PROXIMITY_MAX_STEPS; step++) {
      const nextX = x + dirX * HEART_PROXIMITY_STEP_PERCENT
      const nextY = y + dirY * HEART_PROXIMITY_STEP_PERCENT
      if (nextX <= 1 || nextX >= 99 || nextY <= 1 || nextY >= 99) break
      // findNearestHit's snap-search recovers from a straight extrapolation
      // landing just off the vessel surface as it curves — the common case
      // (gentle curve, small step) still costs a single direct raycast.
      const found = findNearestHit(nextX, nextY)
      if (!found) break

      const stepDx = found.x - x
      const stepDy = found.y - y
      const stepLen = Math.hypot(stepDx, stepDy)
      if (stepLen > 1e-6) {
        dirX = stepDx / stepLen
        dirY = stepDy / stepLen
      }
      x = found.x
      y = found.y

      const width = computeVesselWidth(x, y)
      if (width == null) break
      if (width > maxWidth) maxWidth = width
      // A single step above the threshold isn't enough to commit — see
      // HEART_PROXIMITY_DECISIVE_CONFIRM_STEPS above. Width dropping back
      // down (a branch-root flare narrowing again) resets the streak rather
      // than ending the walk.
      consecutiveStepsAboveThreshold = width > decisiveThreshold ? consecutiveStepsAboveThreshold + 1 : 0
      if (consecutiveStepsAboveThreshold >= HEART_PROXIMITY_DECISIVE_CONFIRM_STEPS) {
        hitDecisiveWidth = true
        step += 1
        break
      }
    }
    return { maxWidth, stepsCompleted: step, hitDecisiveWidth }
  }

  // Returns which of the two points is proximal (closer to the heart) along
  // with the raw walk data for both sides, or null if the points themselves
  // couldn't be resolved on the mesh. decision is null when neither width
  // nor how far each side could walk distinguishes them — the caller can
  // hand reach1/reach2 to an external tiebreaker in that case instead of
  // guessing.
  function determineProximalPoint(
    x1Percent: number,
    y1Percent: number,
    x2Percent: number,
    y2Percent: number,
  ): {
    decision: 'first' | 'second' | null
    reach1: { maxWidth: number; stepsCompleted: number; hitDecisiveWidth: boolean }
    reach2: { maxWidth: number; stepsCompleted: number; hitDecisiveWidth: boolean }
  } | null {
    // findNearestHit's snap-search tolerates a click that's a little off the
    // (sometimes only a few pixels wide) vessel surface — worth paying for
    // once here, unlike inside the walk loop below where it's the dominant
    // cost. Walk from the snapped, on-mesh position it finds, not the raw
    // click, or a single missed direct hit would derail the whole walk.
    const start1 = findNearestHit(x1Percent, y1Percent)
    const start2 = findNearestHit(x2Percent, y2Percent)
    if (!start1 || !start2) return null

    const reach1 = walkAwayFrom(start1.x, start1.y, start2.x, start2.y)
    const reach2 = walkAwayFrom(start2.x, start2.y, start1.x, start1.y)

    // A width comparison is only trustworthy when at least one side actually
    // found something decisively wider than its OWN starting point along the
    // way (hitDecisiveWidth) — otherwise both maxWidth values are just
    // "whatever this budget-limited walk happened to pass on its way to
    // running out of steps", and a side branch that bulges locally before
    // tapering further out can rack up a higher maxWidth than the real trunk
    // ever did, confidently pointing the wrong way. Confirmed against a real
    // bifurcating vessel where this exact case produced a >20% "confident"
    // width gap in the wrong direction, with neither walk ever hitting the
    // decisive threshold — both had simply exhausted their step budget.
    if (reach1.hitDecisiveWidth !== reach2.hitDecisiveWidth) {
      return { decision: reach1.hitDecisiveWidth ? 'first' : 'second', reach1, reach2 }
    }
    if (reach1.hitDecisiveWidth && reach2.hitDecisiveWidth) {
      // Both sides found genuine widening — real measured widths, so exact
      // equality isn't the right bar for a "tie" — treat anything within a
      // small relative margin as too close to call from width alone.
      const widerWidth = Math.max(reach1.maxWidth, reach2.maxWidth)
      const widthGapRatio = widerWidth > 0 ? Math.abs(reach1.maxWidth - reach2.maxWidth) / widerWidth : 0
      if (widthGapRatio > HEART_PROXIMITY_WIDTH_TIE_TOLERANCE) {
        return { decision: reach1.maxWidth > reach2.maxWidth ? 'first' : 'second', reach1, reach2 }
      }
    }
    // Neither side's width is trustworthy (or both were decisive but tied) —
    // fall back to how far each side could walk before running off the
    // model. A point sitting near a branch tip dead-ends within a step or
    // two; a trunk-ward point almost always has much more vessel left to
    // traverse.
    if (reach1.stepsCompleted !== reach2.stepsCompleted) {
      return { decision: reach1.stepsCompleted > reach2.stepsCompleted ? 'first' : 'second', reach1, reach2 }
    }
    return { decision: null, reach1, reach2 }
  }

  function computeLesionPosition(xPercent: number, yPercent: number) {
    const baseline = computeVesselWidth(xPercent, yPercent)
    if (!baseline) return null

    const upstreamDistance = walkBranchDistance(xPercent, yPercent, -1, baseline)
    const downstreamDistance = walkBranchDistance(xPercent, yPercent, 1, baseline)
    const total = upstreamDistance + downstreamDistance
    if (total <= 0) return null

    const ratio = upstreamDistance / total
    if (ratio < 1 / 3) return '近位'
    if (ratio > 2 / 3) return '遠位'
    return '中間'
  }

  useImperativeHandle(ref, () => ({
    zoomIn: () => dolly(0.85),
    zoomOut: () => dolly(1.15),
    setTool: (tool) => {
      const controls = controlsRef.current
      if (!controls) return
      controls.mouseButtons.LEFT = tool === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    },
    capture: () => {
      const canvasElement = containerRef.current?.querySelector('canvas')
      if (!canvasElement) return null

      const sourceWidth = canvasElement.width
      const sourceHeight = canvasElement.height

      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = sourceWidth
      outputCanvas.height = sourceHeight
      const ctx = outputCanvas.getContext('2d')
      if (!ctx) return canvasElement.toDataURL('image/png')

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, sourceWidth, sourceHeight)
      ctx.drawImage(canvasElement, 0, 0, sourceWidth, sourceHeight)
      return outputCanvas.toDataURL('image/png')
    },
    measureVesselWidth: (xPercent, yPercent) => computeVesselWidth(xPercent, yPercent),
    measureAdaptiveReferenceWidth: (xPercent, yPercent, direction) => {
      const baseline = computeVesselWidth(xPercent, yPercent)
      if (!baseline) return null
      return walkToStableReferenceWidth(xPercent, yPercent, direction, baseline)
    },
    measureLesionPosition: (xPercent, yPercent) => computeLesionPosition(xPercent, yPercent),
    measureLesionSweep: (proximalWorld, distalWorld) => {
      const modelGroup = modelGroupRef.current
      if (!modelGroup) return null
      modelGroup.updateMatrixWorld(true)
      const result = measureVesselSweep(
        modelGroup,
        new THREE.Vector3(...proximalWorld),
        new THREE.Vector3(...distalWorld),
      )
      if (!result) return null
      return {
        proximalDiameter: result.proximalDiameter,
        distalDiameter: result.distalDiameter,
        minArea: result.minArea,
        minDiameter: result.minDiameter,
        length: result.length,
        narrowestFraction: result.narrowestFraction,
        narrowestPoint: projectWorldPointToScreen(result.narrowestPoint),
        narrowestWorld: result.narrowestPoint.toArray() as [number, number, number],
        narrowestDirection: result.narrowestDirection.toArray() as [number, number, number],
      }
    },
    getWorldPoint: (xPercent, yPercent) => {
      // Against the model only, so the slice plane or its gizmo can't be hit
      // instead of the vessel behind them; the whole scene is the fallback.
      const modelGroup = modelGroupRef.current
      if (modelGroup) {
        modelGroup.updateMatrixWorld(true)
        const direct = hitAt(xPercent, yPercent, modelGroup)
        if (direct) return [direct.point.x, direct.point.y, direct.point.z]
      }
      const hit = getHitResult(xPercent, yPercent)
      return hit ? [hit.point.x, hit.point.y, hit.point.z] : null
    },
    alignViewToVessel: (center, direction) => alignViewToVessel(center, direction),
    measureDiameterAtScreenX: (xPercent) => {
      const camera = threeStateRef.current?.camera
      const modelGroup = modelGroupRef.current
      if (!camera || !modelGroup) return null
      modelGroup.updateMatrixWorld(true)
      // The vessel is seldom exactly on the horizontal axis, so take the
      // nearest vessel in a band around it (the plane for a screen column is
      // the same whatever the height, so only the hit point depends on it).
      let hit: THREE.Intersection | null = null
      for (const offset of LINE_SEARCH_OFFSETS_PERCENT) {
        hit = hitAt(xPercent, 50 + offset, modelGroup)
        if (hit) break
      }
      if (!hit) return null
      camera.updateMatrixWorld()
      // The plane through the camera that contains the screen's vertical
      // direction and the ray at that column: it is the vertical line on
      // screen, seen edge-on, just like the fixed centre plane.
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize()
      const ray = hit.point.clone().sub(camera.position).normalize()
      const normal = new THREE.Vector3().crossVectors(ray, up)
      if (normal.lengthSq() < 1e-12) return null
      normal.normalize()
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, camera.position)

      // The hit point is on the plane and on the surface, so the cut outline
      // of that vessel passes through it: take the loop nearest to it.
      let best: { loop: THREE.Vector3[]; distance: number } | null = null
      modelGroup.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const cut = computeCrossSection(child, plane)
        if (!cut) return
        for (const loop of cut.loops) {
          const distance = Math.min(...loop.map((point) => point.distanceTo(hit.point)))
          if (!best || distance < best.distance) best = { loop, distance }
        }
      })
      if (!best) return null
      const area = loopArea((best as { loop: THREE.Vector3[] }).loop, normal)
      return { area, diameter: 2 * Math.sqrt(area / Math.PI) }
    },
    projectWorldPoint: (point) => projectWorldPointToScreen(new THREE.Vector3(...point)),
    getCameraState: () => {
      const camera = threeStateRef.current?.camera
      const controls = controlsRef.current
      if (!camera || !controls) return null
      return {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      }
    },
    measureDistance3D: (x1Percent, y1Percent, x2Percent, y2Percent) => {
      const hit1 = getHitResult(x1Percent, y1Percent)
      const hit2 = getHitResult(x2Percent, y2Percent)
      if (!hit1 || !hit2) return null
      return hit1.point.distanceTo(hit2.point)
    },
    determineProximalPoint: (x1Percent, y1Percent, x2Percent, y2Percent) =>
      determineProximalPoint(x1Percent, y1Percent, x2Percent, y2Percent),
    measureBifurcationAngle: (xPercent, yPercent) => {
      const camera = threeStateRef.current?.camera
      const scene = threeStateRef.current?.scene
      if (!camera || !scene || !(camera instanceof THREE.PerspectiveCamera)) return null

      const raycaster = new THREE.Raycaster()
      const ndc = new THREE.Vector2()

      function hitAt(xPct: number, yPct: number) {
        ndc.set((xPct / 100) * 2 - 1, -((yPct / 100) * 2 - 1))
        raycaster.setFromCamera(ndc, camera!)
        return raycaster.intersectObject(scene!, true)[0] ?? null
      }

      const reach: number[] = []
      for (let i = 0; i < BRANCH_SCAN_ANGLE_STEPS; i++) {
        const angle = (i / BRANCH_SCAN_ANGLE_STEPS) * Math.PI * 2
        let maxRadius = 0
        for (let r = 1; r <= BRANCH_SCAN_MAX_RADIUS_PERCENT; r += 1) {
          const x = xPercent + Math.cos(angle) * r
          const y = yPercent + Math.sin(angle) * r
          if (!hitAt(x, y)) break
          maxRadius = r
        }
        reach.push(maxRadius)
      }

      const rankedIndices = reach
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value)
        .map((entry) => entry.index)

      const firstIndex = rankedIndices[0]
      const secondIndex = rankedIndices.slice(1).find((index) => {
        const diff = Math.abs(index - firstIndex)
        return Math.min(diff, BRANCH_SCAN_ANGLE_STEPS - diff) >= BRANCH_MIN_SEPARATION_STEPS
      })
      if (firstIndex === undefined || secondIndex === undefined) return null

      const angle1 = (firstIndex / BRANCH_SCAN_ANGLE_STEPS) * 360
      const angle2 = (secondIndex / BRANCH_SCAN_ANGLE_STEPS) * 360
      const diff = Math.abs(angle1 - angle2)
      return diff > 180 ? 360 - diff : diff
    },
    highlightAt: (xPercent, yPercent, referenceWidth) => {
      const hit = getHitResult(xPercent, yPercent)
      if (!hit || !(hit.object instanceof THREE.Mesh)) return false
      const width = referenceWidth ?? computeVesselWidth(xPercent, yPercent)
      let radius = width ? (width / 2) * 0.55 : FALLBACK_HIGHLIGHT_RADIUS

      const camera = threeStateRef.current?.camera
      if (camera) {
        const distance = camera.position.distanceTo(hit.point)
        const worldUnitsPerPixel = worldUnitsPerPixelAtDistance(distance)
        if (worldUnitsPerPixel) {
          radius = Math.max(radius, MIN_HIGHLIGHT_RADIUS_PX * worldUnitsPerPixel)
        }
      }

      if (paintedMeshRef.current && paintedMeshRef.current !== hit.object) {
        resetMeshColors(paintedMeshRef.current)
      }
      paintedMeshRef.current = hit.object
      lastHighlightRef.current = { points: [hit.point.clone()], radius }
      paintVesselFill(hit.object, [hit.point], radius)
      return true
    },
    highlightSegment: (x1Percent, y1Percent, x2Percent, y2Percent, referenceWidth) => {
      // Walk from point 1 toward point 2 rather than sampling a straight 2D
      // line: each step re-aims from where the vessel surface actually was
      // hit last, so the highlighted path bends to follow a curving or
      // branching vessel instead of cutting across the gap between them.
      const totalDistance = Math.hypot(x2Percent - x1Percent, y2Percent - y1Percent)
      const stepSize = totalDistance / SEGMENT_HIGHLIGHT_STEPS || 1

      const samples: { point: THREE.Vector3; object: THREE.Object3D }[] = []
      let x = x1Percent
      let y = y1Percent
      const startHit = getHitResult(x, y)
      if (startHit) samples.push({ point: startHit.point, object: startHit.object })

      for (let step = 1; step <= SEGMENT_HIGHLIGHT_STEPS; step++) {
        const remainingX = x2Percent - x
        const remainingY = y2Percent - y
        const remainingDistance = Math.hypot(remainingX, remainingY)
        if (remainingDistance < 0.01) break

        const travel = Math.min(stepSize, remainingDistance)
        const nextX = x + (remainingX / remainingDistance) * travel
        const nextY = y + (remainingY / remainingDistance) * travel

        const found = findNearestHit(nextX, nextY)
        if (found) {
          x = found.x
          y = found.y
          samples.push({ point: found.hit.point, object: found.hit.object })
        } else {
          x = nextX
          y = nextY
        }
      }

      const endHit = getHitResult(x2Percent, y2Percent)
      if (endHit) samples.push({ point: endHit.point, object: endHit.object })

      const targetObject = samples[0]?.object
      if (!targetObject || !(targetObject instanceof THREE.Mesh)) return false

      const points = samples.filter((sample) => sample.object === targetObject).map((sample) => sample.point)

      const midX = (x1Percent + x2Percent) / 2
      const midY = (y1Percent + y2Percent) / 2
      const width = referenceWidth ?? computeVesselWidth(midX, midY)
      let radius = width ? (width / 2) * 0.4 : FALLBACK_HIGHLIGHT_RADIUS * 0.7

      const camera = threeStateRef.current?.camera
      if (camera && points[0]) {
        const distance = camera.position.distanceTo(points[0])
        const worldUnitsPerPixel = worldUnitsPerPixelAtDistance(distance)
        if (worldUnitsPerPixel) {
          radius = Math.max(radius, SEGMENT_MIN_HIGHLIGHT_RADIUS_PX * worldUnitsPerPixel)
        }
      }

      if (paintedMeshRef.current && paintedMeshRef.current !== targetObject) {
        resetMeshColors(paintedMeshRef.current)
      }
      paintedMeshRef.current = targetObject
      lastHighlightRef.current = { points: points.map((point) => point.clone()), radius }
      paintVesselFill(targetObject, points, radius)
      return true
    },
    clearSelection: () => {
      if (paintedMeshRef.current) {
        resetMeshColors(paintedMeshRef.current)
        paintedMeshRef.current = null
      }
      lastHighlightRef.current = null
    },
    hideHighlight: () => {
      if (paintedMeshRef.current) resetMeshColors(paintedMeshRef.current)
    },
    showHighlight: () => {
      if (paintedMeshRef.current && lastHighlightRef.current) {
        paintVesselFill(
          paintedMeshRef.current,
          lastHighlightRef.current.points,
          lastHighlightRef.current.radius,
        )
      }
    },
  }))

  return (
    <div ref={containerRef} className="h-full w-full">
      <Canvas
        camera={{ position: initialCamera?.position ?? [4, 3, 4], fov: 45 }}
        gl={{ alpha: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
      >
        <SceneAccessor stateRef={threeStateRef} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} />
        <Suspense fallback={null}>
          <Bounds fit={!initialCamera} clip margin={1.3} maxDuration={0}>
            <group ref={modelGroupRef}>
              {/* No clipping plane: the whole model stays visible while slicing;
                  the plane is only used to measure the cut. */}
              <Model3D url={url} extension={extension} color={color} />
            </group>
          </Bounds>
          <CameraTargetRestorer target={initialCamera?.target} controlsRef={controlsRef} />
        </Suspense>
        {sliceMode && (
          <SliceCapMeshes
            modelGroupRef={modelGroupRef}
            plane={slicePlane}
            color={color}
            onAreaChange={onSliceAreaChange}
            focusPoint={sliceFocusPoint}
          />
        )}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={controlsEnabled}
          onChange={handleControlsChange}
          onStart={cancelAlign}
          onEnd={emitCameraChange}
        />
      </Canvas>
    </div>
  )
})
