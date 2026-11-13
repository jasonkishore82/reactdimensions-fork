import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Lorry from './Lorry.jsx'

const BG = '#dfe3e6'

// An overcast yard: a big soft sky panel and two long side lights for the
// paint and chrome to pick up.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9bfc6']} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[0, 30, 0]} rotation-x={Math.PI / 2} scale={[60, 40, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#fff3e2" position={[-30, 8, 14]} rotation-y={Math.PI / 3} scale={[30, 6, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#e6eeff" position={[30, 8, 14]} rotation-y={-Math.PI / 3} scale={[30, 6, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 6, -30]} rotation-y={Math.PI} scale={[40, 8, 1]} />
    </Environment>
  )
}

// Frames the whole rig (about 12.5 m long and 4.4 m tall) from the front corner.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(7.5 / 2 / tan, 14.5 / 2 / (tan * aspect)) * 1.12
    const az = 0.95
    camera.position.set(-5.5 + Math.cos(az) * dist, 2.4 + dist * 0.24, Math.sin(az) * dist)
    camera.lookAt(-5.5, 1.9, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function LorryScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [10, 6, 18], fov: 30, near: 0.1, far: 300 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 45, 110]} />
        <hemisphereLight args={['#ffffff', '#b5b3ad', 0.45]} />
        <directionalLight
          position={[8, 16, 10]}
          intensity={1.3}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-camera-left={-16}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <Studio />
        <Lorry {...props} />
        <ContactShadows position={[-5.5, 0.004, 0]} opacity={0.5} scale={[18, 6]} blur={2} far={2} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[-5.5, 1.9, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={8} maxDistance={60} minPolarAngle={0.2} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>
        Click the cab for the lights · click the trailer for the doors
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
