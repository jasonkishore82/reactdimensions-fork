import { useEffect } from 'react'
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
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#5f5a52' }}>
        Drag the hands to set the time · the gold hand sets the alarm · click the bells to ring
      </div>
    </div>
  )
}
