import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Phone, { PHONE_H } from './Phone.jsx'

const BG = '#e8e9ec'

// Metal and glass reflect what is around them. A darker studio with bright,
// separate softboxes gives the frame and lenses real highlights and shadows,
// instead of an even grey that makes every surface look flat.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#3a3d44']} />
      <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 260, 60]} rotation-x={Math.PI / 2} scale={[260, 140, 1]} />
      <Lightformer form="rect" intensity={7} color="#fff3e2" position={[-230, 40, 90]} rotation-y={Math.PI / 2.4} scale={[30, 320, 1]} />
      <Lightformer form="rect" intensity={6} color="#eaf1ff" position={[230, 40, 90]} rotation-y={-Math.PI / 2.4} scale={[30, 320, 1]} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[-60, 30, 260]} scale={[120, 160, 1]} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[60, 30, -260]} rotation-y={Math.PI} scale={[120, 160, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#dfe6f2" position={[0, -220, 0]} rotation-x={-Math.PI / 2} scale={[300, 300, 1]} />
    </Environment>
  )
}

// Fits the whole phone in view on any shape of screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max((PHONE_H * 1.12) / 2 / tan, (95 / 2) / (tan * aspect)) * 1.04
    camera.position.set(Math.sin(0.4) * dist, 18, Math.cos(0.4) * dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function PhoneScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [120, 20, 380], fov: 30, near: 1, far: 2000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.4]} />
        <directionalLight position={[-120, 220, 200]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={140} shadow-camera-bottom={-140} shadow-camera-near={50} shadow-camera-far={700} />
        <Studio />
        <Phone {...props} />
        <ContactShadows position={[0, -84, 0]} opacity={0.4} scale={300} blur={2.8} far={90} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.0} minDistance={120} maxDistance={700} minPolarAngle={0.5} maxPolarAngle={2.2} />
      </Canvas>
      <InfoHint>
        Click the phone to flip it · drag to orbit
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
