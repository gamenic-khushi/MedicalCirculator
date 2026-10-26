import * as THREE from 'three'
import type { MeshBVH } from 'three-mesh-bvh'

// Which of two points on the model is nearer the heart, by the path along the
// model's surface from the heart rather than by what the camera sees. The
// screen walk in ModelCanvas (determineProximalPoint) covers a fixed share of
// the view: zoomed in, that is a few millimetres of vessel, and its local
// caliber bumps ordered all 12 test pairs along one vessel the wrong way round.

// The heart (the aortic root) is the model's thickest part; a vessel tree
// without one keeps its widest, proximal trunk. Thickness is sampled on about
// this many triangles.
const THICKNESS_SAMPLES = 1500
// Thickness is the shortest of several rays from the surface back to the
// surface: straight across, and tilted this far, so a capped vessel end (whose
// straight-across ray runs down the vessel) doesn't pass for the heart.
const THICKNESS_TILT = Math.PI / 4
// Below this share of the points' own distance apart, their paths from the
// heart are too close to call (e.g. points on two branches equally far out).
const MIN_PATH_DIFFERENCE_RATIO = 0.3

interface HeartPaths {
  // Merged vertex for each geometry vertex (STL repeats a vertex per triangle).
  vertexOf: Uint32Array
  positions: Float32Array
  // Path length from the heart; Infinity where no sampled thickness reached.
  distance: Float64Array
  // Which connected piece (each has its own heart) a vertex was reached from.
  piece: Int32Array
}

// Built on first use for each geometry (under a second for 600k triangles),
// then kept.
const cache = new WeakMap<THREE.BufferGeometry, HeartPaths>()

// Smallest-distance-first queue of vertices, for Dijkstra.
class VertexQueue {
  private distances: number[] = []
  private vertices: number[] = []
  topDistance = 0

  get size() {
    return this.vertices.length
  }

  push(distance: number, vertex: number) {
    let i = this.vertices.length
    this.distances.push(distance)
    this.vertices.push(vertex)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.distances[parent] <= distance) break
      this.distances[i] = this.distances[parent]
      this.vertices[i] = this.vertices[parent]
      i = parent
    }
    this.distances[i] = distance
    this.vertices[i] = vertex
  }

  pop(): number {
    const top = this.vertices[0]
    this.topDistance = this.distances[0]
    const lastDistance = this.distances.pop()!
    const lastVertex = this.vertices.pop()!
    const count = this.vertices.length
    if (count > 0) {
      let i = 0
      for (;;) {
        let child = 2 * i + 1
        if (child >= count) break
        if (child + 1 < count && this.distances[child + 1] < this.distances[child]) child += 1
        if (this.distances[child] >= lastDistance) break
        this.distances[i] = this.distances[child]
        this.vertices[i] = this.vertices[child]
        i = child
      }
      this.distances[i] = lastDistance
      this.vertices[i] = lastVertex
    }
    return top
  }
}

// One id per distinct position, found by hashing the coordinates' bits (a
// string key per vertex is far too slow on a million-vertex STL).
function mergeVertices(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const count = position.count
  let xyz: Float32Array
  if (
    position instanceof THREE.BufferAttribute &&
    position.array instanceof Float32Array &&
    position.itemSize === 3
  ) {
    xyz = position.array
  } else {
    xyz = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      xyz[3 * i] = position.getX(i)
      xyz[3 * i + 1] = position.getY(i)
      xyz[3 * i + 2] = position.getZ(i)
    }
  }
  const bits = new Uint32Array(xyz.buffer, xyz.byteOffset, count * 3)
  let size = 1
  while (size < count * 2) size <<= 1
  const slots = new Int32Array(size).fill(-1)
  const vertexOf = new Uint32Array(count)
  const firsts: number[] = []
  for (let i = 0; i < count; i++) {
    const x = bits[3 * i]
    const y = bits[3 * i + 1]
    const z = bits[3 * i + 2]
    let slot =
      (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & (size - 1)
    for (;;) {
      const j = slots[slot]
      if (j === -1) {
        slots[slot] = i
        vertexOf[i] = firsts.length
        firsts.push(i)
        break
      }
      if (bits[3 * j] === x && bits[3 * j + 1] === y && bits[3 * j + 2] === z) {
        vertexOf[i] = vertexOf[j]
        break
      }
      slot = (slot + 1) & (size - 1)
    }
  }
  const positions = new Float32Array(firsts.length * 3)
  firsts.forEach((i, id) => {
    positions[3 * id] = xyz[3 * i]
    positions[3 * id + 1] = xyz[3 * i + 1]
    positions[3 * id + 2] = xyz[3 * i + 2]
  })
  return { vertexOf, positions }
}

function buildHeartPaths(geometry: THREE.BufferGeometry, bvh: MeshBVH): HeartPaths {
  const position = geometry.getAttribute('position')
  const indices = geometry.getIndex()?.array
  const corner = (k: number) => (indices ? indices[k] : k)
  const triangles = (indices ? indices.length : position.count) / 3
  const { vertexOf, positions } = mergeVertices(position)
  const vertexCount = positions.length / 3

  // Neighbours of each vertex along the triangles' edges, packed per vertex.
  const start = new Uint32Array(vertexCount + 1)
  for (let k = 0; k < triangles * 3; k++) start[vertexOf[corner(k)] + 1] += 2
  for (let v = 0; v < vertexCount; v++) start[v + 1] += start[v]
  const neighbours = new Uint32Array(start[vertexCount])
  const filled = start.slice(0, vertexCount)
  for (let t = 0; t < triangles; t++) {
    for (let e = 0; e < 3; e++) {
      const a = vertexOf[corner(3 * t + e)]
      const b = vertexOf[corner(3 * t + ((e + 1) % 3))]
      neighbours[filled[a]++] = b
      neighbours[filled[b]++] = a
    }
  }

  // Thickness at sampled triangles: the shortest ray back to the surface,
  // either way across (the mesh's facing can't be trusted) and tilted.
  geometry.computeBoundingBox()
  const nudge = geometry.boundingBox!.getSize(new THREE.Vector3()).length() * 1e-5
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const [normal, along, across] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const ray = new THREE.Ray()
  const [cos, sin] = [Math.cos(THICKNESS_TILT), Math.sin(THICKNESS_TILT)]
  const samples: { vertex: number; thickness: number }[] = []
  const stride = Math.max(1, Math.floor(triangles / THICKNESS_SAMPLES))
  for (let t = 0; t < triangles; t += stride) {
    a.fromBufferAttribute(position, corner(3 * t))
    b.fromBufferAttribute(position, corner(3 * t + 1))
    c.fromBufferAttribute(position, corner(3 * t + 2))
    along.subVectors(b, a)
    normal.subVectors(c, a).cross(along)
    // Models come in any unit (a glTF one spans about 0.002), so only a truly
    // flat triangle is skipped.
    if (normal.lengthSq() === 0) continue
    normal.normalize()
    along.normalize()
    across.crossVectors(normal, along)
    const centre = a.add(b).add(c).divideScalar(3)
    let thickness = Infinity
    for (const side of [1, -1]) {
      for (const tilt of [null, along, across]) {
        ray.direction.copy(normal).multiplyScalar(side * (tilt ? cos : 1))
        if (tilt) ray.direction.addScaledVector(tilt, sin)
        ray.origin.copy(centre).addScaledVector(ray.direction, nudge)
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
        if (hit && hit.distance < thickness) thickness = hit.distance
      }
    }
    if (thickness < Infinity) samples.push({ vertex: vertexOf[corner(3 * t)], thickness })
  }
  samples.sort((p, q) => q.thickness - p.thickness)

  // Path lengths from the thickest spot; a piece not connected to it gets its
  // own thickest spot as its heart.
  const distance = new Float64Array(vertexCount).fill(Infinity)
  const piece = new Int32Array(vertexCount).fill(-1)
  const queue = new VertexQueue()
  let pieces = 0
  for (const { vertex: seed } of samples) {
    if (piece[seed] !== -1) continue
    distance[seed] = 0
    piece[seed] = pieces
    queue.push(0, seed)
    while (queue.size > 0) {
      const v = queue.pop()
      const d = queue.topDistance
      if (d > distance[v]) continue
      for (let k = start[v]; k < start[v + 1]; k++) {
        const w = neighbours[k]
        const dx = positions[3 * w] - positions[3 * v]
        const dy = positions[3 * w + 1] - positions[3 * v + 1]
        const dz = positions[3 * w + 2] - positions[3 * v + 2]
        const step = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d + step < distance[w]) {
          distance[w] = d + step
          piece[w] = pieces
          queue.push(d + step, w)
        }
      }
    }
    pieces += 1
  }
  return { vertexOf, positions, distance, piece }
}

interface HeartPath {
  distance: number
  piece: number
  offSurface: number
}

// Path length from the heart to the surface point nearest `localPoint` (in the
// mesh's own space), which connected piece that is in, and how far off the
// surface the point was.
function heartPathAt(mesh: THREE.Mesh, localPoint: THREE.Vector3): HeartPath | null {
  const geometry = mesh.geometry
  const bvh = (geometry as unknown as { boundsTree?: MeshBVH }).boundsTree
  if (!bvh) return null
  let paths = cache.get(geometry)
  if (!paths) {
    paths = buildHeartPaths(geometry, bvh)
    cache.set(geometry, paths)
  }
  const nearest = bvh.closestPointToPoint(localPoint)
  if (!nearest) return null
  const index = geometry.getIndex()
  let best = { distance: Infinity, piece: -1 }
  for (let k = 0; k < 3; k++) {
    const corner = 3 * nearest.faceIndex + k
    const v = paths.vertexOf[index ? index.getX(corner) : corner]
    const toVertex = Math.hypot(
      localPoint.x - paths.positions[3 * v],
      localPoint.y - paths.positions[3 * v + 1],
      localPoint.z - paths.positions[3 * v + 2],
    )
    if (paths.distance[v] + toVertex < best.distance) {
      best = { distance: paths.distance[v] + toVertex, piece: paths.piece[v] }
    }
  }
  return { ...best, offSurface: nearest.distance }
}

// 'first' or 'second', whichever world-space point lies nearer the heart along
// the model; null when that can't be told: on different meshes or unconnected
// pieces, or about as far out as each other.
export function nearerToHeart(
  root: THREE.Object3D,
  first: THREE.Vector3,
  second: THREE.Vector3,
): 'first' | 'second' | null {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })
  const locate = (point: THREE.Vector3) => {
    let found: { mesh: THREE.Mesh; local: THREE.Vector3; path: HeartPath } | null = null
    for (const mesh of meshes) {
      const local = mesh.worldToLocal(point.clone())
      const path = heartPathAt(mesh, local)
      if (path && (!found || path.offSurface < found.path.offSurface)) found = { mesh, local, path }
    }
    return found
  }
  const one = locate(first)
  const two = locate(second)
  if (
    !one ||
    !two ||
    one.mesh !== two.mesh ||
    one.path.piece === -1 ||
    one.path.piece !== two.path.piece
  ) {
    return null
  }
  const difference = two.path.distance - one.path.distance
  if (Math.abs(difference) < one.local.distanceTo(two.local) * MIN_PATH_DIFFERENCE_RATIO)
    return null
  return difference > 0 ? 'first' : 'second'
}
