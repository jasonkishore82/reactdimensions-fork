import * as THREE from 'three'
import { LENGTH } from './profile.js'

const W = 1024
const H = 3072
const HEAD_PX = (1.15 / LENGTH) * H // the head, in texture rows
const SNOUT_PX = (0.34 / LENGTH) * H // the snout cap

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Smooth value noise, so the pattern forms blotches instead of static.
function makeNoise(seed) {
  const r = rng(seed)
  const N = 256
  const grid = Float32Array.from({ length: N * N }, () => r())
  const at = (x, y) => grid[((y & (N - 1)) * N) + (x & (N - 1))]
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

const hex = (c) => {
  const col = new THREE.Color(c)
  return [col.r * 255, col.g * 255, col.b * 255]
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgb = (c, k = 1) => `rgb(${Math.max(0, Math.min(255, c[0] * k)) | 0},${Math.max(0, Math.min(255, c[1] * k)) | 0},${Math.max(0, Math.min(255, c[2] * k)) | 0})`
const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

// Draws one overlapping scale: a rounded leaf, lit from its centre.
function scale(ctx, cx, cy, hw, hh, col, bump) {
  const g = ctx.createRadialGradient(cx, cy - hh * 0.15, hh * 0.05, cx, cy, hh * 1.05)
  if (bump) {
    g.addColorStop(0, '#f2f2f2')
    g.addColorStop(0.55, '#b4b4b4')
    g.addColorStop(1, '#3c3c3c')
  } else {
    g.addColorStop(0, rgb(col, 1.35))
    g.addColorStop(0.5, rgb(col, 1.0))
    g.addColorStop(1, rgb(col, 0.5))
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cx - hw, cy - hh * 0.1)
  ctx.bezierCurveTo(cx - hw, cy - hh * 1.05, cx + hw, cy - hh * 1.05, cx + hw, cy - hh * 0.1)
  ctx.bezierCurveTo(cx + hw * 0.9, cy + hh * 0.75, cx + hw * 0.25, cy + hh * 1.05, cx, cy + hh * 1.12)
  ctx.bezierCurveTo(cx - hw * 0.25, cy + hh * 1.05, cx - hw * 0.9, cy + hh * 0.75, cx - hw, cy - hh * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = bump ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.32)'
  ctx.lineWidth = Math.max(hw * 0.09, 1)
  ctx.stroke()
}

export function makeSnakeTextures({ back, belly, pattern, patternAmount = 0.55, scales = 22, seed = 5 }) {
  const cols = Math.round(scales)
  const cellW = W / cols
  const circ = 1.05 // typical body circumference, to keep scales near-square on the mesh
  const cellPhys = circ / cols
  const rows = Math.round(LENGTH / (cellPhys * 1.3))
  const cellH = H / rows

  const cBack = hex(back)
  const cBelly = hex(belly)
  const cPat = hex(pattern)
  const rand = rng(seed)
  const noise = makeNoise(seed + 11)
  const noise2 = makeNoise(seed + 29)

  const color = document.createElement('canvas')
  const bump = document.createElement('canvas')
  color.width = bump.width = W
  color.height = bump.height = H
  const ctx = color.getContext('2d')
  const bctx = bump.getContext('2d')
  ctx.fillStyle = rgb(mix(cBack, [0, 0, 0], 0.5))
  ctx.fillRect(0, 0, W, H)
  bctx.fillStyle = '#202020'
  bctx.fillRect(0, 0, W, H)

  const thr = 1 - patternAmount * 0.7

  // Colour of one scale from its position: belly -> flank -> back, blotches.
  const scaleColor = (u, v, jitter) => {
    const bd = Math.abs(u - 0.5) // distance from belly centre
    const bellyW = 1 - smooth(0.16, 0.27, bd)
    const n = noise(u * 6 + 3, v * 30) * 0.7 + noise2(u * 14, v * 90) * 0.3
    const blotch = smooth(thr, thr + 0.14, n)
    let c = mix(cBack, cPat, blotch * 0.92 * (1 - bellyW))
    c = mix(c, cBelly, bellyW)
    // dark speckling where belly meets flank
    const speck = smooth(0.78, 0.9, noise2(u * 31 + 7, v * 160)) * smooth(0.1, 0.18, bd) * (1 - smooth(0.22, 0.3, bd))
    c = mix(c, mix(cBack, [0, 0, 0], 0.2), speck * 0.75)
    const k = 0.9 + jitter * 0.22
    return [c[0] * k, c[1] * k, c[2] * k]
  }

  // Back and flank scales, drawn tail to head so each overlaps the next.
  const drawRows = (fromRow, toRow, rowH, rowCols, hwMul, hhMul) => {
    const cw = W / rowCols
    for (let r = toRow; r >= fromRow; r--) {
      const off = r % 2 ? 0.5 : 0
      for (let c = 0; c < rowCols; c++) {
        const cx = (c + 0.5 + off) * cw
        const cy = (r + 0.5) * rowH
        const u = (((cx % W) + W) % W) / W
        const v = cy / H
        const col = scaleColor(u, v, rand())
        const hw = cw * hwMul
        const hh = rowH * hhMul
        const offs = cx - hw < 0 ? [0, W] : cx + hw > W ? [0, -W] : [0]
        for (const o of offs) {
          scale(ctx, cx + o, cy, hw, hh, col, false)
          scale(bctx, cx + o, cy, hw, hh, col, true)
        }
      }
    }
  }
  const bodyStart = Math.floor(HEAD_PX / cellH)
  drawRows(bodyStart, rows - 1, cellH, cols, 0.62, 0.78)
  // The head has a few large plates instead of many small scales, which also
  // hides the pinching of the texture at the snout.
  const headRowH = cellH * 1.7
  drawRows(Math.ceil(SNOUT_PX / headRowH), Math.ceil(HEAD_PX / headRowH), headRowH, 11, 0.64, 0.74)
  // The very tip stays smooth: the texture pinches to a point there.
  const tip = ctx.createLinearGradient(0, 0, 0, SNOUT_PX + 18)
  tip.addColorStop(0, rgb(mix(cBack, [0, 0, 0], 0.15)))
  tip.addColorStop(1, rgb(mix(cBack, [0, 0, 0], 0.15)) .replace('rgb', 'rgba').replace(')', ',0)'))
  ctx.fillStyle = tip
  ctx.fillRect(0, 0, W, SNOUT_PX + 18)
  bctx.fillStyle = '#808080'
  bctx.fillRect(0, 0, W, SNOUT_PX * 0.7)

  // Belly: wide plates across the underside, one per ~1.6 dorsal rows.
  const plateH = cellH * 1.7
  const plates = Math.round(H / plateH)
  const bx0 = W * 0.3
  const bx1 = W * 0.7
  for (let r = plates - 1; r >= 0; r--) {
    const cy = (r + 0.5) * plateH
    if (cy < 18) continue
    const v = cy / H
    const j = rand()
    const g = ctx.createLinearGradient(0, cy - plateH * 0.6, 0, cy + plateH * 0.7)
    const base = mix(cBelly, [255, 255, 255], 0.05)
    const speck = noise2(7.3, v * 90) > 0.68 ? 0.82 : 1
    g.addColorStop(0, rgb(base, (1.08 + j * 0.05) * speck))
    g.addColorStop(0.6, rgb(base, 0.97 * speck))
    g.addColorStop(1, rgb(base, 0.8 * speck))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(bx0, cy - plateH * 0.56, bx1 - bx0, plateH * 1.12, plateH * 0.42)
    ctx.fill()
    ctx.strokeStyle = 'rgba(60,40,20,0.28)'
    ctx.lineWidth = 2
    ctx.stroke()
    const bg = bctx.createLinearGradient(0, cy - plateH * 0.6, 0, cy + plateH * 0.7)
    bg.addColorStop(0, '#d8d8d8')
    bg.addColorStop(0.7, '#a8a8a8')
    bg.addColorStop(1, '#6a6a6a')
    bctx.fillStyle = bg
    bctx.beginPath()
    bctx.roundRect(bx0, cy - plateH * 0.56, bx1 - bx0, plateH * 1.12, plateH * 0.42)
    bctx.fill()
    bctx.strokeStyle = 'rgba(0,0,0,0.45)'
    bctx.lineWidth = 2.5
    bctx.stroke()
  }

  // Mouth line down each side of the head, and the snout seam.
  for (const [cc, bc] of [[ctx, 'rgba(18,10,4,0.95)'], [bctx, '#000']]) {
    cc.strokeStyle = bc
    cc.lineCap = 'round'
    cc.lineWidth = 7
    for (const sgn of [-1, 1]) {
      cc.beginPath()
      cc.moveTo(W * (0.5 + sgn * 0.03), 4)
      cc.bezierCurveTo(W * (0.5 + sgn * 0.17), HEAD_PX * 0.1, W * (0.5 + sgn * 0.2), HEAD_PX * 0.5, W * (0.5 + sgn * 0.19), HEAD_PX * 0.86)
      cc.stroke()
    }
  }

  const map = new THREE.CanvasTexture(color)
  map.colorSpace = THREE.SRGBColorSpace
  const bumpMap = new THREE.CanvasTexture(bump)
  for (const t of [map, bumpMap]) {
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.anisotropy = 16
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
  }
  return { map, bumpMap, dispose: () => { map.dispose(); bumpMap.dispose() } }
}
