import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createTypewriterAudio } from './audio.js'

// A manual typewriter. Type on your real keyboard (or click the round keys):
// the key goes down, its typebar is flung up out of the basket, strikes the
// platen through the ribbon (which the vibrator lifts into its path), inks the
// letter, falls back onto its felt pad and settles. The carriage escapes one
// letter to the left. A bell rings near the margin; Enter (or the chrome lever)
// throws the carriage back and feeds a new line. Backspace steps back, as on
// the real thing (no erasing).
//
// Every moving part sits on, or turns about, something real:
//   typebars pivot on the chrome segment and rest on a felt pad, low enough to
//     stay clear of the top row of keys;
//   the ribbon runs from one spool, round two guide posts, through the
//     vibrator's fork in front of the platen, to the other spool;
//   the carriage rides on a rail on the raised back, carried on two end plates
//     that hold the platen's axle and the return lever's bracket.

// --- dimensions (1 unit is about an inch) ---
const BODY_W = 11
const BODY_BEVEL = 0.14
const PLATEN_Y = 3.62, PLATEN_Z = -1.6, PLATEN_R = 0.6, PLATEN_LEN = 7
const STRIKE = new THREE.Vector3(0, PLATEN_Y, PLATEN_Z + PLATEN_R) // the printing point
const BASKET = new THREE.Vector3(0, 2.85, PLATEN_Z + PLATEN_R) // centre of the segment, below the printing point
const PIVOT_R = 0.75 // radius of the segment the typebars pivot on
const BAR_L = Math.hypot(PIVOT_R, STRIKE.y - BASKET.y) // every bar reaches the printing point exactly

// --- the sheet of paper ---
const PAPER_W = 6, PAPER_H = 8
const PX = 1024 / PAPER_W // canvas pixels per unit
const COLS = 42, MARGIN = 3, LINE_CHARS = 36, BELL_AT = 31
const CW = PAPER_W / COLS // one letter of carriage travel
const LH_PX = 46, TOP_PX = 300
const LINES = Math.floor((PAPER_H * PX - TOP_PX - 60) / LH_PX)
const PAPER_X = -(MARGIN + 0.5) * CW + PAPER_W / 2 // paper centre on the carriage

// --- the ribbon: black over red, half an inch wide ---
const RIBBON_W = 0.5
const RIBBON_Z = STRIKE.z + 0.06 // just in front of the paper
const RIBBON_REST = 3.05 // its centre line at rest, so the black half's top edge is below the printed line
const RIBBON_LIFT = 0.42 // the vibrator lifts it until the black half covers the printing point
const FORK_X = 0.5 // the vibrator's prongs, either side of the printing point
const GUIDE_X = 1.05 // guide posts, where the ribbon turns towards the spools
const SPOOL = { x: 2.9, z: -0.45, flange: 0.48, wound: [0.4, 0.3] }

// --- the body's side profile [z, y], extruded across; its bevel adds a little all round ---
const PROFILE = [[4.3, 0], [4.3, 0.55], [0.5, 2.35], [-0.95, 2.45], [-1.25, 2.8], [-4, 2.8], [-4, 0]]
// height of the body's top surface at depth z (including the bevel), for placing parts on it
function surfaceY(z) {
  if (z >= 0.5) return 0.55 + (1.8 * (4.3 - z)) / 3.8 + BODY_BEVEL / Math.cos(Math.atan(1.8 / 3.8))
  if (z >= -0.95) return 2.35 + (0.1 * (0.5 - z)) / 1.45 + BODY_BEVEL
  if (z >= -1.25) return 2.45 + (0.35 * (-0.95 - z)) / 0.3 + BODY_BEVEL
  return 2.8 + BODY_BEVEL
}
const BACK_TOP = surfaceY(-2) // the raised back, where the carriage rail sits

// --- keys: four staggered rows on the sloped front ---
const slope = (u) => ({ z: 4.3 - 3.8 * u, y: 0.55 + 1.8 * u })
const PITCH = 0.84
const SHIFT_GAP = 1.0
// Rows stagger to the right going down, as on a real machine (in key pitches).
const ROWS = [
  { u: 0.75, stagger: 0, keys: '1234567890-'.split('').map((c) => [c === '-' ? 'Minus' : `Digit${c}`, c, c]) },
  { u: 0.54, stagger: 0.5, keys: 'QWERTYUIOP'.split('').map((c) => [`Key${c}`, c, c.toLowerCase()]) },
  { u: 0.33, stagger: 0.75, keys: [...'ASDFGHJKL'.split('').map((c) => [`Key${c}`, c, c.toLowerCase()]), ['Semicolon', ';', ';']] },
  { u: 0.12, stagger: 1.25, keys: [...'ZXCVBNM'.split('').map((c) => [`Key${c}`, c, c.toLowerCase()]), ['Comma', ',', ','], ['Period', '.', '.'], ['Slash', '/', '/']] },
]
function buildKeys() {
  const keys = []
  ROWS.forEach((row, r) => {
    const { z, y } = slope(row.u)
    row.keys.forEach(([code, label, ch], i) => keys.push({ code, label, ch, x: (row.stagger + i) * PITCH, z, y, r: 0.3, kind: 'char', row: r }))
  })
  const num = keys.filter((k) => k.row === 0)
  const bottom = keys.filter((k) => k.row === 3)
  const s0 = slope(ROWS[0].u), s3 = slope(ROWS[3].u)
  keys.push({ code: 'Backspace', label: '←', ch: null, x: num[num.length - 1].x + PITCH, z: s0.z, y: s0.y, r: 0.3, kind: 'back' })
  keys.push({ code: 'ShiftLeft', label: 'SHIFT', ch: null, x: bottom[0].x - SHIFT_GAP, z: s3.z, y: s3.y, r: 0.38, kind: 'shift' })
  keys.push({ code: 'ShiftRight', label: 'SHIFT', ch: null, x: bottom[bottom.length - 1].x + SHIFT_GAP, z: s3.z, y: s3.y, r: 0.38, kind: 'shift' })
  // centre the whole keyboard, shift keys included, on the body
  const lo = Math.min(...keys.map((k) => k.x - k.r))
  const hi = Math.max(...keys.map((k) => k.x + k.r))
  const mid = (lo + hi) / 2
  keys.forEach((k) => (k.x -= mid))
  return keys
}

function bodyGeometry() {
  const shape = new THREE.Shape(PROFILE.map(([z, y]) => new THREE.Vector2(-z, y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: BODY_W, bevelEnabled: true, bevelSize: BODY_BEVEL, bevelThickness: BODY_BEVEL, bevelSegments: 4, curveSegments: 4 })
  g.rotateY(Math.PI / 2)
  g.translate(-BODY_W / 2, 0, 0)
  g.computeVertexNormals()
  return g
}

// A typebar's frame: x along the bar, z across the swing (constant), y the rest.
function barQuat(dir, across) {
  const y = new THREE.Vector3().crossVectors(across, dir)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, y, across))
}

// Where a ribbon spool lets the ribbon go: the point on the wound ribbon where
// a line to the guide post just touches it, on the side nearer the platen.
function tangentPoint(cx, cz, r, gx, gz) {
  const dx = gx - cx, dz = gz - cz
  const d = Math.hypot(dx, dz)
  const base = Math.atan2(dz, dx)
  const a = Math.acos(Math.min(1, r / d))
  const p1 = [cx + r * Math.cos(base + a), cz + r * Math.sin(base + a)]
  const p2 = [cx + r * Math.cos(base - a), cz + r * Math.sin(base - a)]
  return p1[1] < p2[1] ? p1 : p2
}

// The ribbon's path seen from above, and how much of the vibrator's lift each
// point takes: all of it inside the fork, none at the guides and spools.
function ribbonPath() {
  const [lw, rw] = SPOOL.wound
  const tl = tangentPoint(-SPOOL.x, SPOOL.z, lw, -GUIDE_X, RIBBON_Z)
  const tr = tangentPoint(SPOOL.x, SPOOL.z, rw, GUIDE_X, RIBBON_Z)
  const corners = [tl, [-GUIDE_X, RIBBON_Z], [GUIDE_X, RIBBON_Z], tr]
  const pts = []
  for (let s = 0; s < corners.length - 1; s++) {
    const [ax, az] = corners[s]
    const [bx, bz] = corners[s + 1]
    const n = s === 1 ? 48 : 12
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n])
  }
  pts.push(corners[corners.length - 1])
  return pts.map(([x, z]) => {
    const ax = Math.abs(x)
    const w = Math.abs(z - RIBBON_Z) > 1e-4 ? 0 : ax <= FORK_X ? 1 : Math.max(0, (GUIDE_X - ax) / (GUIDE_X - FORK_X))
    return { x, z, w }
  })
}

// One half of the ribbon (black or red) as a strip along the path.
function ribbonStrip(path) {
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array(path.length * 2 * 3)
  const nrm = new Float32Array(path.length * 2 * 3)
  const idx = []
  path.forEach((p, i) => {
    const q = path[Math.min(i + 1, path.length - 1)]
    const o = path[Math.max(i - 1, 0)]
    const tx = q.x - o.x, tz = q.z - o.z
    const l = Math.hypot(tx, tz) || 1
    for (const k of [0, 1]) nrm.set([tz / l, 0, -tx / l], (i * 2 + k) * 3)
    if (i < path.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  })
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setIndex(idx)
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

// Typebar physics, in units of "how far through the swing" (0 rest, 1 strike):
const FLING = 11 // speed the key linkage gives the bar
const RETURN = 18 // the bar's return spring and its own weight pulling it back
const REBOUND = 0.28 // off the platen
const PAD_BOUNCE = 0.18 // off the felt pad

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

  // Each character key drives one typebar; left keys use bars on the left of
  // the segment. At rest a bar lies on the felt pad, its tip just above the
  // body, so the fan stays below and behind the top row of keys.
  const bars = useMemo(() => {
    const order = [...charKeys].sort((a, b) => a.x - b.x)
    return order.map((key, i) => {
      const th = THREE.MathUtils.degToRad(162 - (i / (order.length - 1)) * 144)
      const d = new THREE.Vector3(Math.cos(th), 0, Math.sin(th))
      const pivot = BASKET.clone().addScaledVector(d, PIVOT_R)
      const across = new THREE.Vector3(-d.z, 0, d.x)
      // solve for the rest angle that puts the tip 0.07 above the surface beneath it
      let drop = 0.2
      let reach = BAR_L
      for (let k = 0; k < 8; k++) {
        reach = Math.sqrt(Math.max(0, BAR_L * BAR_L - drop * drop))
        const tipZ = pivot.z + d.z * reach
        drop = Math.max(0, pivot.y - (surfaceY(tipZ) + 0.07))
      }
      const restDir = d.clone().multiplyScalar(reach).add(new THREE.Vector3(0, -drop, 0)).normalize()
      const hitDir = STRIKE.clone().sub(pivot).normalize()
      const tip = pivot.clone().addScaledVector(restDir, BAR_L)
      return { code: key.code, pivot, rest: barQuat(restDir, across), hit: barQuat(hitDir, across), tip }
    })
  }, [charKeys])
  const barOf = useMemo(() => new Map(bars.map((b, i) => [b.code, i])), [bars])

  const path = useMemo(ribbonPath, [])

  // --- geometry and materials ---
  const atlas = useMemo(() => legendAtlas([...new Set(keys.map((k) => k.label))]), [keys])
  const geo = useMemo(() => {
    // the segment: a chrome arc through all the pivots
    const arc = []
    for (let i = 0; i <= 41; i++) {
      const a = THREE.MathUtils.degToRad(172 - i * 4)
      arc.push(BASKET.clone().add(new THREE.Vector3(Math.cos(a) * PIVOT_R, 0, Math.sin(a) * PIVOT_R)))
    }
    // the felt pad: a soft rail under the resting tips
    const padPts = bars.map((b) => b.tip.clone().add(new THREE.Vector3(0, -0.085, 0)))
    return {
      body: bodyGeometry(),
      keyTop: new THREE.CylinderGeometry(1, 1, 0.12, 40),
      keyRing: new THREE.TorusGeometry(1, 0.035, 10, 40).rotateX(Math.PI / 2),
      stalk: new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8),
      legends: keys.map((k) => circleLegend(k.r, atlas.uv.get(k.label))),
      // thin plates standing on edge, as real typebars are, so neighbours never touch
      bar: new THREE.BoxGeometry(BAR_L, 0.07, 0.025).translate(BAR_L / 2, 0, 0),
      // the slug's face lands exactly on the printing point
      slug: new THREE.BoxGeometry(0.08, 0.16, 0.05).translate(BAR_L - 0.04, 0.02, 0),
      segment: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 80, 0.06, 10, false),
      pad: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(padPts), 120, 0.05, 8, false),
      platen: new THREE.CylinderGeometry(PLATEN_R, PLATEN_R, PLATEN_LEN, 40).rotateZ(Math.PI / 2),
      axle: new THREE.CylinderGeometry(0.06, 0.06, PLATEN_LEN + 0.12, 12).rotateZ(Math.PI / 2),
      knob: new THREE.CylinderGeometry(0.5, 0.5, 0.42, 32).rotateZ(Math.PI / 2),
      knobCap: new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32).rotateZ(Math.PI / 2),
      endPlate: new THREE.BoxGeometry(0.04, 0.8, 0.5),
      bracket: new THREE.BoxGeometry(0.04, 0.12, 0.5),
      carriageBase: new THREE.BoxGeometry(PLATEN_LEN + 0.08, 0.06, 0.3),
      rod: new THREE.CylinderGeometry(0.04, 0.04, 1, 12).rotateZ(Math.PI / 2),
      roller: new THREE.CylinderGeometry(0.1, 0.1, 0.4, 16).rotateZ(Math.PI / 2),
      table: new THREE.BoxGeometry(7.2, 0.06, 1.8),
      rail: new THREE.BoxGeometry(BODY_W - 0.3, 0.04, 0.3), // stays on the body's top; the carriage may overhang it
      flange: new THREE.CylinderGeometry(SPOOL.flange, SPOOL.flange, 0.03, 32),
      woundL: new THREE.CylinderGeometry(SPOOL.wound[0], SPOOL.wound[0], RIBBON_W / 2, 32),
      woundR: new THREE.CylinderGeometry(SPOOL.wound[1], SPOOL.wound[1], RIBBON_W / 2, 32),
      spindle: new THREE.CylinderGeometry(0.07, 0.07, 1, 12),
      post: new THREE.CylinderGeometry(0.035, 0.035, 1, 10),
      forkBar: new THREE.BoxGeometry(FORK_X * 2 + 0.04, 0.03, 0.03),
      prong: new THREE.BoxGeometry(0.04, 1, 0.03),
      hook: new THREE.BoxGeometry(0.04, 0.03, 0.08),
      ribbonBlack: ribbonStrip(path),
      ribbonRed: ribbonStrip(path),
      lever: new THREE.CylinderGeometry(0.05, 0.05, 1.7, 12).translate(0, 0.85, 0),
      leverTip: new THREE.SphereGeometry(0.12, 16, 12),
      space: new THREE.BoxGeometry(5.4, 0.14, 0.32),
      spaceArm: new THREE.BoxGeometry(0.08, 0.08, 0.7),
      paper: new THREE.PlaneGeometry(PAPER_W, PAPER_H),
      wrap: new THREE.CylinderGeometry(PLATEN_R + 0.012, PLATEN_R + 0.012, PAPER_W, 32, 1, true, Math.PI * 0.5, Math.PI * 0.75).rotateZ(Math.PI / 2),
    }
  }, [keys, atlas, bars, path])
  const clip = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PLATEN_Y + PLATEN_R - 0.02))], [])
  const mats = useMemo(() => ({
    body: new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.1, clearcoat: 0.9, clearcoatRoughness: 0.18 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e6e8ec', metalness: 1, roughness: 0.16 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9a9ea6', metalness: 0.9, roughness: 0.35 }),
    key: new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    legend: new THREE.MeshBasicMaterial({ map: atlas.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.75 }),
    felt: new THREE.MeshStandardMaterial({ color: '#2a1f1c', roughness: 1 }),
    ribbon: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
    ribbonRed: new THREE.MeshStandardMaterial({ color: '#a3201f', roughness: 0.8, side: THREE.DoubleSide }),
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

  const st = useRef({ col: 0, line: 0, lines: [''], carr: 0, carrV: 0, paperY: 0, platenRot: 0, strikes: [], keyDown: new Float32Array(keys.length + 1), held: new Uint8Array(keys.length), lever: 0, ribbon: 0, dent: 0, spool: 0, spoolTarget: 0, shiftLock: false })
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

  // the slug meets the paper: ink, escapement, ribbon advance
  const landLetter = (k) => {
    const s = st.current
    k.inked = true
    live.current.ink(k.ch)
    s.lines[s.line] = (s.lines[s.line] ?? '') + k.ch
    s.col++
    s.dent = 1
    s.spoolTarget += 0.05
    sfx('strike')
    if (s.col === BELL_AT) sfx('bell')
  }

  // --- actions ---
  const typeChar = (ch, code) => {
    const s = st.current
    if (s.col >= LINE_CHARS) { sfx('bell'); return } // margin lock
    const bi = barOf.has(code) ? barOf.get(code) : Math.abs([...ch].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % bars.length
    // a bar already in flight can't be struck again until it is back down
    if (s.strikes.some((k) => k.bar === bi)) return
    const k = { bar: bi, f: 0, v: FLING, ch, inked: false, key: codeIndex.get(code) }
    s.strikes.push(k)
    if (reduced) landLetter(k)
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
    s.platenRot -= 0.45 // one line of paper is 0.27 in, on a 0.6 in platen
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
  const forkRef = useRef()
  const spoolRefs = useRef([])
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

    // typebars: flung up by the key, braked by the return spring, rebound off
    // the platen (where the letter is printed) and settle on the felt pad
    let lift = 0
    const touched = new Set()
    const steps = Math.ceil(dt / 0.004)
    for (const k of s.strikes) {
      if (reduced) k.f = 0
      else for (let i = 0; i < steps; i++) {
        const h = dt / steps
        k.v -= RETURN * h
        k.f += k.v * h
        if (k.f >= 1) {
          k.f = 1
          if (!k.inked) landLetter(k)
          k.v = -Math.abs(k.v) * REBOUND
        }
        if (k.f <= 0 && k.v < 0) {
          k.f = 0
          k.v = Math.abs(k.v) < 0.6 ? 0 : -k.v * PAD_BOUNCE
          if (k.v === 0) k.done = true
        }
      }
      if (reduced) k.done = true
      // the key goes down with the start of the swing and comes back up with the bar
      if (k.key !== undefined) s.keyDown[k.key] = Math.max(s.keyDown[k.key], Math.min(1, k.f * 2.5))
      // the vibrator is linked to the same key: the ribbon is up before the slug arrives
      lift = Math.max(lift, Math.min(1, k.f * 1.8))
      const b = bars[k.bar]
      tmp.q.copy(b.rest).slerp(b.hit, k.f)
      tmp.m.compose(b.pivot, tmp.q, tmp.one)
      barRef.current.setMatrixAt(k.bar, tmp.m)
      slugRef.current.setMatrixAt(k.bar, tmp.m)
      touched.add(k.bar)
    }
    if (touched.size) barRef.current.instanceMatrix.needsUpdate = slugRef.current.instanceMatrix.needsUpdate = true
    s.strikes = s.strikes.filter((k) => !k.done)

    // ribbon: lifted by the vibrator, pressed in where the slug hits, advanced a little each letter
    s.ribbon += (lift - s.ribbon) * Math.min(1, dt * 40)
    s.dent = Math.max(0, s.dent - dt * 12)
    s.spool += (s.spoolTarget - s.spool) * Math.min(1, dt * 10)
    forkRef.current.position.y = s.ribbon * RIBBON_LIFT
    spoolRefs.current.forEach((g, i) => { if (g) g.rotation.y = (i ? 1 : -1) * s.spool * (i ? 1 / SPOOL.wound[1] : 1 / SPOOL.wound[0]) })
    for (const [g, lo, hi] of [[geo.ribbonBlack, 0, RIBBON_W / 2], [geo.ribbonRed, -RIBBON_W / 2, 0]]) {
      const a = g.attributes.position.array
      path.forEach((p, i) => {
        const c = RIBBON_REST + s.ribbon * RIBBON_LIFT * p.w
        const z = p.z - s.dent * 0.055 * Math.max(0, 1 - Math.abs(p.x) / 0.15)
        a.set([p.x, c + lo, z, p.x, c + hi, z], i * 6)
      })
      g.attributes.position.needsUpdate = true
    }

    // carriage: a quick escapement step with a little overshoot, slower on return
    const target = -s.col * CW
    if (reduced) { s.carr = target; s.carrV = 0 } else {
      // small fixed steps keep the stiff spring stable on slow frames
      for (let i = 0; i < steps; i++) {
        s.carrV += ((target - s.carr) * 900 - s.carrV * 42) * (dt / steps)
        s.carr += s.carrV * (dt / steps)
      }
    }
    carriageRef.current.position.x = s.carr
    platenRef.current.rotation.x += (s.platenRot - platenRef.current.rotation.x) * Math.min(1, dt * 14)
    const py = s.line * (LH_PX / PX)
    s.paperY = reduced ? py : s.paperY + (py - s.paperY) * Math.min(1, dt * 12)
    paperRef.current.position.y = s.paperY - (PAPER_H / 2 - (TOP_PX + 40) / PX)
    s.lever = Math.max(0, s.lever - dt * 3)
    leverRef.current.rotation.z = -0.2 - Math.sin(Math.min(1, s.lever) * Math.PI) * 0.5

    for (let i = 0; i <= keys.length; i++) {
      const held = i < keys.length && (s.held[i] || (keys[i].kind === 'shift' && s.shiftLock))
      s.keyDown[i] = Math.max(held ? 1 : 0, s.keyDown[i] - dt * 7)
      const g = i < keys.length ? keyRefs.current[i] : spaceRef.current
      if (g) g.position.y = (i < keys.length ? keys[i].y + 0.6 : 0.95) - Math.min(1, s.keyDown[i]) * 0.14
    }
  })

  const PZ = PLATEN_Z
  const forkBottom = RIBBON_REST - RIBBON_W / 2 - 0.03
  const forkTop = RIBBON_REST + RIBBON_W / 2 + 0.03
  const forkDeep = surfaceY(RIBBON_Z + 0.04) - RIBBON_LIFT - 0.15 // the prongs run down into a slot in the body, deep enough to stay in it when lifted
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

      {/* the typebar basket: the segment the bars pivot on, the felt pad they rest on */}
      <mesh geometry={geo.segment} material={mats.chrome} />
      {/* the segment stands on two posts at its ends, outside the arc the bars use */}
      {[172, 8].map((deg) => {
        const a = THREE.MathUtils.degToRad(deg)
        const x = Math.cos(a) * PIVOT_R
        const z = BASKET.z + Math.sin(a) * PIVOT_R
        const base = surfaceY(z) - 0.05
        return <mesh key={deg} geometry={geo.post} material={mats.chrome} position={[x, (base + BASKET.y) / 2, z]} scale={[1.6, BASKET.y - base, 1.6]} />
      })}
      <mesh geometry={geo.pad} material={mats.felt} receiveShadow />
      <instancedMesh ref={barRef} args={[geo.bar, mats.steel, bars.length]} castShadow />
      <instancedMesh ref={slugRef} args={[geo.slug, mats.chrome, bars.length]} />

      {/* ribbon spools on spindles, with the ribbon wound on them */}
      {[-1, 1].map((sx, i) => {
        const base = surfaceY(SPOOL.z)
        const bottom = RIBBON_REST - RIBBON_W / 2 - 0.02
        return (
          <group key={sx} position={[sx * SPOOL.x, 0, SPOOL.z]}>
            <mesh geometry={geo.spindle} material={mats.chrome} position-y={(base - 0.05 + RIBBON_REST + RIBBON_W / 2 + 0.08) / 2} scale={[1, RIBBON_REST + RIBBON_W / 2 + 0.13 - base, 1]} />
            <group ref={(el) => { spoolRefs.current[i] = el }}>
              <mesh geometry={geo.flange} material={mats.steel} position-y={bottom} castShadow />
              <mesh geometry={geo.flange} material={mats.steel} position-y={RIBBON_REST + RIBBON_W / 2 + 0.02} castShadow />
              <mesh geometry={i ? geo.woundR : geo.woundL} material={mats.ribbonRed} position-y={RIBBON_REST - RIBBON_W / 4} />
              <mesh geometry={i ? geo.woundR : geo.woundL} material={mats.ribbon} position-y={RIBBON_REST + RIBBON_W / 4} />
            </group>
          </group>
        )
      })}
      {/* guide posts on the inside of the ribbon's bend, where it turns towards the spools */}
      {[-1, 1].map((sx) => {
        const base = surfaceY(RIBBON_Z + 0.035) - 0.05
        const top = RIBBON_REST + RIBBON_W / 2 + 0.05
        return <mesh key={sx} geometry={geo.post} material={mats.chrome} position={[sx * GUIDE_X, (base + top) / 2, RIBBON_Z + 0.035]} scale={[1, top - base, 1]} />
      })}
      {/* the ribbon itself, and the vibrator fork that lifts it into the slug's path */}
      <mesh geometry={geo.ribbonBlack} material={mats.ribbon} />
      <mesh geometry={geo.ribbonRed} material={mats.ribbonRed} />
      <group ref={forkRef}>
        <mesh geometry={geo.forkBar} material={mats.chrome} position={[0, forkBottom, RIBBON_Z + 0.04]} />
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * FORK_X, 0, RIBBON_Z + 0.04]}>
            <mesh geometry={geo.prong} material={mats.chrome} position-y={(forkDeep + forkTop) / 2} scale={[1, forkTop - forkDeep, 1]} />
            {/* hooks over the ribbon's top edge and under its bottom edge */}
            <mesh geometry={geo.hook} material={mats.chrome} position={[0, forkTop, -0.04]} />
            <mesh geometry={geo.hook} material={mats.chrome} position={[0, forkBottom, -0.04]} />
          </group>
        ))}
      </group>

      {/* the carriage rail, fixed on the raised back */}
      <mesh geometry={geo.rail} material={mats.chrome} position={[0, BACK_TOP + 0.02, PZ - 0.45]} />

      {/* the carriage: platen on its axle between two end plates, knobs, paper, bail, lever */}
      <group ref={carriageRef}>
        <group position={[PAPER_X, PLATEN_Y, PZ]}>
          <group ref={platenRef}>
            <mesh geometry={geo.platen} material={mats.rubber} castShadow receiveShadow />
          </group>
          <mesh geometry={geo.axle} material={mats.steel} />
          <mesh geometry={geo.wrap} material={mats.paperWrap} />
          {[-1, 1].map((sgn) => (
            <group key={sgn}>
              {/* end plate: carries the axle, stands on the carriage base */}
              <mesh geometry={geo.endPlate} material={mats.steel} position={[sgn * (PLATEN_LEN / 2 + 0.02), -0.25, -0.15]} castShadow />
              <group position-x={sgn * 3.75}>
                <mesh geometry={geo.knob} material={mats.rubber} castShadow />
                <mesh geometry={geo.knobCap} material={mats.chrome} position-x={sgn * 0.22} />
              </group>
            </group>
          ))}
          {/* the carriage base rides on the rail */}
          <mesh geometry={geo.carriageBase} material={mats.steel} position={[0, BACK_TOP + 0.04 + 0.03 - PLATEN_Y, -0.45]} />
          {/* paper table behind */}
          <mesh geometry={geo.table} material={mats.body} position={[0, 0.85, -1.05]} rotation-x={-0.75} castShadow />
          {/* paper bail with two rollers */}
          <mesh geometry={geo.rod} material={mats.chrome} position={[0, PLATEN_R + 0.12, 0.38]} scale={[6.8, 1, 1]} />
          {[-1.6, 1.6].map((x) => <mesh key={x} geometry={geo.roller} material={mats.rubber} position={[x, PLATEN_R + 0.12, 0.38]} />)}
          {/* the sheet rises from the top of the platen, leaning back */}
          <group position={[0, PLATEN_R, -0.02]} rotation-x={-0.22}>
            <mesh ref={paperRef} geometry={geo.paper} material={mats.paper} castShadow receiveShadow />
          </group>
          {/* carriage return lever, on a bracket that runs forward from the left end plate */}
          <mesh geometry={geo.bracket} material={mats.steel} position={[-(PLATEN_LEN / 2 + 0.02), -0.2, 0.33]} />
          <group ref={leverRef} position={[-(PLATEN_LEN / 2 + 0.02), -0.2, 0.58]} rotation-z={-0.2}>
            <mesh geometry={geo.lever} material={mats.chrome} rotation-x={0.5} onPointerDown={grab(carriageReturn)} {...hoverProps} />
            <mesh geometry={geo.leverTip} material={mats.chrome} position={[0, 1.49, 0.81]} onPointerDown={grab(carriageReturn)} {...hoverProps} />
          </group>
        </group>
      </group>
    </group>
  )
}
