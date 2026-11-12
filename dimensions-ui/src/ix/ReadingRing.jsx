import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

// Reading progress as a 3D ring: an article scrolls in the component's own
// scroll area while a glossy ring in the corner fills, arc by arc, with how
// far through it you are, with the percentage and the minutes left in its
// middle. The ring leans towards the pointer. When you reach the end it pops
// and changes to the done colour. Click it (or press Enter on it) to jump to
// the next section. Renders only while something is moving.

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const ARTICLE = [
  ['Depth is information', 'A flat interface asks you to read every label to know what is what. Give the same parts a little depth and the eye sorts them before you think: what is raised can be pressed, what is sunk holds something, what casts a shadow sits above what it falls on. Depth is not decoration. It is a cheap, fast way to say how things relate.', 'The trick is restraint. A single, consistent light, a few heights that mean something, and shadows that agree with each other do more than any amount of gloss. When every element has its own idea of where the light is, depth stops being information and becomes noise.'],
  ['Make it move like it weighs something', 'Motion is depth over time. A card that eases out of the way, a drawer that overshoots a hair and settles, a knob that resists at its stops: each one tells you what the object is made of. Springs and friction are the vocabulary. Linear tweens are the robot voice.', 'Weight also sets expectations. A heavy thing should take a moment to get going and a moment to stop. A light thing should flutter. Get that backwards and people feel it even when they cannot say what is wrong.'],
  ['Let people touch it', 'The best test of a physical-feeling interface is whether you want to poke it. If a ladder looks like it would slide, people will want to push its foot out and see. Give them the handle. Let the drag do what the drag implies, and let the physics answer honestly.', 'Honest answers matter. If the ladder holds at an angle where a real one would slip, the spell breaks. Check the maths, then check it again with your hands.'],
  ['Keep the camera calm', 'Three-dimensional scenes tempt you to fly the camera around. Resist it. A steady three-quarter view that frames the whole object, with a gentle orbit when asked for, keeps people oriented. Move the object, not the world.', 'When the camera must move, ease it, and keep the thing being looked at in the same part of the frame. People track one point; give them one.'],
  ['Respect the reader', 'Not everyone wants motion. Honour reduced-motion settings by jumping to end states instead of animating to them. Keep everything usable from the keyboard, with a focus ring you can actually see. Make the sound optional and off by default.', 'And measure the cost. A scene that idles at full frame rate drains batteries for nothing. Render on demand, and stop the loop when nothing is moving.'],
  ['Finish the edges', 'The difference between a demo and a product is in the edges: the cable that actually reaches the socket, the shade that is joined to its arm, the button that sits in its hole. Nobody notices them when they are right. Everybody notices when they are not.', 'So walk around the model. Look underneath. Pull it past its limits. Then fix what you find, and look again.'],
]

function Studio() {
  return (
    <Environment resolution={128}>
      <color attach="background" args={['#77746e']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[-4, 4, 5]} scale={[4, 6, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[5, -2, 4]} scale={[3, 5, 1]} />
    </Environment>
  )
}

function Ring({ progress, accent, track, done }) {
  const invalidate = useThree((s) => s.invalidate)
  const group = useRef()
  const fill = useRef()
  const cap = useRef()
  const st = useRef({ cur: 0, pop: 0, lean: [0, 0], wasDone: false })
  const R = 1
  const T = 0.17
  const trackGeo = useMemo(() => new THREE.TorusGeometry(R, T * 0.55, 16, 96), [])
  const capGeo = useMemo(() => new THREE.SphereGeometry(T, 20, 12), [])
  const fillMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }), [accent])
  const trackMat = useMemo(() => new THREE.MeshStandardMaterial({ color: track, roughness: 0.7 }), [track])
  useEffect(() => () => (trackGeo.dispose(), capGeo.dispose(), fillMat.dispose(), trackMat.dispose()), [trackGeo, capGeo, fillMat, trackMat])
  useEffect(() => invalidate(), [progress, invalidate])

  // lean towards the pointer
  useEffect(() => {
    const move = (e) => {
      st.current.lean = [clamp((e.clientX / window.innerWidth - 0.5) * 2, -1, 1), clamp((e.clientY / window.innerHeight - 0.5) * 2, -1, 1)]
      invalidate()
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [invalidate])

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const prev = s.cur
    s.cur = reduce ? progress : THREE.MathUtils.damp(s.cur, progress, 9, dt)
    if (Math.abs(s.cur - progress) < 1e-4) s.cur = progress
    let moving = s.cur !== progress
    // rebuild the filled arc when it changes (it starts at 12 o'clock and runs clockwise)
    if (fill.current && (Math.abs(prev - s.cur) > 1e-5 || !fill.current.geometry.userData.ok)) {
      const arc = Math.max(0.0005, s.cur * TAU)
      fill.current.geometry.dispose()
      fill.current.geometry = new THREE.TorusGeometry(R, T, 18, Math.max(3, Math.round(arc * 20)), arc)
      fill.current.geometry.userData.ok = true
    }
    if (cap.current) {
      // a round cap on the leading end of the arc
      const a = Math.PI / 2 - s.cur * TAU
      cap.current.position.set(Math.cos(a) * R, Math.sin(a) * R, 0)
      cap.current.visible = s.cur > 0.003
    }
    // finishing: a pop and the done colour
    const isDone = progress >= 0.999
    if (isDone && !s.wasDone && !reduce) s.pop = 1
    s.wasDone = isDone
    s.pop = Math.max(0, s.pop - dt * 2.2)
    if (s.pop > 0) moving = true
    fillMat.color.set(isDone ? done : accent)
    const g = group.current
    if (g) {
      const k = 1 + Math.sin(s.pop * Math.PI) * 0.16
      g.scale.setScalar(k)
      const tx = reduce ? 0 : s.lean[1] * 0.35
      const ty = reduce ? 0 : s.lean[0] * 0.45
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, tx, 6, dt)
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ty, 6, dt)
      if (Math.abs(g.rotation.x - tx) > 1e-3 || Math.abs(g.rotation.y - ty) > 1e-3) moving = true
    }
    if (moving) invalidate()
  })

  return (
    <group ref={group}>
      <mesh geometry={trackGeo} material={trackMat} />
      {/* the fill: rotated so it begins at the top and runs clockwise */}
      <group rotation={[0, Math.PI, Math.PI / 2]}>
        <mesh ref={fill} material={fillMat}>
          <torusGeometry args={[R, T, 18, 3, 0.0005]} />
        </mesh>
      </group>
      <mesh ref={cap} geometry={capGeo} material={fillMat} />
      {/* a small cap at the start, so the arc's beginning is round too */}
      <mesh geometry={capGeo} material={fillMat} position={[0, R, 0]} visible={progress > 0.003} />
    </group>
  )
}

// accent, track, done: the ring's colours. background, ink: the page.
// wpm: reading speed for the minutes-left estimate. ringSize: in pixels.
export default function ReadingRing({ accent = '#ff4d1a', track = '#d9d3c7', done = '#2f9e62', background = '#f4f1ea', ink = '#1c1a16', wpm = 230, ringSize = 112, style }) {
  const scroller = useRef(null)
  const [p, setP] = useState(0)
  const words = useMemo(() => ARTICLE.reduce((n, s) => n + s.join(' ').split(/\s+/).length, 0), [])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const read = () => {
      const max = el.scrollHeight - el.clientHeight
      setP(max > 0 ? clamp(el.scrollTop / max, 0, 1) : 1)
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      el.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [])
  const minsLeft = Math.ceil(((1 - p) * words) / Math.max(60, wpm))
  const nextSection = () => {
    const el = scroller.current
    const heads = [...el.querySelectorAll('h3')]
    const next = heads.find((h) => h.offsetTop > el.scrollTop + 8) ?? null
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: next ? next.offsetTop - 18 : 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="rdr" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, color: ink, ...style }}>
      <style>{`
        .rdr-scroll { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: thin; outline: none; }
        .rdr-scroll:focus-visible { box-shadow: inset 0 0 0 2px ${accent}; }
        .rdr-art { max-width: 62ch; padding: 34px clamp(18px, 5vw, 56px) 60px; padding-right: calc(${ringSize}px + 40px); }
        .rdr-art h2 { font: 400 clamp(28px, 4vw, 42px)/1.05 Georgia, 'Times New Roman', serif; margin: 0 0 6px; }
        .rdr-art .k { font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .16em; text-transform: uppercase; opacity: .55; }
        .rdr-art h3 { font: 600 17px/1.3 system-ui, sans-serif; margin: 30px 0 8px; }
        .rdr-art p { font: 400 15px/1.65 Georgia, 'Times New Roman', serif; margin: 0 0 12px; opacity: .85; }
        .rdr-ring { position: absolute; top: 14px; right: 18px; border: none; padding: 0; background: none; cursor: pointer; border-radius: 50%; }
        .rdr-ring:focus-visible { outline: 2px solid ${accent}; outline-offset: 4px; }
        .rdr-mid { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; color: ${ink}; }
        .rdr-mid b { font: 600 18px/1 ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
        .rdr-mid small { font: 500 9px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .08em; opacity: .65; margin-top: 3px; }
      `}</style>
      <div ref={scroller} className="rdr-scroll" tabIndex={0} aria-label="Article">
        <article className="rdr-art">
          <span className="k">Essay · {Math.round(words / Math.max(60, wpm))} min read</span>
          <h2>Interfaces with depth</h2>
          {ARTICLE.map(([h, ...ps]) => (
            <section key={h}>
              <h3>{h}</h3>
              {ps.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </section>
          ))}
        </article>
      </div>

      <button className="rdr-ring" style={{ width: ringSize, height: ringSize }} onClick={nextSection} aria-label={`${Math.round(p * 100)}% read. Go to the next section`}>
        <Canvas frameloop="demand" dpr={[1, 2]} orthographic camera={{ position: [0, 0, 10], zoom: ringSize / 2.9 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[-3, 4, 6]} intensity={1.2} />
          <Studio />
          <Ring progress={p} accent={accent} track={track} done={done} />
        </Canvas>
        <span className="rdr-mid" aria-hidden="true">
          <b>{Math.round(p * 100)}%</b>
          <small>{p >= 0.999 ? 'done' : `${minsLeft} min left`}</small>
        </span>
      </button>
    </div>
  )
}
