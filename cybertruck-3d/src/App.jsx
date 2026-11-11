import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial, SoftShadows } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import Truck from './Truck.jsx'
import Cones from './Cones.jsx'
import { input, resetVehicle, vehicle } from './controls.js'

const BG = '#e4e6e9'

// Phones and tablets get lighter settings so it stays smooth.
const LOW_POWER =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || new URLSearchParams(location.search).has('lite'))

// Photo-studio environment made of light panels (no HDR download).
// Long strip lights give the flat steel panels crisp linear reflections,
// and the rig drifts slowly so those reflections slide along the body.
function Studio() {
  const rig = useRef()
  useFrame((_, delta) => {
    rig.current.rotation.y += delta * 0.04
  })
  return (
    <Environment resolution={512} frames={Infinity}>
      <color attach="background" args={['#7f858c']} />
      {/* Light floor bounce, so lower panels stay silver */}
      <Lightformer form="rect" intensity={0.7} color="#d9dde1" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
      <group ref={rig}>
        {/* Big overhead softbox */}
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
        {/* Side strip lights */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <Lightformer form="rect" intensity={3} color="#ffffff" position={[s * 9, 2.5, 0]} rotation-y={(-s * Math.PI) / 2} scale={[16, 0.6, 1]} />
            <Lightformer form="rect" intensity={1.4} color={s > 0 ? '#fff4e6' : '#eaf2ff'} position={[s * 9, 0.6, 3]} rotation-y={(-s * Math.PI) / 2} scale={[16, 0.35, 1]} />
          </group>
        ))}
        {/* Front/back key lights */}
        <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 3, 11]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 3, -11]} rotation-y={Math.PI} scale={[12, 2, 1]} />
      </group>
    </Environment>
  )
}

// Glossy studio floor: blurred real-time reflections of the truck.
function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <MeshReflectorMaterial
        color="#d4d7db"
        roughness={0.85}
        metalness={0}
        blur={[500, 120]}
        resolution={LOW_POWER ? 512 : 1024}
        mixBlur={1}
        mixStrength={1.6}
        mixContrast={1}
        depthScale={0}
        mirror={0.6}
      />
    </mesh>
  )
}

// Faint painted grid on the floor, so you can see the truck moving.
function FloorMarkings() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    ctx.strokeStyle = 'rgba(70,78,88,0.55)'
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, 256, 256)
    ctx.fillStyle = 'rgba(70,78,88,0.35)'
    ctx.fillRect(124, 124, 8, 8)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(50, 50) // 4 m squares
    t.anisotropy = 16
    return t
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} renderOrder={-2}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.6} />
    </mesh>
  )
}

// Sun-style key light that travels with the truck, so its shadow stays sharp.
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
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={6}
      shadow-camera-bottom={-6}
    />
  )
}

// Speed readout, updated straight from the physics state.
function Speedo() {
  const ref = useRef()
  useEffect(() => {
    let raf
    const tick = () => {
      if (ref.current) ref.current.textContent = Math.round(Math.abs(vehicle.speed) * 3.6)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="speedo">
      <span ref={ref}>0</span>
      <small>km/h</small>
    </div>
  )
}

// Hold-to-press touch button that writes into the shared input state.
function Pad({ name, label, className = '' }) {
  const set = (on) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    input.touch[name] = on
    e.currentTarget.classList.toggle('held', on)
  }
  return (
    <button
      className={`pad ${className}`}
      aria-label={name}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        set(true)(e)
      }}
      onPointerUp={set(false)}
      onPointerCancel={set(false)}
      onLostPointerCapture={set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  )
}

function TouchControls() {
  return (
    <div className="touch">
      <div className="cluster">
        <Pad name="left" label="◀" />
        <Pad name="right" label="▶" />
      </div>
      <div className="cluster">
        <Pad name="brake" label="BRAKE" className="small" />
        <div className="stack">
          <Pad name="up" label="▲" className="gas" />
          <Pad name="down" label="▼" />
        </div>
      </div>
    </div>
  )
}

function Button({ active, onClick, children }) {
  return (
    <button className={`pill${active ? ' on' : ''}`} onClick={onClick} onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </button>
  )
}

export default function App() {
  const [lights, setLights] = useState(true)
  const [spin, setSpin] = useState(true)
  const [bounce, setBounce] = useState(0)
  const [resetN, setResetN] = useState(0)
  const reset = () => {
    resetVehicle()
    setResetN((n) => n + 1)
  }

  // Keyboard driving: WASD / arrow keys, Space = handbrake, R = reset.
  useEffect(() => {
    const drive = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']
    const down = (e) => {
      if (drive.includes(e.code)) {
        e.preventDefault()
        input.keys.add(e.code)
      }
      if (e.code === 'KeyR') reset()
      if (e.code === 'KeyL') setLights((v) => !v)
    }
    const up = (e) => input.keys.delete(e.code)
    const clear = () => input.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return (
    <>
      <Canvas
        shadows
        dpr={LOW_POWER ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 2, 10], fov: 32, near: 0.1, far: 300 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[BG]} />
        {/* Fog melts the floor into the backdrop: a seamless studio cove */}
        <fog attach="fog" args={[BG, 16, 34]} />
        <SoftShadows size={22} samples={LOW_POWER ? 8 : 14} focus={0.7} />
        <hemisphereLight args={['#ffffff', '#b8bec4', 0.35]} />
        <FollowLight />
        <Studio />
        <Truck lightsOn={lights} autoRotate={spin} bounce={bounce} />
        <Floor />
        <FloorMarkings />
        <Cones reset={resetN} />
        <EffectComposer disableNormalPass multisampling={LOW_POWER ? 0 : 4}>
          <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} quality={LOW_POWER ? 'performance' : 'medium'} />
          <Bloom mipmapBlur luminanceThreshold={3} intensity={1.1} radius={0.65} />
          {/* Filmic highlight roll-off: bright reflections fade to white smoothly */}
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Vignette offset={0.3} darkness={0.35} />
        </EffectComposer>
      </Canvas>

      <div className="ui">
        <Button active={lights} onClick={() => setLights((v) => !v)}>Lights</Button>
        <Button active={spin} onClick={() => setSpin((v) => !v)}>Auto-spin</Button>
        <Button onClick={() => setBounce((n) => n + 1)}>Bounce</Button>
        <Button onClick={reset}>Reset</Button>
      </div>
      <Speedo />
      {LOW_POWER ? (
        <TouchControls />
      ) : (
        <div className="hint">
          W A S D / arrows to drive · Space brake · R reset · L lights · drag to look around
        </div>
      )}
    </>
  )
}
