import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A little portable radio you can pick up and move across the floor. Press on
// it and it lifts off the floor; it follows the pointer on a spring, leaning
// with its speed like something held from above, and when you let go it drops
// and settles with a small bounce. The soft shadow underneath spreads and fades
// as it rises. Dragging the background orbits the camera.
//
// The radio's origin is the middle of its underside, so y = 0 is resting on the
// floor. While tilted, a corner of the body swings down; the tilt is limited by
// the current height so no corner ever dips below the floor.

const BODY = { w: 1.8, h: 1.1, d: 0.7 } // the case
const FEET = 0.06 // height of the rubber feet under the case
const HALF_SPAN = BODY.w / 2 + BODY.d / 2 // worst-case lever arm for a tilted corner
const BOUNDS = 3.0 // how far from the centre it can be carried
const LIFT = 0.65 // height while held
const MAX_TILT = 0.38

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8a8580']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 7, 6]} rotation-y={Math.PI / 3} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eaf0ff" position={[8, 5, 5]} rotation-y={-Math.PI / 3} scale={[6, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
      <Lightformer form="ring" intensity={0.8} color="#fff4e6" position={[0, 3, -9]} scale={4} />
    </Environment>
  )
}

// A soft round shadow drawn once into a canvas, laid flat under the radio.
function useShadowTexture() {
  const tex = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 })
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.35, 'rgba(0,0,0,0.75)')
    grad.addColorStop(0.7, 'rgba(0,0,0,0.22)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

function Radio({ bodyColor, accentColor, grilleColor }) {
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  useCursor(hover || held, held ? 'grabbing' : 'grab')
  const { camera, controls } = useThree()
  const shadowTex = useShadowTexture()

  const mats = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
      accent: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }),
      grille: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#d4d7dc', metalness: 1, roughness: 0.18 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.9 }),
      dial: new THREE.MeshStandardMaterial({ color: '#f3efe4', roughness: 0.4, emissive: '#ffcf8a', emissiveIntensity: 0.15 }),
      shadow: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, color: '#000000' }),
    }),
    [shadowTex],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.accent.color.set(accentColor)
    mats.grille.color.set(grilleColor)
  }, [mats, bodyColor, accentColor, grilleColor])

  // grille holes: a grid of small dimples clipped to a circle
  const holes = useMemo(() => {
    const out = []
    for (let i = -4; i <= 4; i++)
      for (let j = -4; j <= 4; j++) {
        const x = i * 0.075
        const y = j * 0.075
        if (Math.hypot(x, y) < 0.3) out.push([x, y])
      }
    return out
  }, [])
  const holeGeo = useMemo(() => new THREE.CircleGeometry(0.022, 10), [])
  const handleGeo = useMemo(() => new THREE.TorusGeometry(0.5, 0.05, 12, 40, Math.PI), [])
  useEffect(
    () => () => {
      holeGeo.dispose()
      handleGeo.dispose()
    },
    [holeGeo, handleGeo],
  )

  const st = useRef({
    x: 0,
    z: 0,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    tx: 0, // target on the floor
    tz: 0,
    rx: 0, // tilt
    rz: 0,
    wx: 0, // tilt speeds
    wz: 0,
  })
  const drag = useRef(null) // { ox, oz } grab offset from the pointer's floor point
  const group = useRef()
  const shadow = useRef()
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const reduced = useMemo(reducedMotion, [])

  useEffect(() => {
    const up = () => {
      if (!drag.current) return
      drag.current = null
      setHeld(false)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  const onDown = (e) => {
    e.stopPropagation()
    const s = st.current
    // grab offset: where the pointer meets the floor, relative to the radio
    if (e.ray.intersectPlane(plane, hit)) drag.current = { ox: s.x - hit.x, oz: s.z - hit.z }
    else drag.current = { ox: 0, oz: 0 }
    setHeld(true)
    if (controls) controls.enabled = false
  }

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const d = drag.current

    if (d) {
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        let tx = hit.x + d.ox
        let tz = hit.z + d.oz
        const r = Math.hypot(tx, tz)
        if (r > BOUNDS) {
          tx *= BOUNDS / r
          tz *= BOUNDS / r
        }
        s.tx = tx
        s.tz = tz
      }
    }
    const ty = d ? LIFT : 0

    if (reduced) {
      s.x = s.tx
      s.z = s.tz
      s.y = ty
      s.vx = s.vz = s.vy = 0
      s.rx = s.rz = 0
    } else if (dt > 1e-5) {
      const N = 4
      const h = dt / N
      const K = 160 // follows the pointer briskly, with a little lag
      const C = 2 * 0.85 * Math.sqrt(K)
      const KY = d ? 140 : 210 // drops faster than it lifts
      const CY = 2 * (d ? 0.9 : 0.42) * Math.sqrt(KY)
      const KR = 120
      const CR = 2 * 0.35 * Math.sqrt(KR) // tilt wobbles a little after a stop
      for (let i = 0; i < N; i++) {
        s.vx += (K * (s.tx - s.x) - C * s.vx) * h
        s.vz += (K * (s.tz - s.z) - C * s.vz) * h
        s.x += s.vx * h
        s.z += s.vz * h
        s.vy += (KY * (ty - s.y) - CY * s.vy) * h
        s.y += s.vy * h
        if (s.y < 0) {
          // landing: a small bounce off the floor
          s.y = 0
          s.vy = -s.vy * 0.3
          if (Math.abs(s.vy) < 0.05) s.vy = 0
        }
        // lean into the motion, the top leading (it's held from above)
        const lean = d ? 0.11 : 0.05
        const trx = THREE.MathUtils.clamp(s.vz * lean, -MAX_TILT, MAX_TILT)
        const trz = THREE.MathUtils.clamp(-s.vx * lean, -MAX_TILT, MAX_TILT)
        s.wx += (KR * (trx - s.rx) - CR * s.wx) * h
        s.wz += (KR * (trz - s.rz) - CR * s.wz) * h
        s.rx += s.wx * h
        s.rz += s.wz * h
        // no corner below the floor: the allowed tilt grows with height
        const lim = Math.min(MAX_TILT, Math.asin(Math.min(1, s.y / HALF_SPAN)))
        const mag = Math.abs(s.rx) + Math.abs(s.rz)
        if (mag > lim) {
          const f = lim / mag
          s.rx *= f
          s.rz *= f
          s.wx *= 0.5
          s.wz *= 0.5
        }
      }
    }

    group.current.position.set(s.x, s.y, s.z)
    group.current.rotation.set(s.rx, 0, s.rz)
    // shadow: under the radio, wider, softer and lighter as it rises
    const k = s.y / LIFT
    shadow.current.position.set(s.x, 0.003, s.z)
    shadow.current.scale.set(BODY.w * (1.25 + k * 0.55), BODY.d * (1.6 + k * 0.9), 1)
    mats.shadow.opacity = 0.62 / (1 + k * 1.4)
  })

  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }
  const cy = FEET + BODY.h / 2 // centre of the case
  const front = BODY.d / 2

  return (
    <>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} material={mats.shadow} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={group} onPointerDown={onDown} {...hoverProps}>
        {/* rubber feet */}
        {[
          [-0.62, -0.14],
          [0.62, -0.14],
          [-0.62, 0.14],
          [0.62, 0.14],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} material={mats.rubber} position={[x, FEET / 2, z]}>
            <cylinderGeometry args={[0.07, 0.08, FEET, 16]} />
          </mesh>
        ))}
        {/* the case */}
        <RoundedBox args={[BODY.w, BODY.h, BODY.d]} radius={0.14} smoothness={5} position-y={cy} material={mats.body} castShadow />
        {/* speaker grille: a recessed fabric disc with a chrome bezel */}
        <group position={[-0.42, cy, front]}>
          <mesh material={mats.grille} rotation-x={Math.PI / 2} position-z={0.004}>
            <cylinderGeometry args={[0.36, 0.36, 0.012, 48]} />
          </mesh>
          <mesh material={mats.chrome} position-z={0.012}>
            <torusGeometry args={[0.37, 0.022, 10, 56]} />
          </mesh>
          {holes.map(([x, y]) => (
            <mesh key={`${x}${y}`} geometry={holeGeo} material={mats.rubber} position={[x, y, 0.0115]} />
          ))}
        </group>
        {/* tuning window and two knobs */}
        <RoundedBox args={[0.62, 0.22, 0.03]} radius={0.01} smoothness={3} position={[0.45, cy + 0.26, front]} material={mats.dial} />
        {[-0.08, -0.28].map((dy, i) => (
          <group key={dy} position={[0.3 + i * 0.3, cy + dy, front]}>
            <mesh material={mats.accent} rotation-x={Math.PI / 2} position-z={0.05}>
              <cylinderGeometry args={[0.1, 0.11, 0.1, 32]} />
            </mesh>
            <mesh material={mats.chrome} rotation-x={Math.PI / 2} position-z={0.102}>
              <cylinderGeometry args={[0.06, 0.06, 0.006, 24]} />
            </mesh>
          </group>
        ))}
        {/* carrying handle on two posts */}
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} material={mats.accent} position={[x, FEET + BODY.h + 0.03, 0]}>
            <cylinderGeometry args={[0.07, 0.085, 0.06, 20]} />
          </mesh>
        ))}
        <mesh geometry={handleGeo} material={mats.accent} position-y={FEET + BODY.h + 0.06} castShadow />
      </group>
    </>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(17))
    const dist = Math.max(5.6 / 2 / tan, 9.6 / 2 / (tan * aspect)) * 1.05 // the whole carry area, radio included
    camera.position.set(Math.sin(0.5) * dist, dist * 0.55, Math.cos(0.5) * dist)
    camera.lookAt(0, 0.4, 0)
  }, [camera, size.width, size.height])
  return null
}

// bodyColor, accentColor, grilleColor: the radio. floorColor: the studio
// floor and backdrop.
export default function DragModel({
  bodyColor = '#e2573f',
  accentColor = '#2b2c30',
  grilleColor = '#3a3936',
  floorColor = '#d9d4cb',
  autoRotate = false,
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [5, 4, 7], fov: 34, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[floorColor]} />
        <fog attach="fog" args={[floorColor, 16, 34]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
        <directionalLight position={[-5, 9, 6]} intensity={0.6} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={floorColor} roughness={0.9} />
        </mesh>
        <Radio bodyColor={bodyColor} accentColor={accentColor} grilleColor={grilleColor} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.4, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={5} maxDistance={24} minPolarAngle={0.25} maxPolarAngle={1.35} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4f4a43' }}>
        Drag the radio to carry it · drag the floor to orbit
      </div>
    </div>
  )
}
