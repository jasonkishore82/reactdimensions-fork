import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Turntable, { view } from './Turntable.jsx'

const BG = '#e8eaed'

// Bright photo-studio: a big softbox overhead and strip lights at the sides.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#9aa0a8']} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[14, 9, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#fff4e4" position={[-8, 4, 3]} rotation-y={Math.PI / 2.4} scale={[10, 2.4, 1]} />
      <Lightformer form="rect" intensity={2} color="#eaf1ff" position={[8, 3, -2]} rotation-y={-Math.PI / 2.4} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 2.5, 9]} scale={[12, 2, 1]} />
    </Environment>
  )
}

// Frames the whole deck on any shape of screen.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const dist = Math.min(12.6 * Math.pow(Math.max(1.55 / aspect, 1), 0.9), 28)
    camera.position.set(0, dist * 0.85, dist * 0.52)
    camera.lookAt(0, 0, 0.1)
  }, [camera, size.width, size.height])

  // Pull back a little while the record is off the deck, so it fits in view.
  const zoom = useRef(1)
  useFrame((_, delta) => {
    const next = zoom.current + (view.zoom - zoom.current) * (1 - Math.exp(-Math.min(delta, 0.05) * 3))
    const ratio = next / zoom.current
    zoom.current = next
    if (Math.abs(ratio - 1) < 1e-6) return
    const t = new THREE.Vector3(0, 0, 0.1)
    camera.position.sub(t).multiplyScalar(ratio).add(t)
  })
  return null
}

export default function TurntableScene({ ...props }) {
  const controls = useRef()
  const [hint, setHint] = useState('')
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 9.5, 5.8], fov: 30, near: 0.1, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.85 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c9ccd2', 0.3]} />
        <directionalLight
          position={[-3, 10, 5]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <Studio />
        <Turntable {...props} controlsRef={controls} onHint={setHint} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.62, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial transparent opacity={0.16} />
        </mesh>
        <ContactShadows position={[0, -0.615, 0]} opacity={0.5} scale={14} blur={3} far={1.2} resolution={512} color="#202328" />
        <Rig />
        <OrbitControls
          ref={controls}
          makeDefault
          enablePan={false}
          minDistance={6}
          maxDistance={40}
          minPolarAngle={0.05}
          maxPolarAngle={1.38}
          target={[0, 0, 0.1]}
        />
      </Canvas>
      {hint && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 12,
            textAlign: 'center',
            pointerEvents: 'none',
            font: '500 11px/1.4 ui-monospace, Menlo, monospace',
            letterSpacing: '0.06em',
            color: '#5a6068',
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}
