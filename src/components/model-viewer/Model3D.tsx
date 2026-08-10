import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { FBXLoader, OBJLoader, STLLoader } from 'three-stdlib'

interface Model3DProps {
  url: string
  extension: string
  color: string
}

export function Model3D({ url, extension, color }: Model3DProps) {
  if (extension === 'obj') return <ObjModel url={url} color={color} />
  if (extension === 'fbx') return <FbxModel url={url} color={color} />
  return <StlModel url={url} color={color} />
}

function StlModel({ url, color }: { url: string; color: string }) {
  const geometry = useLoader(STLLoader, url)

  const centered = useMemo(() => {
    geometry.center()
    return geometry
  }, [geometry])

  return (
    <mesh geometry={centered} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// FBX/OBJ files can reference external or embedded textures that don't ship alongside
// this app's bundled sample models. applyMaterial() replaces every material anyway, so
// actually decoding those textures (some loaders resolve them via ad-hoc blob URLs that
// never go through the loading manager, so a urlModifier can't intercept them) is both
// pointless and, when the source data is missing or unsupported, fatal to the whole
// loader. Short-circuit texture loading entirely so it can never fail.
let textureLoadingDisabled = false
function disableTextureLoading() {
  if (textureLoadingDisabled) return
  textureLoadingDisabled = true
  const placeholder = new THREE.Texture(document.createElement('img'))
  THREE.TextureLoader.prototype.load = function (_url, onLoad) {
    queueMicrotask(() => onLoad?.(placeholder))
    return placeholder
  }
}
disableTextureLoading()

function ObjModel({ url, color }: { url: string; color: string }) {
  const object = useLoader(OBJLoader, url)
  useMemo(() => applyMaterial(object, color), [object, color])
  return <primitive object={object} />
}

function FbxModel({ url, color }: { url: string; color: string }) {
  const object = useLoader(FBXLoader, url)
  useMemo(() => {
    disableAnimations(object)
    applyMaterial(object, color)
  }, [object, color])
  return <primitive object={object} />
}

function disableAnimations(object: THREE.Object3D) {
  if ('animations' in object && Array.isArray(object.animations)) {
    object.animations.length = 0
  }
  object.traverse((child) => {
    if ('animations' in child && Array.isArray((child as any).animations)) {
      ;(child as any).animations.length = 0
    }
  })
}

function applyMaterial(object: THREE.Object3D, color: string) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
    }
  })
}
