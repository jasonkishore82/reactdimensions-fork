import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Clock from './Clock.jsx'

const BG = '#ece8e1'

// Lacquer and chrome: tall soft panels for long highlights on the case and
// bells, and a warm bounce from the front.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9bdc3']} />
      <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[-14, 10, 10]} rotation-y={Math.PI / 3} scale={[6, 20, 1]} />
      <Lightformer form="rect" intensity={2.8} color="#fff1df" position={[14, 10, 10]} rotation-y={-Math.PI / 3} scale={[6, 20, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 26, 4]} rotation-x={Math.PI / 2} scale={[24, 14, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#e6eeff" position={[0, 8, -20]} rotation-y={Math.PI} scale={[24, 10, 1]} />
    </Environment>
  )
}

// Frames the whole clock, feet to handle (about 17 tall and 13 wide).
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(23 / 2 / tan, 18 / 2 / (tan * aspect)) * 1.15
    camera.position.set(Math.sin(0.4) * dist, 9.8 + dist * 0.12, Math.cos(0.4) * dist)
    camera.lookAt(0, 9.8, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function ClockScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [10, 10, 40], fov: 30, near: 0.5, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d8d2c8', 0.35]} />
        <directionalLight position={[-10, 22, 14]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={20} shadow-camera-bottom={-4} />
        <Studio />
        <Clock {...props} />
        <ContactShadows position={[0, 0.005, 0]} opacity={0.5} scale={30} blur={2.4} far={4} resolution={512} color="#2a2520" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 9.8, 0]} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={14} maxDistance={90} minPolarAngle={0.3} maxPolarAngle={1.6} />
      </Canvas>
      <InfoHint>
        Drag the hands to set the time · the gold hand sets the alarm · click the bells to ring
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
