import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'

import { computeCrossSection, triangulateFan } from '@/lib/slicePlane'

interface CapGeometryEntry {
  key: string
  geometry: THREE.BufferGeometry
}

interface SliceCapMeshesProps {
  modelGroupRef: RefObject<THREE.Group | null>
  plane: THREE.Plane | null
  color: string
  onAreaChange?: (area: number | null) => void
}

// Renders a solid, non-clipped cap over whatever cross-section the current
// slice plane cuts through the model, so the cut reads as a real closed
// surface instead of a hollow shell. Recomputing this (a BVH shapecast per
// mesh, real work on a several-thousand-triangle vessel) on every pointer
// move during a drag would be visibly janky, so recomputation is coalesced
// to at most once per rendered frame — the plain clipping-plane visual
// already gives smooth feedback while the cap trails a frame or two behind.
export function SliceCapMeshes({ modelGroupRef, plane, color, onAreaChange }: SliceCapMeshesProps) {
  const [caps, setCaps] = useState<CapGeometryEntry[]>([])
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (!plane) {
      setCaps([])
      onAreaChange?.(null)
      return
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const modelGroup = modelGroupRef.current
      if (!modelGroup) return

      const nextCaps: CapGeometryEntry[] = []
      let totalArea = 0
      let meshIndex = 0
      modelGroup.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const meshKey = `mesh-${meshIndex++}`
        const crossSection = computeCrossSection(child, plane)
        if (!crossSection) return
        totalArea += crossSection.area

        crossSection.loops.forEach((loop, loopIndex) => {
          const { positions, indices } = triangulateFan(loop)
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          geometry.setIndex(indices)
          geometry.computeVertexNormals()
          nextCaps.push({ key: `${meshKey}-${loopIndex}`, geometry })
        })
      })
      setCaps(nextCaps)
      onAreaChange?.(nextCaps.length > 0 ? totalArea : null)
    })

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // onAreaChange is a fresh closure every render (LesionAnalysisPage
    // doesn't memoize it) — depending on it would refire this expensive
    // recompute on every unrelated re-render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plane, modelGroupRef])

  // Leaving slice mode unmounts this component entirely (see ModelCanvas's
  // `{sliceMode && <SliceCapMeshes .../>}`) — without this, the parent would
  // keep showing the last cross-section area from before the cut was
  // removed.
  useEffect(() => {
    return () => onAreaChange?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cap geometries are rebuilt (not reused) on every recompute, so the old
  // ones need disposing or they'd leak GPU buffers for as long as the user
  // keeps dragging the plane.
  useEffect(() => {
    return () => {
      caps.forEach((cap) => cap.geometry.dispose())
    }
  }, [caps])

  return (
    <>
      {caps.map((cap) => (
        <mesh key={cap.key} geometry={cap.geometry}>
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}
