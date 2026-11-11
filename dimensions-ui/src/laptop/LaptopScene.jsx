import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Laptop from './Laptop.jsx'

const BG = '#e9eaed'

// Brushed aluminium needs long soft panels to reflect.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8f949b']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 8, 2]} rotation-x={Math.PI / 2} scale={[14, 6, 1]} />
      <Lightformer form="rect" intensity={3} color="#fff0dc" position={[-8, 3, 3]} rotation-y={Math.PI / 2.4} scale={[9, 2.5, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#e6efff" position={[8, 2, 2]} rotation-y={-Math.PI / 2.4} scale={[9, 2.5, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 2, 10]} scale={[14, 2.4, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 2, -10]} rotation-y={Math.PI} scale={[14, 3, 1]} />
    </Environment>
  )
}

// Keeps the whole laptop in view, open, on any shape of screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(3.25 / tan, 3.6 / (tan * aspect)) * 1.16
    const az = 0.55
    const el = 0.42
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, 1.8 + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(0, 1.7, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function LaptopScene({ autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [5, 5, 11], fov: 30, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.4]} />
        <directionalLight
          position={[-4, 8, 6]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
        />
        <Studio />
        <Laptop {...props} />
        <ContactShadows position={[0, -0.005, 0]} opacity={0.45} scale={16} blur={2.6} far={3} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls
          makeDefault
          enablePan={false}
          target={[0, 1.7, 0]}
          autoRotate={autoRotate}
          autoRotateSpeed={0.9}
          minDistance={5}
          maxDistance={24}
          minPolarAngle={0.3}
          maxPolarAngle={1.55}
        />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 12,
          textAlign: 'center',
          pointerEvents: 'none',
          font: '500 11px/1.4 ui-monospace, Menlo, monospace',
          letterSpacing: '0.06em',
          color: '#5a6068',
        }}
      >
        Click the laptop to open or close the lid
      </div>
    </div>
  )
}
