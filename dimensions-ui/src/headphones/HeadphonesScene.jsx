import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Headphones, { LOWEST } from './Headphones.jsx'

// The headset floats and bobs above the floor; the floor sits just under the
// cups at their lowest (fully extended, bottom of the bob).
const FLOOR_Y = -6 + LOWEST - 0.12 - 0.3

const BG = '#e6e8ec'

// Soft leather needs broad soft light with a few long highlights.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8f949b']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 40, 12]} rotation-x={Math.PI / 2} scale={[60, 40, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#fff1dc" position={[-40, 8, 16]} rotation-y={Math.PI / 2.3} scale={[14, 40, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#e3eeff" position={[40, 8, 16]} rotation-y={-Math.PI / 2.3} scale={[14, 40, 1]} />
      <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 4, 46]} scale={[50, 30, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 6, -46]} rotation-y={Math.PI} scale={[50, 30, 1]} />
    </Environment>
  )
}

// Frames the whole headset on any shape of screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max((30 * 1.16) / 2 / tan, (33 / 2) / (tan * aspect)) * 1.16
    const az = 0.62
    camera.position.set(Math.sin(az) * dist, 3, Math.cos(az) * dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function HeadphonesScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [30, 4, 50], fov: 30, near: 1, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.45]} />
        <directionalLight position={[-14, 30, 24]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={26} shadow-camera-bottom={-26} shadow-camera-near={5} shadow-camera-far={120} />
        <Studio />
        <Headphones {...props} />
        <ContactShadows position={[0, FLOOR_Y, 0]} opacity={0.42} scale={50} blur={2.8} far={22} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.2} minDistance={22} maxDistance={110} minPolarAngle={0.4} maxPolarAngle={2.0} />
      </Canvas>
      <InfoHint>
        Click to fold flat · drag to orbit
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
