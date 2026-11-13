import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Typewriter from './Typewriter.jsx'

const BG = '#e9e4da'

// Lacquer and chrome both need something to reflect: warm soft panels.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9b2a6']} />
      <Lightformer form="rect" intensity={3.2} color="#fff6ea" position={[-7, 6, 5]} rotation-y={Math.PI / 3} scale={[4, 9, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[7, 6, 4]} rotation-y={-Math.PI / 3} scale={[4, 9, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 11, 1]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
      <Lightformer form="rect" intensity={1} color="#e8eeff" position={[0, 4, -10]} rotation-y={Math.PI} scale={[12, 6, 1]} />
    </Environment>
  )
}

// Frames the machine and its paper from the typist's seat, on any screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(17.5))
    const a = 0.5
    const dist = Math.max(15 / 2 / (tan * aspect), 10 / 2 / tan) * 1.3
    camera.position.set(0, 2.6 + Math.sin(a) * dist, 0.6 + Math.cos(a) * dist)
    camera.lookAt(0, 2.6, 0.6)
  }, [camera, size.width, size.height])
  return null
}

const srOnly = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }

export default function TypewriterScene({ autoRotate = false, ...props }) {
  const [sheet, setSheet] = useState(0)
  const [line, setLine] = useState('')
  return (
    <div data-typewriter="" role="group" aria-label="3D typewriter. Type on your keyboard; Enter returns the carriage." style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 12, 18], fov: 35, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#cfc6b8', 0.35]} />
        <directionalLight position={[-6, 13, 8]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-8} />
        <Studio />
        <Typewriter sheet={sheet} onLine={setLine} {...props} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.55} scale={24} blur={2.4} far={3} resolution={512} color="#3a2e22" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 2.6, 0.6]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={8} maxDistance={50} minPolarAngle={0.2} maxPolarAngle={1.5} />
      </Canvas>
      <div style={srOnly} aria-live="polite">{line}</div>
      <button
        onClick={() => setSheet((s) => s + 1)}
        style={{ position: 'absolute', right: 12, top: 12, padding: '7px 12px', borderRadius: 999, border: '1px solid rgba(0,0,0,.18)', background: 'rgba(255,255,255,.75)', color: '#2a2622', font: '500 12px/1 ui-sans-serif, system-ui, sans-serif', cursor: 'pointer' }}
      >
        New sheet
      </button>
      <InfoHint>
        Type on your keyboard · Enter returns the carriage
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
