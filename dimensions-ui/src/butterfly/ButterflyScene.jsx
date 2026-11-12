import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Butterfly from './Butterfly.jsx'

const BG = '#e4ebe1'
const TARGET = [0, 3.1, 0]

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#cfd9cc']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-10, 8, 8]} rotation-y={Math.PI / 3} scale={[6, 12, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#fff3e0" position={[10, 6, 6]} rotation-y={-Math.PI / 3} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[20, 10, 1]} />
    </Environment>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    // fit the flower and the loop the butterfly flies round it
    const dist = Math.max(5.4 / 2 / tan, 8.5 / 2 / (tan * aspect)) * 1.05
    camera.position.set(Math.sin(0.5) * dist, TARGET[1] + dist * 0.32, Math.cos(0.5) * dist)
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

export default function ButterflyScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6, 8, 14], fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#9aa88f', 0.5]} />
        <directionalLight position={[-5, 12, 7]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
        <Studio />
        <Butterfly {...props} />
        <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={16} blur={2.6} far={6} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={5} maxDistance={40} minPolarAngle={0.2} maxPolarAngle={1.75} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4c5a48' }}>
        Click the butterfly to take off · move the pointer to lead it · click the flower to call it back
      </div>
    </div>
  )
}
