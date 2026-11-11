import * as THREE from 'three'

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function tex(c, { srgb = false, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 16
  return t
}

// Brushed stainless: fine horizontal streaks in the roughness channel (G).
export function brushedSteel() {
  const [c, ctx] = canvas(1024, 1024)
  ctx.fillStyle = 'rgb(0,80,255)'
  ctx.fillRect(0, 0, 1024, 1024)
  const r = rng(3)
  for (let i = 0; i < 3500; i++) {
    const y = r() * 1024
    const g = 50 + r() * 70
    ctx.strokeStyle = `rgba(0,${g | 0},255,${0.15 + r() * 0.35})`
    ctx.lineWidth = 0.5 + r() * 1.5
    const x = r() * 1024
    const len = 200 + r() * 800
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
    // wrap so the texture tiles
    ctx.beginPath()
    ctx.moveTo(x - 1024, y)
    ctx.lineTo(x + len - 1024, y)
    ctx.stroke()
  }
  return tex(c, { repeat: [0.5, 0.5] })
}

// Chunky off-road tread. Lathe UVs: u runs around the tyre, v across it.
export function treadBump() {
  const [c, ctx] = canvas(2048, 256)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 2048, 256)
  const blocks = 36
  const bw = 2048 / blocks
  for (let i = 0; i < blocks; i++) {
    const x = i * bw
    const off = i % 2 ? 0.12 : 0
    ctx.fillStyle = '#fff'
    // two staggered rows of blocks with a centre groove
    ctx.beginPath()
    ctx.moveTo(x + bw * 0.1, 256 * (0.12 + off))
    ctx.lineTo(x + bw * 0.85, 256 * (0.18 + off))
    ctx.lineTo(x + bw * 0.75, 256 * 0.47)
    ctx.lineTo(x + bw * 0.05, 256 * 0.47)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x + bw * 0.05, 256 * 0.53)
    ctx.lineTo(x + bw * 0.75, 256 * 0.53)
    ctx.lineTo(x + bw * 0.85, 256 * (0.82 - off))
    ctx.lineTo(x + bw * 0.1, 256 * (0.88 - off))
    ctx.fill()
  }
  return tex(c)
}

// Angular aero wheel cover, drawn for a cylinder cap (circle fills the square).
export function wheelCover() {
  const S = 1024
  const [c, ctx] = canvas(S, S)
  const [b, bctx] = canvas(S, S)
  const cx = S / 2
  const R = S / 2

  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, R)
  g.addColorStop(0, '#3a3d42')
  g.addColorStop(0.8, '#2a2c30')
  g.addColorStop(1, '#141517')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  bctx.fillStyle = '#808080'
  bctx.fillRect(0, 0, S, S)

  // Six faceted blades sweeping from the hub.
  const blades = 6
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2
    const pts = [
      [0.18, a - 0.12],
      [0.92, a + 0.18],
      [0.92, a + 0.55],
      [0.24, a + 0.42],
    ].map(([r, t]) => [cx + Math.cos(t) * r * R, cx + Math.sin(t) * r * R])
    for (const [cc, fill, stroke] of [
      [ctx, '#1b1c1f', '#4b4f55'],
      [bctx, '#2a2a2a', '#ffffff'],
    ]) {
      cc.beginPath()
      cc.moveTo(...pts[0])
      for (const p of pts.slice(1)) cc.lineTo(...p)
      cc.closePath()
      cc.fillStyle = fill
      cc.fill()
      cc.lineWidth = 6
      cc.strokeStyle = stroke
      cc.stroke()
    }
  }
  // Hub
  for (const [cc, fill] of [
    [ctx, '#45484d'],
    [bctx, '#ffffff'],
  ]) {
    cc.beginPath()
    cc.arc(cx, cx, R * 0.16, 0, Math.PI * 2)
    cc.fillStyle = fill
    cc.fill()
  }
  // Outer rim lip
  ctx.lineWidth = R * 0.05
  ctx.strokeStyle = '#3d4045'
  ctx.beginPath()
  ctx.arc(cx, cx, R * 0.96, 0, Math.PI * 2)
  ctx.stroke()
  return { color: tex(c, { srgb: true }), bump: tex(b) }
}

// Roof / tonneau slats running across the width.
export function slats() {
  const [c, ctx] = canvas(64, 512)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 64, 512)
  ctx.fillStyle = '#000'
  for (let y = 0; y < 512; y += 32) ctx.fillRect(0, y, 64, 4)
  const t = tex(c, { repeat: [1, 1] })
  return t
}

// Matte textured plastic for the cladding and flares.
export function plasticBump() {
  const [c, ctx] = canvas(512, 512)
  const img = ctx.createImageData(512, 512)
  const r = rng(11)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + r() * 40
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return tex(c, { repeat: [3, 3] })
}

// Soft dark blob for ambient occlusion where the truck meets the floor.
export function groundOcclusion() {
  const [c, ctx] = canvas(512, 256)
  ctx.filter = 'blur(18px)'
  ctx.fillStyle = 'rgba(20,24,28,0.55)'
  ctx.beginPath()
  ctx.roundRect(70, 60, 372, 136, 40)
  ctx.fill()
  ctx.filter = 'none'
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
