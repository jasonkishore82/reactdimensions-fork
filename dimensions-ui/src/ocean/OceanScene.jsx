import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Ocean from './Ocean.jsx'

export default function OceanScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [-17, 5.5, 10], fov: 50, near: 0.5, far: 30000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Ocean {...props} />
        <OrbitControls makeDefault enablePan={false} target={[0, 2, 0]} autoRotate={autoRotate} autoRotateSpeed={0.4} minDistance={10} maxDistance={220} maxPolarAngle={1.52} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
        Click the water to send the buoy there · drag to look around
      </div>
    </div>
  )
}
