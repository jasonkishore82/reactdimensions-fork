import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import Card from './Card.jsx'

// A studio light that follows the pointer so the specular highlight
// sweeps across the clear-coat as you move.
function PointerLight() {
  const light = useRef()
  const target = new THREE.Vector3()
  useFrame((state) => {
    target.set(state.pointer.x * 4, state.pointer.y * 3 + 1, 4)
    light.current.position.lerp(target, 0.08)
  })
  return <pointLight ref={light} intensity={7} distance={12} decay={1.6} color="#ffffff" />
}

// Studio environment built from emissive panels (no HDR download needed).
// It slowly rotates so reflections drift across the card even at rest.
function Studio() {
  const rig = useRef()
  useFrame((state, delta) => {
    rig.current.rotation.y += delta * 0.15
  })
  return (
    <Environment resolution={256} frames={Infinity}>
      <color attach="background" args={['#0b0c0e']} />
      <group ref={rig}>
        <Lightformer form="rect" intensity={4} color="#ffffff" position={[0, 4, -6]} scale={[12, 1.2, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#dbe8ff" position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#fff1dc" position={[6, 1, 0]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={3} color="#ffffff" position={[0, 2, 6]} scale={2.5} />
        <Lightformer form="rect" intensity={1.2} color="#9fb4c4" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
      </group>
    </Environment>
  )
}

export default function App() {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 35 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <ambientLight intensity={0.15} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} castShadow />
        <PointerLight />
        <Studio />
        <Card />
        <ContactShadows position={[0, -1.55, 0]} opacity={0.4} scale={8} blur={2.8} far={3} color="#2a3b47" />
      </Canvas>
      <div className="hint">Drag to spin · flick to flip · double-click to turn over</div>
    </>
  )
}
