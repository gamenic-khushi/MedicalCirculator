// A small closed 3D model for the tests, written as an ASCII STL: a vessel 30 mm
// long along the Y axis, 5 mm wide, narrowing to 1.6 mm wide in the middle. It is
// built here so the tests need no model file and always see the same vessel.

const LENGTH = 30
const RINGS = 60
const SEGMENTS = 24

function radiusAt(y: number): number {
  // 2.5 mm, narrowing to 0.8 mm in the middle.
  return 2.5 - 1.7 * Math.exp(-(((y - LENGTH / 2) / 3) ** 2))
}

type Vec = [number, number, number]

function facet(a: Vec, b: Vec, c: Vec): string {
  const u: Vec = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v: Vec = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n: Vec = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const length = Math.hypot(...n) || 1
  const f = (p: Vec) => `vertex ${p[0].toFixed(5)} ${p[1].toFixed(5)} ${p[2].toFixed(5)}`
  return `facet normal ${(n[0] / length).toFixed(5)} ${(n[1] / length).toFixed(5)} ${(n[2] / length).toFixed(5)}\nouter loop\n${f(a)}\n${f(b)}\n${f(c)}\nendloop\nendfacet\n`
}

export function makeStenosisStl(): Buffer {
  const point = (ring: number, segment: number): Vec => {
    const y = (ring / RINGS) * LENGTH
    const angle = (segment / SEGMENTS) * Math.PI * 2
    const r = radiusAt(y)
    return [r * Math.cos(angle), y, r * Math.sin(angle)]
  }
  let out = 'solid vessel\n'
  for (let ring = 0; ring < RINGS; ring++) {
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const next = (segment + 1) % SEGMENTS
      const a = point(ring, segment)
      const b = point(ring, next)
      const c = point(ring + 1, next)
      const d = point(ring + 1, segment)
      out += facet(a, b, c) + facet(a, c, d)
    }
  }
  // End caps, so the model is closed.
  const bottom: Vec = [0, 0, 0]
  const top: Vec = [0, LENGTH, 0]
  for (let segment = 0; segment < SEGMENTS; segment++) {
    const next = (segment + 1) % SEGMENTS
    out += facet(bottom, point(0, next), point(0, segment))
    out += facet(top, point(RINGS, segment), point(RINGS, next))
  }
  out += 'endsolid vessel\n'
  return Buffer.from(out, 'utf8')
}
