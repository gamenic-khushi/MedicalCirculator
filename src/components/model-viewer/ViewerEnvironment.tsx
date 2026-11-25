import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'

import { floorPlacement } from '@/lib/floorPlacement'

// The space colour, also used by the pages behind the canvas until it draws.
export const SPACE_COLOR = '#070b18'
// A grid of thin lines on a dark floor that fades out towards the edge, into
// space. Far squares look smaller, which is what shows depth; where they get too
// small to draw cleanly, the lines blend away instead of shimmering. The lines are brighter and
// thicker, and the floor reaches further out, so the grid stands out (Aki, 2026/11/25).
// One square is 1 cm (models are in mm), so the grid also gives a sense of size.
function createFloorMaterial(radius: number, tileSize: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Seen from below, the floor disappears instead of hiding the model.
    side: THREE.FrontSide,
    uniforms: {
      radius: { value: radius },
      tileSize: { value: tileSize },
      floorColor: { value: new THREE.Color('#111a33') },
      grout: { value: new THREE.Color('#8aa0c8') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPosition;
      void main() {
        vPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float radius;
      uniform float tileSize;
      uniform vec3 floorColor;
      uniform vec3 grout;
      varying vec2 vPosition;
      void main() {
        vec2 t = vPosition / tileSize;
        vec2 fw = fwidth(t);
        float tooSmall = smoothstep(0.12, 0.4, max(fw.x, fw.y));
        vec2 g = abs(fract(t - 0.5) - 0.5) / fw;
        float line = (1.0 - min(min(g.x, g.y), 1.6) / 1.6) * (1.0 - tooSmall);
        vec3 color = mix(floorColor, grout, line);
        float fade = 1.0 - smoothstep(0.45, 1.0, length(vPosition) / radius);
        gl_FragColor = vec4(color, fade);
        #include <colorspace_fragment>
      }
    `,
  })
}

const noRaycast = () => {}

// A plain dark background behind the model, and a gridded floor with a soft shadow under it. The
// floor stays under the model as the camera's up turns (as when the view is
// turned to lay the vessel flat); while the user orbits, it holds still.
export function ViewerEnvironment({
  modelGroupRef,
  floorRef,
}: {
  modelGroupRef: MutableRefObject<THREE.Group | null>
  floorRef: MutableRefObject<THREE.Group | null>
}) {
  const [extent, setExtent] = useState<{ radius: number; height: number; tileSize: number } | null>(null)
  // Made again only when the model's size changes: once per model.
  const material = useMemo(() => (extent ? createFloorMaterial(extent.radius, extent.tileSize) : null), [extent])
  useEffect(() => () => material?.dispose(), [material])

  // Clicks and measurements aim rays into the scene: they must only ever find
  // the model, never the floor or its shadow.
  useLayoutEffect(() => {
    floorRef.current?.traverse((child) => {
      child.raycast = noRaycast
    })
  })

  useFrame(({ camera }) => {
    const floor = floorRef.current
    const model = modelGroupRef.current
    if (!floor || !model) return
    const box = new THREE.Box3().setFromObject(model)
    if (box.isEmpty()) return
    const placement = floorPlacement(box, camera.up.clone().normalize())
    floor.position.copy(placement.position)
    floor.quaternion.copy(placement.quaternion)
    if (
      extent?.radius !== placement.radius ||
      extent.height !== placement.height ||
      extent.tileSize !== placement.tileSize
    ) {
      setExtent({ radius: placement.radius, height: placement.height, tileSize: placement.tileSize })
    }
  })

  return (
    <>
      <color attach="background" args={[SPACE_COLOR]} />
      <group ref={floorRef} visible={extent !== null}>
        {extent && material && (
          <>
            <mesh rotation-x={-Math.PI / 2} renderOrder={1} material={material}>
              <planeGeometry args={[extent.radius * 2, extent.radius * 2]} />
            </mesh>
            <ContactShadows
              scale={extent.height * 1.5}
              far={extent.height}
              blur={2.5}
              opacity={0.8}
              resolution={512}
              renderOrder={2}
            />
          </>
        )}
      </group>
    </>
  )
}
