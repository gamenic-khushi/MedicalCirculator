import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'

import type { LesionProfileSample } from '@/lib/twoPointLesionMeasurement'

import { flowParams } from './flowEffect'

// The blood flow (Aki 11/26): thin light-blue streamlines along the whole vessel the two points
// are on, with dashes that run along them. They follow the vessel's real centre line and outline
// (the sweep of the measurement, taken on beyond ① and ② until the vessel ends or splits) and
// show the continuity of a flow: the narrower the vessel, the faster the dashes go, and the
// lines gather into the narrowing. The FFR sets how bright and how fast the whole flow is. The
// lines are drawn over the vessel (no depth test), as if its wall were see-through, and are
// never in a saved picture (the canvas hides the group for a capture).

export interface FlowPath {
  centres: THREE.Vector3[]
  profile: LesionProfileSample[]
  ffr: number | null
  /** The length of the stretch between ① and ②; the dashes are set against it. */
  refLength: number
}

interface Station {
  position: THREE.Vector3
  n1: THREE.Vector3
  n2: THREE.Vector3
  radius: number
  area: number
  arc: number
}

// The stations along the centre line with a frame each (turned smoothly along the line).
function buildStations(path: FlowPath): Station[] {
  const { centres, profile } = path
  const count = Math.min(centres.length, profile.length)
  const stations: Station[] = []
  let n1 = new THREE.Vector3()
  for (let i = 0; i < count; i += 1) {
    const before = centres[Math.max(i - 1, 0)]
    const after = centres[Math.min(i + 1, count - 1)]
    const tangent = after.clone().sub(before).normalize()
    if (i === 0) {
      const helper = Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
      n1 = tangent.clone().cross(helper).normalize()
    } else {
      n1 = n1.clone().sub(tangent.clone().multiplyScalar(n1.dot(tangent))).normalize()
    }
    const n2 = tangent.clone().cross(n1).normalize()
    // The wall reaches `top` above and `bottom` below the centre line: the middle is the radius.
    const radius = Math.max((profile[i].top + profile[i].bottom) / 2, 1e-6)
    stations.push({ position: centres[i], n1: n1.clone(), n2, radius, area: radius * radius, arc: profile[i].arc })
  }
  return stations
}

// Dashes per length of the stretch between ① and ② (the density is the same along a whole vessel).
const DASHES_PER_REF_LENGTH = 5
// How far a dash goes in a second at full flow, in lengths of the stretch between ① and ②.
const FLOW_SPEED = 0.16
// Where the lines run: in the middle, halfway out and near the wall (as a share of the radius).
const RING_RADII = [
  { r: 0, count: 1 },
  { r: 0.45, count: 6 },
  { r: 0.82, count: 10 },
]

export function FlowLines({ path, groupRef }: { path: FlowPath; groupRef: React.RefObject<THREE.Group | null> }) {
  const stations = useMemo(() => buildStations(path), [path])
  const total = stations.length > 0 ? stations[stations.length - 1].arc : 1
  const refLength = path.refLength > 0 ? path.refLength : total
  const params = flowParams(path.ffr)
  const meanArea = useMemo(() => stations.reduce((sum, s) => sum + s.area, 0) / Math.max(stations.length, 1), [stations])

  const geometries = useMemo(() => {
    if (stations.length < 2) return []
    const offsets: { r: number; theta: number }[] = []
    for (const ring of RING_RADII) {
      for (let k = 0; k < ring.count; k += 1) offsets.push({ r: ring.r, theta: (k / ring.count) * Math.PI * 2 + ring.r })
    }
    return offsets.map(({ r, theta }) => {
      const positions: number[] = []
      const tau: number[] = []
      // The "time of flight" along the line: the vessel's area over the mean area, summed along
      // it, so a dash at a fixed pace in this measure goes faster where the vessel is narrow.
      let phase = 0
      stations.forEach((station, i) => {
        if (i > 0) phase += ((station.arc - stations[i - 1].arc) * station.area) / meanArea
        const p = station.position
          .clone()
          .addScaledVector(station.n1, Math.cos(theta) * r * station.radius * 0.9)
          .addScaledVector(station.n2, Math.sin(theta) * r * station.radius * 0.9)
        positions.push(p.x, p.y, p.z)
        tau.push(phase)
      })
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('tau', new THREE.Float32BufferAttribute(tau, 1))
      return geometry
    })
  }, [stations, meanArea])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFreq: { value: 1 },
          uSpeed: { value: 1 },
          uStrength: { value: 1 },
          uColor: { value: new THREE.Color('#7dd3fc') },
        },
        vertexShader: `
          attribute float tau;
          varying float vTau;
          void main() {
            vTau = tau;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform float uTime;
          uniform float uFreq;
          uniform float uSpeed;
          uniform float uStrength;
          uniform vec3 uColor;
          varying float vTau;
          void main() {
            float p = fract(vTau * uFreq - uTime * uSpeed);
            float dash = smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.4, 0.55, p));
            gl_FragColor = vec4(uColor, (0.15 + 0.85 * dash) * uStrength);
          }`,
      }),
    [],
  )

  const lines = useMemo(() => geometries.map((geometry) => new THREE.Line(geometry, material)), [geometries, material])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uFreq.value = DASHES_PER_REF_LENGTH / refLength
    // The FFR sets the pace (and, with it, how bright the flow is): a low FFR is weaker and slower.
    material.uniforms.uSpeed.value = FLOW_SPEED * params.speed * DASHES_PER_REF_LENGTH
    material.uniforms.uStrength.value = params.strength
  })

  return (
    <group ref={groupRef} renderOrder={20}>
      {lines.map((line, index) => (
        <primitive key={index} object={line} frustumCulled={false} renderOrder={20} />
      ))}
    </group>
  )
}
