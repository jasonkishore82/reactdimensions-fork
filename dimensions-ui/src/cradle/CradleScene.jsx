import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Cradle, { layoutOf } from './Cradle.jsx'

const BG = '#e8e9ec'

// Chrome is only what it reflects: a light grey room with tall soft panels
// reads as polished steel, with crisp bright lines down each ball.
function Studio() {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#9a9fa6']} />
      <Lightformer form="rect" intensity={4} color="#ffffff" position={[-6, 3, 3]} rotation-y={Math.PI / 2.4} scale={[2.6, 10, 1]} />
      <Lightformer form="rect" intensity={4} color="#fff2e0" position={[6, 3, 3]} rotation-y={-Math.PI / 2.4} scale={[2.6, 10, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 9, 2]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 3, 9]} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#e6efff" position={[0, 3, -9]} rotation-y={Math.PI} scale={[10, 6, 1]} />
    </Environment>
  )
}

// Fits the whole cradle in view on any shape of screen, whatever its size.
function Rig({ balls, length }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const n = Math.min(Math.max(Math.round(balls), 3), 8)
    const lay = layoutOf(n, length)
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    // seen from an angle, the base's depth adds to the width on screen
    const dist = Math.max((lay.height + 1.4) / 2 / tan, (lay.width + 2.2) / 2 / (tan * aspect)) * 1.18
    camera.position.set(Math.sin(0.3) * dist, lay.centerY + 1.2, Math.cos(0.3) * dist)
    camera.lookAt(0, lay.centerY - 0.15, 0)
  }, [camera, size.width, size.height, balls, length])
  return null
}

export default function CradleScene({ autoRotate = false, ...props }) {
  const balls = props.balls ?? 5
  const length = props.stringLength ?? 3.4
  const n = Math.min(Math.max(Math.round(balls), 3), 8)
  const lay = layoutOf(n, length)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4, 4, 16], fov: 30, near: 0.1, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d8dadd', 0.3]} />
        <directionalLight position={[-4, 9, 6]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Studio />
        <Cradle {...props} />
        <ContactShadows position={[0, -0.352, 0]} opacity={0.5} scale={Math.max(14, lay.width * 1.6)} blur={2.6} far={2} resolution={512} color="#202328" />
        <Rig balls={balls} length={length} />
        <OrbitControls makeDefault enablePan={false} target={[0, lay.centerY - 0.15, 0]} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={5} maxDistance={32} minPolarAngle={0.5} maxPolarAngle={1.62} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#5a6068' }}>
        Drag an end ball and let go
      </div>
    </div>
  )
}
