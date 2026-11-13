import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Sneaker from './Sneaker.jsx'

// a soft grey studio, like a product shoot
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#9c9c9e']} />
      <Lightformer form="rect" intensity={1.7} color="#ffffff" position={[0, 30, 4]} rotation-x={Math.PI / 2} scale={[40, 24, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[-26, 10, 14]} rotation-y={Math.PI / 3} scale={[10, 22, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[26, 10, 10]} rotation-y={-Math.PI / 3} scale={[10, 22, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#ffffff" position={[0, 8, -26]} scale={[34, 12, 1]} />
    </Environment>
  )
}

const TARGET = [0.4, 5.0, 0]

// a three-quarter view of the outer side, toe to the right
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(19 / 2 / tan, 36 / 2 / (tan * aspect)) * 1.12
    camera.position.copy(new THREE.Vector3(0.46, 0.22, 1).normalize().multiplyScalar(dist).add(new THREE.Vector3(...TARGET)))
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

export default function SneakerScene({ background = '#d2d2d2', autoRotate = false, ...props }) {
  const shoe = useRef()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) {
        e.preventDefault()
        shoe.current?.hop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', background: '#1c1a16', color: '#f4f1ea', cursor: 'pointer' }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [20, 18, 50], fov: 30, near: 0.5, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#7a7a7a', 0.35]} />
        <directionalLight position={[-10, 34, 18]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} />
        <Studio />
        <Sneaker ref={shoe} {...props} />
        <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={50} blur={2.2} far={10} resolution={1024} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={14} maxDistance={140} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
        <button onClick={() => shoe.current?.hop()} style={btn}>
          Hop
        </button>
        <button onClick={() => shoe.current?.flex()} style={btn}>
          Flex
        </button>
      </div>
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.5 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', color: '#4a4844' }}>
        Drag the toe up to flex the sole · click the shoe to make it hop · drag the background to look round, scroll to zoom
      </div>
    </div>
  )
}
