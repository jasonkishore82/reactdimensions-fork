import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Stamp from './Stamp.jsx'

const BG = '#e7e5e1'
const TARGET = [0, 1.6, 0.4]

// Varnished wood wants long soft highlights to show its clear coat; a warm
// key from the left and a cool fill keep the grain readable.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c3c4c6']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 10, 3]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#fff0dc" position={[-8, 4, 5]} rotation-y={Math.PI / 3} scale={[3, 9, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#eef3ff" position={[8, 4, 4]} rotation-y={-Math.PI / 3} scale={[3, 9, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 3, -10]} rotation-y={Math.PI} scale={[12, 5, 1]} />
    </Environment>
  )
}

// Frames the sheet and the stamp standing on it, on any screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(14 / 2 / tan, 24 / 2 / (tan * aspect)) * 1.05
    const el = 0.68
    const az = 0.3
    camera.position.set(TARGET[0] + Math.sin(az) * Math.cos(el) * dist, TARGET[1] + Math.sin(el) * dist, TARGET[2] + Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

export default function StampScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6, 14, 18], fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d8d6d2', 0.35]} />
        <directionalLight position={[-6, 13, 7]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.02}>
          <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.5, 45]} />
        </directionalLight>
        <Studio />
        <Stamp {...props} />
        <ContactShadows position={[0, -0.002, 0]} opacity={0.45} scale={34} blur={2.4} far={6} resolution={1024} color="#25221e" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={8} maxDistance={60} minPolarAngle={0.12} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>Click the stamp to print · drag it to move it across the paper · lower the ink level to see it run dry</InfoHint>
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
