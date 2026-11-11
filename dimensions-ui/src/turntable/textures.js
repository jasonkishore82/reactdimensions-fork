import * as THREE from 'three'
import { KNOB, LABEL_R, PLINTH, POWER, REC_R } from './arm.js'

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function noise1(seed) {
  const r = rng(seed)
  const g = Float32Array.from({ length: 512 }, () => r())
  return (x) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return g[i & 511] * (1 - u) + g[(i + 1) & 511] * u
  }
}

const luminance = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

// ---------------------------------------------------------------- wood top

// World position on the plinth -> pixel on the wood canvas (grain runs along x).
const W = 2048
const H = Math.round((W * PLINTH.d) / PLINTH.w)
const px = (x) => ((x + PLINTH.w / 2) / PLINTH.w) * W
const py = (z) => ((z + PLINTH.d / 2) / PLINTH.d) * H

export function woodTexture({ color, grain = 0.6 }) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const base = new THREE.Color(color)
  const dark = luminance(base) < 0.12
  g.fillStyle = `#${base.getHexString()}`
  g.fillRect(0, 0, W, H)

  // Broad tonal bands across the grain
  const n = noise1(7)
  for (let y = 0; y < H; y++) {
    const v = (n(y * 0.018) - 0.5) * 0.5 + (n(y * 0.07 + 40) - 0.5) * 0.25
    g.fillStyle = v > 0 ? `rgba(255,235,200,${v * 0.22 * grain})` : `rgba(10,4,0,${-v * 0.5 * grain})`
    g.fillRect(0, y, W, 1)
  }

  // Fine grain: long wavering streaks
  const r = rng(21)
  const streaks = Math.round(3200 * (0.4 + grain))
  for (let i = 0; i < streaks; i++) {
    const y0 = r() * H
    const x0 = r() * W - 200
    const len = 220 + r() * 1100
    const amp = 0.6 + r() * 3.2
    const freq = 0.003 + r() * 0.01
    const ph = r() * 6.28
    const light = r() > 0.62
    const a = (0.035 + r() * 0.1) * grain * (dark ? 1.5 : 1)
    g.strokeStyle = light ? `rgba(255,228,190,${a * 0.7})` : `rgba(18,8,2,${a})`
    g.lineWidth = 0.6 + r() * 2.2
    g.beginPath()
    for (let x = 0; x <= len; x += 28) g.lineTo(x0 + x, y0 + Math.sin(x * freq + ph) * amp)
    g.stroke()
  }
  // A few dark pores
  for (let i = 0; i < 900 * grain; i++) {
    g.fillStyle = `rgba(20,8,2,${0.1 + r() * 0.25})`
    g.fillRect(r() * W, r() * H, 6 + r() * 26, 1)
  }

  // Printed legends: speed selector and power symbol
  const ink = luminance(base) > 0.55 ? 'rgba(30,24,18,0.9)' : 'rgba(245,236,220,0.92)'
  g.fillStyle = ink
  g.strokeStyle = ink
  g.textBaseline = 'middle'
  g.font = '600 30px "IBM Plex Mono", Menlo, monospace'
  const dots = [
    [KNOB.x + 0.52, KNOB.z - 0.16, '33'],
    [KNOB.x + 0.52, KNOB.z + 0.16, '45'],
  ]
  for (const [x, z, label] of dots) {
    g.beginPath()
    g.arc(px(x), py(z), 5, 0, Math.PI * 2)
    g.fill()
    g.fillText(label, px(x + 0.16), py(z) + 2)
  }
  const cx = px(POWER.x)
  const cy = py(POWER.z + 0.46)
  g.lineWidth = 3.2
  g.lineCap = 'round'
  g.beginPath()
  g.arc(cx, cy + 2, 11, -Math.PI / 2 + 0.65, -Math.PI / 2 - 0.65 + Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.moveTo(cx, cy - 12)
  g.lineTo(cx, cy + 1)
  g.stroke()

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  // ExtrudeGeometry's top face uses raw shape coordinates as UVs.
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / PLINTH.w, 1 / PLINTH.d)
  t.offset.set(0.5, 0.5)
  return t
}

// The record artwork lives in vinyl/textures.js (shared with the Vinyl Record component).
export { sheenTexture, vinylTextures } from '../vinyl/textures.js'
