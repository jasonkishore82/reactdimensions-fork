import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Bottle from './Bottle.jsx'

const BG = '#f3f4f5'

// Glass looks like glass because of what it reflects: tall soft windows and
// dark edges give the crisp bright lines and dark rims seen in studio photos.
function Studio() {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#23272c']} />
      <Lightformer form="rect" intensity={5} color="#ffffff" position={[-6, 2, 3]} rotation-y={Math.PI / 2.5} scale={[2.2, 12, 1]} />
      <Lightformer form="rect" intensity={5} color="#ffffff" position={[6, 2, 3]} rotation-y={-Math.PI / 2.5} scale={[2.2, 12, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 9, 2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 2, 9]} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 2, -9]} rotation-y={Math.PI} scale={[6, 10, 1]} />
    </Environment>
  )
}

// Fits the whole bottle in view on any shape of screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(5.1 / tan, 3.0 / (tan * aspect)) * 1.12
    camera.position.set(Math.sin(0.35) * dist, 0.6, Math.cos(0.35) * dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function BottleScene({ autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [4, 1, 17], fov: 30, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d8dadd', 0.25]} />
        <directionalLight position={[-4, 9, 6]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Studio />
        <Bottle {...props} />
        <ContactShadows position={[0, -4.3, 0]} opacity={0.5} scale={14} blur={2.6} far={3} resolution={512} color="#30363c" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.0} minDistance={6} maxDistance={30} minPolarAngle={0.5} maxPolarAngle={1.75} target={[0, 0, 0]} />
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
        Click the bottle to open or close the swing top
      </div>
    </div>
  )
}
