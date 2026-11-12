import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Lamp from './Lamp.jsx'

const BG = '#d9d4cb'

// A dim room, so the lamp's own light reads on the desk.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#6e6a64']} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[-10, 8, 8]} rotation-y={Math.PI / 3} scale={[6, 12, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#e6eeff" position={[10, 6, 6]} rotation-y={-Math.PI / 3} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[20, 10, 1]} />
    </Environment>
  )
}

// The desk top (oak) and a sheet of paper for the light to fall on.
function Desk() {
  const tex = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
    const g = c.getContext('2d')
    g.fillStyle = '#b48a5e'
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 120; i++) {
      const y = Math.random() * 512
      g.strokeStyle = Math.random() < 0.6 ? `rgba(90,55,25,${0.08 + Math.random() * 0.12})` : `rgba(230,190,140,${0.06 + Math.random() * 0.1})`
      g.lineWidth = 0.6 + Math.random() * 2
      g.beginPath()
      for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x / 80 + i) * 4)
      g.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(3, 3)
    t.anisotropy = 8
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial map={tex} roughness={0.55} />
      </mesh>
      {/* where the light falls in the default pose */}
      <mesh rotation-x={-Math.PI / 2} rotation-z={0.35} position={[4.5, 0.004, -1.5]} receiveShadow>
        <planeGeometry args={[2.1, 2.97]} />
        <meshStandardMaterial color="#f6f4ef" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(8.5 / 2 / tan, 11 / 2 / (tan * aspect)) * 1.1
    camera.position.set(2.2 + Math.sin(0.55) * dist, 3.4 + dist * 0.3, Math.cos(0.55) * dist)
    camera.lookAt(2.2, 3.0, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function LampScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [10, 8, 18], fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.25]} />
        <directionalLight position={[-6, 12, 8]} intensity={0.45} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
        <Studio />
        <Desk />
        <Lamp {...props} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[2.2, 3.0, 0]} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={6} maxDistance={40} minPolarAngle={0.2} maxPolarAngle={1.5} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4f4a43' }}>
        Drag an arm to pose it · drag the shade to tilt it · drag the base to turn · click the switch
      </div>
    </div>
  )
}
