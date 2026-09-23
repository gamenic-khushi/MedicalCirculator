import { useEffect, useRef, useState, type RefObject } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'

export type SliceAxis = 'x' | 'y' | 'z'
export type SliceGizmoMode = 'translate' | 'rotate'

export interface SlicePlaneValue {
  normal: [number, number, number]
  constant: number
}

interface SlicePlaneGizmoProps {
  enabled: boolean
  mode: SliceGizmoMode
  boundingBox: THREE.Box3 | null
  axisPreset: SliceAxis | null
  onPlaneChange: (plane: SlicePlaneValue) => void
}

const AXIS_UNIT_VECTORS: Record<SliceAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}
// The plane mesh's own local normal, before the anchor group's rotation is
// applied — kept as a named constant so every quaternion computed below
// means "rotate this local +Z to point along the target world axis."
const LOCAL_NORMAL = new THREE.Vector3(0, 0, 1)
// The visual plane must extend past the model regardless of which axis it's
// cut along, so it reads as a real cutting plane rather than a small tile
// floating in the middle of the mesh.
const PLANE_SIZE_MARGIN = 1.5

function planeFromAnchor(anchor: THREE.Object3D): SlicePlaneValue {
  anchor.updateMatrixWorld(true)
  const worldNormal = LOCAL_NORMAL.clone().applyQuaternion(anchor.quaternion).normalize()
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(worldNormal, anchor.position)
  return { normal: plane.normal.toArray() as [number, number, number], constant: plane.constant }
}

// Mounted as a sibling to <Bounds> inside ModelCanvas's <Canvas> (not a
// child of it) so the anchor's position/quaternion live in true scene-root
// world space, independent of whatever fit transform <Bounds> applies to
// the model itself. The anchor group is the single source of truth for the
// plane's pose: an axis-preset click sets it programmatically below, and
// <TransformControls> mutates the same object directly while dragging —
// both paths funnel through the same planeFromAnchor() conversion, so there
// is no separate "preset" vs "gizmo" plane representation to keep in sync.
export function SlicePlaneGizmo({ enabled, mode, boundingBox, axisPreset, onPlaneChange }: SlicePlaneGizmoProps) {
  const anchorRef = useRef<THREE.Group>(null)
  const [planeSize, setPlaneSize] = useState(1)

  useEffect(() => {
    const anchor = anchorRef.current
    if (!enabled || !anchor || !boundingBox) return

    const center = boundingBox.getCenter(new THREE.Vector3())
    const size = boundingBox.getSize(new THREE.Vector3())
    setPlaneSize(Math.max(size.x, size.y, size.z, 1e-6) * PLANE_SIZE_MARGIN)

    anchor.position.copy(center)
    anchor.quaternion.setFromUnitVectors(LOCAL_NORMAL, AXIS_UNIT_VECTORS[axisPreset ?? 'z'])
    onPlaneChange(planeFromAnchor(anchor))
    // onPlaneChange is a fresh closure every render (LesionAnalysisPage
    // doesn't memoize it) — depending on it would refire this on every
    // unrelated re-render of the parent, not just when the plane actually
    // needs to move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, boundingBox, axisPreset])

  if (!enabled) return null

  return (
    <TransformControls
      // drei types `object` as RefObject<Object3D> (non-nullable current),
      // but a ref only settles after mount — this cast is safe because every
      // read of anchorRef.current below is already null-guarded.
      object={anchorRef as unknown as RefObject<THREE.Object3D>}
      mode={mode}
      onObjectChange={() => {
        if (anchorRef.current) onPlaneChange(planeFromAnchor(anchorRef.current))
      }}
    >
      <group ref={anchorRef}>
        <mesh>
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial
            color="#4f7dff"
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </TransformControls>
  )
}
