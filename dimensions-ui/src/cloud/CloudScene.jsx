import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Cloud from './Cloud.jsx'

export default function CloudScene({ autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [-30, 10, 95], fov: 45, near: 0.5, far: 30000 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Cloud {...props} />
        <OrbitControls makeDefault enablePan={false} target={[0, 22, 0]} autoRotate={autoRotate} autoRotateSpeed={0.25} minDistance={20} maxDistance={260} minPolarAngle={0.35} maxPolarAngle={2.1} />
      </Canvas>
      <InfoHint>Drag to fly around the cloud · scroll to move closer, even inside it</InfoHint>
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner instead of a
// line of text over the scene: hover it (or tap it) to read them.
function InfoHint({ children }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hover || pinned
  return (
    <div
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 'calc(100% - 24px)' }}
    >
      {open && (
        <div role="tooltip" style={{ maxWidth: 340, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.06)', font: '500 11px/1.6 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', color: '#2a2925', textAlign: 'left' }}>
          {children}
        </div>
      )}
      <button
        type="button"
        aria-label="How to use"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        style={{ width: 30, height: 30, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: open ? '#1c1a16' : 'rgba(255,255,255,0.88)', color: open ? '#f4f1ea' : '#2a2925', font: 'italic 700 15px/1 Georgia, "Times New Roman", serif', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}
      >
        i
      </button>
    </div>
  )
}
