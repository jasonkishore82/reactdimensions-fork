import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Knife, { knifeView } from './Knife.jsx'

const BG = '#e8e9ec'
const FLOOR_Y = -2.2

// Steel needs long soft highlights; the panels sit to the sides and above so
// the flat blades catch a bright stripe as they turn.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#b9bdc3']} />
      <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[-8, 4, 5]} rotation-y={Math.PI / 3} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={3} color="#fff2e2" position={[8, 4, 5]} rotation-y={-Math.PI / 3} scale={[3, 10, 1]} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 10, 3]} rotation-x={Math.PI / 2} scale={[16, 6, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#e6eeff" position={[0, 3, -10]} rotation-y={Math.PI} scale={[14, 5, 1]} />
    </Environment>
  )
}

// Keeps the knife in view as tools fold out: it eases out and re-centres on
// whatever is open, while keeping the angle and zoom the visitor has chosen.
function Rig() {
  const { camera, size, controls } = useThree()
  const tan = Math.tan(THREE.MathUtils.degToRad(15))
  const fit = useRef({ d: 0, cx: 0, cy: 0 })
  const wanted = () => {
    const aspect = size.width / size.height
    const w = knifeView.maxX - knifeView.minX + 1.6
    const h = knifeView.maxY - FLOOR_Y + 1.2
    return { d: Math.max(h / 2 / tan, w / 2 / (tan * aspect)) * 1.1, cx: (knifeView.minX + knifeView.maxX) / 2, cy: (knifeView.maxY + FLOOR_Y) / 2 + 0.3 }
  }
  useEffect(() => {
    const w = wanted()
    fit.current = { ...w }
    camera.position.set(w.cx + Math.sin(0.28) * w.d, w.cy + w.d * 0.22, Math.cos(0.28) * w.d)
    camera.lookAt(w.cx, w.cy, 0)
    if (controls) controls.target.set(w.cx, w.cy, 0)
  }, [camera, size.width, size.height, controls])
  useFrame((_, delta) => {
    if (!controls) return
    const e = 1 - Math.exp(-Math.min(delta, 0.05) * 3)
    const w = wanted()
    const f = fit.current
    const nd = f.d + (w.d - f.d) * e
    const ratio = nd / f.d
    f.d = nd
    const dx = (w.cx - f.cx) * e
    const dy = (w.cy - f.cy) * e
    f.cx += dx
    f.cy += dy
    const t = controls.target
    camera.position.sub(t).multiplyScalar(ratio).add(t)
    t.x += dx
    t.y += dy
    camera.position.x += dx
    camera.position.y += dy
  })
  return null
}

export default function KnifeScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4, 4, 26], fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.35]} />
        <directionalLight position={[-5, 10, 8]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={10} shadow-camera-bottom={-6} />
        <Studio />
        <Knife {...props} />
        <ContactShadows position={[0, FLOOR_Y, 0]} opacity={0.4} scale={26} blur={2.8} far={5} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={6} maxDistance={60} minPolarAngle={0.35} maxPolarAngle={1.65} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#5a6068' }}>
        Lift a tool up out of the handle and over · click to snap it open or shut
      </div>
    </div>
  )
}
