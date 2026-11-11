import * as THREE from 'three'

// Card texture resolution. Real cards are 85.6 x 53.98 mm (ratio ~1.586).
export const TEX_W = 2048
export const TEX_H = Math.round(TEX_W / 1.586)

const FONT = "'IBM Plex Mono', 'Menlo', monospace"

// Each layout is drawn three times with different "inks":
//  - color: what you see
//  - orm:   roughness (G) + metalness (B) so printed text reads as foil
//  - bump:  white ink on black, so the text is slightly raised and catches light
const INKS = {
  color: { bg: '#34363b', ink: '#f2f2f2', dim: '#cfcfcf' },
  orm: { bg: 'rgb(0,120,30)', ink: 'rgb(0,70,235)', dim: 'rgb(0,70,235)' },
  bump: { bg: '#000', ink: '#fff', dim: '#bbb' },
}

// Everything printed on the card. Each key is also a prop on the card component.
export const DEFAULT_TEXT = {
  brand: 'DIMENSIONS',
  tier: 'Studio Pass',
  number: '8560 5398 0003 2026',
  version: 'v1.0',
  expiresTop: 'EXPIRES',
  expiresBottom: 'END',
  expiry: '00-00',
  holder: 'FOUNDING MEMBER',
  cvv: '123',
  signatureNote: 'AUTHORIZED SIGNATURE — NOT VALID UNLESS SIGNED',
  backLine1: 'Rendered in real time. No image assets were used to make this card.',
  backLine2: '85.60 x 53.98 mm  /  clear-coat PBR  /  spring physics',
  backName: 'react-dimensions',
}

function makeCanvas() {
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  return c
}

// maxWidth squeezes long custom text so it stays in its slot on the card.
function text(ctx, str, x, y, size, { align = 'left', weight = 500, spacing = 0, fill, maxWidth } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = fill
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
  if (maxWidth) ctx.fillText(str, x, y, maxWidth)
  else ctx.fillText(str, x, y)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

// Proportions measured from the reference image.
function drawFront(ctx, ink, copy) {
  const W = TEX_W
  const H = TEX_H
  ctx.fillStyle = ink.bg
  ctx.fillRect(0, 0, W, H)

  const left = W * 0.115

  // Bank logo: a quarter-disc "sail"
  const ly = H * 0.15
  const ls = H * 0.055
  ctx.fillStyle = ink.ink
  ctx.beginPath()
  ctx.moveTo(left, ly + ls)
  ctx.lineTo(left, ly + ls * 0.25)
  ctx.quadraticCurveTo(left + ls * 0.15, ly - ls, left + ls * 1.25, ly - ls)
  ctx.lineTo(left + ls * 1.25, ly + ls)
  ctx.closePath()
  ctx.fill()

  text(ctx, copy.brand, left + ls * 1.55, ly, H * 0.072, { weight: 600, spacing: 4, fill: ink.ink, maxWidth: W * 0.33 })
  text(ctx, copy.tier, W * 0.877, ly, H * 0.07, { align: 'right', weight: 500, spacing: 4, fill: ink.ink, maxWidth: W * 0.35 })

  // Contactless symbol
  const cx = W * 0.825
  const cy = H * 0.41
  ctx.strokeStyle = ink.ink
  ctx.lineCap = 'round'
  ctx.lineWidth = H * 0.012
  ;[0.025, 0.05, 0.075].forEach((r, i) => {
    ctx.beginPath()
    ctx.arc(cx, cy, H * r + i * H * 0.004, -Math.PI / 3.2, Math.PI / 3.2)
    ctx.stroke()
  })

  // Card number
  // Spread the groups evenly between the left margin and right margin,
  // shrinking the type if a long number wouldn't otherwise fit.
  const groups = copy.number.trim().split(/\s+/).filter(Boolean)
  const numRight = W * 0.877
  const avail = numRight - left
  const minGap = W * 0.02
  const measure = (size) => {
    ctx.font = `500 ${size}px ${FONT}`
    if ('letterSpacing' in ctx) ctx.letterSpacing = '8px'
    return groups.map((g) => ctx.measureText(g).width)
  }
  const gaps = Math.max(groups.length - 1, 1)
  const sum = (list) => list.reduce((a, b) => a + b, 0)
  let numSize = H * 0.095
  let widths = measure(numSize)
  const needed = sum(widths) + minGap * gaps
  if (needed > avail) {
    numSize *= avail / needed
    widths = measure(numSize)
  }
  const gap = Math.max((avail - sum(widths)) / gaps, 0)
  let gx = left
  groups.forEach((g, i) => {
    text(ctx, g, gx, H * 0.606, numSize, { weight: 500, spacing: 8, fill: ink.ink })
    gx += widths[i] + gap
  })

  text(ctx, copy.version, left, H * 0.72, H * 0.055, { weight: 500, spacing: 4, fill: ink.dim, maxWidth: W * 0.4 })

  // Expiry
  text(ctx, copy.expiresTop, W * 0.69, H * 0.755, H * 0.022, { align: 'right', weight: 600, fill: ink.dim, maxWidth: W * 0.2 })
  text(ctx, copy.expiresBottom, W * 0.69, H * 0.785, H * 0.022, { align: 'right', weight: 600, fill: ink.dim, maxWidth: W * 0.2 })
  text(ctx, copy.expiry, W * 0.877, H * 0.77, H * 0.07, { align: 'right', weight: 500, spacing: 6, fill: ink.ink, maxWidth: W * 0.17 })

  text(ctx, copy.holder, left, H * 0.915, H * 0.065, { weight: 500, spacing: 6, fill: ink.ink, maxWidth: W * 0.76 })
}

function drawBack(ctx, ink, layer, copy) {
  const W = TEX_W
  const H = TEX_H
  ctx.fillStyle = ink.bg
  ctx.fillRect(0, 0, W, H)

  // Magnetic stripe: glossy black, slightly raised
  if (layer === 'color') ctx.fillStyle = '#060606'
  else if (layer === 'orm') ctx.fillStyle = 'rgb(0,40,120)'
  else ctx.fillStyle = '#333'
  ctx.fillRect(0, H * 0.1, W, H * 0.2)

  // Signature panel
  const sx = W * 0.07
  const sy = H * 0.4
  const sw = W * 0.62
  const sh = H * 0.15
  if (layer === 'color') {
    const grad = ctx.createLinearGradient(sx, 0, sx + sw, 0)
    grad.addColorStop(0, '#e9ebee')
    grad.addColorStop(1, '#d4d8dc')
    ctx.fillStyle = grad
    ctx.fillRect(sx, sy, sw, sh)
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 6
    for (let x = sx - sh; x < sx + sw; x += 26) {
      ctx.beginPath()
      ctx.moveTo(Math.max(x, sx), sy + Math.max(0, sx - x))
      ctx.lineTo(Math.min(x + sh, sx + sw), sy + sh - Math.max(0, x + sh - sx - sw))
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = layer === 'orm' ? 'rgb(0,200,0)' : '#111'
    ctx.fillRect(sx, sy, sw, sh)
  }

  // CVV box
  ctx.fillStyle = layer === 'color' ? '#ffffff' : layer === 'orm' ? 'rgb(0,200,0)' : '#111'
  ctx.fillRect(sx + sw + W * 0.02, sy, W * 0.13, sh)
  text(ctx, copy.cvv, sx + sw + W * 0.085, sy + sh / 2, H * 0.06, {
    align: 'center',
    weight: 600,
    fill: layer === 'color' ? '#1c1d1f' : ink.bg,
    maxWidth: W * 0.11,
  })

  const small = H * 0.032
  const wide = W * 0.86
  text(ctx, copy.signatureNote, sx, H * 0.6, small, { weight: 500, spacing: 2, fill: ink.dim, maxWidth: wide })
  text(ctx, copy.backLine1, sx, H * 0.7, small, { weight: 400, fill: ink.dim, maxWidth: wide })
  text(ctx, copy.backLine2, sx, H * 0.75, small, { weight: 400, fill: ink.dim, maxWidth: wide })
  text(ctx, copy.backName, sx, H * 0.85, H * 0.04, { weight: 500, spacing: 2, fill: ink.ink, maxWidth: W * 0.5 })

  // Small bank mark bottom-right
  text(ctx, copy.brand, W * 0.93, H * 0.88, H * 0.05, { align: 'right', weight: 600, spacing: 4, fill: ink.ink, maxWidth: W * 0.3 })
}

function drawChip(ctx, layer) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height

  // Base: warm polished gold, with a soft diagonal sheen and fine brushing.
  if (layer === 'color') {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#f3cf86')
    g.addColorStop(0.35, '#e0ac5a')
    g.addColorStop(0.6, '#f6d690')
    g.addColorStop(1, '#c48b3e')
    ctx.fillStyle = g
  } else if (layer === 'orm') {
    ctx.fillStyle = 'rgb(0,95,200)' // fairly smooth, mostly metallic
  } else {
    ctx.fillStyle = '#808080'
  }
  ctx.fillRect(0, 0, W, H)

  // Brushed-metal streaks (tiny height/roughness variation).
  const rand = mulberry32(7)
  for (let i = 0; i < 260; i++) {
    const y = rand() * H
    const dy = (rand() - 0.5) * 6
    const a = 0.03 + rand() * 0.05
    const light = rand() > 0.5
    const w = 1 + rand() * 1.5
    if (layer === 'color') ctx.strokeStyle = light ? `rgba(255,240,200,${a})` : `rgba(120,70,20,${a})`
    else if (layer === 'orm') ctx.strokeStyle = `rgba(0,${light ? 70 : 130},200,0.25)`
    else ctx.strokeStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y + dy)
    ctx.stroke()
  }

  // Thin engraved lines separating the contact pads.
  // Grooves: dark, rough, non-metallic, and recessed in the bump map.
  ctx.strokeStyle =
    layer === 'color' ? 'rgba(92,55,18,0.9)' : layer === 'orm' ? 'rgb(0,200,40)' : '#000'
  ctx.lineWidth = W * 0.011
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  const path = (pts) => {
    ctx.beginPath()
    ctx.moveTo(pts[0][0] * W, pts[0][1] * H)
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x * W, y * H)
    ctx.stroke()
  }
  // Centre pad
  ctx.beginPath()
  ctx.roundRect(W * 0.37, H * 0.3, W * 0.26, H * 0.4, W * 0.035)
  ctx.stroke()
  // Left and right pads: horizontal rails
  path([[0, 0.34], [0.37, 0.34]])
  path([[0, 0.66], [0.37, 0.66]])
  path([[0.63, 0.34], [1, 0.34]])
  path([[0.63, 0.66], [1, 0.66]])
  // Top / bottom: lines that step out from the centre pad
  path([[0.5, 0], [0.5, 0.3]])
  path([[0.5, 0.7], [0.5, 1]])
  path([[0.3, 0], [0.3, 0.2], [0.37, 0.27]])
  path([[0.7, 0], [0.7, 0.2], [0.63, 0.27]])
  path([[0.3, 1], [0.3, 0.8], [0.37, 0.73]])
  path([[0.7, 1], [0.7, 0.8], [0.63, 0.73]])

  // Bevelled rim highlight so the edge reads as a raised plate.
  if (layer === 'color') {
    ctx.strokeStyle = 'rgba(255,235,190,0.55)'
    ctx.lineWidth = W * 0.02
    ctx.strokeRect(W * 0.01, H * 0.01, W * 0.98, H * 0.98)
  }
}

// Small seeded RNG so the brushed texture is the same on every layer.
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function toTexture(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 16
  t.needsUpdate = true
  return t
}

// The printed colours for a card colour: dark ink on light cards, light ink on dark ones.
function colorInk(color) {
  const { r, g, b } = new THREE.Color(color) // linear values
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2
  return { bg: color, ink: light ? '#17181a' : '#f2f2f2', dim: light ? '#3c3e42' : '#cfcfcf' }
}

export function createFaceTextures(side, custom = {}, color) {
  const copy = { ...DEFAULT_TEXT, ...custom }
  const out = {}
  for (const layer of ['color', 'orm', 'bump']) {
    const c = makeCanvas()
    const ctx = c.getContext('2d')
    const ink = layer === 'color' && color ? colorInk(color) : INKS[layer]
    if (side === 'front') drawFront(ctx, ink, copy)
    else drawBack(ctx, ink, layer, copy)
    out[layer] = toTexture(c, layer === 'color')
  }
  return out
}

export function createChipTextures() {
  const out = {}
  for (const layer of ['color', 'orm', 'bump']) {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 400
    drawChip(c.getContext('2d'), layer)
    out[layer] = toTexture(c, layer === 'color')
  }
  return out
}
