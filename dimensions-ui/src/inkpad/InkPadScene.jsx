import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import InkPad from './InkPad.jsx'

const BG = '#e8e8e6'
const TARGET = [0, 2.2, -1.2]

// Matte plastic and felt want broad, soft light: big panels from above and
// the sides, nothing hard enough to blow out the case's texture.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c4c6c9']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 9, 3]} rotation-x={Math.PI / 2} scale={[14, 9, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[-8, 4, 4]} rotation-y={Math.PI / 3} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#fff3e6" position={[8, 4, 4]} rotation-y={-Math.PI / 3} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#e8eeff" position={[0, 3, -10]} rotation-y={Math.PI} scale={[12, 5, 1]} />
    </Environment>
  )
}

// Frames the pad with its lid open on any screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(13 / 2 / tan, 15 / 2 / (tan * aspect)) * 1.1
    const el = 0.62
    const az = 0.45
    camera.position.set(TARGET[0] + Math.sin(az) * Math.cos(el) * dist, TARGET[1] + Math.sin(el) * dist, TARGET[2] + Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

export default function InkPadScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6, 12, 18], fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d6d7da', 0.35]} />
        <directionalLight position={[-5, 12, 7]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.02}>
          <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10, 0.5, 40]} />
        </directionalLight>
        <Studio />
        <InkPad {...props} />
        <ContactShadows position={[0, -0.002, 0]} opacity={0.55} scale={26} blur={2.2} far={4} resolution={1024} color="#202226" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={8} maxDistance={50} minPolarAngle={0.15} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>Click the case to unlatch and open it · press and drag on the felt to push into it</InfoHint>
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
