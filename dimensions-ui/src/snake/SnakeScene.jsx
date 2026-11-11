import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Snake from './Snake.jsx'

const BG = '#12141a'

// Dark studio: warm key from the upper left, cool rim from behind on the
// right, like the reference render.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#05060a']} />
      <Lightformer form="rect" intensity={5} color="#fff1dd" position={[-6, 5, 3]} rotation-y={Math.PI / 3} scale={[7, 4, 1]} />
      <Lightformer form="rect" intensity={4} color="#7f9bff" position={[6, 3, -4]} rotation-y={-Math.PI / 3} scale={[6, 3, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[8, 5, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#9fb2d6" position={[0, 1, 8]} scale={[10, 2, 1]} />
    </Environment>
  )
}

// Keeps the whole snake in frame on any shape of screen.
function Rig({ enabled }) {
  const { camera, size } = useThree()
  useFrame(() => {
    if (!enabled) return
    const aspect = size.width / size.height
    const dist = Math.min(5.7 * Math.pow(Math.max(1.6 / aspect, 1), 0.85), 14)
    camera.position.set(0.3, 1.9 + (dist - 5.7) * 0.14, dist)
    camera.lookAt(-0.45, 0.9, -0.1)
  })
  return null
}

export default function SnakeScene({ followPointer = true, ...props }) {
  const key = useRef()
  return (
    <div style={{ width: '100%', height: '100%', touchAction: followPointer ? 'pan-y' : 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0.3, 1.9, 5.7], fov: 32, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 14, 30]} />
        <ambientLight intensity={0.12} />
        <spotLight
          ref={key}
          position={[-4.5, 8, 5]}
          angle={0.62}
          penumbra={0.9}
          intensity={420}
          decay={2}
          color="#fff3e2"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.03}
        />
        <directionalLight position={[5, 3, -5]} intensity={0.9} color="#7f9bff" />
        <Studio />
        <Snake followPointer={followPointer} {...props} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[40, 64]} />
          <meshStandardMaterial color="#1b1e27" roughness={0.9} metalness={0} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={14} blur={2.6} far={2.6} resolution={512} color="#000000" />
        <Rig enabled={followPointer} />
        {!followPointer && <OrbitControls enablePan={false} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI / 2.05} target={[-0.45, 0.9, -0.1]} />}
      </Canvas>
    </div>
  )
}
