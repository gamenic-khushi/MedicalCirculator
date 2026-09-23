import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { DRACOLoader, FBXLoader, GLTFLoader, OBJLoader, STLLoader } from 'three-stdlib'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'

// ModelCanvas's lesion-analysis walks (heart-proximity ordering, reference
// width, bifurcation angle, ...) raycast against these meshes dozens of
// times per placement, now at full precision (computeVesselWidth) rather
// than a cheap proxy — and Three.js's default raycast is a linear scan over
// every triangle, which measured ~5ms per cast on these meshes with no
// acceleration structure. A BVH turns that into a tree lookup instead,
// typically two to three orders of magnitude faster, which is what makes
// running the real, accurate walk on every click actually feel instant
// rather than taking several seconds. This patches every mesh in the app,
// not just these models, but raycasting is the only thing it changes.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

function buildBoundsTree(geometry: THREE.BufferGeometry) {
  // Cheap to skip if a highlight repaint or remount hands us the same
  // (cached, per ensureVertexColorAttribute) geometry a second time.
  if (!(geometry as { boundsTree?: unknown }).boundsTree) geometry.computeBoundsTree()
}

interface Model3DProps {
  url: string
  extension: string
  color: string
}

export function Model3D({ url, extension, color }: Model3DProps) {
  if (extension === 'obj') return <ObjModel url={url} color={color} />
  if (extension === 'fbx') return <FbxModel url={url} color={color} />
  if (extension === 'glb' || extension === 'gltf') return <GltfModel url={url} color={color} />
  return <StlModel url={url} color={color} />
}

function ensureVertexColorAttribute(geometry: THREE.BufferGeometry) {
  const existing = geometry.getAttribute('color') as THREE.BufferAttribute | undefined
  if (existing) {
    // The loaded geometry is cached and reused across mounts (e.g. across pages
    // sharing the same model), so a highlight painted earlier can otherwise leak
    // into a freshly mounted, unrelated viewer.
    ;(existing.array as Float32Array).fill(1)
    existing.needsUpdate = true
    return
  }
  const count = geometry.getAttribute('position').count
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3))
}

function StlModel({ url, color }: { url: string; color: string }) {
  const geometry = useLoader(STLLoader, url)

  const centered = useMemo(() => {
    geometry.center()
    ensureVertexColorAttribute(geometry)
    buildBoundsTree(geometry)
    return geometry
  }, [geometry])

  return (
    <mesh geometry={centered} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.05}
        side={THREE.DoubleSide}
        vertexColors
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

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

// FBX stores units as centimeters; converting to glTF (which uses meters) via
// FBX2glTF scales geometry down by 100x. This app has always treated a
// model's raw coordinate units as millimeters directly (no unit conversion),
// so GLTF-sourced models need to be scaled back up to match that convention —
// otherwise every downstream measurement (vessel width, stenosis length, the
// highlight radius) comes out 100x too small.
const GLTF_UNIT_SCALE = 100

function GltfModel({ url, color }: { url: string; color: string }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.setDRACOLoader(dracoLoader)
  })
  useMemo(() => {
    disableAnimations(gltf.scene)
    applyMaterial(gltf.scene, color)
  }, [gltf, color])
  return <primitive object={gltf.scene} scale={GLTF_UNIT_SCALE} />
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
      ensureVertexColorAttribute(child.geometry)
      buildBoundsTree(child.geometry)
      child.material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.05,
        side: THREE.DoubleSide,
        vertexColors: true,
      })
    }
  })
}
