import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Lighter from './Lighter.jsx'

const BG = '#e9e7e3'

// Brushed and polished metal are all reflection: tall soft panels give the
// case its long highlights, and a darker surround keeps its edges defined.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9bdc3']} />
      <Lightformer form="rect" intensity={3.4} color="#ffffff" position={[-6, 4, 4]} rotation-y={Math.PI / 3} scale={[2.4, 9, 1]} />
      <Lightformer form="rect" intensity={3} color="#fff1df" position={[6, 4, 4]} rotation-y={-Math.PI / 3} scale={[2.4, 9, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 9, 2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#e6eeff" position={[0, 3, -9]} rotation-y={Math.PI} scale={[10, 5, 1]} />
    </Environment>
  )
}

// Frames the lighter with its lid open and a flame on top, on any screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(9.4 / 2 / tan, 8.4 / 2 / (tan * aspect)) * 1.12
    camera.position.set(Math.sin(0.35) * dist, 3.4 + dist * 0.18, Math.cos(0.35) * dist)
    camera.lookAt(0.2, 3.4, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function LighterScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4, 5, 16], fov: 30, near: 0.1, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d4d6da', 0.3]} />
        <directionalLight position={[-4, 9, 6]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Studio />
        <Lighter {...props} />
        <ContactShadows position={[0, -0.002, 0]} opacity={0.5} scale={14} blur={2.4} far={3} resolution={512} color="#22252a" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0.2, 3.4, 0]} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={6} maxDistance={30} minPolarAngle={0.3} maxPolarAngle={1.62} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#5a6068' }}>
        Click the lighter to flip the lid · click the wheel to strike
      </div>
    </div>
  )
}
