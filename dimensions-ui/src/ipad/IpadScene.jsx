import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Ipad, { FLOOR_Y } from './Ipad.jsx'

const BG = '#e8e9ec'

// Brushed aluminium and black glass need long soft panels to reflect.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8f949b']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 8, 2]} rotation-x={Math.PI / 2} scale={[14, 6, 1]} />
      <Lightformer form="rect" intensity={3} color="#fff0dc" position={[-8, 3, 3]} rotation-y={Math.PI / 2.4} scale={[9, 2.5, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#e6efff" position={[8, 2, 2]} rotation-y={-Math.PI / 2.4} scale={[9, 2.5, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 2, 10]} scale={[14, 2.4, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 2, -10]} rotation-y={Math.PI} scale={[14, 3, 1]} />
    </Environment>
  )
}

// Keeps the whole stand in view on any shape of screen (about 4.2 tall, 2.8 wide).
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(4.6 / 2 / tan, 3.6 / 2 / (tan * aspect)) * 1.12
    camera.position.set(Math.sin(0.35) * dist, 0.5, Math.cos(0.35) * dist)
    camera.lookAt(0, -0.1, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function IpadScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3, 1, 14], fov: 30, near: 0.1, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.4]} />
        <directionalLight position={[-3, 6, 6]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Studio />
        <Ipad {...props} />
        <ContactShadows position={[0, FLOOR_Y - 0.002, -0.2]} opacity={0.45} scale={8} blur={2.6} far={2} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, -0.1, 0]} autoRotate={autoRotate} autoRotateSpeed={0.9} minDistance={4} maxDistance={20} minPolarAngle={0.5} maxPolarAngle={1.62} />
      </Canvas>
      <InfoHint>
        Move the pointer and it follows you · click to put it to sleep
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
