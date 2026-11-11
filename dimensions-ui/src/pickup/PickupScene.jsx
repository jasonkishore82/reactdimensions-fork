import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import Pickup from './Pickup.jsx'
import Cones from './Cones.jsx'
import { input, resetVehicle, vehicle } from './controls.js'

const BG = '#dcdcd6'

// Studio built from light panels: long strips give the flat steel crisp reflections.
function Studio() {
  const rig = useRef()
  useFrame((_, delta) => {
    rig.current.rotation.y += delta * 0.04
  })
  return (
    <Environment resolution={512} frames={Infinity}>
      <color attach="background" args={['#7f858c']} />
      <Lightformer form="rect" intensity={0.7} color="#d9dde1" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
      <group ref={rig}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Lightformer form="rect" intensity={3} color="#ffffff" position={[s * 9, 2.5, 0]} rotation-y={(-s * Math.PI) / 2} scale={[16, 0.6, 1]} />
            <Lightformer form="rect" intensity={1.4} color={s > 0 ? '#fff4e6' : '#eaf2ff'} position={[s * 9, 0.6, 3]} rotation-y={(-s * Math.PI) / 2} scale={[16, 0.35, 1]} />
          </group>
        ))}
        <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 3, 11]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 3, -11]} rotation-y={Math.PI} scale={[12, 2, 1]} />
      </group>
    </Environment>
  )
}

function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <MeshReflectorMaterial
        color="#cfd2d6"
        roughness={0.85}
        metalness={0}
        blur={[400, 100]}
        resolution={512}
        mixBlur={1}
        mixStrength={1.4}
        depthScale={0}
        mirror={0.6}
      />
    </mesh>
  )
}

// Faint painted grid so you can see the truck move.
function FloorGrid() {
  const tex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    ctx.strokeStyle = 'rgba(70,78,88,0.55)'
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(50, 50)
    t.anisotropy = 8
    return t
  })()
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} renderOrder={-2}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.55} />
    </mesh>
  )
}

// Key light that travels with the truck so its shadow stays sharp.
function FollowLight() {
  const light = useRef()
  useFrame(() => {
    const l = light.current
    l.position.set(vehicle.x + 4, 10, vehicle.z + 5)
    l.target.position.set(vehicle.x, 0, vehicle.z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      intensity={1.1}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={6}
      shadow-camera-bottom={-6}
    />
  )
}

const DRIVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']

export default function PickupScene({ lightsOn = true, autoRotate = true, drivable = false, color, roughness, bounce = 0 }) {
  const wrap = useRef()

  // Keys only count while the preview has focus, so the page can still scroll.
  useEffect(() => {
    resetVehicle()
    return () => {
      input.keys.clear()
      resetVehicle()
    }
  }, [])
  useEffect(() => {
    if (!drivable) input.keys.clear()
  }, [drivable])

  const onKeyDown = (e) => {
    if (!drivable) return
    if (DRIVE_KEYS.includes(e.code)) {
      e.preventDefault()
      input.keys.add(e.code)
    }
    if (e.code === 'KeyR') resetVehicle()
  }
  const onKeyUp = (e) => input.keys.delete(e.code)

  return (
    <div
      ref={wrap}
      tabIndex={0}
      aria-label="3D pickup preview. When driving is on, use W A S D or the arrow keys."
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={() => input.keys.clear()}
      onPointerDown={() => wrap.current?.focus({ preventScroll: true })}
      style={{ position: 'relative', width: '100%', height: '100%', outline: 'none', touchAction: 'none' }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 2, 10], fov: 32, near: 0.1, far: 300 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 16, 34]} />
        <hemisphereLight args={['#ffffff', '#b8bec4', 0.35]} />
        <FollowLight />
        <Studio />
        <Pickup lightsOn={lightsOn} autoRotate={autoRotate} drivable={drivable} color={color} roughness={roughness} bounce={bounce} />
        <Floor />
        <FloorGrid />
        {drivable && <Cones />}
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={3} intensity={1.1} radius={0.65} />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>
      {drivable && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4a4d52' }}>
          Click here, then W A S D / arrows · Space brake · R reset
        </div>
      )}
    </div>
  )
}
