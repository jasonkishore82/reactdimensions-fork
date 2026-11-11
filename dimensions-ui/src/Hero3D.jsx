import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import Card from './Card.jsx'

// A light that trails the cursor so the highlight sweeps the clear-coat.
function PointerLight() {
  const light = useRef()
  const target = new THREE.Vector3()
  useFrame((state) => {
    // Rest the light up and to the left until the cursor moves, so the
    // highlight doesn't sit dead centre on the card.
    const px = state.pointer.x || -0.55
    const py = state.pointer.y || 0.45
    target.set(px * 4.5, py * 3 + 1, 4)
    light.current.position.lerp(target, 0.08)
  })
  return <pointLight ref={light} intensity={5} distance={12} decay={1.6} color="#fff6ec" />
}

// Studio built from light panels, slowly turning so reflections drift.
function Studio() {
  const rig = useRef()
  useFrame((_, delta) => {
    rig.current.rotation.y += delta * 0.15
  })
  return (
    <Environment resolution={256} frames={Infinity}>
      <color attach="background" args={['#0b0c0e']} />
      <group ref={rig}>
        <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 4, -6]} scale={[12, 1.2, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#ffe2cf" position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#fff1dc" position={[6, 1, 0]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={3} color="#ffffff" position={[0, 2, 6]} scale={2.5} />
        <Lightformer form="rect" intensity={1.5} color="#ff6a33" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
      </group>
    </Environment>
  )
}

export default function Hero3D(props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 35 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <PointerLight />
      <Studio />
      <Card {...props} />
      <ContactShadows position={[0, -1.45, 0]} opacity={0.35} scale={8} blur={2.8} far={3} color="#3a2a20" />
    </Canvas>
  )
}
