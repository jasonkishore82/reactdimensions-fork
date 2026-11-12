import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Book, { COVER_W, playFlipSound } from './Book.jsx'

const BG = '#efe9df'

// Soft, warm light from above, like a reading lamp in a bright room. Paper is
// matte, so most of its light comes from the room around it: keep it light,
// or the white pages read as grey.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#d8cfc2']} />
      <Lightformer form="rect" intensity={3} color="#fff4e4" position={[0, 9, 2]} rotation-x={Math.PI / 2} scale={[12, 8, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 3, 4]} rotation-y={Math.PI / 2.5} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#eef3ff" position={[8, 3, 4]} rotation-y={-Math.PI / 2.5} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={1} color="#ffffff" position={[0, 2, 10]} scale={[10, 6, 1]} />
    </Environment>
  )
}

// Fits the open book (two pages wide) in view on any shape of screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(5.2 / 2 / tan, (COVER_W * 2.25) / 2 / (tan * aspect)) * 1.02
    camera.position.set(0, Math.sin(1.0) * dist, Math.cos(1.0) * dist)
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height])
  return null
}

const btn = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: '1px solid rgba(43,29,20,0.18)',
  background: 'rgba(255,255,255,0.75)',
  color: '#2b1d14',
  font: '500 18px/1 system-ui, sans-serif',
  cursor: 'pointer',
}

export default function BookScene({ autoRotate = false, sound = true, pages = 12, ...props }) {
  const n = Math.max(1, Math.round(pages / 2))
  const [turned, setTurned] = useState(0)
  useEffect(() => setTurned((t) => Math.min(t, n + 1)), [n])
  const turn = (next) => {
    const t = Math.min(Math.max(next, 0), n + 1)
    if (t === turned) return
    if (sound) playFlipSound()
    setTurned(t)
  }

  // the arrow keys turn pages too
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight') turn(turned + 1)
      if (e.key === 'ArrowLeft') turn(turned - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const total = n * 2
  const label =
    turned === 0 ? 'Cover' : turned === 1 ? 'Page 1' : turned > n ? 'Back cover' : `Pages ${2 * turned - 2}–${2 * turned - 1} of ${total}`

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 10, 8], fov: 30, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#fff8ee', '#d9cfc2', 0.75]} />
        <directionalLight position={[-3, 9, 4]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
        <Studio />
        <Book {...props} pages={pages} turned={turned} onTurn={turn} />
        <ContactShadows position={[0, -0.075, 0]} opacity={0.45} scale={16} blur={2.4} far={2} resolution={512} color="#3a2a1e" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={5} maxDistance={24} minPolarAngle={0.15} maxPolarAngle={1.45} />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        <button type="button" aria-label="Previous page" style={{ ...btn, pointerEvents: 'auto', opacity: turned === 0 ? 0.4 : 1 }} disabled={turned === 0} onClick={() => turn(turned - 1)}>
          ‹
        </button>
        <span style={{ minWidth: 150, textAlign: 'center', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#5a4a3e' }} aria-live="polite">
          {label}
        </span>
        <button type="button" aria-label="Next page" style={{ ...btn, pointerEvents: 'auto', opacity: turned > n ? 0.4 : 1 }} disabled={turned > n} onClick={() => turn(turned + 1)}>
          ›
        </button>
      </div>
    </div>
  )
}
