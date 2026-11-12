import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'

import { floorPlacement } from '@/lib/floorPlacement'

// The space colour, also used by the pages behind the canvas until it draws.
export const SPACE_COLOR = '#070b18'
// 1 cm (models are in mm), so the tiles also give a sense of size.
const TILE_SIZE = 10
const STAR_FACE_SIZE = 1024
const STARS_PER_FACE = 260

// Still stars on deep navy, as a background at an infinite distance: they turn
// with the view but never come closer, and can't be clicked or measured.
function createStarfield() {
  // A fixed seed: the same sky every time, so saved images stay comparable.
  let seed = 20261111
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const faces = Array.from({ length: 6 }, () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = STAR_FACE_SIZE
    const context = canvas.getContext('2d')
    if (!context) return canvas
    context.fillStyle = SPACE_COLOR
    context.fillRect(0, 0, STAR_FACE_SIZE, STAR_FACE_SIZE)
    for (let i = 0; i < STARS_PER_FACE; i++) {
      // Mostly faint, a few brighter ones, a hint of blue in some.
      context.globalAlpha = 0.2 + 0.7 * random() ** 3
      context.fillStyle = random() < 0.25 ? '#c7d2fe' : '#ffffff'
      context.beginPath()
      context.arc(random() * STAR_FACE_SIZE, random() * STAR_FACE_SIZE, 0.5 + random() * 0.9, 0, Math.PI * 2)
      context.fill()
    }
    return canvas
  })
  const texture = new THREE.CubeTexture(faces)
  texture.colorSpace = THREE.SRGBColorSpace
  // The view's angle never changes, so the faces are never drawn much smaller.
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

// Dark tiles that fade out towards the edge of the floor, into space. Far tiles
// look smaller, which is what shows depth; where they get too small to draw
// cleanly, they blend into their average colour instead of shimmering.
function createFloorMaterial(radius: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Seen from below, the floor disappears instead of hiding the model.
    side: THREE.FrontSide,
    uniforms: {
      radius: { value: radius },
      tileSize: { value: TILE_SIZE },
      tileA: { value: new THREE.Color('#1c2740') },
      tileB: { value: new THREE.Color('#222f4b') },
      grout: { value: new THREE.Color('#52627f') },
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
      uniform vec3 tileA;
      uniform vec3 tileB;
      uniform vec3 grout;
      varying vec2 vPosition;
      void main() {
        vec2 t = vPosition / tileSize;
        vec2 fw = fwidth(t);
        float tooSmall = smoothstep(0.12, 0.4, max(fw.x, fw.y));
        float checker = mix(mod(floor(t.x) + floor(t.y), 2.0), 0.5, tooSmall);
        vec2 g = abs(fract(t - 0.5) - 0.5) / fw;
        float line = (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - tooSmall);
        vec3 color = mix(mix(tileA, tileB, checker), grout, line);
        float fade = 1.0 - smoothstep(0.3, 1.0, length(vPosition) / radius);
        gl_FragColor = vec4(color, 0.95 * fade);
        #include <colorspace_fragment>
      }
    `,
  })
}

const noRaycast = () => {}

// Space behind the model, and a tiled floor with a soft shadow under it. The
// floor stays under the model as the camera's up turns (as when the view is
// turned to lay the vessel flat); while the user orbits, it holds still.
export function ViewerEnvironment({
  modelGroupRef,
  floorRef,
}: {
  modelGroupRef: MutableRefObject<THREE.Group | null>
  floorRef: MutableRefObject<THREE.Group | null>
}) {
  const stars = useMemo(() => createStarfield(), [])
  useEffect(() => () => stars.dispose(), [stars])
  const [extent, setExtent] = useState<{ radius: number; height: number } | null>(null)
  // Made again only when the model's size changes: once per model.
  const material = useMemo(() => (extent ? createFloorMaterial(extent.radius) : null), [extent])
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
    if (extent?.radius !== placement.radius || extent.height !== placement.height) {
      setExtent({ radius: placement.radius, height: placement.height })
    }
  })

  return (
    <>
      <primitive attach="background" object={stars} />
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
