import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

export interface SlicePlaneValue {
  normal: [number, number, number]
  constant: number
}

interface SlicePlaneVisualProps {
  // The vessel centre under the screen-centre crosshair and which way the
  // vessel runs there. The plane sits on that point, square across the vessel;
  // null (crosshair not over the model) hides the plane.
  focus: { point: [number, number, number]; direction: [number, number, number] } | null
  boundingBox: THREE.Box3 | null
  onPlaneChange: (plane: SlicePlaneValue | null) => void
}

// The plane mesh's own local normal, before the group's rotation is applied.
const LOCAL_NORMAL = new THREE.Vector3(0, 0, 1)
// The plane now sits at the crosshair all the time, so a sheet as big as the
// whole model would cover the view while the user is lining a vessel up. A
// tile a bit under half the model's size still shows the cut's orientation.
const PLANE_SIZE_MARGIN = 0.45

// Mounted as a sibling to <Bounds> inside ModelCanvas's <Canvas> (not a
// child of it) so the pose lives in true scene-root world space, independent
// of whatever fit transform <Bounds> applies to the model itself. There are no
// handles: the plane follows the crosshair and the user moves the model.
export function SlicePlaneVisual({ focus, boundingBox, onPlaneChange }: SlicePlaneVisualProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [planeSize, setPlaneSize] = useState(1)
  const focusKey = focus ? `${focus.point.join(',')}|${focus.direction.join(',')}` : ''

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    if (!focus) {
      onPlaneChange(null)
      return
    }
    if (boundingBox) {
      const size = boundingBox.getSize(new THREE.Vector3())
      setPlaneSize(Math.max(size.x, size.y, size.z, 1e-6) * PLANE_SIZE_MARGIN)
    }
    const normal = new THREE.Vector3(...focus.direction).normalize()
    group.position.set(...focus.point)
    group.quaternion.setFromUnitVectors(LOCAL_NORMAL, normal)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.position)
    onPlaneChange({ normal: plane.normal.toArray() as [number, number, number], constant: plane.constant })
    // onPlaneChange is a fresh closure every render — depending on it would
    // refire this on every unrelated re-render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, boundingBox])

  return (
    <group ref={groupRef} visible={!!focus}>
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
  )
}
