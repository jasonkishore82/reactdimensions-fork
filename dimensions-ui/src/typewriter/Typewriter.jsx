import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createTypewriterAudio } from './audio.js'

// A manual typewriter. Type on your real keyboard (or click the round keys):
// the key goes down, its typebar swings up out of the basket and strikes the
// platen through the ribbon, the letter is inked onto the paper and the
// carriage steps one letter to the left. A bell rings near the margin; Enter
// (or the chrome lever) throws the carriage back and feeds a new line.
// Backspace steps the carriage back, as on the real thing (no erasing).

// --- dimensions (1 unit is about an inch) ---
const BODY_W = 11
const PLATEN_Y = 3.4, PLATEN_Z = -1.6, PLATEN_R = 0.6
const STRIKE = new THREE.Vector3(0, PLATEN_Y, PLATEN_Z + PLATEN_R) // the printing point
const BASKET = new THREE.Vector3(0, 2.65, PLATEN_Z + PLATEN_R) // centre of the typebar arc, below the printing point
const PIVOT_R = 1.0
const BAR_L = STRIKE.distanceTo(BASKET.clone().add(new THREE.Vector3(PIVOT_R, 0, 0)))

// --- the sheet of paper ---
const PAPER_W = 6, PAPER_H = 8
const PX = 1024 / PAPER_W // canvas pixels per unit
const COLS = 42, MARGIN = 3, LINE_CHARS = 36, BELL_AT = 31
const CW = PAPER_W / COLS // one letter of carriage travel
const LH_PX = 46, TOP_PX = 300
const LINES = Math.floor((PAPER_H * PX - TOP_PX - 60) / LH_PX)
const PAPER_X = -(MARGIN + 0.5) * CW + PAPER_W / 2 // paper centre on the carriage

// --- keys: four staggered rows on the sloped front ---
const slope = (u) => ({ z: 4.3 - 3.8 * u, y: 0.55 + 1.8 * u })
const ROWS = [
  { u: 0.75, off: -0.35, keys: '1234567890-'.split('').map((c) => [c === '-' ? 'Minus' : `Digit${c}`, c, c]) },
  { u: 0.54, off: 0, keys: 'QWERTYUIOP'.split('').map((c) => [`Key${c}`, c, c.toLowerCase()]) },
  { u: 0.33, off: 0.25, keys: [...'ASDFGHJKL'.split('').map((c) => [`Key${c}`, c, c.toLowerCase()]), ['Semicolon', ';', ';']] },
  { u: 0.12, off: 0.5, keys: [...'ZXCVBNM'.split('').map((c) => [`Key${c}`, c, c.toLowerCase()]), ['Comma', ',', ','], ['Period', '.', '.'], ['Slash', '/', '/']] },
]
const SPACING = 0.84
function buildKeys() {
  const keys = []
  ROWS.forEach((row, r) => {
    const { z, y } = slope(row.u)
    const x0 = -((row.keys.length - 1) * SPACING) / 2 + row.off
    row.keys.forEach(([code, label, ch], i) => keys.push({ code, label, ch, x: x0 + i * SPACING, z, y, r: 0.3, kind: 'char', row: r }))
  })
  const num = keys.filter((k) => k.row === 0)
  const bottom = keys.filter((k) => k.row === 3)
  const s0 = slope(ROWS[0].u), s3 = slope(ROWS[3].u)
  keys.push({ code: 'Backspace', label: '←', ch: null, x: num[num.length - 1].x + SPACING, z: s0.z, y: s0.y, r: 0.3, kind: 'back' })
  keys.push({ code: 'ShiftLeft', label: 'SHIFT', ch: null, x: bottom[0].x - 1.0, z: s3.z, y: s3.y, r: 0.38, kind: 'shift' })
  keys.push({ code: 'ShiftRight', label: 'SHIFT', ch: null, x: bottom[bottom.length - 1].x + 1.0, z: s3.z, y: s3.y, r: 0.38, kind: 'shift' })
  return keys
}

// the body: a side profile (front slope, flat deck, raised back) extruded across
function bodyGeometry() {
  const pts = [[4.3, 0], [4.3, 0.55], [0.5, 2.35], [-0.95, 2.45], [-1.25, 2.8], [-4, 2.8], [-4, 0]]
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: BODY_W, bevelEnabled: true, bevelSize: 0.14, bevelThickness: 0.14, bevelSegments: 4, curveSegments: 4 })
  g.rotateY(Math.PI / 2)
  g.translate(-BODY_W / 2, 0, 0)
  g.computeVertexNormals()
  return g
}

function legendAtlas(labels) {
  const C = 128, COLS_A = 8
  const rows = Math.ceil(labels.length / COLS_A)
  const canvas = document.createElement('canvas')
  canvas.width = C * COLS_A
  canvas.height = C * rows
  const c = canvas.getContext('2d')
  c.fillStyle = '#fff'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const uv = new Map()
  labels.forEach((label, i) => {
    const cx = (i % COLS_A) * C + C / 2, cy = Math.floor(i / COLS_A) * C + C / 2
    c.font = label.length > 1 ? '700 30px "Helvetica Neue", Arial, sans-serif' : '700 68px Georgia, "Times New Roman", serif'
    c.fillText(label, cx, cy + 3)
    const u0 = (i % COLS_A) / COLS_A, vT = 1 - Math.floor(i / COLS_A) / rows
    uv.set(label, [u0, u0 + 1 / COLS_A, vT - 1 / rows, vT])
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { tex, uv }
}

function circleLegend(r, [u0, u1, vB, vT]) {
  const g = new THREE.CircleGeometry(r * 0.78, 32)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position, a = g.attributes.uv
  for (let i = 0; i < a.count; i++) {
    const s = 0.5 + p.getX(i) / (r * 1.56), t = 0.5 - p.getZ(i) / (r * 1.56)
    a.setXY(i, u0 + s * (u1 - u0), vB + t * (vT - vB))
  }
  return g
}

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
const easeOut = (t) => 1 - (1 - t) * (1 - t)

export default function Typewriter({
  bodyColor = '#1f3d33',
  keyColor = '#1b1b1b',
  legendColor = '#f4efe2',
  paperColor = '#f8f4ea',
  inkColor = '#1d1b26',
  ribbonColor = '#1a1a1a',
  sound = false,
  sheet = 0,
  onLine,
}) {
  const { controls } = useThree()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const keys = useMemo(buildKeys, [])
  const charKeys = useMemo(() => keys.filter((k) => k.kind === 'char'), [keys])
  const codeIndex = useMemo(() => new Map(keys.map((k, i) => [k.code, i])), [keys])

  // each character key drives one typebar; left keys use bars on the left of the arc
  const bars = useMemo(() => {
    const order = [...charKeys].sort((a, b) => a.x - b.x)
    return order.map((key, i) => {
      const th = THREE.MathUtils.degToRad(162 - (i / (order.length - 1)) * 144)
      const d = new THREE.Vector3(Math.cos(th), 0, Math.sin(th))
      const pivot = BASKET.clone().addScaledVector(d, PIVOT_R)
      const X = new THREE.Vector3(1, 0, 0)
      const rest = new THREE.Quaternion().setFromUnitVectors(X, new THREE.Vector3(d.x, -0.12, d.z).normalize())
      const hit = new THREE.Quaternion().setFromUnitVectors(X, STRIKE.clone().sub(pivot).normalize())
      return { code: key.code, pivot, rest, hit }
    })
  }, [charKeys])
  const barOf = useMemo(() => new Map(bars.map((b, i) => [b.code, i])), [bars])

  // --- geometry and materials ---
  const atlas = useMemo(() => legendAtlas([...new Set(keys.map((k) => k.label))]), [keys])
  const geo = useMemo(() => ({
    body: bodyGeometry(),
    keyTop: new THREE.CylinderGeometry(1, 1, 0.12, 40),
    keyRing: new THREE.TorusGeometry(1, 0.035, 10, 40).rotateX(Math.PI / 2),
    stalk: new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8),
    legends: keys.map((k) => circleLegend(k.r, atlas.uv.get(k.label))),
    bar: new THREE.BoxGeometry(BAR_L, 0.035, 0.07).translate(BAR_L / 2, 0, 0),
    slug: new THREE.BoxGeometry(0.1, 0.16, 0.1).translate(BAR_L, 0.02, 0),
    segment: new THREE.TorusGeometry(PIVOT_R, 0.07, 10, 48, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI),
    pad: new THREE.RingGeometry(PIVOT_R + BAR_L * 0.86, PIVOT_R + BAR_L * 1.05, 48, 1, 0, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI),
    platen: new THREE.CylinderGeometry(PLATEN_R, PLATEN_R, 7, 40).rotateZ(Math.PI / 2),
    knob: new THREE.CylinderGeometry(0.5, 0.5, 0.42, 32).rotateZ(Math.PI / 2),
    knobCap: new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32).rotateZ(Math.PI / 2),
    rod: new THREE.CylinderGeometry(0.04, 0.04, 1, 12).rotateZ(Math.PI / 2),
    roller: new THREE.CylinderGeometry(0.1, 0.1, 0.4, 16).rotateZ(Math.PI / 2),
    table: new THREE.BoxGeometry(7.2, 0.06, 1.8),
    rail: new THREE.BoxGeometry(BODY_W + 1, 0.12, 0.35),
    spool: new THREE.CylinderGeometry(0.55, 0.55, 0.22, 32),
    spoolHub: new THREE.CylinderGeometry(0.16, 0.16, 0.32, 16),
    ribbon: new THREE.BoxGeometry(1, 0.16, 0.012),
    lever: new THREE.CylinderGeometry(0.05, 0.05, 1.7, 12).translate(0, 0.85, 0),
    leverTip: new THREE.SphereGeometry(0.12, 16, 12),
    space: new THREE.BoxGeometry(5.4, 0.14, 0.32),
    spaceArm: new THREE.BoxGeometry(0.08, 0.08, 0.7),
    paper: new THREE.PlaneGeometry(PAPER_W, PAPER_H),
    wrap: new THREE.CylinderGeometry(PLATEN_R + 0.012, PLATEN_R + 0.012, PAPER_W, 32, 1, true, Math.PI * 0.5, Math.PI * 0.75).rotateZ(Math.PI / 2),
  }), [keys, atlas])
  const clip = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PLATEN_Y + PLATEN_R - 0.02))], [])
  const mats = useMemo(() => ({
    body: new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.1, clearcoat: 0.9, clearcoatRoughness: 0.18 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e6e8ec', metalness: 1, roughness: 0.16 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9a9ea6', metalness: 0.9, roughness: 0.35 }),
    key: new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    legend: new THREE.MeshBasicMaterial({ map: atlas.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.75 }),
    felt: new THREE.MeshStandardMaterial({ color: '#2a1f1c', roughness: 1, side: THREE.DoubleSide }),
    ribbon: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    ribbonRed: new THREE.MeshStandardMaterial({ color: '#a3201f', roughness: 0.8 }),
    paper: new THREE.MeshStandardMaterial({ roughness: 0.92, side: THREE.DoubleSide, clippingPlanes: null }),
    paperWrap: new THREE.MeshStandardMaterial({ roughness: 0.92 }),
  }), [atlas])
  useEffect(() => {
    mats.body.color.set(bodyColor); mats.key.color.set(keyColor); mats.legend.color.set(legendColor)
    mats.paper.color.set(paperColor); mats.paperWrap.color.set(paperColor); mats.ribbon.color.set(ribbonColor)
  }, [mats, bodyColor, keyColor, legendColor, paperColor, ribbonColor])
  useEffect(() => () => {
    for (const g of Object.values(geo)) (Array.isArray(g) ? g : [g]).forEach((x) => x.dispose())
    Object.values(mats).forEach((m) => m.dispose())
    atlas.tex.dispose()
  }, [geo, mats, atlas])

  // --- the paper: a canvas the slugs ink letters onto ---
  const paper = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(PAPER_W * PX)
    canvas.height = Math.round(PAPER_H * PX)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return { canvas, ctx: canvas.getContext('2d'), tex }
  }, [])
  useEffect(() => { mats.paper.map = paper.tex; mats.paper.clippingPlanes = clip; mats.paper.needsUpdate = true }, [mats, paper, clip])
  useEffect(() => () => paper.tex.dispose(), [paper])
  const { gl } = useThree()
  useEffect(() => { gl.localClippingEnabled = true }, [gl])

  const st = useRef({ col: 0, line: 0, lines: [''], carr: 0, carrV: 0, paperY: 0, platenRot: 0, strikes: [], keyDown: new Float32Array(keys.length + 1), held: new Uint8Array(keys.length), lever: 0, ribbon: 0, shiftLock: false })
  const blank = () => {
    const { ctx, canvas, tex } = paper
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // faint laid texture so the sheet reads as paper
    ctx.fillStyle = 'rgba(120,100,70,0.03)'
    for (let y = 0; y < canvas.height; y += 6) ctx.fillRect(0, y, canvas.width, 1)
    tex.needsUpdate = true
    Object.assign(st.current, { col: 0, line: 0, lines: [''] })
  }
  useEffect(blank, [paper, sheet])

  const ink = (ch) => {
    const s = st.current
    const { ctx, tex } = paper
    const x = (MARGIN + s.col) * CW * PX + (CW * PX) / 2
    const y = TOP_PX + s.line * LH_PX + 34
    ctx.save()
    ctx.translate(x + (Math.random() - 0.5) * 1.2, y + (Math.random() - 0.5) * 1.4)
    ctx.font = '600 40px "Courier New", Courier, "Nimbus Mono PS", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 0.72 + Math.random() * 0.28 // uneven ribbon ink
    ctx.fillStyle = inkColor
    ctx.fillText(ch, 0, 0)
    ctx.restore()
    tex.needsUpdate = true
  }

  const audio = useRef(null)
  const live = useRef({ sound, onLine, ink })
  live.current = { sound, onLine, ink }
  useEffect(() => { if (!sound) { audio.current?.dispose(); audio.current = null } }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const sfx = (name) => {
    if (!live.current.sound) return
    if (!audio.current) audio.current = createTypewriterAudio()
    audio.current?.[name]()
  }

  const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  // --- actions ---
  const typeChar = (ch, code) => {
    const s = st.current
    if (s.col >= LINE_CHARS) { sfx('bell'); return } // margin lock
    const bi = barOf.has(code) ? barOf.get(code) : Math.abs([...ch].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % bars.length
    s.strikes.push({ bar: bi, t: 0, ch, done: false })
    const ki = codeIndex.get(code)
    if (ki !== undefined) s.keyDown[ki] = 1
    sfx('strike')
  }
  const space = () => {
    const s = st.current
    s.keyDown[keys.length] = 1
    if (s.col >= LINE_CHARS) return
    s.col++
    s.lines[s.line] += ' '
    sfx('space')
    if (s.col === BELL_AT) sfx('bell')
  }
  const back = () => {
    const s = st.current
    if (s.col > 0) s.col--
    const ki = codeIndex.get('Backspace')
    s.keyDown[ki] = 1
    sfx('space')
  }
  const carriageReturn = () => {
    const s = st.current
    s.lever = 1
    s.col = 0
    s.line++
    s.platenRot -= 0.45
    if (s.line >= LINES) { blank(); s.line = 0 }
    s.lines[s.line] = ''
    live.current.onLine?.(s.lines[s.line - 1] ?? '')
    sfx('ret')
  }

  // real keyboard
  useEffect(() => {
    const down = (e) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const mine = e.target === document.body || e.target?.closest?.('[data-typewriter]')
      if (e.code === 'Enter') { if (!e.repeat) carriageReturn(); if (mine) e.preventDefault(); return }
      if (e.code === 'Backspace') { back(); if (mine) e.preventDefault(); return }
      if (e.code === 'Space') { space(); if (mine) e.preventDefault(); return }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { st.current.held[codeIndex.get(e.code)] = 1; return }
      if (e.key.length === 1) { typeChar(e.key, e.code); if (mine) e.preventDefault() }
    }
    const up = (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') st.current.held[codeIndex.get(e.code)] = 0 }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeIndex, barOf])

  // pointer
  useEffect(() => {
    const up = () => { if (controls) controls.enabled = true }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [controls])
  const grab = (fn) => (e) => { e.stopPropagation(); if (controls) controls.enabled = false; fn() }
  const clickKey = (k) => {
    const s = st.current
    if (k.kind === 'shift') { s.shiftLock = !s.shiftLock; return }
    if (k.kind === 'back') return back()
    const ch = s.shiftLock ? k.label : k.ch
    typeChar(ch, k.code)
  }
  const hoverProps = { onPointerOver: (e) => { e.stopPropagation(); setHover(true) }, onPointerOut: () => setHover(false) }

  // --- animation ---
  const keyRefs = useRef([])
  const spaceRef = useRef()
  const carriageRef = useRef()
  const platenRef = useRef()
  const paperRef = useRef()
  const leverRef = useRef()
  const ribbonRef = useRef()
  const barRef = useRef()
  const slugRef = useRef()
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), one: new THREE.Vector3(1, 1, 1) }), [])

  useEffect(() => {
    bars.forEach((b, i) => {
      tmp.m.compose(b.pivot, b.rest, tmp.one)
      barRef.current.setMatrixAt(i, tmp.m)
      slugRef.current.setMatrixAt(i, tmp.m)
    })
    barRef.current.instanceMatrix.needsUpdate = slugRef.current.instanceMatrix.needsUpdate = true
  }, [bars, tmp])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = st.current
    const DUR = reduced ? 0.0001 : 0.15
    let ribbon = 0
    const touched = new Set()
    for (const k of s.strikes) {
      k.t += dt / DUR
      // the letter lands, and the carriage escapes, at the top of the swing
      if (!k.done && k.t >= 0.5) {
        k.done = true
        live.current.ink(k.ch)
        s.lines[s.line] = (s.lines[s.line] ?? '') + k.ch
        s.col++
        if (s.col === BELL_AT) sfx('bell')
      }
      const f = k.t < 0.5 ? easeOut(k.t / 0.5) : Math.max(0, 1 - (k.t - 0.5) / 0.5)
      ribbon = Math.max(ribbon, f)
      const b = bars[k.bar]
      tmp.q.copy(b.rest).slerp(b.hit, f)
      tmp.m.compose(b.pivot, tmp.q, tmp.one)
      barRef.current.setMatrixAt(k.bar, tmp.m)
      slugRef.current.setMatrixAt(k.bar, tmp.m)
      touched.add(k.bar)
    }
    if (touched.size) barRef.current.instanceMatrix.needsUpdate = slugRef.current.instanceMatrix.needsUpdate = true
    s.strikes = s.strikes.filter((k) => k.t < 1)

    // carriage: a quick escapement step with a little overshoot, slower on return
    const target = -s.col * CW
    if (reduced) { s.carr = target; s.carrV = 0 } else {
      // small fixed steps keep the stiff spring stable on slow frames
      const n = Math.ceil(dt / 0.004)
      for (let i = 0; i < n; i++) {
        s.carrV += ((target - s.carr) * 900 - s.carrV * 42) * (dt / n)
        s.carr += s.carrV * (dt / n)
      }
    }
    carriageRef.current.position.x = s.carr
    platenRef.current.rotation.x += (s.platenRot - platenRef.current.rotation.x) * Math.min(1, dt * 14)
    const py = s.line * (LH_PX / PX)
    s.paperY = reduced ? py : s.paperY + (py - s.paperY) * Math.min(1, dt * 12)
    paperRef.current.position.y = s.paperY - (PAPER_H / 2 - (TOP_PX + 40) / PX)
    s.lever = Math.max(0, s.lever - dt * 3)
    leverRef.current.rotation.z = -0.2 - Math.sin(Math.min(1, s.lever) * Math.PI) * 0.5
    s.ribbon += (ribbon - s.ribbon) * Math.min(1, dt * 40)
    ribbonRef.current.position.y = s.ribbon * 0.16

    for (let i = 0; i <= keys.length; i++) {
      const held = i < keys.length && (s.held[i] || (keys[i].kind === 'shift' && s.shiftLock))
      s.keyDown[i] = Math.max(held ? 1 : 0, s.keyDown[i] - dt * 7)
      const g = i < keys.length ? keyRefs.current[i] : spaceRef.current
      if (g) g.position.y = (i < keys.length ? keys[i].y + 0.6 : 0.95) - Math.min(1, s.keyDown[i]) * 0.14
    }
  })

  const PZ = PLATEN_Z
  return (
    <group>
      <mesh geometry={geo.body} material={mats.body} castShadow receiveShadow />

      {/* keys on stalks */}
      {keys.map((k, i) => (
        <group key={k.code}>
          <mesh geometry={geo.stalk} material={mats.steel} position={[k.x, k.y + 0.25, k.z]} />
          <group ref={(el) => { keyRefs.current[i] = el }} position={[k.x, k.y + 0.6, k.z]} rotation-x={0.22}>
            <mesh geometry={geo.keyTop} material={mats.key} scale={[k.r, 1, k.r]} castShadow onPointerDown={grab(() => clickKey(k))} {...hoverProps} />
            <mesh geometry={geo.keyRing} material={mats.chrome} scale={[k.r, 1, k.r]} position-y={0.04} />
            <mesh geometry={geo.legends[i]} material={mats.legend} position-y={0.062} renderOrder={2} />
          </group>
        </group>
      ))}
      {/* space bar on two arms */}
      <group ref={spaceRef} position={[0, 0.95, 4.35]}>
        <mesh geometry={geo.space} material={mats.key} castShadow onPointerDown={grab(space)} {...hoverProps} />
        <mesh geometry={geo.spaceArm} material={mats.steel} position={[-2.2, -0.05, -0.45]} />
        <mesh geometry={geo.spaceArm} material={mats.steel} position={[2.2, -0.05, -0.45]} />
      </group>

      {/* the typebar basket */}
      <mesh geometry={geo.pad} material={mats.felt} position={[BASKET.x, BASKET.y - 0.17, BASKET.z]} />
      <mesh geometry={geo.segment} material={mats.chrome} position={BASKET.toArray()} />
      <instancedMesh ref={barRef} args={[geo.bar, mats.steel, bars.length]} castShadow />
      <instancedMesh ref={slugRef} args={[geo.slug, mats.chrome, bars.length]} />

      {/* ribbon spools and the ribbon, which lifts as a bar strikes */}
      {[-2.9, 2.9].map((x) => (
        <group key={x} position={[x, 2.95, -0.75]}>
          <mesh geometry={geo.spool} material={mats.steel} castShadow />
          <mesh geometry={geo.spoolHub} material={mats.chrome} />
        </group>
      ))}
      <group ref={ribbonRef}>
        <mesh geometry={geo.ribbon} material={mats.ribbon} position={[0, PLATEN_Y - 0.04, STRIKE.z + 0.06]} scale={[5.8, 1, 1]} />
        <mesh geometry={geo.ribbon} material={mats.ribbonRed} position={[0, PLATEN_Y - 0.2, STRIKE.z + 0.06]} scale={[5.8, 1, 1]} />
      </group>

      {/* carriage rail (fixed) */}
      <mesh geometry={geo.rail} material={mats.chrome} position={[0, 2.86, PZ - 0.2]} />

      {/* the carriage: platen, knobs, paper, bail, lever */}
      <group ref={carriageRef}>
        <group position={[PAPER_X, PLATEN_Y, PZ]}>
          <group ref={platenRef}>
            <mesh geometry={geo.platen} material={mats.rubber} castShadow receiveShadow />
          </group>
          <mesh geometry={geo.wrap} material={mats.paperWrap} />
          {[-1, 1].map((sgn) => (
            <group key={sgn} position-x={sgn * 3.75}>
              <mesh geometry={geo.knob} material={mats.rubber} castShadow />
              <mesh geometry={geo.knobCap} material={mats.chrome} position-x={sgn * 0.22} />
            </group>
          ))}
          {/* paper table behind */}
          <mesh geometry={geo.table} material={mats.body} position={[0, 0.85, -1.05]} rotation-x={-0.75} castShadow />
          {/* paper bail with two rollers */}
          <mesh geometry={geo.rod} material={mats.chrome} position={[0, PLATEN_R + 0.12, 0.38]} scale={[6.8, 1, 1]} />
          {[-1.6, 1.6].map((x) => <mesh key={x} geometry={geo.roller} material={mats.rubber} position={[x, PLATEN_R + 0.12, 0.38]} />)}
          {/* the sheet rises from the top of the platen, leaning back */}
          <group position={[0, PLATEN_R, -0.02]} rotation-x={-0.22}>
            <mesh ref={paperRef} geometry={geo.paper} material={mats.paper} castShadow receiveShadow />
          </group>
          {/* carriage return lever */}
          <group ref={leverRef} position={[-4.05, 0.2, 0.4]} rotation-z={-0.2}>
            <mesh geometry={geo.lever} material={mats.chrome} rotation-x={0.5} onPointerDown={grab(carriageReturn)} {...hoverProps} />
            <mesh geometry={geo.leverTip} material={mats.chrome} position={[0, 1.49, 0.81]} onPointerDown={grab(carriageReturn)} {...hoverProps} />
          </group>
        </group>
      </group>
    </group>
  )
}
