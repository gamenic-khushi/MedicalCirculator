import * as THREE from 'three'
import type { MeshBVH } from 'three-mesh-bvh'

export interface CrossSection {
  loops: THREE.Vector3[][]
  area: number
}

// Two triangles sharing an edge each compute that edge's plane-intersection
// point independently, and a real (often non-indexed) STL export can leave
// tiny float32 rounding gaps between vertices that are meant to coincide —
// this tolerance is what lets the walk below still treat them as one point.
// Confirmed against this app's own real vessel data (a model whose smallest
// real measured feature is ~0.003mm, an order of magnitude smaller than
// what's typically assumed for anatomical geometry): a wider tolerance
// tried during development (1e-3) risked being large enough to merge two
// genuinely distinct nearby loops on this fine a mesh, while this value
// already closes every real loop correctly with no visible fragmentation.
const VERTEX_MERGE_EPSILON = 1e-6
// Classifying which side of the plane a vertex is on only needs to rule out
// exact (or true floating-point) equality to avoid a divide-by-zero in the
// edge-intersection lerp below — unlike the merge tolerance above, this
// isn't about tolerating noisy real-world data.
const PLANE_SIDE_EPSILON = 1e-9

function classifySide(distance: number): -1 | 0 | 1 {
  if (distance > PLANE_SIDE_EPSILON) return 1
  if (distance < -PLANE_SIDE_EPSILON) return -1
  return 0
}

interface Segment {
  a: THREE.Vector3
  b: THREE.Vector3
}

// shapecast traverses geometry.boundsTree in the mesh's LOCAL space, so the
// plane must be transformed into that space first — but every point this
// function ever returns is converted back to WORLD space before it leaves,
// since a mesh with non-uniform scale (GLTF's 100x) would otherwise make the
// eventual area wrong by scale²  once computed downstream.
export function computeCrossSection(mesh: THREE.Mesh, worldPlane: THREE.Plane): CrossSection | null {
  const boundsTree = (mesh.geometry as unknown as { boundsTree?: MeshBVH }).boundsTree
  if (!boundsTree) return null

  const inverseWorld = mesh.matrixWorld.clone().invert()
  const localPlane = worldPlane.clone().applyMatrix4(inverseWorld)

  const segments: Segment[] = []
  const boxMin = new THREE.Vector3()
  const boxMax = new THREE.Vector3()

  boundsTree.shapecast({
    intersectsBounds: (box) => {
      // Project the box onto the plane's normal to get its [min, max] signed
      // distance range — if both ends land on the same side, nothing inside
      // this box can cross the plane, so the whole subtree can be skipped.
      // This is exactly where the BVH's acceleration pays off.
      const normal = localPlane.normal
      boxMin.set(
        normal.x >= 0 ? box.min.x : box.max.x,
        normal.y >= 0 ? box.min.y : box.max.y,
        normal.z >= 0 ? box.min.z : box.max.z,
      )
      boxMax.set(
        normal.x >= 0 ? box.max.x : box.min.x,
        normal.y >= 0 ? box.max.y : box.min.y,
        normal.z >= 0 ? box.max.z : box.min.z,
      )
      const dMin = normal.dot(boxMin) + localPlane.constant
      const dMax = normal.dot(boxMax) + localPlane.constant
      return dMin <= 0 !== dMax <= 0 || dMin === 0 || dMax === 0
    },
    intersectsTriangle: (triangle) => {
      const vertices = [triangle.a, triangle.b, triangle.c]
      const distances = vertices.map((v) => localPlane.distanceToPoint(v))
      const sides = distances.map(classifySide)

      const points: THREE.Vector3[] = []
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3
        if (sides[i] === 0) {
          points.push(vertices[i])
        }
        if (sides[i] !== 0 && sides[j] !== 0 && sides[i] !== sides[j]) {
          const t = distances[i] / (distances[i] - distances[j])
          points.push(new THREE.Vector3().lerpVectors(vertices[i], vertices[j], t))
        }
      }
      // A plane crossing a triangle (not just touching a vertex or edge)
      // always yields exactly one segment (2 points); anything else (0 or
      // duplicate points) means the plane only grazed this triangle.
      if (points.length >= 2) {
        segments.push({
          a: points[0].clone().applyMatrix4(mesh.matrixWorld),
          b: points[1].clone().applyMatrix4(mesh.matrixWorld),
        })
      }
      return false
    },
  })

  if (segments.length === 0) return null

  const loops = stitchLoops(segments)
  if (loops.length === 0) return null

  const area = loops.reduce((sum, loop) => sum + loopArea(loop, worldPlane.normal), 0)
  return { loops, area }
}

function pointKey(point: THREE.Vector3): string {
  const scale = 1 / VERTEX_MERGE_EPSILON
  return `${Math.round(point.x * scale)}:${Math.round(point.y * scale)}:${Math.round(point.z * scale)}`
}

interface Edge {
  keyA: string
  keyB: string
  used: boolean
}

// Segments are collected per-triangle independently, so two triangles that
// share an edge each compute that shared edge's endpoint separately — these
// land at (nearly) the same coordinates but aren't the same object. Merging
// by a rounded-coordinate key is what lets the walk below treat them as one
// vertex and actually close a loop.
function stitchLoops(segments: Segment[]): THREE.Vector3[][] {
  const pointsByKey = new Map<string, THREE.Vector3>()
  const edges: Edge[] = []
  const adjacency = new Map<string, Edge[]>()

  function register(point: THREE.Vector3): string {
    const key = pointKey(point)
    if (!pointsByKey.has(key)) pointsByKey.set(key, point)
    return key
  }

  for (const segment of segments) {
    const keyA = register(segment.a)
    const keyB = register(segment.b)
    if (keyA === keyB) continue
    const edge: Edge = { keyA, keyB, used: false }
    edges.push(edge)
    ;(adjacency.get(keyA) ?? adjacency.set(keyA, []).get(keyA)!).push(edge)
    ;(adjacency.get(keyB) ?? adjacency.set(keyB, []).get(keyB)!).push(edge)
  }

  function otherEnd(edge: Edge, key: string): string {
    return edge.keyA === key ? edge.keyB : edge.keyA
  }

  const loops: THREE.Vector3[][] = []
  for (const startEdge of edges) {
    if (startEdge.used) continue
    startEdge.used = true
    const keys = [startEdge.keyA, startEdge.keyB]
    let current = startEdge.keyB
    let closed = false

    while (true) {
      const next = (adjacency.get(current) ?? []).find((edge) => !edge.used)
      if (!next) break
      next.used = true
      const nextKey = otherEnd(next, current)
      if (nextKey === keys[0]) {
        closed = true
        break
      }
      keys.push(nextKey)
      current = nextKey
    }

    // An open contour (dead end before returning to the start) means the cut
    // ran off a non-manifold edge or the mesh's own boundary — real
    // possibilities on scanned/exported STL data. Skip it rather than
    // rendering a cap that silently closes a gap that isn't really there.
    if (closed && keys.length >= 3) {
      loops.push(keys.map((key) => pointsByKey.get(key)!))
    }
  }
  return loops
}

function planeBasis(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  const arbitrary = Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(normal, arbitrary).normalize()
  const v = new THREE.Vector3().crossVectors(normal, u).normalize()
  return { u, v }
}

function loopArea(loop: THREE.Vector3[], normal: THREE.Vector3): number {
  const { u, v } = planeBasis(normal)
  let area = 0
  for (let i = 0; i < loop.length; i++) {
    const p1 = loop[i]
    const p2 = loop[(i + 1) % loop.length]
    const x1 = p1.dot(u)
    const y1 = p1.dot(v)
    const x2 = p2.dot(u)
    const y2 = p2.dot(v)
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

// Fan triangulation from the loop's own centroid — sufficient for the
// roughly-convex, lumen-shaped cross-sections a vessel produces. Returns
// geometry in the same (world) space the loop points are already in; the
// caller re-expresses it in whatever local space it actually renders into.
export function triangulateFan(loop: THREE.Vector3[]): { positions: Float32Array; indices: number[] } {
  const centroid = loop.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(loop.length)
  const positions = new Float32Array((loop.length + 1) * 3)
  centroid.toArray(positions, 0)
  loop.forEach((point, i) => point.toArray(positions, (i + 1) * 3))

  const indices: number[] = []
  for (let i = 1; i <= loop.length; i++) {
    const next = i === loop.length ? 1 : i + 1
    indices.push(0, i, next)
  }
  return { positions, indices }
}
