import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Gamepad from './Gamepad.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#9a9a9c']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 12, 2]} rotation-x={Math.PI / 2} scale={[18, 10, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[-10, 5, 6]} rotation-y={Math.PI / 3} scale={[4, 10, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[10, 5, 4]} rotation-y={-Math.PI / 3} scale={[4, 10, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 4, -10]} scale={[14, 5, 1]} />
    </Environment>
  )
}

// looking down at the face from in front, like holding it
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(13.5 / 2 / tan, 19 / 2 / (tan * aspect)) * 1.08
    // from high in front, the way the controller is usually pictured
    camera.position.copy(new THREE.Vector3(0, 0.94, 0.34).normalize().multiplyScalar(dist))
    camera.lookAt(0, 0.4, 0.4)
  }, [camera, size.width, size.height])
  return null
}

// keys the controller uses; while the preview has focus they don't scroll the page
const USED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyE', 'KeyZ', 'KeyC', 'KeyF', 'KeyH', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4'])

export default function GamepadScene({ background = '#e4e4e4', autoRotate = false, ...props }) {
  const pad = useRef()
  const keys = useRef(new Set())
  const box = useRef()
  const [connected, setConnected] = useState(null)
  const [focused, setFocused] = useState(false)

  const onKeyDown = (e) => {
    if (!USED.has(e.code) || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    if (e.code === 'KeyR' && !e.repeat) pad.current?.rumble()
    keys.current.add(e.code)
  }
  const onKeyUp = (e) => keys.current.delete(e.code)

  return (
    <div
      ref={box}
      tabIndex={0}
      aria-label="Game controller. Keys: arrows for the d-pad, W A S D and I J K L for the sticks, 1 to 4 for the face buttons, Q and E shoulders, Z and C triggers, R to rumble."
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPointerDown={() => box.current?.focus({ preventScroll: true })}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        keys.current.clear()
        setFocused(false)
      }}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none', outline: 'none' }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 20, 15], fov: 30, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#8a8a8a', 0.45]} />
        <directionalLight position={[-3, 14, 6]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={11} shadow-camera-bottom={-11} />
        <Studio />
        <group position={[0, 0.3, 0]}>
          <Gamepad ref={pad} {...props} keys={keys} onStatus={setConnected} />
        </group>
        <ContactShadows position={[0, -1.85, 0]} opacity={0.35} scale={26} blur={2.6} far={3} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.4, 0.4]} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={7} maxDistance={60} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 12, right: 12, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12, pointerEvents: 'none' }}>
        <button
          onClick={() => pad.current?.rumble()}
          style={{ pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', background: '#1c1a16', color: '#f4f1ea', cursor: 'pointer' }}
        >
          Rumble
        </button>
        <span aria-live="polite" style={{ font: '500 12px/1.3 ui-monospace, Menlo, monospace', color: '#2a2925', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {connected ? `Mirroring: ${connected}` : 'Connect a controller to mirror it'}
        </span>
      </div>
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.55 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', color: '#4a4844' }}>
        Press the buttons · drag a stick to tilt it, click it to click it · hold a trigger to pull it
        <br />
        {focused ? 'Keys: arrows d-pad · WASD / IJKL sticks · 1–4 buttons · Q E shoulders · Z C triggers · F H stick clicks · R rumble' : 'Click the controller to use the keyboard too'}
      </div>
    </div>
  )
}
