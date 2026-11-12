import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Ladder from './Ladder.jsx'

const TARGET = [1.8, 2.6, 0]

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#cfcfcc']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[10, 8, 8]} rotation-y={Math.PI / 4} scale={[8, 10, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#fff6ea" position={[-2, 6, 10]} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[4, 14, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
    </Environment>
  )
}

// the room: a wall at x = 0 with a skirting board, and the floor in front of it
function Room({ wallColor, floorColor }) {
  return (
    <group>
      <mesh position={[-0.001, 5, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[80, 10]} />
        <meshStandardMaterial color={wallColor} roughness={0.95} />
      </mesh>
      <mesh position={[0.03, 0.12, 0]}>
        <boxGeometry args={[0.06, 0.24, 80]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>
      <mesh position={[20, 0, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 80]} />
        <meshStandardMaterial color={floorColor} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(17))
    // the ladder standing, and the floor it can slide out over
    const dist = Math.max(7.4 / 2 / tan, 9 / 2 / (tan * aspect)) * 1.05
    const dir = new THREE.Vector3(0.62, 0.22, 0.75).normalize()
    camera.position.set(TARGET[0] + dir.x * dist, TARGET[1] + dir.y * dist, TARGET[2] + dir.z * dist)
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

export default function LadderScene({ autoRotate = false, wallColor = '#e6e4df', floorColor = '#d3cfc6', ...props }) {
  const [status, setStatus] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const tone = { Holding: '#2f7d4f', Standing: '#2f7d4f', Held: '#5a5852', Slipping: '#c4421a', Falling: '#c4421a', 'On the floor': '#5a5852' }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: wallColor }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [9, 5, 9], fov: 34, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[wallColor]} />
        <hemisphereLight args={['#ffffff', '#a8a49c', 0.4]} />
        <directionalLight position={[9, 11, 6]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={9} shadow-camera-bottom={-3} />
        <Studio />
        <Room wallColor={wallColor} floorColor={floorColor} />
        <Ladder {...props} resetKey={resetKey} onStatus={setStatus} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={6} maxDistance={36} minPolarAngle={0.25} maxPolarAngle={1.5} minAzimuthAngle={0.15} maxAzimuthAngle={Math.PI - 0.15} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, pointerEvents: 'none', font: '500 12px/1.3 ui-monospace, Menlo, monospace', color: '#2b2a26' }}>
        {status && (
          <>
            <span style={{ padding: '6px 10px', borderRadius: 999, background: tone[status.state] ?? '#5a5852', color: '#fff', letterSpacing: '.06em' }}>{status.state}</span>
            <span>
              {status.fromFloor.toFixed(1)}° from the floor · slips below {status.critical.toFixed(1)}°
            </span>
          </>
        )}
        <button
          onClick={() => setResetKey((k) => k + 1)}
          style={{ pointerEvents: 'auto', marginLeft: 'auto', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '.1em', textTransform: 'uppercase', padding: '9px 14px', borderRadius: 999, border: 'none', background: '#1c1a16', color: '#f4f1ea', cursor: 'pointer' }}
        >
          Stand it up
        </button>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#55524b' }}>
        Drag the foot out to lean it further · drag the top to tip it off the wall · click a rung to hang the can
      </div>
    </div>
  )
}
