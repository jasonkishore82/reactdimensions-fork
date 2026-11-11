import { useEffect } from 'react'
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
        Click the watch to swap it · click the strap to change it
      </div>
    </div>
  )
}
