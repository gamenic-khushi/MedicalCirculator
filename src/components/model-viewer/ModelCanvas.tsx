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
  measureLesionPosition: (xPercent: number, yPercent: number) => string | null
  measureDistance3D: (
    x1Percent: number,
    y1Percent: number,
    x2Percent: number,
    y2Percent: number,
  ) => number | null
  measureBifurcationAngle: (xPercent: number, yPercent: number) => number | null
  highlightAt: (xPercent: number, yPercent: number, referenceWidth?: number) => boolean
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
  const lastHighlightRef = useRef<{ point: THREE.Vector3; radius: number } | null>(null)

  function resetMeshColors(mesh: THREE.Mesh) {
    const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (!colorAttr) return
    ;(colorAttr.array as Float32Array).fill(1)
    colorAttr.needsUpdate = true
  }

  function paintVesselFill(mesh: THREE.Mesh, worldPoint: THREE.Vector3, worldRadius: number) {
    const positionAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (!positionAttr || !colorAttr) return

    const localPoint = mesh.worldToLocal(worldPoint.clone())
    const worldScale = mesh.getWorldScale(new THREE.Vector3())
    const avgScale = (worldScale.x + worldScale.y + worldScale.z) / 3 || 1
    const innerRadius = (worldRadius / avgScale) * 0.9
    const outerRadius = (worldRadius / avgScale) * 1.1

    const vertex = new THREE.Vector3()
    const blended = new THREE.Color()
    for (let i = 0; i < positionAttr.count; i += 1) {
      vertex.fromBufferAttribute(positionAttr, i)
      const distance = vertex.distanceTo(localPoint)
      const t = 1 - THREE.MathUtils.smoothstep(distance, innerRadius, outerRadius)
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

  function computeVesselWidth(xPercent: number, yPercent: number) {
    const canvasElement = containerRef.current?.querySelector('canvas')
    const camera = threeStateRef.current?.camera
    if (!camera || !canvasElement || !(camera instanceof THREE.PerspectiveCamera)) {
      return null
    }

    const center = findNearestHit(xPercent, yPercent)
    if (!center) return null

    let leftEdge = center.x
    for (let d = EDGE_SCAN_STEP_PERCENT; d <= EDGE_SCAN_MAX_PERCENT; d += EDGE_SCAN_STEP_PERCENT) {
      if (!hitAt(center.x - d, center.y)) break
      leftEdge = center.x - d
    }

    let rightEdge = center.x
    for (let d = EDGE_SCAN_STEP_PERCENT; d <= EDGE_SCAN_MAX_PERCENT; d += EDGE_SCAN_STEP_PERCENT) {
      if (!hitAt(center.x + d, center.y)) break
      rightEdge = center.x + d
    }

    const widthPercent = rightEdge - leftEdge
    const widthPx = (widthPercent / 100) * canvasElement.clientWidth

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
      lastHighlightRef.current = { point: hit.point.clone(), radius }
      paintVesselFill(hit.object, hit.point, radius)
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
          lastHighlightRef.current.point,
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
