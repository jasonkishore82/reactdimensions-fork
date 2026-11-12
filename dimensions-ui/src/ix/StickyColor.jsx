import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

// Sticky product shot: blocks of copy scroll past on the left while the
// product stays pinned on the right, taking on each block's colourway as it
// arrives. The colour blends continuously with the scroll (halfway between two
// blocks it is halfway between their colours), the bottle turns a little for
// each block, and the backdrop picks up a pale tint of the same colour. Click
// a swatch to go to that block. Renders only while something is moving.
// Under reduced motion the colour switches per block without blending.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (t) => t * t * (3 - 2 * t)

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#7f7f7f']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-6, 5, 6]} rotation-y={Math.PI / 4} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#ffffff" position={[7, 4, 4]} rotation-y={-Math.PI / 3} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
    </Environment>
  )
}

// An insulated bottle: a powder-coated body, a steel shoulder band and a cap
// with a carry loop. Only the body takes the colourway.
function Bottle({ bodyRef, groupRef }) {
  const geo = useMemo(() => {
    const prof = [
      [0, 0],
      [0.46, 0],
      [0.52, 0.04],
      [0.55, 0.14],
      [0.55, 2.3],
      [0.53, 2.48],
      [0.42, 2.66],
      [0.3, 2.78],
      [0.29, 2.8],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const body = new THREE.LatheGeometry(prof, 64)
    return {
      body,
      band: new THREE.CylinderGeometry(0.3, 0.3, 0.12, 48),
      cap: new THREE.CylinderGeometry(0.33, 0.31, 0.34, 48),
      capTop: new THREE.SphereGeometry(0.33, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      loop: new THREE.TorusGeometry(0.17, 0.045, 12, 32, Math.PI),
      base: new THREE.CylinderGeometry(0.47, 0.46, 0.05, 48),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return (
    <group ref={groupRef}>
      <mesh ref={bodyRef} geometry={geo.body} castShadow>
        <meshPhysicalMaterial color="#8fa58a" roughness={0.6} clearcoat={0.15} clearcoatRoughness={0.6} />
      </mesh>
      <mesh geometry={geo.base} position-y={0.025}>
        <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.3} />
      </mesh>
      <mesh geometry={geo.band} position-y={2.86}>
        <meshStandardMaterial color="#d6d9de" metalness={1} roughness={0.22} />
      </mesh>
      <mesh geometry={geo.cap} position-y={3.09} castShadow>
        <meshStandardMaterial color="#1d1d1f" roughness={0.6} />
      </mesh>
      <mesh geometry={geo.capTop} position-y={3.26} scale={[1, 0.18, 1]}>
        <meshStandardMaterial color="#1d1d1f" roughness={0.6} />
      </mesh>
      {/* the carry loop, rooted in the cap's top on both sides */}
      <mesh geometry={geo.loop} position-y={3.3}>
        <meshStandardMaterial color="#1d1d1f" roughness={0.5} />
      </mesh>
    </group>
  )
}

function Rig() {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const dist = Math.max(4.4 / 2 / tan, 2.6 / 2 / (tan * aspect)) * 1.05
    camera.position.set(0, 1.9 + dist * 0.12, dist)
    camera.lookAt(0, 1.6, 0)
    invalidate()
  }, [camera, size.width, size.height, invalidate])
  return null
}

// follows the scroll: blends the colour and turns the bottle
function Driver({ scroller, colors, bodyRef, groupRef, onState }) {
  const invalidate = useThree((s) => s.invalidate)
  const st = useRef({ target: 0, cur: 0, reduce: false })
  const cols = useMemo(() => colors.map((c) => new THREE.Color(c)), [colors])
  const tmp = useMemo(() => new THREE.Color(), [])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const read = () => {
      // which block is centred, as a fraction (block i is centred at f = i)
      const blocks = [...el.querySelectorAll('[data-block]')]
      const mid = el.scrollTop + el.clientHeight / 2
      let f = 0
      for (let i = 0; i < blocks.length - 1; i++) {
        const a = blocks[i].offsetTop + blocks[i].offsetHeight / 2
        const b = blocks[i + 1].offsetTop + blocks[i + 1].offsetHeight / 2
        if (mid >= a) f = i + clamp((mid - a) / (b - a), 0, 1)
      }
      st.current.target = f
      st.current.reduce = !!mq?.matches
      invalidate()
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      el.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [scroller, invalidate, colors])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    if (s.reduce) s.cur = s.target
    else s.cur = THREE.MathUtils.damp(s.cur, s.target, 7, dt)
    if (Math.abs(s.cur - s.target) < 1e-4) s.cur = s.target
    else invalidate()
    const n = cols.length
    const f = clamp(s.cur, 0, n - 1)
    const i = Math.floor(f)
    const j = Math.min(n - 1, i + 1)
    const t = s.reduce ? Math.round(f - i) : smooth(f - i)
    tmp.copy(cols[i]).lerp(cols[j], t)
    if (bodyRef.current) bodyRef.current.material.color.copy(tmp)
    // a fifth of a turn per block, so each colourway shows a fresh side
    if (groupRef.current) groupRef.current.rotation.y = -0.35 + f * ((Math.PI * 2) / 5)
    onState(f, tmp.getStyle())
  })
  return null
}

const DEFAULT_COLORS = '#8fa58a, #c4704f, #2f3b52, #e2b33c, #e8e3d8'
const DEFAULT_NAMES = 'Sage, Clay, Ink, Sun, Chalk'

// colors, names: the colourways, comma-separated, one per block. background:
// the page behind (tinted towards each colour by `tint`). ink: the text.
export default function StickyColor({ colors = DEFAULT_COLORS, names = DEFAULT_NAMES, background = '#f4f1ea', ink = '#1c1a16', tint = 0.22, style }) {
  const list = useMemo(() => colors.split(',').map((s) => s.trim()).filter(Boolean), [colors])
  const labels = useMemo(() => names.split(',').map((s) => s.trim()), [names])
  const scroller = useRef(null)
  const bodyRef = useRef()
  const groupRef = useRef()
  const [view, setView] = useState({ f: 0, color: list[0] })
  const last = useRef({ f: -1, color: '' })
  const onState = (f, color) => {
    if (Math.abs(f - last.current.f) < 0.004 && color === last.current.color) return
    last.current = { f, color }
    setView({ f, color })
  }
  const bg = useMemo(() => new THREE.Color(background).lerp(new THREE.Color(view.color), tint).getStyle(), [background, view.color, tint])
  const active = Math.round(view.f)
  const goTo = (i) => {
    const el = scroller.current
    const b = el?.querySelectorAll('[data-block]')[i]
    if (!b) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: b.offsetTop + b.offsetHeight / 2 - el.clientHeight / 2, behavior: reduce ? 'auto' : 'smooth' })
  }

  const copy = [
    'Double-walled steel keeps coffee hot through the morning and water cold through the afternoon.',
    'A powder coat that grips in a wet hand and shrugs off the scuffs of a daily bag.',
    'The cap seals with a quarter turn and the loop takes a finger, a clip or a carabiner.',
    'Narrow enough for a car cup holder, wide enough for ice cubes to go straight in.',
    'Every colour is mixed to sit quietly on a desk and still be found at the bottom of a bag.',
  ]

  return (
    <div className="stc" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: bg, transition: 'background-color 120ms linear', ...style }}>
      <style>{`
        .stc-scroll { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: thin; z-index: 2; outline: none; container-type: size; }
        .stc-scroll:focus-visible { box-shadow: inset 0 0 0 2px ${ink}; }
        .stc-col { width: min(44%, 420px); padding: 0 0 0 clamp(18px, 4vw, 48px); }
        .stc-block { height: 72cqh; display: flex; flex-direction: column; justify-content: center; }
        .stc-block:first-child { margin-top: 14cqh; }
        .stc-block:last-child { margin-bottom: 14cqh; }
        .stc-k { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .16em; text-transform: uppercase; opacity: .6; }
        .stc-h { font: 400 clamp(30px, 4.4vw, 52px)/1 Georgia, 'Times New Roman', serif; margin: 12px 0 14px; transition: opacity 300ms; }
        .stc-p { font: 400 14px/1.55 system-ui, sans-serif; max-width: 32ch; opacity: .78; }
        .stc-block[data-on='false'] .stc-h, .stc-block[data-on='false'] .stc-p { opacity: .28; }
        .stc-sw { position: absolute; right: 18px; bottom: 16px; z-index: 3; display: flex; gap: 8px; }
        .stc-sw button { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,.9); cursor: pointer; padding: 0; box-shadow: 0 1px 4px rgba(0,0,0,.2); transition: transform 200ms; }
        .stc-sw button[aria-current='true'] { transform: scale(1.3); }
        .stc-sw button:focus-visible { outline: 2px solid ${ink}; outline-offset: 2px; }
        @media (max-width: 560px) { .stc-col { width: 58%; } }
      `}</style>

      {/* the pinned stage, on the right */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '58%', zIndex: 1 }}>
        <Canvas frameloop="demand" shadows dpr={[1, 1.75]} camera={{ position: [0, 2.4, 11], fov: 30, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}>
          <hemisphereLight args={['#ffffff', '#8f8f8f', 0.5]} />
          <directionalLight position={[-3, 6, 4]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
          <Studio />
          <Bottle bodyRef={bodyRef} groupRef={groupRef} />
          <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={5} blur={2.4} far={2} />
          <Rig />
          <Driver scroller={scroller} colors={list} bodyRef={bodyRef} groupRef={groupRef} onState={onState} />
        </Canvas>
      </div>

      {/* the copy, scrolling past */}
      <div ref={scroller} className="stc-scroll" tabIndex={0} aria-label="Colourways" style={{ color: ink }}>
        <div className="stc-col">
          {list.map((c, i) => (
            <section key={i} data-block="" data-on={i === active} className="stc-block">
              <span className="stc-k">
                {String(i + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
              </span>
              <h3 className="stc-h">{labels[i] || `Colour ${i + 1}`}</h3>
              <p className="stc-p">{copy[i % copy.length]}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="stc-sw" role="group" aria-label="Go to colourway">
        {list.map((c, i) => (
          <button key={i} aria-label={labels[i] || `Colour ${i + 1}`} aria-current={i === active} style={{ background: c }} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  )
}
