import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Phone, { PHONE_H } from './Phone.jsx'

const BG = '#e8e9ec'

// Metal and glass reflect what is around them, so the studio has long strip
// lights on each side and a softbox above.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8d9299']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 260, 80]} rotation-x={Math.PI / 2} scale={[300, 200, 1]} />
      <Lightformer form="rect" intensity={4} color="#fff1dc" position={[-230, 40, 90]} rotation-y={Math.PI / 2.4} scale={[40, 300, 1]} />
      <Lightformer form="rect" intensity={4} color="#e3eeff" position={[230, 40, 90]} rotation-y={-Math.PI / 2.4} scale={[40, 300, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 30, 260]} scale={[200, 120, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 30, -260]} rotation-y={Math.PI} scale={[200, 120, 1]} />
    </Environment>
  )
}

// Fits the whole phone in view on any shape of screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max((PHONE_H * 1.12) / 2 / tan, (95 / 2) / (tan * aspect)) * 1.04
    camera.position.set(Math.sin(0.4) * dist, 18, Math.cos(0.4) * dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function PhoneScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [120, 20, 380], fov: 30, near: 1, far: 2000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.4]} />
        <directionalLight position={[-120, 220, 200]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={140} shadow-camera-bottom={-140} shadow-camera-near={50} shadow-camera-far={700} />
        <Studio />
        <Phone {...props} />
        <ContactShadows position={[0, -84, 0]} opacity={0.4} scale={300} blur={2.8} far={90} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.0} minDistance={120} maxDistance={700} minPolarAngle={0.5} maxPolarAngle={2.2} />
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
        Click the phone to flip it · drag to orbit
      </div>
    </div>
  )
}
