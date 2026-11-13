import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

// Scroll to explode: a phone lying on the table separates into its six layers
// (back glass, battery, logic board, mid-frame, display, cover glass) as you
// scroll down the component's own scroll track, and reassembles as you scroll
// back. Each layer lifts along the stack axis by its index times `spacing`, so
// the gaps only ever grow and no two parts can touch at any progress. Labels
// fade in beside each layer once it is apart, and the camera eases back to keep
// the whole stack in frame. Focus it and use the arrow keys, PageUp/PageDown,
// Home and End. Under reduced motion the layers follow the scroll exactly.
// Renders on demand, so it idles at zero cost.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// Phone footprint (long side along X) and the gap kept between stacked layers.
const W = 3.0
const D = 1.48
const CLEAR = 0.004
// Layer thicknesses. The mid-frame also has side walls that hang down around
// the battery and board (outside their footprints) to close the phone's sides.
const T = { back: 0.087, battery: 0.112, board: 0.093, frame: 0.09, display: 0.037, glass: 0.03 }
const WALL = T.battery + T.board + CLEAR
const RIM = 0.06

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8a857d']} />
      <Lightformer form="rect" intensity={2.0} color="#ffffff" position={[-6, 7, 6]} rotation-y={Math.PI / 4} scale={[5, 9, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#e6eeff" position={[8, 5, 3]} rotation-y={-Math.PI / 3} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[14, 8, 1]} />
    </Environment>
  )
}

function roundRect(path, w, d, r) {
  const x = -w / 2
  const z = -d / 2
  const rr = Math.max(0.001, Math.min(r, w / 2, d / 2))
  path.moveTo(x + rr, z)
  path.lineTo(x + w - rr, z)
  path.quadraticCurveTo(x + w, z, x + w, z + rr)
  path.lineTo(x + w, z + d - rr)
  path.quadraticCurveTo(x + w, z + d, x + w - rr, z + d)
  path.lineTo(x + rr, z + d)
  path.quadraticCurveTo(x, z + d, x, z + d - rr)
  path.lineTo(x, z + rr)
  path.quadraticCurveTo(x, z, x + rr, z)
  return path
}

// A rounded slab occupying exactly y in [0, t] (bevel included). Holes are
// circles [x, z, radius] or rounded rectangles { w, d, r } centred on the slab.
function slab(w, d, t, r, holes = []) {
  const b = Math.min(0.012, t / 4)
  const shape = roundRect(new THREE.Shape(), w - 2 * b, d - 2 * b, r)
  for (const h of holes) {
    if (Array.isArray(h)) {
      const p = new THREE.Path()
      p.absarc(h[0], h[1], h[2], 0, Math.PI * 2, true)
      shape.holes.push(p)
    } else {
      shape.holes.push(roundRect(new THREE.Path(), h.w, h.d, h.r))
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 12 })
  // shape plane XY -> XZ, extrusion -> +Y; then lift so the slab sits on y = 0
  g.rotateX(Math.PI / 2)
  g.computeBoundingBox()
  g.translate(0, -g.boundingBox.min.y, 0)
  return g
}

function useScreenTexture(accent) {
  const tex = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 512 })
    const g = c.getContext('2d')
    const grd = g.createLinearGradient(0, 0, 1024, 512)
    grd.addColorStop(0, '#1b1f2e')
    grd.addColorStop(0.55, '#3a2a4a')
    grd.addColorStop(1, accent)
    g.fillStyle = grd
    g.fillRect(0, 0, 1024, 512)
    const r = g.createRadialGradient(760, 180, 10, 760, 180, 360)
    r.addColorStop(0, 'rgba(255,240,220,.55)')
    r.addColorStop(1, 'rgba(255,240,220,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 1024, 512)
    g.fillStyle = 'rgba(255,255,255,.92)'
    g.font = '300 120px system-ui, -apple-system, "Segoe UI", sans-serif'
    g.fillText('9:41', 70, 190)
    g.font = '500 28px ui-monospace, Menlo, monospace'
    g.fillStyle = 'rgba(255,255,255,.6)'
    g.fillText('THURSDAY 12', 76, 250)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [accent])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

// The six layers, bottom to top. Every child of a layer stays inside y in
// [0, t], which is what keeps the exploded stack free of intersections.
function useLayers(bodyColor, frameColor, accent) {
  const geos = useMemo(() => ({
    back: slab(W, D, T.back - 0.002, 0.24),
    battery: slab(1.56, 1.04, T.battery - 0.002, 0.06),
    board: slab(1.05, 1.22, 0.024, 0.05),
    frame: slab(W, D, T.frame - 0.005, 0.24, [[-1.18, -0.38, 0.17], [-1.18, 0.0, 0.17]]),
    display: slab(W - 0.04, D - 0.04, T.display - 0.002, 0.22),
    wall: slab(W, D, WALL, 0.24, [{ w: W - 2 * RIM, d: D - 2 * RIM, r: 0.12 }]),
    glass: slab(W, D, T.glass, 0.24),
  }), [])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])
  const screen = useScreenTexture(accent)

  return useMemo(() => [
    {
      name: 'Back glass', sub: 'Matte glass · charging coil', t: T.back,
      node: (
        <>
          <mesh geometry={geos.back} castShadow>
            <meshPhysicalMaterial color={bodyColor} roughness={0.42} clearcoat={0.6} clearcoatRoughness={0.4} />
          </mesh>
          <mesh position={[0.25, 0.0855, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.3, 0.42, 64]} />
            <meshStandardMaterial color="#b8733f" metalness={1} roughness={0.35} />
          </mesh>
        </>
      ),
    },
    {
      name: 'Battery', sub: '4,400 mAh · stacked cell', t: T.battery,
      node: (
        <group position={[0.58, 0, 0]}>
          <mesh geometry={geos.battery} castShadow>
            <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.1105, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.1, 0.5]} />
            <meshStandardMaterial color="#f1ede4" roughness={0.8} />
          </mesh>
          <mesh position={[-0.42, 0.111, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.16, 0.5]} />
            <meshStandardMaterial color={accent} roughness={0.7} />
          </mesh>
        </group>
      ),
    },
    {
      name: 'Logic board', sub: 'SoC · memory · cameras', t: T.board,
      node: (
        <group position={[-0.88, 0, 0]}>
          <mesh geometry={geos.board} castShadow>
            <meshStandardMaterial color="#1f3b2f" roughness={0.6} />
          </mesh>
          <mesh position={[0.08, 0.024 + 0.02, 0.22]}>
            <boxGeometry args={[0.36, 0.04, 0.36]} />
            <meshStandardMaterial color="#1a1b1e" metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh position={[0.08, 0.065, 0.22]}>
            <boxGeometry args={[0.22, 0.002, 0.22]} />
            <meshStandardMaterial color="#9aa0a8" metalness={1} roughness={0.25} />
          </mesh>
          <mesh position={[0.38, 0.024 + 0.0125, 0.36]}>
            <boxGeometry args={[0.2, 0.025, 0.28]} />
            <meshStandardMaterial color="#26282c" roughness={0.5} />
          </mesh>
          <mesh position={[0.1, 0.024 + 0.0125, -0.38]}>
            <boxGeometry args={[0.32, 0.025, 0.18]} />
            <meshStandardMaterial color="#26282c" roughness={0.5} />
          </mesh>
          {/* camera modules */}
          {[-0.38, 0.0].map((zz) => (
            <group key={zz} position={[-0.3, 0, zz]}>
              <mesh position={[0, 0.024 + 0.033, 0]}>
                <boxGeometry args={[0.3, 0.066, 0.3]} />
                <meshStandardMaterial color="#2a2c31" metalness={0.5} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.0905, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 0.002, 32]} />
                <meshStandardMaterial color="#9aa0a8" metalness={1} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      ),
    },
    {
      name: 'Mid-frame', sub: 'Aluminium chassis', t: T.frame,
      node: (
        <>
          <mesh geometry={geos.frame} castShadow>
            <meshStandardMaterial color={frameColor} metalness={1} roughness={0.32} />
          </mesh>
          {/* side walls hang below the plate, around (never over) the battery
              and board footprints, and stop CLEAR above the back glass */}
          <mesh geometry={geos.wall} position={[0, -WALL, 0]} castShadow>
            <meshStandardMaterial color={frameColor} metalness={1} roughness={0.32} />
          </mesh>
          {/* side buttons on the outside of the walls */}
          <mesh position={[-0.55, -WALL / 2, D / 2 + 0.012]}>
            <boxGeometry args={[0.34, 0.06, 0.026]} />
            <meshStandardMaterial color={frameColor} metalness={1} roughness={0.25} />
          </mesh>
          <mesh position={[0.1, -WALL / 2, D / 2 + 0.012]}>
            <boxGeometry args={[0.22, 0.06, 0.026]} />
            <meshStandardMaterial color={frameColor} metalness={1} roughness={0.25} />
          </mesh>
          <mesh position={[-0.5, -WALL / 2, -D / 2 - 0.012]}>
            <boxGeometry args={[0.5, 0.035, 0.026]} />
            <meshStandardMaterial color={frameColor} metalness={1} roughness={0.25} />
          </mesh>
        </>
      ),
    },
    {
      name: 'Display', sub: '6.1" OLED · 120 Hz', t: T.display,
      node: (
        <>
          <mesh geometry={geos.display} castShadow>
            <meshStandardMaterial color="#0c0d10" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.0355, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[W - 0.2, D - 0.18]} />
            <meshBasicMaterial map={screen} toneMapped={false} />
          </mesh>
        </>
      ),
    },
    {
      name: 'Cover glass', sub: 'Ceramic-hardened', t: T.glass,
      node: (
        <mesh geometry={geos.glass}>
          <meshPhysicalMaterial color="#ffffff" roughness={0.04} metalness={0} clearcoat={1} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ),
    },
  ], [geos, screen, bodyColor, frameColor, accent])
}

function Driver({ scroller, parts, labels, spacing, smoothing, onProgress }) {
  const invalidate = useThree((s) => s.invalidate)
  const st = useRef({ target: 0, cur: 0, reduce: false })
  const tmp = useMemo(() => new THREE.Vector3(), [])

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
  }, [spacing, smoothing, invalidate])

  useFrame((state, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    if (s.reduce || smoothing <= 0) s.cur = s.target
    else s.cur = THREE.MathUtils.damp(s.cur, s.target, smoothing, dt)
    if (Math.abs(s.cur - s.target) < 2e-4) s.cur = s.target
    else invalidate()

    // explode over most of the track, holding fully apart near the end
    const e = smooth(0.06, 0.86, s.cur)
    const gap = Math.max(0, spacing) * e
    // the mid-frame's walls hang down around the battery and board, so from
    // the frame up everything also rises by the wall depth: exploded, the board
    // comes right out from under the walls instead of staying boxed in
    const clearWalls = WALL * e
    let base = 0
    let lift = 0
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (p.name === 'Mid-frame') lift = clearWalls
      const g = p.ref.current
      if (g) g.position.y = base + i * gap + lift
      const lbl = labels.current[i]
      if (lbl) {
        const a = smooth(0.3 + i * 0.05, 0.62 + i * 0.05, e)
        lbl.style.opacity = a.toFixed(3)
        lbl.style.transform = `translate3d(${((1 - a) * -10).toFixed(2)}px, -50%, 0)`
      }
      base += p.t + CLEAR
    }

    // keep the stack framed: fit its current height and footprint
    const H = base + (parts.length - 1) * gap + lift
    const { camera, size } = state
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const elev = 0.32
    const vert = H * Math.cos(elev) + D * Math.sin(elev) + 0.5
    const horiz = W + 2.4
    const dist = Math.max(vert / 2 / tan, horiz / 2 / (tan * aspect)) * 1.08
    const ty = H * 0.5
    tmp.set(0.55, ty, 0)
    camera.position.set(tmp.x - Math.sin(0.35) * Math.cos(elev) * dist, ty + Math.sin(elev) * dist, Math.cos(0.35) * Math.cos(elev) * dist)
    camera.lookAt(tmp)
    onProgress(s.cur, e)
  })
  return null
}

export default function ScrollExplodeScene({
  spacing = 0.8,
  smoothing = 6,
  length = 3,
  labels = true,
  bodyColor = '#2b2d31',
  frameColor = '#b9bcc2',
  accent = '#ff4d1a',
  background = '#d9d4cb',
}) {
  const scroller = useRef(null)
  const bar = useRef(null)
  const pct = useRef(null)
  const state = useRef(null)
  const labelEls = useRef([])
  const lastPct = useRef(-1)
  const refs = useRef(Array.from({ length: 6 }, () => ({ current: null })))

  const onProgress = (p, e) => {
    if (bar.current) bar.current.style.transform = `scaleY(${p.toFixed(4)})`
    const v = Math.round(e * 100)
    if (v !== lastPct.current) {
      lastPct.current = v
      if (pct.current) pct.current.textContent = `${v}%`
      if (state.current) state.current.textContent = v === 0 ? 'Assembled' : v === 100 ? 'Exploded' : 'Separating'
    }
  }

  const key = (e) => {
    const el = scroller.current
    const h = el.clientHeight
    const max = el.scrollHeight - h
    const map = { ArrowDown: h * 0.25, ArrowUp: -h * 0.25, PageDown: h * 0.9, PageUp: -h * 0.9, ' ': e.shiftKey ? -h * 0.9 : h * 0.9 }
    let top = null
    if (e.key in map) top = el.scrollTop + map[e.key]
    else if (e.key === 'Home') top = 0
    else if (e.key === 'End') top = max
    if (top == null) return
    e.preventDefault()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: clamp(top, 0, max), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="sxp" style={{ '--sxp-accent': accent, background }}>
      <style>{`
        .sxp { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .sxp-canvas { position: absolute; inset: 0; }
        .sxp-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; outline: none; scrollbar-width: none; z-index: 1; }
        .sxp-scroll::-webkit-scrollbar { display: none; }
        .sxp-scroll:focus-visible { box-shadow: inset 0 0 0 3px var(--sxp-accent); }
        .sxp-label { display: flex; align-items: center; gap: 8px; white-space: nowrap; pointer-events: none; user-select: none; opacity: 0; transform: translate3d(-10px, -50%, 0); }
        .sxp-label i { display: block; width: 26px; height: 1px; background: rgba(28,26,22,.45); }
        .sxp-label i::before { content: ''; display: block; width: 5px; height: 5px; margin: -2px 0 0 -2px; border-radius: 50%; background: var(--sxp-accent); }
        .sxp-label b { display: block; font: 600 10px/1.2 ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; color: #1c1a16; }
        .sxp-label span { display: block; font: 400 11px/1.3 Georgia, 'Times New Roman', serif; color: #5d574e; }
        .sxp-rail { position: absolute; right: 22px; top: 18%; bottom: 18%; width: 2px; background: rgba(28,26,22,.14); border-radius: 2px; pointer-events: none; z-index: 2; }
        .sxp-fill { position: absolute; inset: 0; background: var(--sxp-accent); transform-origin: 50% 0; transform: scaleY(0); border-radius: 2px; }
        .sxp-read { position: absolute; left: 20px; top: 16px; pointer-events: none; z-index: 2; font: 500 10px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: #6f685e; }
        .sxp-read b { display: block; margin-top: 8px; font: 400 34px/1 Georgia, 'Times New Roman', serif; letter-spacing: 0; color: #1c1a16; font-variant-numeric: tabular-nums; }
        .sxp-cap { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; pointer-events: none; z-index: 2; font: 500 11px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .06em; color: #4f4a43; }
        @media (prefers-reduced-motion: reduce) { .sxp-label { transform: translate3d(0, -50%, 0) !important; } }
      `}</style>
      <div className="sxp-canvas">
        <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ position: [-3, 5, 10], fov: 30, near: 0.1, far: 200 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
          <color attach="background" args={[background]} />
          <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
          <directionalLight position={[-4, 10, 6]} intensity={0.9} />
          <Studio />
          <Stack refs={refs.current} labelEls={labelEls} showLabels={labels} bodyColor={bodyColor} frameColor={frameColor} accent={accent} spacing={spacing} smoothing={smoothing} scroller={scroller} onProgress={onProgress} />
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={8} blur={2.2} far={1.2} resolution={512} color="#2a2420" />
        </Canvas>
      </div>
      <div ref={scroller} className="sxp-scroll" tabIndex={0} role="region" aria-label="Exploded view. Scroll down, or use the arrow keys, to take the phone apart; scroll back to reassemble it." onKeyDown={key}>
        <div style={{ height: `${(Math.max(1, length) + 1) * 100}%` }} />
      </div>
      <div className="sxp-read" aria-hidden="true">
        <span ref={state}>Assembled</span>
        <b ref={pct}>0%</b>
      </div>
      <div className="sxp-rail" aria-hidden="true"><span ref={bar} className="sxp-fill" /></div>
      <InfoHint>Scroll down to take it apart · scroll up to put it back</InfoHint>
    </div>
  )
}

function Stack({ refs, labelEls, showLabels, bodyColor, frameColor, accent, spacing, smoothing, scroller, onProgress }) {
  const layers = useLayers(bodyColor, frameColor, accent)
  const parts = layers.map((l, i) => ({ ref: refs[i], t: l.t }))
  return (
    <group>
      {layers.map((l, i) => (
        <group key={l.name} ref={refs[i]}>
          {l.node}
          {showLabels && (
            <Html position={[W / 2 + 0.08, l.t / 2, 0]} zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
              <div ref={(d) => (labelEls.current[i] = d)} className="sxp-label">
                <i />
                <div>
                  <b>{l.name}</b>
                  <span>{l.sub}</span>
                </div>
              </div>
            </Html>
          )}
        </group>
      ))}
      <Driver scroller={scroller} parts={parts} labels={labelEls} spacing={spacing} smoothing={smoothing} onProgress={onProgress} />
    </group>
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
