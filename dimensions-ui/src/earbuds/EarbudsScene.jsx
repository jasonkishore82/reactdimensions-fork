import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Earbuds from './Earbuds.jsx'

const TARGET = [0, 2.6, 0]

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#bdbdbd']} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[-8, 8, 8]} rotation-y={Math.PI / 4} scale={[8, 10, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[8, 6, 6]} rotation-y={-Math.PI / 4} scale={[6, 8, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, 4, -10]} rotation-y={Math.PI} scale={[12, 6, 1]} />
    </Environment>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    // the case with its lid open, and room on the floor for a dropped bud
    const dist = Math.max(8 / 2 / tan, 12 / 2 / (tan * aspect)) * 1.02
    camera.position.set(Math.sin(0.45) * dist, TARGET[1] + dist * 0.42, Math.cos(0.45) * dist)
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

function Battery({ label, value, docked = true }) {
  return (
    <div style={{ display: 'grid', gap: 5, justifyItems: 'center', opacity: docked ? 1 : 0.45 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: `conic-gradient(${value > 20 ? '#2bd96b' : '#ff5a36'} ${value * 3.6}deg, rgba(0,0,0,.08) 0)`, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', font: '600 9px/1 ui-monospace, Menlo, monospace', color: '#1c1a16' }}>{label}</div>
      </div>
      <span style={{ font: '500 11px/1 ui-monospace, Menlo, monospace', color: '#1c1a16', fontVariantNumeric: 'tabular-nums' }}>{docked ? `${value}%` : 'out'}</span>
    </div>
  )
}

export default function EarbudsScene({ autoRotate = false, background = '#cfcfcf', ...props }) {
  const [status, setStatus] = useState(null)
  const show = status && status.lid > 0.55
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6, 10, 18], fov: 30, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#b0b0b0', 0.45]} />
        <directionalLight position={[-5, 12, 8]} intensity={1.0} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-6} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
        <Earbuds {...props} onStatus={setStatus} />
        <ContactShadows position={[0, 0.003, 0]} opacity={0.35} scale={16} blur={2.4} far={3} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={8} maxDistance={50} minPolarAngle={0.15} maxPolarAngle={1.5} />
      </Canvas>

      {/* the battery panel, shown while the lid is open */}
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: `translate(-50%, ${show ? 0 : -12}px)`,
          opacity: show ? 1 : 0,
          transition: 'opacity 260ms, transform 260ms',
          pointerEvents: 'none',
          display: 'flex',
          gap: 18,
          padding: '12px 18px',
          borderRadius: 18,
          background: 'rgba(255,255,255,.85)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
        }}
      >
        {status && (
          <>
            <Battery label="L" value={status.left} docked={status.leftIn} />
            <Battery label="R" value={status.right} docked={status.rightIn} />
            <Battery label="◫" value={status.case} />
          </>
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4c4b48' }}>
        Click or drag the lid · lift a bud out and drop it · put it back near its well
      </div>
    </div>
  )
}
