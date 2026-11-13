import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createStampAudio } from './audio.js'

// A custom rubber stamp: a varnished hardwood block with a turned knob, a
// thin red foam cushion, and a black rubber die cut with your design. It
// stands on a sheet of paper. Click it and it lifts, comes down, the cushion
// squashes and it leaves a print: mottled, slightly crooked, and fainter each
// time until it is re-inked. Drag it to move it about the sheet. Turn it over
// to see the die, cut in mirror image as a real one is.
// 1 unit = 10 mm. +y up, the camera looks from +z.

const SHAPES = {
  rectangle: { w: 6.4, d: 3.8, h: 1.7, knob: 1 },
  square: { w: 3.8, d: 3.8, h: 1.7, knob: 0.88 },
  long: { w: 8.4, d: 2.6, h: 1.6, knob: 0.92 },
}
export const STAMP_SHAPES = Object.keys(SHAPES)
const RELIEF = 0.035 // how far the cut design stands proud of the die
const RUB_T = 0.08
const CUSH_T = 0.14
const INSET = 0.06 // the die is a little smaller than the block
const PAPER = { w: 21, d: 14.8, t: 0.012 } // A5, landscape
const PAPER_PX = 96 // canvas pixels per unit (≈ 240 dpi)
const LIFT = 1.3

const WOODS = {
  oak: { base: '#c08a50', dark: '#86552a' },
  teak: { base: '#a8703c', dark: '#6a3e1a' },
  walnut: { base: '#6e4428', dark: '#3a2213' },
  maple: { base: '#e2c08e', dark: '#bf9460' },
  cherry: { base: '#ad5d3c', dark: '#6f301b' },
}
export const STAMP_WOODS = Object.keys(WOODS)
export const STAMP_DESIGNS = ['text', 'geometric', 'monogram']

// ---- procedural textures ----

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function valueNoise(seed) {
  const h = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const n = (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = h(xi, yi)
    const b = h(xi + 1, yi)
    const c = h(xi, yi + 1)
    const d = h(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  return (x, y, oct = 4) => {
    let t = 0
    let amp = 0.5
    let f = 1
    for (let i = 0; i < oct; i++) {
      t += n(x * f, y * f) * amp
      f *= 2
      amp *= 0.5
    }
    return t
  }
}

// Flat-sawn hardwood: growth rings that wander as long horizontal bands, fine
// streaks running with the grain, and pores. Returns colour and bump canvases.
function woodCanvases(wood, seed = 3) {
  const S = 512
  const fbm = valueNoise(seed)
  const base = new THREE.Color(wood.base)
  const dark = new THREE.Color(wood.dark)
  const col = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const bmp = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const ci = col.getContext('2d').createImageData(S, S)
  const bi = bmp.getContext('2d').createImageData(S, S)
  const r = rng(seed * 991)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const warp = fbm(x / 170, y / 46) * 2.4 + fbm(x / 50, y / 14, 2) * 0.25
      const ring = (y / S) * 7 + warp
      const f = ring - Math.floor(ring)
      // latewood: a sharp dark edge fading back into the lighter earlywood
      const late = Math.pow(f, 5) * 0.85 + (f > 0.92 ? 0.15 : 0)
      const streak = fbm(x / 260, y / 1.6, 3)
      const pore = r() < 0.012 ? 0.5 : 0
      const t = Math.min(1, late * 0.62 + (streak - 0.35) * 0.55 + pore * 0.3 + 0.12)
      const i = (y * S + x) * 4
      ci.data[i] = (base.r + (dark.r - base.r) * t) * 255
      ci.data[i + 1] = (base.g + (dark.g - base.g) * t) * 255
      ci.data[i + 2] = (base.b + (dark.b - base.b) * t) * 255
      ci.data[i + 3] = 255
      const b = 200 - late * 60 - pore * 120 - streak * 30
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = b
      bi.data[i + 3] = 255
    }
  }
  col.getContext('2d').putImageData(ci, 0, 0)
  bmp.getContext('2d').putImageData(bi, 0, 0)
  return { col, bmp }
}

// Fine paper fibre for the sheet, as a canvas that prints are drawn onto.
function paperCanvas(color) {
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(PAPER.w * PAPER_PX), height: Math.round(PAPER.d * PAPER_PX) })
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  const r = rng(7)
  for (let i = 0; i < 26000; i++) {
    const v = r() < 0.5 ? 0 : 255
    g.fillStyle = `rgba(${v},${v},${v},${0.025 + r() * 0.03})`
    g.fillRect(r() * c.width, r() * c.height, 1 + r() * 2.5, 1)
  }
  return c
}

// The design, white on clear, as it should read on paper. The die is cut as
// its mirror image.
function designCanvas(design, text, subtext, aspect) {
  const W = 1024
  const H = Math.round(W / aspect)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = g.strokeStyle = '#fff'
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const m = Math.min(W, H)
  const fit = (str, weight, family, maxW, maxH) => {
    let size = maxH
    g.font = `${weight} ${size}px ${family}`
    while (g.measureText(str).width > maxW && size > 8) {
      size -= 2
      g.font = `${weight} ${size}px ${family}`
    }
    return size
  }
  const frame = (inset, lw, rad) => {
    g.lineWidth = lw
    g.beginPath()
    g.roundRect(inset, inset, W - inset * 2, H - inset * 2, rad)
    g.stroke()
  }
  const SANS = '"Arial Black", "Helvetica Neue", Arial, sans-serif'
  const SERIF = 'Georgia, "Times New Roman", serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  if (design === 'geometric') {
    const r = rng([...(text || 'x')].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7))
    frame(m * 0.04, m * 0.022, m * 0.03)
    const x0 = m * 0.09
    const y0 = m * 0.09
    const x1 = W - x0
    const y1 = H - y0
    g.save()
    g.beginPath()
    g.rect(x0, y0, x1 - x0, y1 - y0)
    g.clip()
    g.lineWidth = m * 0.012
    // a few big diagonals and the lines that run parallel to them
    for (let i = 0; i < 5; i++) {
      const ax = x0 + r() * (x1 - x0)
      const dir = r() < 0.5 ? 1 : -1
      for (let k = 0; k < 3; k++) {
        g.beginPath()
        g.moveTo(ax + k * m * 0.035, y0)
        g.lineTo(ax + k * m * 0.035 + dir * (y1 - y0), y1)
        g.stroke()
      }
    }
    // nested squares and triangles
    for (let i = 0; i < 4; i++) {
      const s = m * (0.16 + r() * 0.16)
      const cx = x0 + r() * (x1 - x0)
      const cy = y0 + r() * (y1 - y0)
      g.save()
      g.translate(cx, cy)
      g.rotate((r() < 0.5 ? 0 : 1) * (Math.PI / 4))
      for (let k = 0; k < 3; k++) g.strokeRect(-s / 2 + k * s * 0.17, -s / 2 + k * s * 0.17, s - k * s * 0.34, s - k * s * 0.34)
      g.restore()
      g.beginPath()
      const tx = x0 + r() * (x1 - x0)
      const ty = y0 + r() * (y1 - y0)
      g.moveTo(tx, ty)
      g.lineTo(tx + s * 0.9, ty)
      g.lineTo(tx, ty - s * 0.9 * (r() < 0.5 ? 1 : -1))
      g.closePath()
      g.stroke()
    }
    // a grid of little filled and empty squares in a corner
    const cs = m * 0.05
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        const gx = x1 - (i + 1) * cs * 1.35
        const gy = y1 - (j + 1) * cs * 1.35
        if (r() < 0.5) g.fillRect(gx, gy, cs, cs)
        else g.strokeRect(gx, gy, cs, cs)
      }
    g.restore()
    if (text) {
      // a cartouche for the text, knocked out of the pattern
      const size = fit(text, 900, SANS, W * 0.5, m * 0.16)
      const tw = g.measureText(text).width
      g.save()
      g.globalCompositeOperation = 'destination-out'
      g.fillRect(W / 2 - tw / 2 - m * 0.05, H / 2 - size * 0.75, tw + m * 0.1, size * 1.5)
      g.restore()
      g.lineWidth = m * 0.014
      g.strokeRect(W / 2 - tw / 2 - m * 0.035, H / 2 - size * 0.62, tw + m * 0.07, size * 1.24)
      g.fillText(text, W / 2, H / 2 + size * 0.04)
    }
  } else if (design === 'monogram') {
    frame(m * 0.04, m * 0.02, m * 0.06)
    frame(m * 0.075, m * 0.008, m * 0.04)
    const cx = W / 2
    const cy = H * (subtext ? 0.44 : 0.5)
    const rad = m * (subtext ? 0.3 : 0.34)
    g.lineWidth = m * 0.018
    g.beginPath()
    g.arc(cx, cy, rad, 0, Math.PI * 2)
    g.stroke()
    g.lineWidth = m * 0.007
    g.beginPath()
    g.arc(cx, cy, rad * 0.88, 0, Math.PI * 2)
    g.stroke()
    // a ring of dots
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      g.beginPath()
      g.arc(cx + Math.cos(a) * rad * 1.12, cy + Math.sin(a) * rad * 1.12, m * 0.008, 0, Math.PI * 2)
      g.fill()
    }
    const initials = (text || 'RD').slice(0, 3).toUpperCase()
    fit(initials, 700, SERIF, rad * 1.45, rad * 1.05)
    g.fillText(initials, cx, cy + rad * 0.05)
    if (W / H > 1.3) {
      // rules out to either side
      g.lineWidth = m * 0.012
      for (const s of [-1, 1]) {
        g.beginPath()
        g.moveTo(cx + s * rad * 1.3, cy)
        g.lineTo(cx + s * (W / 2 - m * 0.16), cy)
        g.stroke()
        g.beginPath()
        g.arc(cx + s * (W / 2 - m * 0.16), cy, m * 0.02, 0, Math.PI * 2)
        g.fill()
      }
    }
    if (subtext) {
      fit(subtext.toUpperCase(), 700, SANS, W * 0.8, m * 0.1)
      g.fillText(subtext.toUpperCase(), cx, H - m * 0.15)
    }
  } else {
    frame(m * 0.04, m * 0.026, m * 0.05)
    frame(m * 0.085, m * 0.009, m * 0.03)
    const main = (text || 'APPROVED').toUpperCase()
    const hasSub = !!subtext
    const size = fit(main, 900, SANS, W * 0.8, m * (hasSub ? 0.3 : 0.4))
    const cy = hasSub ? H * 0.42 : H / 2
    g.fillText(main, W / 2, cy)
    if (hasSub) {
      const sub = subtext.toUpperCase()
      const ss = fit(sub, 700, SANS, W * 0.56, m * 0.11)
      const sy = cy + size * 0.5 + ss * 1.05
      g.fillText(sub, W / 2, sy)
      const sw = g.measureText(sub).width
      g.lineWidth = m * 0.012
      for (const s of [-1, 1]) {
        g.beginPath()
        g.moveTo(W / 2 + s * (sw / 2 + m * 0.04), sy)
        g.lineTo(W / 2 + s * (W / 2 - m * 0.16), sy)
        g.stroke()
      }
    }
  }
  return c
}

// ---- the knob: a turned profile ----
function knobGeometry() {
  const pts = [
    [0, 0],
    [0.98, 0],
    [1.02, 0.07],
    [0.96, 0.2],
    [0.8, 0.45],
    [0.64, 0.9],
    [0.56, 1.4],
    [0.58, 1.85],
    [0.74, 2.3],
    [0.97, 2.85],
    [1.12, 3.4],
    [1.11, 3.9],
    [0.96, 4.35],
    [0.66, 4.72],
    [0.32, 4.92],
    [0, 4.98],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const curve = new THREE.SplineCurve(pts)
  const prof = curve.getPoints(90)
  prof[0].set(0, 0)
  prof[prof.length - 1].set(0, prof[prof.length - 1].y)
  return new THREE.LatheGeometry(prof, 64)
}

// A prop that can also be changed from inside the scene; `onChange` lets the
// owner stay in sync.
function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  return [
    v,
    (next) => {
      setV(next)
      onChange?.({ [key]: next })
    },
  ]
}

const easeOut = (t) => 1 - (1 - t) * (1 - t)
const easeIn = (t) => t * t * t
const clamp01 = (t) => Math.min(1, Math.max(0, t))

// design: text | geometric | monogram. text, subtext: what the die says.
// shape: rectangle | square | long. wood: oak | teak | walnut | maple | cherry.
// ink: the ink colour. inkLevel: how much is on the die (each print uses some).
// paperColor: the sheet. showFace: turn the stamp over to look at the die.
export default function Stamp({
  design = 'text',
  text = 'APPROVED',
  subtext = 'QUALITY CHECKED',
  shape = 'rectangle',
  wood = 'oak',
  ink = '#b3202b',
  inkLevel: inkProp = 1,
  paperColor = '#f6f2e8',
  showFace: faceProp = false,
  sound = false,
  onChange,
}) {
  const [inkLevel, setInkLevel] = useTwoWay(inkProp, 'inkLevel', onChange)
  const [showFace, setShowFace] = useTwoWay(faceProp, 'showFace', onChange)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)
  useCursor(hover || dragging, dragging ? 'grabbing' : 'pointer')
  const { camera, gl, controls } = useThree()

  const S = SHAPES[shape] || SHAPES.rectangle
  const dieW = S.w - INSET * 2
  const dieD = S.d - INSET * 2

  // ---- geometry ----
  const geo = useMemo(
    () => ({
      block: new RoundedBoxGeometry(S.w, S.h, S.d, 5, 0.14),
      cushion: new RoundedBoxGeometry(S.w - 0.03, CUSH_T, S.d - 0.03, 2, 0.02),
      die: new RoundedBoxGeometry(dieW, RUB_T, dieD, 2, 0.025),
      // the cut design, facing down (seen from below it reads in mirror)
      relief: new THREE.PlaneGeometry(dieW - 0.06, dieD - 0.06).rotateX(-Math.PI / 2),
      knob: knobGeometry(),
    }),
    [S.w, S.h, S.d, dieW, dieD],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  // ---- textures ----
  const woodTex = useMemo(() => {
    const w = WOODS[wood] || WOODS.oak
    const { col, bmp } = woodCanvases(w, 3)
    const mk = (canvas, srgb, rot) => {
      const t = new THREE.CanvasTexture(canvas)
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 8
      if (rot) {
        // on the knob the grain runs up its length
        t.center.set(0.5, 0.5)
        t.rotation = Math.PI / 2
        t.repeat.set(0.6, 1.4)
      }
      return t
    }
    return { col: mk(col, true), bmp: mk(bmp), knobCol: mk(col, true, true), knobBmp: mk(bmp, false, true) }
  }, [wood])
  useEffect(() => () => Object.values(woodTex).forEach((t) => t.dispose()), [woodTex])

  const designC = useMemo(() => designCanvas(design, text, subtext, dieW / dieD), [design, text, subtext, dieW, dieD])
  const designTex = useMemo(() => {
    const t = new THREE.CanvasTexture(designC)
    t.anisotropy = 8
    return t
  }, [designC])
  useEffect(() => () => designTex.dispose(), [designTex])

  const paper = useMemo(() => {
    const c = paperCanvas(paperColor)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return { c, t }
  }, [paperColor])
  useEffect(() => () => paper.t.dispose(), [paper])

  // ---- materials ----
  const mats = useMemo(
    () => ({
      // varnished wood: the grain under a satin clear coat
      wood: new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.65, clearcoatRoughness: 0.22 }),
      knob: new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.75, clearcoatRoughness: 0.18 }),
      cushion: new THREE.MeshStandardMaterial({ color: '#8e2a22', roughness: 0.95 }),
      die: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.9 }),
      relief: new THREE.MeshStandardMaterial({ roughness: 0.75, alphaTest: 0.5, side: THREE.BackSide }),
      paper: new THREE.MeshStandardMaterial({ roughness: 0.92 }),
      paperEdge: new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.95 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    for (const [m, c, b] of [
      [mats.wood, woodTex.col, woodTex.bmp],
      [mats.knob, woodTex.knobCol, woodTex.knobBmp],
    ]) {
      m.map = c
      m.bumpMap = b
      m.bumpScale = 0.5
      m.needsUpdate = true
    }
  }, [mats, woodTex])
  useEffect(() => {
    mats.relief.alphaMap = designTex
    mats.relief.bumpMap = designTex
    mats.relief.bumpScale = 2
    mats.relief.color.set('#1d1d1f').lerp(new THREE.Color(ink), 0.6 * clamp01(inkLevel))
    mats.relief.needsUpdate = true
  }, [mats, designTex, ink, inkLevel])
  useEffect(() => {
    mats.paper.map = paper.t
    mats.paper.needsUpdate = true
  }, [mats, paper])

  // ---- sound ----
  const audio = useRef(null)
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const live = useRef({})
  live.current = { ink, inkLevel, sound, showFace, designC, paper, dieW, dieD }
  const play = (name, arg) => {
    if (!live.current.sound) return
    if (!audio.current) audio.current = createStampAudio()
    audio.current?.[name](arg)
  }

  // ---- the print ----
  // The die's design, filled with ink, broken up where the ink is thin, at a
  // slight random angle, multiplied onto the paper.
  const print = (x, z, yaw) => {
    const { designC: dc, paper: p, ink: inkC, inkLevel: lvl, dieW: dw, dieD: dd } = live.current
    const pw = Math.round((dw - 0.06) * PAPER_PX)
    const ph = Math.round((dd - 0.06) * PAPER_PX)
    const tmp = Object.assign(document.createElement('canvas'), { width: pw, height: ph })
    const g = tmp.getContext('2d')
    g.drawImage(dc, 0, 0, pw, ph)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = inkC
    g.fillRect(0, 0, pw, ph)
    // mottle: blotches where the ink did not take, more as it runs dry
    g.globalCompositeOperation = 'destination-out'
    const dry = 1 - clamp01(lvl)
    const r = Math.random
    const n = Math.round(260 + dry * 2600)
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.15 + r() * (0.35 + dry * 0.6)
      g.beginPath()
      g.arc(r() * pw, r() * ph, 0.6 + r() * (2 + dry * 5), 0, Math.PI * 2)
      g.fill()
    }
    // a rocked stamp prints heavier on one side
    const side = g.createLinearGradient(0, 0, pw, ph * (r() - 0.5))
    const a = 0.05 + dry * 0.5
    side.addColorStop(r() < 0.5 ? 0 : 1, `rgba(0,0,0,${a})`)
    side.addColorStop(0.5, 'rgba(0,0,0,0)')
    g.globalAlpha = 1
    g.fillStyle = side
    g.fillRect(0, 0, pw, ph)

    const ctx = p.c.getContext('2d')
    ctx.save()
    ctx.translate((x + PAPER.w / 2) * PAPER_PX, (z + PAPER.d / 2) * PAPER_PX)
    ctx.rotate(-yaw)
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.18 + clamp01(lvl) * 0.8
    ctx.drawImage(tmp, -pw / 2, -ph / 2)
    ctx.restore()
    p.t.needsUpdate = true
  }

  // ---- motion ----
  const rootRef = useRef()
  const bodyRef = useRef()
  const upperRef = useRef()
  const cushionRef = useRef()
  const st = useRef({ x: 0.6, z: 0.4, yaw: 0, tx: 0.6, tz: 0.4, y: 0, t: -1, printed: false, squash: 0, flip: faceProp ? 1 : 0, lift: 0, tilt: 0, nextYaw: 0 })
  const grab = useRef(null)

  const stampNow = () => {
    const s = st.current
    if (s.t >= 0 || live.current.showFace) return
    s.t = 0
    s.printed = false
    s.nextYaw = THREE.MathUtils.degToRad((Math.random() - 0.5) * 3.5)
  }

  // pointer → a point on the desk under it
  const deskPoint = (clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, camera)
    const hit = new THREE.Vector3()
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT * 0.4), hit) ? hit : null
  }
  useEffect(() => {
    const move = (e) => {
      const gr = grab.current
      if (!gr) return
      if (!gr.moved && Math.hypot(e.clientX - gr.sx, e.clientY - gr.sy) > 5) {
        gr.moved = true
        setDragging(true)
      }
      if (gr.moved) {
        const p = deskPoint(e.clientX, e.clientY)
        if (p) {
          const s = st.current
          const lim = { x: PAPER.w / 2 + 3, z: PAPER.d / 2 + 2 }
          s.tx = THREE.MathUtils.clamp(p.x - gr.ox, -lim.x, lim.x)
          s.tz = THREE.MathUtils.clamp(p.z - gr.oz, -lim.z, lim.z)
        }
      }
    }
    const up = () => {
      const gr = grab.current
      if (!gr) return
      grab.current = null
      setDragging(false)
      if (controls) controls.enabled = true
      if (!gr.moved) {
        if (live.current.showFace) setShowFace(false)
        else stampNow()
      } else play('tap', 0.6)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  })

  const onDown = (e) => {
    e.stopPropagation()
    const s = st.current
    if (s.t >= 0) return
    const p = deskPoint(e.clientX, e.clientY)
    grab.current = { sx: e.clientX, sy: e.clientY, moved: false, ox: p ? p.x - s.x : 0, oz: p ? p.z - s.z : 0 }
    if (controls) controls.enabled = false
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    if (!(dt > 0)) return // a zero-length frame would divide by zero below
    const s = st.current
    const w = live.current
    const dragged = !!grab.current?.moved

    // sliding about when dragged: it follows the hand with a little lag and
    // leans into the direction of travel
    const k = 1 - Math.exp(-dt * 14)
    const vx = (s.tx - s.x) * k
    const vz = (s.tz - s.z) * k
    s.x += vx
    s.z += vz
    s.tilt += (THREE.MathUtils.clamp(vx / dt, -8, 8) * 0.012 - s.tilt) * (1 - Math.exp(-dt * 10))
    s.lift += ((dragged ? 0.55 : 0) - s.lift) * (1 - Math.exp(-dt * 12))

    // the stamping stroke
    let y = 0
    s.squash = 0
    if (s.t >= 0) {
      s.t += dt
      const t = s.t
      if (t < 0.24) {
        y = LIFT * easeOut(t / 0.24)
        s.yaw += (s.nextYaw - s.yaw) * (1 - Math.exp(-dt * 12))
      } else if (t < 0.36) y = LIFT * (1 - easeIn((t - 0.24) / 0.12))
      else if (t < 0.54) {
        if (!s.printed) {
          s.printed = true
          print(s.x, s.z, s.yaw)
          play('thump', 0.5 + w.inkLevel * 0.5)
          setInkLevel(Math.max(0, +(w.inkLevel - 0.12).toFixed(2)))
        }
        s.squash = Math.sin(Math.PI * clamp01((t - 0.36) / 0.18))
      } else if (t < 0.8) y = 0.7 * easeOut((t - 0.54) / 0.26)
      else if (t < 1.05) y = 0.7 * (1 - easeIn((t - 0.8) / 0.25))
      else {
        s.t = -1
        play('tap', 0.4)
      }
    }
    s.y = y

    // turning it over to look at the die
    s.flip += ((w.showFace ? 1 : 0) - s.flip) * (1 - Math.exp(-dt * 6))
    const f = s.flip
    const fe = f * f * (3 - 2 * f)

    rootRef.current.position.set(s.x, PAPER.t + s.y + s.lift + fe * 4.2, s.z)
    rootRef.current.rotation.set(s.tilt * 0.4, s.yaw, -s.tilt)
    // the turn is about the block's middle
    bodyRef.current.position.y = -(RELIEF + RUB_T + CUSH_T + S.h / 2)
    bodyRef.current.parent.rotation.x = -2.05 * fe
    cushionRef.current.scale.y = 1 - s.squash * 0.38
    upperRef.current.position.y = RELIEF + RUB_T + CUSH_T * (1 - s.squash * 0.38)
  })

  const pivotY = RELIEF + RUB_T + CUSH_T + S.h / 2

  return (
    <group>
      {/* the sheet of paper */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, PAPER.t / 2, 0]} material={mats.paperEdge} receiveShadow>
          <boxGeometry args={[PAPER.w, PAPER.t, PAPER.d]} />
        </mesh>
        <mesh position={[0, PAPER.t + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.paper} receiveShadow>
          <planeGeometry args={[PAPER.w, PAPER.d]} />
        </mesh>
      </group>

      <group ref={rootRef}>
        <group position={[0, pivotY, 0]}>
          <group
            ref={bodyRef}
            onPointerDown={onDown}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(true)
            }}
            onPointerOut={() => setHover(false)}
          >
            {/* the cut design and the die it is cut from */}
            <mesh geometry={geo.relief} material={mats.relief} position={[0, 0.0005, 0]} />
            <mesh geometry={geo.die} material={mats.die} position={[0, RELIEF + RUB_T / 2, 0]} castShadow />
            {/* the foam cushion, which squashes as the stamp lands */}
            <group ref={cushionRef} position={[0, RELIEF + RUB_T, 0]}>
              <mesh geometry={geo.cushion} material={mats.cushion} position={[0, CUSH_T / 2, 0]} castShadow />
            </group>
            {/* the block and its knob ride on the cushion */}
            <group ref={upperRef}>
              <mesh geometry={geo.block} material={mats.wood} position={[0, S.h / 2, 0]} castShadow receiveShadow />
              <mesh geometry={geo.knob} material={mats.knob} position={[0, S.h - 0.02, 0]} scale={S.knob} castShadow receiveShadow />
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
