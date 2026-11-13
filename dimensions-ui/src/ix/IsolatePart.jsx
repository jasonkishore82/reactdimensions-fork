import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A stylised camera, slightly exploded into its parts. Tap a part to isolate
// it: everything else fades to a faint grey ghost, the camera eases round to
// frame the part, and a label names it. Tap another part to move on; tap empty
// space or press Escape to put everything back.
//
// Every part owns its materials, and fades them itself (opacity and saturation
// together) towards "dimmed" or "lit", so switching between parts crossfades.

// Parts, laid out with gaps between them (checked: no two boxes overlap, and
// the lowest point, the grip's underside, is at y = 0.9).
//   body    x -1.2..1.2   y 0.85..2.35  z -0.45..0.45
//   lens    x -0.35..0.65 y 1.05..2.05  z 0.62..1.41
//   grip    x -1.9..-1.4  y 0.9..2.2    z -0.45..0.55
//   shutter x -1.02..-0.58 y 2.54..2.69
//   dial    x 0.67..1.17  y 2.6..2.75
//   finder  x -0.2..0.6   y 2.55..3.0   z -0.52..0.3
//   screen  x -0.65..0.95 y 1.1..2.1    z -0.74..-0.65
const PARTS = [
  { id: 'body', name: 'Body', note: 'Magnesium shell, weather sealed', center: [0, 1.6, 0], radius: 1.45 },
  { id: 'lens', name: 'Lens', note: '35 mm f/1.8 prime', center: [0.15, 1.55, 1.03], radius: 0.72 },
  { id: 'grip', name: 'Grip', note: 'Textured rubber over the battery', center: [-1.65, 1.55, 0.05], radius: 0.8 },
  { id: 'shutter', name: 'Shutter button', note: 'Two-stage: focus, then fire', center: [-0.8, 2.62, 0.1], radius: 0.38 },
  { id: 'dial', name: 'Mode dial', note: 'P · A · S · M', center: [0.92, 2.67, 0], radius: 0.42 },
  { id: 'finder', name: 'Viewfinder', note: 'OLED, 0.7× magnification', center: [0.2, 2.775, -0.1], radius: 0.6 },
  { id: 'screen', name: 'Rear screen', note: '3-inch touch display', center: [0.15, 1.6, -0.69], radius: 0.95 },
]
const OVERVIEW = { target: new THREE.Vector3(-0.1, 1.85, 0.1), size: 3.6 }
const FOV = 32

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8a8580']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 7, 6]} rotation-y={Math.PI / 3} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eaf0ff" position={[8, 5, 5]} rotation-y={-Math.PI / 3} scale={[6, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
      <Lightformer form="ring" intensity={0.9} color="#fff4e6" position={[0, 3, -9]} scale={4} />
    </Environment>
  )
}

// A part's own materials, faded towards grey and transparent by `dim` (0..1).
function usePartMaterials(spec) {
  const mats = useMemo(() => {
    const out = {}
    for (const [k, make] of Object.entries(spec)) out[k] = make()
    for (const m of Object.values(out)) {
      m.userData.base = m.color.clone()
      m.userData.opacity = m.opacity
    }
    return out
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  return mats
}

const _grey = new THREE.Color()
function applyDim(mats, f) {
  for (const m of Object.values(mats)) {
    const base = m.userData.base
    const l = base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722
    _grey.setRGB(l * 0.9 + 0.08, l * 0.9 + 0.08, l * 0.9 + 0.08)
    m.color.copy(base).lerp(_grey, f * 0.9)
    const o = m.userData.opacity * (1 - f * 0.86)
    const transparent = o < 0.999 || m.userData.opacity < 1
    if (m.transparent !== transparent) {
      m.transparent = transparent
      m.needsUpdate = true
    }
    m.opacity = o
    m.depthWrite = f < 0.5
  }
}

// Wraps a part: click to select, and fades its materials.
function Part({ id, selected, onSelect, mats, children, reduced }) {
  const f = useRef(-1) // -1: not applied yet
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const want = selected && selected !== id ? 1 : 0
    const cur = Math.max(f.current, 0)
    let next = reduced ? want : cur + (want - cur) * (1 - Math.exp(-dt * 9))
    if (Math.abs(want - next) < 1e-3) next = want
    if (next !== f.current) {
      f.current = next
      applyDim(mats, next)
    }
  })
  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 6) return // that was an orbit drag
        onSelect(id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {children}
    </group>
  )
}

const std = (o) => () => new THREE.MeshStandardMaterial(o)
const phys = (o) => () => new THREE.MeshPhysicalMaterial(o)

function CameraModel({ bodyColor, accentColor, selected, onSelect, reduced }) {
  // one material set per part, so each fades on its own
  const m = {
    body: usePartMaterials({ shell: phys({ roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.3 }), trim: std({ color: '#c9ccd1', metalness: 1, roughness: 0.25 }) }),
    lens: usePartMaterials({ barrel: std({ roughness: 0.55 }), ring: std({ color: '#c9ccd1', metalness: 1, roughness: 0.25 }), glass: phys({ color: '#16243a', roughness: 0.05, metalness: 0.2, clearcoat: 1 }), mark: std({ color: '#d84a2b', roughness: 0.5 }) }),
    grip: usePartMaterials({ rubber: std({ roughness: 0.85 }) }),
    shutter: usePartMaterials({ button: std({ color: '#c9ccd1', metalness: 1, roughness: 0.22 }), collar: std({ roughness: 0.55 }) }),
    dial: usePartMaterials({ dial: std({ color: '#c9ccd1', metalness: 1, roughness: 0.3 }), mark: std({ color: '#d84a2b', roughness: 0.5 }) }),
    finder: usePartMaterials({ shell: phys({ roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.3 }), eye: std({ roughness: 0.8 }) }),
    screen: usePartMaterials({ frame: std({ roughness: 0.55 }), glass: std({ color: '#0e1622', roughness: 0.15, emissive: '#2a4d7a', emissiveIntensity: 0.35 }) }),
  }
  useEffect(() => {
    for (const mm of [m.body.shell, m.finder.shell]) {
      mm.color.set(bodyColor)
      mm.userData.base.set(bodyColor)
    }
    for (const mm of [m.lens.barrel, m.grip.rubber, m.shutter.collar, m.finder.eye, m.screen.frame]) {
      mm.color.set(accentColor)
      mm.userData.base.set(accentColor)
    }
  }, [bodyColor, accentColor]) // eslint-disable-line react-hooks/exhaustive-deps

  const P = (id) => ({ id, selected, onSelect, mats: m[id], reduced })
  return (
    <group>
      <Part {...P('body')}>
        <RoundedBox args={[2.4, 1.5, 0.9]} radius={0.14} smoothness={5} position={[0, 1.6, 0]} material={m.body.shell} />
        {/* a chrome band along the top edge of the front */}
        <mesh material={m.body.trim} position={[0, 2.18, 0.452]}>
          <boxGeometry args={[2.0, 0.035, 0.012]} />
        </mesh>
      </Part>

      <Part {...P('lens')}>
        <group position={[0.15, 1.55, 0]}>
          <mesh material={m.lens.ring} rotation-x={Math.PI / 2} position-z={0.66}>
            <cylinderGeometry args={[0.44, 0.44, 0.08, 48]} />
          </mesh>
          <mesh material={m.lens.barrel} rotation-x={Math.PI / 2} position-z={1.035}>
            <cylinderGeometry args={[0.5, 0.48, 0.67, 48]} />
          </mesh>
          {/* focus ring grooves */}
          {[0.92, 0.98, 1.04, 1.1].map((z) => (
            <mesh key={z} material={m.lens.barrel} position-z={z}>
              <torusGeometry args={[0.497, 0.012, 6, 48]} />
            </mesh>
          ))}
          <mesh material={m.lens.mark} position-z={0.78}>
            <torusGeometry args={[0.49, 0.01, 6, 48]} />
          </mesh>
          <mesh material={m.lens.ring} position-z={1.37}>
            <torusGeometry args={[0.43, 0.035, 10, 48]} />
          </mesh>
          <mesh material={m.lens.glass} rotation-x={Math.PI / 2} position-z={1.36}>
            <cylinderGeometry args={[0.4, 0.4, 0.02, 48]} />
          </mesh>
        </group>
      </Part>

      <Part {...P('grip')}>
        <RoundedBox args={[0.5, 1.3, 1.0]} radius={0.2} smoothness={5} position={[-1.65, 1.55, 0.05]} material={m.grip.rubber} />
      </Part>

      <Part {...P('shutter')}>
        <mesh material={m.shutter.collar} position={[-0.8, 2.56, 0.1]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 32]} />
        </mesh>
        <mesh material={m.shutter.button} position={[-0.8, 2.635, 0.1]}>
          <cylinderGeometry args={[0.15, 0.16, 0.11, 32]} />
        </mesh>
      </Part>

      <Part {...P('dial')}>
        <mesh material={m.dial.dial} position={[0.92, 2.67, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.14, 40]} />
        </mesh>
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * Math.PI * 2
          return (
            <mesh key={i} material={m.dial.dial} position={[0.92 + Math.cos(a) * 0.25, 2.67, Math.sin(a) * 0.25]} rotation-y={-a}>
              <boxGeometry args={[0.04, 0.12, 0.02]} />
            </mesh>
          )
        })}
        <mesh material={m.dial.mark} position={[0.92, 2.742, 0.15]}>
          <boxGeometry args={[0.04, 0.004, 0.14]} />
        </mesh>
      </Part>

      <Part {...P('finder')}>
        <RoundedBox args={[0.8, 0.45, 0.7]} radius={0.1} smoothness={4} position={[0.2, 2.775, -0.05]} material={m.finder.shell} />
        <mesh material={m.finder.eye} rotation-x={Math.PI / 2} position={[0.2, 2.775, -0.46]}>
          <cylinderGeometry args={[0.16, 0.16, 0.12, 32]} />
        </mesh>
      </Part>

      <Part {...P('screen')}>
        <RoundedBox args={[1.6, 1.0, 0.08]} radius={0.035} smoothness={3} position={[0.15, 1.6, -0.69]} material={m.screen.frame} />
        <mesh material={m.screen.glass} position={[0.15, 1.6, -0.7305]} rotation-y={Math.PI}>
          <planeGeometry args={[1.44, 0.86]} />
        </mesh>
      </Part>
    </group>
  )
}

// Eases the orbit target and camera to frame a sphere (centre, radius), keeping
// the current viewing direction; cancelled if the user starts orbiting.
function useFraming(reduced) {
  const { camera, controls, size } = useThree()
  const tw = useRef(null)
  const v = useMemo(() => ({ d0: new THREE.Vector3(), q: new THREE.Quaternion(), qi: new THREE.Quaternion(), dir: new THREE.Vector3() }), [])
  useEffect(() => {
    if (!controls) return
    const stop = () => (tw.current = null)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])
  const fitDist = (radius) => {
    const aspect = size.width / size.height
    const half = THREE.MathUtils.degToRad(FOV / 2)
    const fit = Math.min(Math.tan(half), Math.tan(half) * aspect)
    return (radius / fit) * 1.15
  }
  const go = (center, radius) => {
    if (!controls) return
    const t0 = controls.target.clone()
    const off = camera.position.clone().sub(t0)
    tw.current = { t0, t1: center.clone(), d0: off.length(), d1: fitDist(radius), dir0: off.normalize(), dir1: off.clone(), k: reduced ? 1 : 0 }
  }
  useFrame((_, delta) => {
    const t = tw.current
    if (!t || !controls) return
    t.k = Math.min(1, t.k + Math.min(delta, 1 / 30) / 0.85)
    const e = easeInOut(t.k)
    controls.target.lerpVectors(t.t0, t.t1, e)
    v.q.setFromUnitVectors(t.dir0, t.dir1)
    v.qi.identity().slerp(v.q, e)
    v.dir.copy(t.dir0).applyQuaternion(v.qi)
    camera.position.copy(controls.target).addScaledVector(v.dir, THREE.MathUtils.lerp(t.d0, t.d1, e))
    controls.update()
    if (t.k >= 1) tw.current = null
  })
  return { go, fitDist }
}

function Scene({ bodyColor, accentColor, labelColor, autoRotate, missRef }) {
  const [selected, setSelected] = useState(null)
  const reduced = useMemo(reducedMotion, [])
  const { camera, controls } = useThree()
  const { go, fitDist } = useFraming(reduced)

  // place the camera for the overview once
  const placed = useRef(false)
  useEffect(() => {
    if (placed.current || !controls) return
    placed.current = true
    const d = fitDist(OVERVIEW.size / 2)
    camera.position.copy(OVERVIEW.target).add(new THREE.Vector3(Math.sin(0.6) * 0.9, 0.38, Math.cos(0.6) * 0.9).normalize().multiplyScalar(d))
    controls.target.copy(OVERVIEW.target)
    controls.update()
  }, [controls]) // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => {
    setSelected(id)
    if (id) {
      const p = PARTS.find((x) => x.id === id)
      go(new THREE.Vector3(...p.center), p.radius)
    } else go(OVERVIEW.target, OVERVIEW.size / 2)
  }
  const selRef = useRef(select)
  selRef.current = select

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') selRef.current(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => () => (document.body.style.cursor = ''), [])

  // tapping empty space restores (the Canvas reports it as a missed click)
  missRef.current = () => selRef.current(null)

  const part = PARTS.find((p) => p.id === selected)
  return (
    <>
      <CameraModel bodyColor={bodyColor} accentColor={accentColor} selected={selected} onSelect={select} reduced={reduced} />
      {part && (
        <Html position={[part.center[0], part.center[1] + part.radius * 0.75 + 0.15, part.center[2]]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ whiteSpace: 'nowrap', textAlign: 'center', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 18px rgba(40,30,20,0.18)', font: '500 11px/1.35 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', color: '#2b2824' }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 7, background: labelColor, marginRight: 7, verticalAlign: 'middle' }} />
            <b style={{ fontWeight: 600 }}>{part.name}</b>
            <span style={{ opacity: 0.6 }}> · {part.note}</span>
          </div>
        </Html>
      )}
      <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate && !selected} autoRotateSpeed={0.6} minDistance={1.5} maxDistance={24} minPolarAngle={0.2} maxPolarAngle={1.5} />
    </>
  )
}

// bodyColor: the camera's shell. accentColor: the rubber and lens barrel.
// labelColor: the dot on the part label. floorColor: the studio.
export default function IsolatePart({ bodyColor = '#e9e4da', accentColor = '#26272b', labelColor = '#d84a2b', floorColor = '#d9d4cb', autoRotate = false }) {
  const missRef = useRef(null)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [5, 4, 8], fov: FOV, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }} onPointerMissed={() => missRef.current?.()}>
        <color attach="background" args={[floorColor]} />
        <fog attach="fog" args={[floorColor, 16, 36]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
        <directionalLight position={[-5, 9, 6]} intensity={0.6} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={floorColor} roughness={0.9} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={10} resolution={512} blur={2.6} opacity={0.42} far={3.2} />
        <Scene bodyColor={bodyColor} accentColor={accentColor} labelColor={labelColor} autoRotate={autoRotate} missRef={missRef} />
      </Canvas>
      <InfoHint>
        Tap a part to isolate it · tap empty space or press Esc to restore
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
