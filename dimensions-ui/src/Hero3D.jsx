import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import Card from './Card.jsx'

// Soft studio: an even grey surround, plus dim panels that slowly turn so reflections drift.
function Studio() {
  const rig = useRef()
  useFrame((_, delta) => {
    rig.current.rotation.y += delta * 0.15
  })
  return (
    <Environment resolution={256} frames={Infinity}>
      <color attach="background" args={['#8e8e96']} />
      <group ref={rig}>
        <Lightformer form="rect" intensity={1} color="#ffffff" position={[0, 4, -6]} scale={[12, 1.2, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ff6a33" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
      </group>
    </Environment>
  )
}

export default function Hero3D(props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 35 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
    >
      <ambientLight intensity={1.4} />
      <Studio />
      <Card {...props} />
      <ContactShadows position={[0, -1.45, 0]} opacity={0.35} scale={8} blur={2.8} far={3} color="#3a2a20" />
    </Canvas>
  )
}
