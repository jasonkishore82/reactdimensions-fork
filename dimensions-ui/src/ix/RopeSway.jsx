import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A cable hanging from the hook of a desk stand, with a plug on its free end.
// Grab the plug and drag it anywhere: the cable follows, and when you let go it
// swings and settles, the plug coming to rest on the floor.
//
// The cable is a verlet rope: SEGS stiff links between SEGS + 1 points, plus one
// more link for the rigid plug body (from the cable's end to the plug's tip).
// Each frame is run in small steps: integrate with gravity and damping, then
// satisfy the link lengths a number of times. Links work both ways, so the
// cable never stretches past its length; the plug can be pulled no further from
// the hook than the cable reaches. Every point is kept above the floor and out
// of the stand (its pole, arm and base plate are capsules / a disc). The cable
// is drawn as a tube whose vertices are rewritten every frame.

const SEGS = 30
const LEN = 5.4 // cable length
const SEG = LEN / SEGS
const R = 0.06 // cable radius
const PLUG_LEN = 0.62 // from the cable's end to the plug's tip
const ANCHOR = new THREE.Vector3(0, 4.4, 0) // the bottom of the hook ring
const POLE = { x: -2.6, z: 0, r: 0.11, top: 5.0 }
const ARM = { a: new THREE.Vector3(POLE.x, POLE.top, POLE.z), b: new THREE.Vector3(0, POLE.top, POLE.z), r: 0.08 }
const PLATE = { r: 1.0, h: 0.1 }
const PLUG_R = 0.19 // collision radius of the plug's two points (covers the body's half-width)
const GRIP_LAYER = 1 // the invisible grab handle: raycast, but never drawn or shadowed
const GRAVITY = -16
const STEPS = 4
const ITER = 24
const TUBE_SEG = 96
const TUBE_RAD = 10

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8a8580']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 7, 6]} rotation-y={Math.PI / 3} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eaf0ff" position={[8, 5, 5]} rotation-y={-Math.PI / 3} scale={[6, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
    </Environment>
  )
}

// push p out of a capsule a-b of radius r
const _ab = new THREE.Vector3()
const _ap = new THREE.Vector3()
const _c = new THREE.Vector3()
function outOfCapsule(p, a, b, r) {
  _ab.subVectors(b, a)
  _ap.subVectors(p, a)
  const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1)
  _c.copy(a).addScaledVector(_ab, t)
  _ap.subVectors(p, _c)
  const d = _ap.length()
  if (d < r) {
    if (d < 1e-6) _ap.set(0, 0, 1)
    else _ap.multiplyScalar(1 / d)
    p.copy(_c).addScaledVector(_ap, r)
    return true
  }
  return false
}

const POLE_A = new THREE.Vector3(POLE.x, 0, POLE.z)
const POLE_B = new THREE.Vector3(POLE.x, POLE.top, POLE.z)

// keep a point (with radius r) above the floor and out of the stand; returns
// true if it touched the ground, for friction
function collide(p, r) {
  let ground = false
  const onPlate = Math.hypot(p.x - POLE.x, p.z - POLE.z) < PLATE.r + r
  const floor = (onPlate ? PLATE.h : 0) + r
  if (p.y < floor) {
    p.y = floor
    ground = true
  }
  outOfCapsule(p, POLE_A, POLE_B, POLE.r + r)
  outOfCapsule(p, ARM.a, ARM.b, ARM.r + r)
  return ground
}

function makeRope() {
  const n = SEGS + 2 // cable points + the plug tip
  const pos = []
  const prev = []
  // start hanging, with the end draped along the floor towards the viewer
  for (let i = 0; i <= SEGS; i++) {
    const l = i * SEG
    const p = l < ANCHOR.y - R ? new THREE.Vector3(ANCHOR.x, ANCHOR.y - l, ANCHOR.z) : new THREE.Vector3(ANCHOR.x + 0.15, R, ANCHOR.z + (l - ANCHOR.y + R))
    pos.push(p)
    prev.push(p.clone())
  }
  const tip = pos[SEGS].clone().add(new THREE.Vector3(0, 0, PLUG_LEN))
  pos.push(tip)
  prev.push(tip.clone())
  // inverse masses: the hook is fixed, the plug is heavier than a cable link
  const w = Array.from({ length: n }, (_, i) => (i === 0 ? 0 : i >= SEGS ? 0.35 : 1))
  return { pos, prev, w, ground: new Array(n).fill(false) }
}

const _d = new THREE.Vector3()
function step(rope, h, target, damping) {
  const { pos, prev, w, ground } = rope
  const n = pos.length
  const g = GRAVITY * h * h
  for (let i = 1; i < n; i++) {
    const p = pos[i]
    const q = prev[i]
    let vx = (p.x - q.x) * damping
    let vy = (p.y - q.y) * damping
    let vz = (p.z - q.z) * damping
    if (ground[i]) {
      // friction on the floor
      vx *= 0.7
      vz *= 0.7
    }
    q.copy(p)
    p.x += vx
    p.y += vy + g
    p.z += vz
  }
  // held: the cable's end goes where the pointer is; its previous position is
  // kept, so on release it carries the speed it was moving with
  if (target) pos[SEGS].copy(target)
  pos[0].copy(ANCHOR)
  const d = _d
  for (let k = 0; k < ITER; k++) {
    for (let i = 0; i < n - 1; i++) {
      const a = pos[i]
      const b = pos[i + 1]
      const wa = target && i === SEGS ? 0 : w[i]
      const wb = target && i + 1 === SEGS ? 0 : w[i + 1]
      const sum = wa + wb
      if (sum === 0) continue
      const rest = i === SEGS ? PLUG_LEN : SEG
      d.subVectors(b, a)
      const len = d.length() || 1e-6
      const diff = (len - rest) / (len * sum)
      a.addScaledVector(d, diff * wa)
      b.addScaledVector(d, -diff * wb)
    }
    for (let i = 1; i < n; i++) {
      if (target && i === SEGS) continue
      ground[i] = collide(pos[i], i >= SEGS ? PLUG_R : R)
    }
  }
}

function Cable({ cableColor, plugColor, accentColor }) {
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  useCursor(hover || held, held ? 'grabbing' : 'grab')
  const { camera, controls, raycaster } = useThree()
  const reduced = useMemo(reducedMotion, [])
  useEffect(() => {
    raycaster.layers.enable(GRIP_LAYER)
  }, [raycaster])

  const rope = useMemo(() => {
    const r = makeRope()
    // pose it before the first frame: lead the plug out to the front right,
    // then let it drop and settle there
    const lead = new THREE.Vector3(1.7, 1.2, 1.4)
    for (let i = 0; i < 300; i++) step(r, 1 / 240, lead, 0.97)
    for (let i = 0; i < 900; i++) step(r, 1 / 240, null, 0.97)
    for (const [i, p] of r.pos.entries()) r.prev[i].copy(p)
    return r
  }, [])

  // the tube: a fixed index buffer; positions and normals rewritten each frame
  const tube = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const verts = (TUBE_SEG + 1) * (TUBE_RAD + 1)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const uv = new Float32Array(verts * 2)
    const idx = []
    for (let i = 0; i <= TUBE_SEG; i++)
      for (let j = 0; j <= TUBE_RAD; j++) {
        uv[(i * (TUBE_RAD + 1) + j) * 2] = i / TUBE_SEG
        uv[(i * (TUBE_RAD + 1) + j) * 2 + 1] = j / TUBE_RAD
        if (i < TUBE_SEG && j < TUBE_RAD) {
          const a = i * (TUBE_RAD + 1) + j
          const b = (i + 1) * (TUBE_RAD + 1) + j
          idx.push(a, b, a + 1, b, b + 1, a + 1)
        }
      }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(-1, 2.5, 0), 8)
    return g
  }, [])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(rope.pos.slice(0, SEGS + 1).map((p) => p.clone()), false, 'centripetal'), [rope])

  const mats = useMemo(
    () => ({
      cable: new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.4 }),
      plug: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      accent: new THREE.MeshStandardMaterial({ roughness: 0.45 }),
      brass: new THREE.MeshStandardMaterial({ color: '#d8b46a', metalness: 1, roughness: 0.25 }),
      grip: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  )
  useEffect(
    () => () => {
      tube.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [tube, mats],
  )
  useEffect(() => {
    mats.cable.color.set(cableColor)
    mats.plug.color.set(plugColor)
    mats.accent.color.set(accentColor)
  }, [mats, cableColor, plugColor, accentColor])

  const plug = useRef()
  const drag = useRef(null) // { plane, off }
  const target = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => ({ P: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), B: new THREE.Vector3(), V: new THREE.Vector3(), Y: new THREE.Vector3(0, 1, 0) }), [])

  useEffect(() => {
    const up = () => {
      if (!drag.current) return
      drag.current = null
      setHeld(false)
      if (controls) controls.enabled = true
      if (reduced) {
        // no swinging: settle it at once
        for (let i = 0; i < 600; i++) step(rope, 1 / 240, null, 0.9)
        for (const [i, p] of rope.pos.entries()) rope.prev[i].copy(p)
      }
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls, rope, reduced])

  const onDown = (e) => {
    e.stopPropagation()
    const end = rope.pos[SEGS]
    // drag in a plane through the plug, facing the camera
    const n = new THREE.Vector3()
    camera.getWorldDirection(n)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, end)
    const hit = new THREE.Vector3()
    const off = e.ray.intersectPlane(plane, hit) ? end.clone().sub(hit) : new THREE.Vector3()
    drag.current = { plane, off }
    setHeld(true)
    if (controls) controls.enabled = false
  }

  const writeTube = () => {
    const { P, T, N, B, V, Y } = tmp
    for (let i = 0; i <= SEGS; i++) curve.points[i].copy(rope.pos[i])
    const pa = tube.attributes.position.array
    const na = tube.attributes.normal.array
    // parallel-transport frames along the curve, so the tube doesn't twist
    curve.getTangent(0, T)
    N.crossVectors(T, Math.abs(T.y) > 0.9 ? V.set(1, 0, 0) : Y).normalize()
    for (let i = 0; i <= TUBE_SEG; i++) {
      const t = i / TUBE_SEG
      curve.getPoint(t, P)
      curve.getTangent(t, T)
      N.addScaledVector(T, -N.dot(T)).normalize()
      B.crossVectors(T, N)
      for (let j = 0; j <= TUBE_RAD; j++) {
        const a = (j / TUBE_RAD) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        const k = (i * (TUBE_RAD + 1) + j) * 3
        const nx = c * N.x + s * B.x
        const ny = c * N.y + s * B.y
        const nz = c * N.z + s * B.z
        na[k] = nx
        na[k + 1] = ny
        na[k + 2] = nz
        pa[k] = P.x + nx * R
        pa[k + 1] = P.y + ny * R
        pa[k + 2] = P.z + nz * R
      }
    }
    tube.attributes.position.needsUpdate = true
    tube.attributes.normal.needsUpdate = true
  }

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const d = drag.current
    let tgt = null
    if (d) {
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(d.plane, target)) {
        target.add(d.off)
        // no stretching: keep the plug within the cable's reach of the hook
        const v = target.clone().sub(ANCHOR)
        const max = LEN * 0.985
        if (v.length() > max) target.copy(ANCHOR).addScaledVector(v.normalize(), max)
        collide(target, PLUG_R)
        tgt = target
      } else tgt = rope.pos[SEGS].clone()
    }
    if (dt > 1e-5) {
      const h = dt / STEPS
      for (let i = 0; i < STEPS; i++) step(rope, h, tgt, 0.995)
    }
    writeTube()

    // the plug: from the cable's end towards its tip
    const end = rope.pos[SEGS]
    const tip = rope.pos[SEGS + 1]
    tmp.V.subVectors(tip, end).normalize()
    plug.current.position.copy(end)
    plug.current.quaternion.setFromUnitVectors(tmp.Y, tmp.V)
  })

  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }

  // the plug is built along +y from the cable's end (y = 0) to the pin tips
  return (
    <group>
      <mesh geometry={tube} material={mats.cable} castShadow frustumCulled={false} />
      <group ref={plug}>
        {/* strain relief, ribbed */}
        <mesh material={mats.plug} position-y={0.09}>
          <cylinderGeometry args={[0.105, 0.075, 0.18, 24]} />
        </mesh>
        {[0.05, 0.1, 0.15].map((y) => (
          <mesh key={y} material={mats.plug} position-y={y} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.083 + y * 0.12, 0.012, 6, 24]} />
          </mesh>
        ))}
        {/* body and face */}
        <RoundedBox args={[0.36, 0.3, 0.24]} radius={0.06} smoothness={4} position-y={0.33} material={mats.plug} castShadow />
        <mesh material={mats.accent} position-y={0.483}>
          <boxGeometry args={[0.28, 0.006, 0.16]} />
        </mesh>
        {/* two pins */}
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} material={mats.brass} position={[x, 0.55, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.14, 12]} />
          </mesh>
        ))}
        {/* invisible, larger handle so it's easy to grab on touch */}
        <mesh material={mats.grip} position-y={0.3} layers={GRIP_LAYER} onPointerDown={onDown} {...hoverProps}>
          <sphereGeometry args={[0.42, 12, 8]} />
        </mesh>
      </group>
    </group>
  )
}

// The stand: a weighted base plate, a pole, an arm and a hook ring.
function Stand({ standColor }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.3 }), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2a2d', roughness: 0.6 }), [])
  useEffect(
    () => () => {
      mat.dispose()
      dark.dispose()
    },
    [mat, dark],
  )
  useEffect(() => {
    mat.color.set(standColor)
  }, [mat, standColor])
  const armLen = ARM.b.x - ARM.a.x
  return (
    <group>
      <mesh material={dark} position={[POLE.x, PLATE.h / 2, POLE.z]} castShadow receiveShadow>
        <cylinderGeometry args={[PLATE.r, PLATE.r + 0.04, PLATE.h, 48]} />
      </mesh>
      <mesh material={mat} position={[POLE.x, PLATE.h + (POLE.top - PLATE.h) / 2, POLE.z]} castShadow>
        <cylinderGeometry args={[POLE.r, POLE.r, POLE.top - PLATE.h, 24]} />
      </mesh>
      <mesh material={mat} position={[POLE.x, POLE.top, POLE.z]}>
        <sphereGeometry args={[POLE.r + 0.02, 24, 16]} />
      </mesh>
      <mesh material={mat} position={[ARM.a.x + armLen / 2, POLE.top, POLE.z]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[ARM.r, ARM.r, armLen, 20]} />
      </mesh>
      <mesh material={mat} position={[ARM.b.x, POLE.top, POLE.z]}>
        <sphereGeometry args={[ARM.r + 0.01, 20, 12]} />
      </mesh>
      {/* a short drop and the ring the cable is tied to */}
      <mesh material={mat} position={[0, POLE.top - 0.16, POLE.z]}>
        <cylinderGeometry args={[0.03, 0.03, 0.24, 12]} />
      </mesh>
      <mesh material={mat} position={[ANCHOR.x, ANCHOR.y + 0.17, ANCHOR.z]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.17, 0.03, 10, 32]} />
      </mesh>
      {/* the cable's knot at the bottom of the ring */}
      <mesh material={dark} position={[ANCHOR.x, ANCHOR.y + 0.02, ANCHOR.z]}>
        <sphereGeometry args={[0.1, 20, 14]} />
      </mesh>
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(16))
    const dist = Math.max(6 / 2 / tan, 8 / 2 / (tan * aspect)) * 1.08
    camera.position.set(Math.sin(0.45) * dist, 2.4 + dist * 0.28, Math.cos(0.45) * dist)
    camera.lookAt(-0.6, 2.4, 0)
  }, [camera, size.width, size.height])
  return null
}

// cableColor, plugColor, accentColor: the cable and its plug. standColor: the
// stand. floorColor: the studio floor and backdrop.
export default function RopeSway({
  cableColor = '#e8a33d',
  plugColor = '#f2efe8',
  accentColor = '#2b2c30',
  standColor = '#9aa0a8',
  floorColor = '#d9d4cb',
  autoRotate = false,
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [5, 5, 12], fov: 32, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[floorColor]} />
        <fog attach="fog" args={[floorColor, 18, 40]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
        <directionalLight position={[-5, 10, 6]} intensity={0.6} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={floorColor} roughness={0.9} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={16} resolution={512} blur={2.4} opacity={0.5} far={5} />
        <Stand standColor={standColor} />
        <Cable cableColor={cableColor} plugColor={plugColor} accentColor={accentColor} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[-0.6, 2.4, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={6} maxDistance={30} minPolarAngle={0.2} maxPolarAngle={1.45} />
      </Canvas>
      <InfoHint>
        Drag the plug to swing the cable · drag the background to orbit
      </InfoHint>
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner instead of a
// line of text over the scene: hover it (or tap it) to read them.
function InfoHint({ children }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hover || pinned
  return (
    <div
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 'calc(100% - 24px)' }}
    >
      {open && (
        <div role="tooltip" style={{ maxWidth: 340, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.06)', font: '500 11px/1.6 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', color: '#2a2925', textAlign: 'left' }}>
          {children}
        </div>
      )}
      <button
        type="button"
        aria-label="How to use"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        style={{ width: 30, height: 30, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: open ? '#1c1a16' : 'rgba(255,255,255,0.88)', color: open ? '#f4f1ea' : '#2a2925', font: 'italic 700 15px/1 Georgia, "Times New Roman", serif', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}
      >
        i
      </button>
    </div>
  )
}
