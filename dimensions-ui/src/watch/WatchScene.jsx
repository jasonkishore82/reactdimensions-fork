import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Watch from './Watch.jsx'

const BG = '#e8e9ec'

// Polished metal needs strong, clean light panels to reflect.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8d9299']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 8, 3]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#fff1dc" position={[-7, 2, 4]} rotation-y={Math.PI / 2.4} scale={[8, 2, 1]} />
      <Lightformer form="rect" intensity={3.2} color="#e3eeff" position={[7, 1, 4]} rotation-y={-Math.PI / 2.4} scale={[8, 2, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 0.5, 9]} scale={[12, 2.2, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#e8f0ff" position={[0, 1, -9]} rotation-y={Math.PI} scale={[12, 3, 1]} />
    </Environment>
  )
}

// Keeps the watch and its strap in view, whatever the shape of the screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(3.05 / tan, (3.2 / (tan * Math.min(aspect, 2))) * 1.0) * 1.12
    const az = 0.45
    camera.position.set(Math.sin(az) * dist, dist * 0.1, Math.cos(az) * dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function WatchScene({ autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [4, 1, 11], fov: 30, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.4]} />
        <directionalLight
          position={[-3, 6, 6]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        <Studio />
        <Watch {...props} />
        <ContactShadows position={[0, -2.7, 0]} opacity={0.4} scale={14} blur={2.8} far={4} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls
          makeDefault
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
          minDistance={4}
          maxDistance={22}
          minPolarAngle={0.5}
          maxPolarAngle={2.0}
        />
      </Canvas>
      <InfoHint>
        Click the watch to swap it · click the strap to change it
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
