import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import Fox from './Fox.jsx'

// Soft daylight to put catchlights in the eyes and a sheen on the nose.
function Studio() {
  return (
    <Environment resolution={256}>
      <Lightformer form="rect" intensity={3} color="#fff7e8" position={[-4, 5, 6]} scale={[5, 4, 1]} />
      <Lightformer form="circle" intensity={2.5} color="#ffffff" position={[3, 4, 5]} scale={1.5} />
      <Lightformer form="rect" intensity={1.2} color="#ffe2a8" position={[0, -3, 4]} rotation-x={-Math.PI / 2} scale={[10, 4, 1]} />
    </Environment>
  )
}

// Keeps the fox in the upper part of the stage, leaving room for the copy.
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const fill = 0.66 // share of the height the fox takes
    const dist = Math.max(3.6 / fill / 2 / tan, 3.0 / 2 / (tan * aspect))
    const half = dist * tan
    const lookY = 3.55 - half * 0.88
    camera.position.set(0, lookY + 0.2, dist)
    camera.lookAt(0, lookY, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function FoxScene({
  title = 'Uh-oh! This map is wrong',
  subtitle = 'We’ll guide you back to a place you know',
  buttonLabel = 'Take me home',
  href = '/',
  skyColor = '#f6d773',
  accentColor = '#e8873a',
  ...props
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', containerType: 'size', background: `linear-gradient(180deg, ${skyColor} 0%, color-mix(in srgb, ${skyColor} 45%, #fffaf0) 48%, #ffffff 82%)`, fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <style>{`
        .fx-404 { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); font: 900 min(46cqw, 62cqh)/0.8 ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.06em; color: rgba(255,255,255,.42); white-space: nowrap; pointer-events: none; user-select: none; }
        .fx-cloud { position: absolute; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,255,255,.95), rgba(255,255,255,0)); pointer-events: none; }
        .fx-copy { position: absolute; left: 16px; right: 16px; bottom: 6%; text-align: center; pointer-events: none; }
        .fx-copy h2 { margin: 0; font: 700 clamp(22px, 5.4cqw, 52px)/1.1 ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.03em; color: #16130f; }
        .fx-copy p { margin: 10px 0 20px; font-size: clamp(13px, 1.9cqw, 18px); color: #6b655d; }
        .fx-btn { pointer-events: auto; display: inline-flex; align-items: center; gap: 10px; padding: 13px 22px; border-radius: 12px; color: #fff; font: 600 15px/1 ui-sans-serif, system-ui, sans-serif; text-decoration: none; background: linear-gradient(180deg, color-mix(in srgb, ${accentColor} 80%, white), ${accentColor}); box-shadow: 0 10px 24px -8px color-mix(in srgb, ${accentColor} 75%, transparent), inset 0 1px 0 rgba(255,255,255,.35); transition: transform 150ms, box-shadow 150ms; }
        .fx-btn:hover { transform: translateY(-1px); }
        .fx-btn:focus-visible { outline: 3px solid #16130f; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) { .fx-btn { transition: none; } }
      `}</style>
      <div className="fx-404" aria-hidden="true">404</div>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }} camera={{ fov: 30, near: 0.1, far: 60, position: [0, 2, 12] }} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <hemisphereLight args={['#fff6e0', '#e8c78a', 0.6]} />
        <directionalLight position={[-3, 6, 5]} intensity={1.4} color="#fff3e2" />
        <Studio />
        <Fox {...props} />
        <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={5} blur={2.6} far={1.5} resolution={512} color="#8a5a1a" />
        <Rig />
      </Canvas>
      {/* soft clouds drifting over the fox's feet */}
      <div className="fx-cloud" style={{ left: '-10%', bottom: '18%', width: '55%', height: '30%' }} />
      <div className="fx-cloud" style={{ right: '-12%', bottom: '20%', width: '55%', height: '28%' }} />
      <div className="fx-cloud" style={{ left: '20%', bottom: '10%', width: '60%', height: '30%' }} />
      <div className="fx-copy">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <a className="fx-btn" href={href} onClick={(e) => { if (href === '#' || href === '/') e.preventDefault() }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
          {buttonLabel}
        </a>
      </div>
    </div>
  )
}
