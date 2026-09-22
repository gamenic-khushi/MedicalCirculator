import {
  forwardRef,
  Suspense,
  useEffect,
  useImperativeHandle,
  useRef,
  type MutableRefObject,
} from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import type { CameraState } from '@/types/viewerState'

import { Model3D } from './Model3D'

export type ViewerTool = 'rotate' | 'pan'

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
    reach1: { maxWidth: number; stepsCompleted: number }
    reach2: { maxWidth: number; stepsCompleted: number }
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
const HEART_PROXIMITY_STEP_PERCENT = 1
const HEART_PROXIMITY_MAX_STEPS = 20
const HEART_PROXIMITY_DECISIVE_WIDTH_RATIO = 1.4
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
  { url, extension, color, controlsEnabled = true, initialCamera, onCameraChange },
  ref,
) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const threeStateRef = useRef<ThreeState | null>(null)
  const paintedMeshRef = useRef<THREE.Mesh | null>(null)
  const lastHighlightRef = useRef<{ points: THREE.Vector3[]; radius: number } | null>(null)

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

  function dolly(factor: number) {
    const controls = controlsRef.current
    if (!controls || !controls.enabled) return
    const camera = controls.object
    camera.position.lerp(controls.target, 1 - factor)
    controls.update()
    emitCameraChange()
  }

  function hitAt(xPct: number, yPct: number) {
    const camera = threeStateRef.current?.camera
    const scene = threeStateRef.current?.scene
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
  ): { maxWidth: number; stepsCompleted: number } {
    const dx0 = fromXPercent - towardsXPercent
    const dy0 = fromYPercent - towardsYPercent
    const length0 = Math.hypot(dx0, dy0) || 1
    let dirX = dx0 / length0
    let dirY = dy0 / length0

    let x = fromXPercent
    let y = fromYPercent
    const startingWidth = computeVesselWidth(x, y) ?? 0
    let maxWidth = startingWidth

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
      // Once we've clearly found something much wider than where we
      // started, that's a confident enough "this side leads toward the
      // trunk" signal on its own — no need to keep walking.
      if (maxWidth > Math.max(startingWidth, 1e-6) * HEART_PROXIMITY_DECISIVE_WIDTH_RATIO) {
        step += 1
        break
      }
    }
    return { maxWidth, stepsCompleted: step }
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
    reach1: { maxWidth: number; stepsCompleted: number }
    reach2: { maxWidth: number; stepsCompleted: number }
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

    // Real measured widths, so exact equality isn't the right bar for a
    // "tie" — treat anything within a small relative margin as too close to
    // call from width alone, and fall through to the steps-walked signal.
    const widerWidth = Math.max(reach1.maxWidth, reach2.maxWidth)
    const widthGapRatio = widerWidth > 0 ? Math.abs(reach1.maxWidth - reach2.maxWidth) / widerWidth : 0
    if (widthGapRatio > HEART_PROXIMITY_WIDTH_TIE_TOLERANCE) {
      return { decision: reach1.maxWidth > reach2.maxWidth ? 'first' : 'second', reach1, reach2 }
    }
    // Width was inconclusive — fall back to how far each side could walk
    // before running off the model. A point sitting near a branch tip
    // dead-ends within a step or two; a trunk-ward point almost always has
    // much more vessel left to traverse.
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
    getWorldPoint: (xPercent, yPercent) => {
      const hit = getHitResult(xPercent, yPercent)
      return hit ? [hit.point.x, hit.point.y, hit.point.z] : null
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
        gl={{ alpha: true, preserveDrawingBuffer: true }}
      >
        <SceneAccessor stateRef={threeStateRef} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} />
        <Suspense fallback={null}>
          <Bounds fit={!initialCamera} clip margin={1.3} maxDuration={0}>
            <Model3D url={url} extension={extension} color={color} />
          </Bounds>
          <CameraTargetRestorer target={initialCamera?.target} controlsRef={controlsRef} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={controlsEnabled}
          onEnd={emitCameraChange}
        />
      </Canvas>
    </div>
  )
})
