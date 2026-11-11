import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { LIP_Y, NECK_Y, glassGeometry, radiusAt } from './profile.js'

// Glass photographs with dark outlines where the surface turns away from you,
// because it bends the dark room behind. This shell fades in towards the edges
// to give that look (the transmission pass alone only shows the backdrop).
const rimVert = `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const rimFrag = `
uniform vec3 rimColor; uniform float strength; uniform float power;
varying vec3 vN; varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), power);
  gl_FragColor = vec4(rimColor, f * strength);
  #include <colorspace_fragment>
}`

const OPEN_ANGLE = 2.35 // how far the wire swings forward when opened

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Wire tube through points (all in the x/y plane unless given a z).
const wire = (pts, radius, closed = false, segs = 80) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'centripetal'), segs, radius, 10, closed)

// A prop that can also be changed from inside the scene (clicking the bottle);
// `onChange` lets the owner stay in sync.
function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  return [
    v,
    (next) => {
      setV(next)
      onChange?.({ [key]: next })
    },
  ]
}

// glass / tint: the glass colour and how strongly it colours the light passing
// through. capColor, gasket, wireColor: the swing-top parts. droplets: how many
// condensation beads cover the glass. frost: from clear to frosted. open: 0 shut .. 1 open.
export default function Bottle({
  glass = '#ffffff',
  tint = '#bfe6df',
  tintStrength = 0.22,
  capColor = '#f2f1ec',
  gasket = '#c4161c',
  wireColor = '#c9cdd2',
  droplets = 0.55,
  frost = 0,
  open: openProp = 0,
  onChange,
}) {
  const [open, setOpen] = useTwoWay(openProp, 'open', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const glassGeo = useMemo(glassGeometry, [])
  useEffect(() => () => glassGeo.dispose(), [glassGeo])

  const tubes = useMemo(() => {
    const r = 0.03
    // The lever: a U of wire that pivots on the neck, with a bar across the top
    // of the stopper. It lives in the x/y plane, with the pivot at the origin.
    const lever = wire(
      [
        [-0.66, 0, 0],
        [-0.74, 0.45, 0],
        [-0.76, 1.05, 0],
        [-0.62, 1.5, 0],
        [-0.34, 1.78, 0],
        [0, 1.84, 0],
        [0.34, 1.78, 0],
        [0.62, 1.5, 0],
        [0.76, 1.05, 0],
        [0.74, 0.45, 0],
        [0.66, 0, 0],
      ],
      r,
    )
    // The neck wire: a ring clipped round the neck, with a loop on each side
    // for the lever to pivot on.
    const ring = wire(
      Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        return [Math.cos(a) * 0.615, -0.2, Math.sin(a) * 0.615]
      }),
      r,
      true,
      96,
    )
    const loops = [-1, 1].map((s) => wire([[s * 0.615, -0.2, 0.1], [s * 0.68, -0.08, 0.08], [s * 0.66, 0, 0.0], [s * 0.6, -0.1, -0.1], [s * 0.615, -0.2, -0.1]], r * 0.85, false, 30))
    return { lever, ring, loops }
  }, [])
  useEffect(
    () => () => {
      tubes.lever.dispose()
      tubes.ring.dispose()
      tubes.loops.forEach((g) => g.dispose())
    },
    [tubes],
  )

  // Condensation: small flattened beads stuck to the outside of the glass.
  const maxBeads = 320
  const beads = useRef()
  const beadData = useMemo(() => {
    const r = rng(8)
    return Array.from({ length: maxBeads }, () => {
      const y = 0.45 + Math.pow(r(), 0.9) * 6.7
      return { y, a: r() * Math.PI * 2, s: 0.018 + Math.pow(r(), 2.4) * 0.08, stretch: 1 + r() * 1.4 }
    })
  }, [])
  const beadGeo = useMemo(() => new THREE.SphereGeometry(1, 14, 10), [])
  useLayoutEffect(() => {
    const n = Math.round(droplets * maxBeads)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < maxBeads; i++) {
      const b = beadData[i]
      const rad = radiusAt(b.y)
      const px = Math.cos(b.a) * (rad + 0.004)
      const pz = Math.sin(b.a) * (rad + 0.004)
      e.set(0, -b.a, 0)
      q.setFromEuler(e)
      // flat against the glass: thin along the surface normal (local x)
      const s = i < n ? b.s : 0.0001
      m.compose(new THREE.Vector3(px, b.y, pz), q, new THREE.Vector3(s * 0.4, s * b.stretch, s))
      beads.current.setMatrixAt(i, m)
    }
    beads.current.instanceMatrix.needsUpdate = true
  }, [droplets, beadData])

  // The lever on a lightly damped spring
  const leverRef = useRef()
  const st = useRef({ a: openProp * OPEN_ANGLE, v: 0 })
  const want = useRef(open)
  want.current = open
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    s.v += ((want.current * OPEN_ANGLE - s.a) * 60 - s.v * 8) * dt
    s.a += s.v * dt
    leverRef.current.rotation.x = s.a
  })

  const tintColor = useMemo(() => new THREE.Color(tint), [tint])
  const rim = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { rimColor: { value: new THREE.Color() }, strength: { value: 0.7 }, power: { value: 2.6 } },
        vertexShader: rimVert,
        fragmentShader: rimFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  useEffect(() => () => rim.dispose(), [rim])
  useEffect(() => {
    // dark, slightly tinted outline; frosted glass has softer edges
    rim.uniforms.rimColor.value.copy(tintColor).multiplyScalar(0.18)
    rim.uniforms.strength.value = 0.85 * (1 - frost * 0.5)
  }, [rim, tintColor, frost])
  const wireMat = <meshPhysicalMaterial color={wireColor} metalness={1} roughness={0.22} envMapIntensity={1.4} />

  return (
    <group
      position={[0, -4.3, 0]}
      onClick={(e) => {
        e.stopPropagation()
        setOpen(open > 0.5 ? 0 : 1)
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* the glass: a closed shell, so light bends through the wall */}
      <mesh geometry={glassGeo} castShadow>
        <meshPhysicalMaterial
          color={glass}
          transmission={1}
          thickness={1.2}
          ior={1.5}
          roughness={0.02 + frost * 0.55}
          attenuationColor={tintColor}
          attenuationDistance={6 - tintStrength * 4.6}
          envMapIntensity={1.3}
          specularIntensity={1}
          clearcoat={0.4 * (1 - frost)}
          clearcoatRoughness={0.05}
        />
      </mesh>

      <mesh geometry={glassGeo} material={rim} renderOrder={1} />

      {/* condensation beads */}
      <instancedMesh ref={beads} args={[beadGeo, undefined, maxBeads]}>
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.4} roughness={0} clearcoat={1} clearcoatRoughness={0} envMapIntensity={2.2} depthWrite={false} />
      </instancedMesh>

      {/* neck wire */}
      <group position={[0, NECK_Y, 0]}>
        <mesh geometry={tubes.ring}>{wireMat}</mesh>
        {tubes.loops.map((g, i) => (
          <mesh key={i} geometry={g}>
            {wireMat}
          </mesh>
        ))}
        {/* lever + stopper swing together about the pivots */}
        <group ref={leverRef}>
          <mesh geometry={tubes.lever}>{wireMat}</mesh>
          {/* stopper, sitting on the lip: ceramic cap over a red rubber gasket */}
          <group position={[0, LIP_Y - NECK_Y, 0]}>
            <mesh position={[0, 0.02, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.5, 0.1, 40]} />
              <meshPhysicalMaterial color={gasket} roughness={0.55} clearcoat={0.2} />
            </mesh>
            <mesh position={[0, 0.34, 0]} scale={[1, 0.55, 1]} castShadow>
              <sphereGeometry args={[0.46, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial color={capColor} roughness={0.28} clearcoat={0.7} clearcoatRoughness={0.1} />
            </mesh>
            <mesh position={[0, 0.17, 0]} castShadow>
              <cylinderGeometry args={[0.46, 0.46, 0.3, 40]} />
              <meshPhysicalMaterial color={capColor} roughness={0.28} clearcoat={0.7} clearcoatRoughness={0.1} />
            </mesh>
            {/* the plug that goes down into the neck */}
            <mesh position={[0, -0.16, 0]} castShadow>
              <cylinderGeometry args={[0.38, 0.34, 0.3, 32]} />
              <meshPhysicalMaterial color={gasket} roughness={0.6} />
            </mesh>
            {/* a small wire hook the lever bar rests in */}
            <mesh position={[0, 0.58, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.07, 0.025, 8, 20]} />
              {wireMat}
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
