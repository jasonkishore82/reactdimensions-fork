import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Pen from './Pen.jsx'

const BG = '#e6e4df'

// Black resin and gold want long soft highlights down the barrel, so the
// panels are tall strips either side and a wide softbox overhead.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#a9acb1']} />
      <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[0, 10, 2]} rotation-x={Math.PI / 2} scale={[22, 5, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#fff3e2" position={[-9, 5, 6]} rotation-y={Math.PI / 3} scale={[3, 12, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[9, 5, 6]} rotation-y={-Math.PI / 3} scale={[3, 12, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#e3ebff" position={[0, 3, -10]} rotation-y={Math.PI} scale={[16, 4, 1]} />
    </Environment>
  )
}

// Frame the sheet of paper from above and in front; on narrow screens back
// off so the whole sheet still fits across.
function Rig() {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const aspect = size.width / size.height
    const d = Math.min(70, Math.max(10.5 / tan, 15.5 / (tan * aspect)))
    const el = THREE.MathUtils.degToRad(54)
    camera.position.set(0, d * Math.sin(el), d * Math.cos(el))
    camera.lookAt(0, 0, 0.6)
    if (controls) {
      controls.target.set(0, 0, 0.6)
      controls.update()
    }
  }, [camera, size.width, size.height, controls])
  return null
}

export default function PenScene({ autoRotate = false, ...props }) {
  const hud = useRef()
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 28, 20], fov: 30, near: 0.5, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#cfc9be', 0.45]} />
        <directionalLight
          position={[-6, 18, 9]}
          intensity={1.15}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.02}
          shadow-camera-left={-17}
          shadow-camera-right={17}
          shadow-camera-top={13}
          shadow-camera-bottom={-13}
          shadow-camera-far={60}
        />
        <Studio />
        {/* the desk under the paper */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#d8d4cc" roughness={0.85} />
        </mesh>
        <Pen {...props} hudRef={hud} />
        <ContactShadows position={[0, 0.006, 0]} opacity={0.45} scale={34} blur={2.2} far={6} resolution={512} color="#1d1c1a" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={8} maxDistance={80} minPolarAngle={0.1} maxPolarAngle={1.35} />
      </Canvas>
      <div ref={hud} style={{ position: 'absolute', left: 14, top: 12, pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', color: '#4c5057', whiteSpace: 'pre' }} />
      <InfoHint>
        Drag the pen to lift and throw it · click the cap · drag across the end knob to fill
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
