import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

// Scroll to rotate: a serum pump bottle turns a full circle as you scroll
// through the component's own scroll track. The canvas stays pinned while an
// invisible track scrolls over it; progress 0..1 maps to 0..360 degrees of yaw
// (times `turns`), eased toward the scroll position so wheel steps glide. A thin
// rail and an angle readout show where you are. Focus it and use the arrow keys
// (left / right step 15 degrees). Under reduced motion the turn follows the
// scroll exactly with no easing. Renders on demand, so it idles at zero cost.

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8a857d']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-6, 5, 6]} rotation-y={Math.PI / 4} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#e6eeff" position={[7, 4, 4]} rotation-y={-Math.PI / 3} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#fff1e0" position={[0, 2, -8]} scale={[12, 3, 1]} />
    </Environment>
  )
}

// The wrap-around label, drawn once to a canvas.
function useLabelTexture(labelColor, accent, ink, text) {
  const tex = useMemo(() => {
    const W = 1024
    const H = 744
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
    const g = c.getContext('2d')
    g.fillStyle = labelColor
    g.fillRect(0, 0, W, H)
    g.fillStyle = accent
    g.fillRect(0, 54, W, 14)
    g.fillStyle = ink
    g.textAlign = 'center'
    g.font = '500 30px ui-monospace, Menlo, monospace'
    g.fillText('N° 01  ·  DAILY', W / 2, 150)
    g.font = '400 132px Georgia, "Times New Roman", serif'
    g.fillText(String(text || 'Serum'), W / 2, 330)
    g.fillStyle = accent
    g.beginPath()
    g.arc(W / 2, 400, 9, 0, TAU)
    g.fill()
    g.fillStyle = ink
    g.font = '400 34px Georgia, "Times New Roman", serif'
    g.fillText('hydrating facial serum', W / 2, 490)
    g.globalAlpha = 0.55
    g.font = '500 24px ui-monospace, Menlo, monospace'
    g.fillText('30 ML  ·  1.0 FL OZ', W / 2, 640)
    g.globalAlpha = 1
    g.fillStyle = accent
    g.fillRect(0, H - 68, W, 14)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [labelColor, accent, ink, text])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

// A pump bottle: lathed glass body, metal collar, pump head with a spout that
// points sideways so the turn always reads.
function Bottle({ bodyColor, capColor, labelColor, accent, label }) {
  const profile = useMemo(() => {
    const pts = [
      [0, 0], [0.5, 0], [0.585, 0.025], [0.618, 0.09], [0.62, 0.2], [0.62, 1.66], [0.6, 1.78], [0.53, 1.89],
      [0.4, 1.97], [0.27, 2.01], [0.21, 2.04], [0.2, 2.1], [0.2, 2.16], [0, 2.16],
    ]
    return pts.map(([x, y]) => new THREE.Vector2(x, y))
  }, [])
  const tex = useLabelTexture(labelColor, accent, '#1c1a16', label)
  const labelArc = 2.25
  return (
    <group>
      <mesh castShadow>
        <latheGeometry args={[profile, 96]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.12} metalness={0} clearcoat={1} clearcoatRoughness={0.06} />
      </mesh>
      {/* label: an arc of cylinder just proud of the glass, centred on +Z */}
      <mesh position={[0, 0.92, 0]}>
        <cylinderGeometry args={[0.624, 0.624, 1.08, 72, 1, true, -labelArc / 2, labelArc]} />
        <meshStandardMaterial map={tex} roughness={0.7} side={THREE.FrontSide} />
      </mesh>
      {/* collar */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.27, 0.24, 64]} />
        <meshStandardMaterial color={capColor} metalness={1} roughness={0.28} />
      </mesh>
      <mesh position={[0, 2.325, 0]}>
        <cylinderGeometry args={[0.2, 0.27, 0.03, 64]} />
        <meshStandardMaterial color={capColor} metalness={1} roughness={0.28} />
      </mesh>
      {/* stem and head */}
      <mesh position={[0, 2.42, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.18, 32]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.2, 48]} />
        <meshStandardMaterial color={capColor} metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0, 2.71, 0]}>
        <sphereGeometry args={[0.2, 48, 16, 0, TAU, 0, Math.PI / 2]} />
        <meshStandardMaterial color={capColor} metalness={1} roughness={0.22} />
      </mesh>
      {/* spout, pointing along +X */}
      <mesh position={[0.36, 2.64, 0]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.38, 24]} />
        <meshStandardMaterial color={capColor} metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0.555, 2.625, 0]}>
        <sphereGeometry args={[0.05, 24, 12]} />
        <meshStandardMaterial color="#2a2622" roughness={0.6} />
      </mesh>
    </group>
  )
}

const TARGET_Y = 1.35

function Rig() {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(3.5 / 2 / tan, 2.4 / 2 / (tan * aspect)) * 1.12
    camera.position.set(0, TARGET_Y + dist * 0.16, dist)
    camera.lookAt(0, TARGET_Y, 0)
    invalidate()
  }, [camera, size.width, size.height, invalidate])
  return null
}

// Reads the scroll track, eases toward it and turns the model. Rendering is on
// demand: a frame is requested on every scroll and while the turn is settling.
function Driver({ scroller, model, turns, smoothing, onProgress }) {
  const invalidate = useThree((s) => s.invalidate)
  const st = useRef({ target: 0, cur: 0, reduce: false })
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const read = () => {
      const max = el.scrollHeight - el.clientHeight
      st.current.target = max > 0 ? clamp(el.scrollTop / max, 0, 1) : 0
      st.current.reduce = !!mq?.matches
      invalidate()
    }
    read()
    st.current.cur = st.current.target
    const ro = new ResizeObserver(read)
    ro.observe(el)
    el.addEventListener('scroll', read, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', read)
    }
  }, [scroller, invalidate])
  useEffect(() => {
    invalidate()
  }, [turns, smoothing, invalidate])
  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    if (s.reduce || smoothing <= 0) s.cur = s.target
    else s.cur = THREE.MathUtils.damp(s.cur, s.target, smoothing, dt)
    if (Math.abs(s.cur - s.target) < 2e-4) s.cur = s.target
    else invalidate()
    if (model.current) model.current.rotation.y = s.cur * turns * TAU
    onProgress(s.cur)
  })
  return null
}

export default function ScrollRotateScene({
  turns = 1,
  smoothing = 6,
  length = 3,
  bodyColor = '#2f4a3a',
  capColor = '#d8d2c6',
  labelColor = '#f4f1ea',
  accent = '#ff4d1a',
  background = '#d9d4cb',
  label = 'Serum',
}) {
  const scroller = useRef(null)
  const model = useRef(null)
  const bar = useRef(null)
  const deg = useRef(null)
  const hint = useRef(null)
  const lastDeg = useRef(-1)

  const onProgress = (p) => {
    if (bar.current) bar.current.style.transform = `scaleY(${p.toFixed(4)})`
    if (hint.current) hint.current.style.opacity = String(clamp(1 - p * 8, 0.35, 1))
    const d = Math.round(p * turns * 360)
    if (d !== lastDeg.current && deg.current) {
      lastDeg.current = d
      deg.current.textContent = `${d}°`
    }
  }

  const key = (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!d) return
    e.preventDefault()
    const el = scroller.current
    const max = el.scrollHeight - el.clientHeight
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ top: (d * 15 * max) / (360 * Math.max(0.25, turns)), behavior: reduce ? 'auto' : 'smooth' })
  }

  const ticks = Math.max(1, Math.round(turns * 4))

  return (
    <div className="srt" style={{ '--srt-accent': accent, background }}>
      <style>{`
        .srt { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .srt-canvas { position: absolute; inset: 0; }
        .srt-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; outline: none; scrollbar-width: none; z-index: 1; }
        .srt-scroll::-webkit-scrollbar { display: none; }
        .srt-scroll:focus-visible { box-shadow: inset 0 0 0 3px var(--srt-accent); }
        .srt-rail { position: absolute; right: 22px; top: 18%; bottom: 18%; width: 2px; background: rgba(28,26,22,.14); border-radius: 2px; pointer-events: none; z-index: 2; }
        .srt-fill { position: absolute; inset: 0; background: var(--srt-accent); transform-origin: 50% 0; transform: scaleY(0); border-radius: 2px; }
        .srt-tick { position: absolute; right: 8px; transform: translateY(-50%); font: 500 9px/1 ui-monospace, Menlo, monospace; letter-spacing: .08em; color: #6f685e; white-space: nowrap; }
        .srt-tick::after { content: ''; position: absolute; right: -10px; top: 50%; width: 6px; height: 1px; background: rgba(28,26,22,.3); }
        .srt-read { position: absolute; left: 20px; top: 16px; pointer-events: none; z-index: 2; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: #6f685e; }
        .srt-read b { display: block; margin-top: 8px; font: 400 34px/1 Georgia, 'Times New Roman', serif; letter-spacing: 0; color: #1c1a16; font-variant-numeric: tabular-nums; }
        .srt-cap { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; pointer-events: none; z-index: 2; font: 500 11px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .06em; color: #4f4a43; transition: opacity 200ms; }
      `}</style>
      <div className="srt-canvas">
        <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ position: [0, 2, 12], fov: 30, near: 0.1, far: 100 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
          <color attach="background" args={[background]} />
          <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
          <directionalLight position={[-4, 8, 6]} intensity={0.9} />
          <Studio />
          <group ref={model}>
            <Bottle bodyColor={bodyColor} capColor={capColor} labelColor={labelColor} accent={accent} label={label} />
          </group>
          <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={5} blur={2.4} far={2.5} resolution={512} color="#2a2420" />
          <Rig />
          <Driver scroller={scroller} model={model} turns={turns} smoothing={smoothing} onProgress={onProgress} />
        </Canvas>
      </div>
      <div
        ref={scroller}
        className="srt-scroll"
        tabIndex={0}
        role="region"
        aria-label="Rotation. Scroll, or use the arrow keys, to turn the bottle."
        onKeyDown={key}
      >
        <div style={{ height: `${(Math.max(1, length) + 1) * 100}%` }} />
      </div>
      <div className="srt-read" aria-hidden="true">
        Yaw
        <b ref={deg}>0°</b>
      </div>
      <div className="srt-rail" aria-hidden="true">
        <span ref={bar} className="srt-fill" />
        {Array.from({ length: ticks + 1 }, (_, i) => (
          <span key={i} className="srt-tick" style={{ top: `${(i / ticks) * 100}%` }}>{Math.round((i / ticks) * turns * 360)}°</span>
        ))}
      </div>
      <div ref={hint} className="srt-cap" aria-hidden="true">Scroll to turn it a full circle · ← → step 15°</div>
    </div>
  )
}
