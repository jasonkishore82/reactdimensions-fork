import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Keyboard from './Keyboard.jsx'
import { buildLayout } from './layout.js'

const BG = '#25272c'

// Soft studio panels: keycaps are matte plastic, so broad light reads best.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#3a3d44']} />
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[-6, 6, 4]} rotation-y={Math.PI / 3} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#ffeedd" position={[6, 6, 4]} rotation-y={-Math.PI / 3} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
      <Lightformer form="rect" intensity={1} color="#dfe8ff" position={[0, 3, -10]} rotation-y={Math.PI} scale={[12, 5, 1]} />
    </Environment>
  )
}

// Frames the whole board, seen from the front and above, on any screen shape.
function Rig({ layout }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const { width, depth } = buildLayout(layout)
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const a = 0.95 // elevation of the view
    const dist = Math.max((width + 1.6) / 2 / (tan * aspect), ((depth + 1.6) * Math.sin(a) + 0.8) / 2 / tan) * 1.08
    camera.position.set(0, Math.sin(a) * dist, Math.cos(a) * dist)
    camera.lookAt(0, 0, 0.2)
  }, [camera, size.width, size.height, layout])
  return null
}

export default function KeyboardScene({ autoRotate = false, layout = 'TKL', ...props }) {
  const [typed, setTyped] = useState('')
  const onType = (ch) => setTyped((t) => (ch === null ? t.slice(0, -1) : (t + ch).slice(-48)))
  const { width } = buildLayout(layout)
  return (
    <div role="group" aria-label="3D mechanical keyboard. Type on your keyboard to press its keys." style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 14, 12], fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#30323a', 0.35]} />
        <directionalLight position={[-5, 12, 7]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={10} shadow-camera-bottom={-10} />
        <Studio />
        <Keyboard layout={layout} onType={onType} {...props} />
        <ContactShadows position={[0, -0.74, 0]} opacity={0.6} scale={width * 1.6} blur={2.4} far={2} resolution={512} color="#000000" />
        <Rig layout={layout} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0, 0.2]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={6} maxDistance={60} minPolarAngle={0.15} maxPolarAngle={1.45} />
      </Canvas>
      <div aria-live="polite" style={{ position: 'absolute', left: 16, right: 16, top: 14, textAlign: 'center', pointerEvents: 'none', font: '500 15px/1.4 ui-monospace, Menlo, monospace', color: '#e8e8ea', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {typed}<span style={{ opacity: 0.6 }}>▍</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#a4a8b0' }}>
        Type on your keyboard, or click the keys
      </div>
    </div>
  )
}
