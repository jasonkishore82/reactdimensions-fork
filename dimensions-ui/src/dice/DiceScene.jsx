import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Dice, { TRAY } from './Dice.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#bdbdbd']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[-8, 10, 6]} rotation-y={Math.PI / 4} scale={[8, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[8, 8, 6]} rotation-y={-Math.PI / 4} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
    </Environment>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    // the whole tray, rim included
    const dist = Math.max((2 * TRAY.z + 2.4) / 2 / tan, (2 * TRAY.x + 1.6) / 2 / (tan * aspect)) * 1.02
    camera.position.set(0, dist * 0.66, dist * 0.75)
    camera.lookAt(0, 0, 0.3)
  }, [camera, size.width, size.height])
  return null
}

export default function DiceScene({ autoRotate = false, background = '#cdcdcd', ...props }) {
  const [rollKey, setRollKey] = useState(0)
  const [values, setValues] = useState([])
  const [rolling, setRolling] = useState(false)
  const roll = () => setRollKey((k) => k + 1)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) {
        e.preventDefault()
        roll()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const total = values.reduce((a, b) => a + b, 0)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 9, 7], fov: 30, near: 0.1, far: 100 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#9a9a9a', 0.35]} />
        <directionalLight position={[-4, 10, 5]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
        <Studio />
        <Dice
          {...props}
          rollKey={rollKey}
          onRolling={() => setRolling(true)}
          onResult={(v) => {
            setValues(v)
            setRolling(false)
          }}
        />
        <ContactShadows position={[0, 0.002, 0]} opacity={0.3} scale={12} blur={2.2} far={3} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 0, 0.3]} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={6} maxDistance={30} minPolarAngle={0.1} maxPolarAngle={1.25} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, pointerEvents: 'none' }}>
        <button
          onClick={roll}
          style={{ pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', background: '#1c1a16', color: '#f4f1ea', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }}
        >
          Roll
        </button>
        <div aria-live="polite" style={{ font: '500 13px/1 ui-monospace, Menlo, monospace', color: '#2a2925', minWidth: 120 }}>
          {rolling ? 'Rolling…' : values.length > 1 ? `${values.join(' + ')} = ${total}` : values.length === 1 ? `Rolled ${values[0]}` : ''}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4a4844' }}>
        Roll (or Space) to throw · drag a die to pick it up and fling it · click a die to flip it
      </div>
    </div>
  )
}
