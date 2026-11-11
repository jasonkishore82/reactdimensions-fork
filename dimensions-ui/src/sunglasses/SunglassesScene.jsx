import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Sunglasses from './Sunglasses.jsx'

const BG = '#e8e9ec'

// Mirrored lenses need something colourful to reflect, so the studio has warm
// and cool strip lights as well as a big white softbox.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8f949c']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 8, 2]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={3.4} color="#ffb070" position={[-7, 2, 3]} rotation-y={Math.PI / 2.4} scale={[8, 1.6, 1]} />
      <Lightformer form="rect" intensity={3.4} color="#7aa6ff" position={[7, 2, 3]} rotation-y={-Math.PI / 2.4} scale={[8, 1.6, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 1, 9]} scale={[12, 2.4, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#e8f0ff" position={[0, 1, -9]} rotation-y={Math.PI} scale={[12, 3, 1]} />
    </Environment>
  )
}

// Fits the glasses in view on any shape of screen.
function Rig({ width, arm }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    // The arms stick out backwards, so as it turns the view is wider than the front alone.
    const fit = width * 0.9 + arm * 0.85
    const dist = Math.max(2.2 / tan, (fit * 0.5) / (tan * aspect)) * 1.18
    const az = 0.5
    camera.position.set(Math.sin(az) * dist, dist * 0.16, Math.cos(az) * dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height, width, arm])
  return null
}

export default function SunglassesScene({ autoRotate = true, ...props }) {
  const width = (props.lensWidth ?? 2) * 2 + (props.bridge ?? 0.45) + (props.thickness ?? 0.16) * 2
  return (
    <div style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [3, 1.5, 9], fov: 30, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.4]} />
        <directionalLight
          position={[-3, 7, 5]}
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
        <Sunglasses {...props} />
        <ContactShadows position={[0, -1.7, 0]} opacity={0.45} scale={14} blur={2.8} far={3} resolution={512} color="#202328" />
        <Rig width={width} arm={props.templeLength ?? 3.6} />
        <OrbitControls
          makeDefault
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={1.4}
          minDistance={4}
          maxDistance={22}
          minPolarAngle={0.5}
          maxPolarAngle={1.9}
        />
      </Canvas>
    </div>
  )
}
