import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Tape, { tapeView } from './Tape.jsx'

const BG = '#e9e7e2'
const LEFT = -5 // the back of the case, with a little room
const TOP = 17.5 // above the lock button

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9bdc3']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[-20, 20, 18]} rotation-y={Math.PI / 4} scale={[10, 30, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#fff1df" position={[30, 18, 18]} rotation-y={-Math.PI / 4} scale={[10, 30, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[10, 40, 4]} rotation-x={Math.PI / 2} scale={[60, 20, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#e6eeff" position={[10, 10, -30]} rotation-y={Math.PI} scale={[60, 16, 1]} />
    </Environment>
  )
}

// Keeps the case and the whole blade in view: it eases out as the blade is
// drawn and back as it reels in, keeping the visitor's angle and zoom.
function Rig() {
  const { camera, size, controls } = useThree()
  const tan = Math.tan(THREE.MathUtils.degToRad(15))
  const fit = useRef(null)
  const wanted = () => {
    const aspect = size.width / size.height
    const w = tapeView.maxX - LEFT + 3
    const h = TOP - Math.min(tapeView.minY, 7) + 2
    return { d: Math.max(h / 2 / tan, w / 2 / (tan * aspect)) * 1.12, cx: (LEFT + tapeView.maxX) / 2, cy: (TOP + Math.min(tapeView.minY, 7)) / 2 }
  }
  useEffect(() => {
    const w = wanted()
    fit.current = { ...w }
    camera.position.set(w.cx + Math.sin(0.35) * w.d, w.cy + w.d * 0.2, Math.cos(0.35) * w.d)
    camera.lookAt(w.cx, w.cy, 0)
    if (controls) controls.target.set(w.cx, w.cy, 0)
  }, [camera, size.width, size.height, controls])
  useFrame((_, delta) => {
    if (!controls || !fit.current) return
    const e = 1 - Math.exp(-Math.min(delta, 0.05) * 2.5)
    const w = wanted()
    const f = fit.current
    const nd = f.d + (w.d - f.d) * e
    const ratio = nd / f.d
    f.d = nd
    const dx = (w.cx - f.cx) * e
    const dy = (w.cy - f.cy) * e
    f.cx += dx
    f.cy += dy
    const t = controls.target
    camera.position.sub(t).multiplyScalar(ratio).add(t)
    t.x += dx
    t.y += dy
    camera.position.x += dx
    camera.position.y += dy
  })
  return null
}

export default function TapeScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [20, 14, 60], fov: 30, near: 0.5, far: 400 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d6d2ca', 0.35]} />
        <directionalLight position={[-12, 40, 20]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-20} shadow-camera-right={60} shadow-camera-top={30} shadow-camera-bottom={-20} />
        <Studio />
        <Tape {...props} />
        <mesh rotation-x={-Math.PI / 2} position={[20, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 120]} />
          <shadowMaterial transparent opacity={0.18} />
        </mesh>
        <ContactShadows position={[20, 0.003, 0]} opacity={0.4} scale={[90, 30]} blur={2.4} far={14} resolution={512} color="#2a2520" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={14} maxDistance={160} minPolarAngle={0.3} maxPolarAngle={1.6} />
      </Canvas>
      <InfoHint>
        Drag the hook to pull the blade out · click the lock on top to hold it or let it reel in
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
