import * as THREE from 'three'

// Wood and shell textures drawn on canvases, so there are no image files to
// ship. Every texture's grain runs along its v (vertical) axis; the geometry
// maps v along the grain direction of the real part.

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function finish(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  return t
}

// straight grain: thin vertical lines of varying darkness that wander a little
function grain(ctx, w, h, rand, { lines, dark, light, wander, alpha }) {
  for (let i = 0; i < lines; i++) {
    const x0 = rand() * w
    const width = 0.4 + rand() * 2.2
    const isDark = rand() < 0.7
    ctx.strokeStyle = isDark ? dark : light
    ctx.globalAlpha = alpha * (0.3 + rand() * 0.7)
    ctx.lineWidth = width
    ctx.beginPath()
    const ph = rand() * 6.28
    const amp = wander * (0.3 + rand())
    for (let y = 0; y <= h; y += 16) {
      const x = x0 + Math.sin(y / h * 6.28 * 1.5 + ph) * amp + Math.sin(y / 37 + ph) * 0.6
      if (y === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// Sitka spruce top: pale amber, tight even grain, faint cross-silk (medullary rays)
export function spruceTexture(tint = '#d9a456') {
  const [c, ctx] = canvas(1024, 1024)
  const rand = rng(11)
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, 1024, 1024)
  // the bookmatched halves are a touch different in tone
  const g = ctx.createLinearGradient(0, 0, 1024, 0)
  g.addColorStop(0, 'rgba(120,60,10,0.10)')
  g.addColorStop(0.5, 'rgba(255,230,170,0.08)')
  g.addColorStop(1, 'rgba(120,60,10,0.10)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 1024)
  grain(ctx, 1024, 1024, rand, { lines: 260, dark: '#9a5a1c', light: '#f3c98a', wander: 3, alpha: 0.35 })
  // cross-silk
  for (let i = 0; i < 220; i++) {
    ctx.globalAlpha = 0.05 + rand() * 0.06
    ctx.fillStyle = '#fff1cf'
    ctx.fillRect(rand() * 1024, rand() * 1024, 8 + rand() * 30, 1 + rand() * 2)
  }
  ctx.globalAlpha = 1
  return finish(c)
}

// East Indian rosewood: dark chocolate with purple-black streaks
export function rosewoodTexture(base = '#4a2416') {
  const [c, ctx] = canvas(1024, 1024)
  const rand = rng(23)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 1024, 1024)
  // broad bands of lighter and darker wood
  for (let i = 0; i < 40; i++) {
    const x = rand() * 1024
    const w = 10 + rand() * 60
    ctx.globalAlpha = 0.12 + rand() * 0.15
    ctx.fillStyle = rand() < 0.5 ? '#1c0b06' : '#7a3f22'
    ctx.fillRect(x, 0, w, 1024)
  }
  grain(ctx, 1024, 1024, rand, { lines: 420, dark: '#120604', light: '#8d4c2a', wander: 6, alpha: 0.4 })
  // pores
  for (let i = 0; i < 2500; i++) {
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#0e0403'
    ctx.fillRect(rand() * 1024, rand() * 1024, 1, 3 + rand() * 6)
  }
  ctx.globalAlpha = 1
  return finish(c)
}

// mahogany neck: warm red-brown, fine grain
export function mahoganyTexture() {
  const [c, ctx] = canvas(512, 1024)
  const rand = rng(37)
  ctx.fillStyle = '#6a3018'
  ctx.fillRect(0, 0, 512, 1024)
  grain(ctx, 512, 1024, rand, { lines: 200, dark: '#3a160a', light: '#8e4826', wander: 2, alpha: 0.35 })
  return finish(c)
}

// ebony-ish fingerboard
export function ebonyTexture() {
  const [c, ctx] = canvas(256, 1024)
  const rand = rng(41)
  ctx.fillStyle = '#1d140f'
  ctx.fillRect(0, 0, 256, 1024)
  grain(ctx, 256, 1024, rand, { lines: 120, dark: '#070403', light: '#3a2a20', wander: 1.5, alpha: 0.45 })
  return finish(c)
}

// tortoiseshell pickguard: deep red-brown mottled with amber and near-black
export function tortoiseTexture() {
  const [c, ctx] = canvas(512, 512)
  const rand = rng(53)
  ctx.fillStyle = '#4a1409'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 900; i++) {
    const x = rand() * 512
    const y = rand() * 512
    const r = 2 + rand() * 18
    const pick = rand()
    ctx.globalAlpha = 0.18 + rand() * 0.35
    ctx.fillStyle = pick < 0.45 ? '#160403' : pick < 0.8 ? '#7e2a10' : '#b85a1c'
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.5 + rand() * 0.8), rand() * 3, 0, 6.29)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  return finish(c)
}

// the rosette's mosaic band: a ring of tiny alternating tiles (u runs round the ring)
export function mosaicTexture() {
  const [c, ctx] = canvas(1024, 32)
  for (let i = 0; i < 128; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#1a120c' : '#d8c7a0'
      ctx.fillRect(i * 8, j * 8, 8, 8)
    }
  }
  return finish(c)
}
