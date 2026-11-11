import * as THREE from 'three'

// Shared by the Vinyl Record and Turntable components.
export const REC_R = 2.78 // a 12 inch record, in scene units (1 unit is roughly an inch)
export const LABEL_R = 0.94

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const luminance = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

// 2D value noise, for the marbled finish.
function noise2(seed) {
  const r = rng(seed)
  const g = Float32Array.from({ length: 256 * 256 }, () => r())
  const at = (x, y) => g[((y & 255) << 8) + (x & 255)]
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

// ------------------------------------------------------------------- vinyl

const V = 2048 // texture is square; the record's edge touches the middle of each side
const VR = V / 2

function arcText(g, text, radius, centre, flip, size) {
  g.save()
  g.translate(VR, VR)
  g.font = `600 ${size}px "IBM Plex Mono", Menlo, monospace`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const step = (size * 0.66) / radius
  const total = step * (text.length - 1)
  for (let i = 0; i < text.length; i++) {
    const a = centre + (i * step - total / 2) * (flip ? -1 : 1)
    g.save()
    g.rotate(a)
    g.translate(0, flip ? radius : -radius)
    g.rotate(flip ? Math.PI : 0)
    g.fillText(text[i], 0, 0)
    g.restore()
  }
  g.restore()
}

// Coloured pressings: swirled marble or flicked splatter on top of the base colour.
function paintFinish(g, base, accent, finish) {
  if (finish === 'marble') {
    const S = 420
    const small = document.createElement('canvas')
    small.width = small.height = S
    const sg = small.getContext('2d')
    const img = sg.createImageData(S, S)
    const n = noise2(17)
    const fbm = (x, y) => n(x, y) * 0.5 + n(x * 2.1, y * 2.1) * 0.25 + n(x * 4.3, y * 4.3) * 0.125 + n(x * 8.7, y * 8.7) * 0.0625
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const nx = (x / S) * 5
        const ny = (y / S) * 5
        const warp = fbm(nx + 4, ny + 9) * 2.4
        const v = Math.sin((nx * 1.1 + ny * 0.8 + warp * 3.4) * Math.PI)
        let t = Math.min(Math.max((v + 0.15) / 0.8, 0), 1)
        t = t * t * (3 - 2 * t) * 0.82
        const o = (y * S + x) * 4
        img.data[o] = (base.r + (accent.r - base.r) * t) * 255
        img.data[o + 1] = (base.g + (accent.g - base.g) * t) * 255
        img.data[o + 2] = (base.b + (accent.b - base.b) * t) * 255
        img.data[o + 3] = 255
      }
    }
    sg.putImageData(img, 0, 0)
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(small, 0, 0, V, V)
  } else if (finish === 'splatter') {
    const r = rng(41)
    g.fillStyle = `#${accent.getHexString()}`
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * VR * 0.96
      const cx = VR + Math.cos(a) * d
      const cy = VR + Math.sin(a) * d
      const size = 10 + Math.pow(r(), 2.2) * 120
      // a lumpy main blob...
      for (let k = 0; k < 6; k++) {
        g.beginPath()
        g.arc(cx + (r() - 0.5) * size * 0.9, cy + (r() - 0.5) * size * 0.9, size * (0.45 + r() * 0.5), 0, Math.PI * 2)
        g.fill()
      }
      // ...and flicked droplets around it
      const drops = 5 + Math.floor(r() * 12)
      for (let k = 0; k < drops; k++) {
        const da = r() * Math.PI * 2
        const dd = size * (0.9 + r() * 2.6)
        g.beginPath()
        g.arc(cx + Math.cos(da) * dd, cy + Math.sin(da) * dd, 2 + r() * size * 0.16, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
}

export function vinylTextures({ vinyl, label, labelText = 'SIDE A', accent = '#ffffff', finish = 'solid' }) {
  const cv = document.createElement('canvas')
  const bm = document.createElement('canvas')
  cv.width = cv.height = bm.width = bm.height = V
  const g = cv.getContext('2d')
  const b = bm.getContext('2d')
  const vc = new THREE.Color(vinyl)
  const lc = new THREE.Color(label)
  g.fillStyle = `#${vc.getHexString()}`
  g.fillRect(0, 0, V, V)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, V, V)
  paintFinish(g, vc, new THREE.Color(accent), finish)

  const ringPx = (rUnits) => (rUnits / REC_R) * VR
  const labelPx = ringPx(LABEL_R)
  const r = rng(3)
  // Light vinyl needs dark groove lines, dark vinyl light ones.
  const bright = luminance(vc) > 0.2 || finish !== 'solid'

  // Microgrooves
  for (let rad = labelPx + 26; rad < VR - 24; rad += 1.7) {
    const a = 0.012 + r() * 0.035
    g.strokeStyle = bright ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`
    g.lineWidth = 0.9
    g.beginPath()
    g.arc(VR, VR, rad, 0, Math.PI * 2)
    g.stroke()
    b.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
    b.lineWidth = 0.9
    b.beginPath()
    b.arc(VR, VR, rad, 0, Math.PI * 2)
    b.stroke()
  }
  // Gaps between tracks are smooth and shinier
  for (const gap of [0.3, 0.43, 0.55, 0.66, 0.77, 0.88]) {
    const rad = labelPx + (VR - 24 - labelPx) * gap
    g.strokeStyle = bright ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.55)'
    g.lineWidth = 9
    g.beginPath()
    g.arc(VR, VR, rad, 0, Math.PI * 2)
    g.stroke()
    b.strokeStyle = '#808080'
    b.lineWidth = 9
    b.beginPath()
    b.arc(VR, VR, rad, 0, Math.PI * 2)
    b.stroke()
  }
  // Lead-in (outside) and run-out (inside) are plain
  g.strokeStyle = 'rgba(0,0,0,0.35)'
  g.lineWidth = 26
  g.beginPath()
  g.arc(VR, VR, VR - 14, 0, Math.PI * 2)
  g.stroke()
  b.strokeStyle = '#808080'
  b.lineWidth = 26
  b.beginPath()
  b.arc(VR, VR, VR - 14, 0, Math.PI * 2)
  b.stroke()

  // Label
  g.fillStyle = `#${lc.getHexString()}`
  g.beginPath()
  g.arc(VR, VR, labelPx, 0, Math.PI * 2)
  g.fill()
  b.fillStyle = '#909090'
  b.beginPath()
  b.arc(VR, VR, labelPx, 0, Math.PI * 2)
  b.fill()
  const onLabel = luminance(lc) > 0.5 ? '#1d1a17' : '#fbf6ec'
  g.strokeStyle = onLabel
  g.globalAlpha = 0.5
  g.lineWidth = 4
  g.beginPath()
  g.arc(VR, VR, labelPx - 22, 0, Math.PI * 2)
  g.stroke()
  g.globalAlpha = 1
  g.fillStyle = onLabel
  arcText(g, 'REACT DIMENSIONS RECORDS', labelPx * 0.78, 0, false, 34)
  arcText(g, 'STEREO  33⅓ RPM  STEREO', labelPx * 0.78, 0, true, 30)
  g.font = '700 74px "IBM Plex Mono", Menlo, monospace'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(labelText).slice(0, 14).toUpperCase(), VR, VR - 120)
  g.font = '500 34px "IBM Plex Mono", Menlo, monospace'
  g.fillText('A1  ·  SIDE ONE', VR, VR + 118)
  g.fillStyle = 'rgba(0,0,0,0.85)'
  g.beginPath()
  g.arc(VR, VR, 22, 0, Math.PI * 2)
  g.fill()

  const map = new THREE.CanvasTexture(cv)
  map.colorSpace = THREE.SRGBColorSpace
  const bump = new THREE.CanvasTexture(bm)
  for (const t of [map, bump]) t.anisotropy = 16
  return { map, bump, dispose: () => { map.dispose(); bump.dispose() } }
}

// Soft bands of light that lie across a record. The overlay stays still while
// the record spins under it, as on a real record.
export function sheenTexture() {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  const hashN = rng(9)
  const ringNoise = Float32Array.from({ length: 400 }, () => hashN())
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5) / S - 0.5
      const dy = (y + 0.5) / S - 0.5
      const rr = Math.hypot(dx, dy) * 2 // 0 centre .. 1 edge
      const th = Math.atan2(dy, dx)
      let I = 0
      if (rr < 1 && rr > LABEL_R / REC_R) {
        const d1 = wrap(th + 2.15) // upper left band
        const d2 = wrap(th - 0.95) // lower right band
        I = 0.8 * Math.exp(-Math.pow(d1 / 0.3, 2)) + 0.6 * Math.exp(-Math.pow(d2 / 0.24, 2))
        const edge = Math.min((rr - LABEL_R / REC_R) / 0.06, (1 - rr) / 0.05, 1)
        I *= Math.max(edge, 0) * (0.62 + 0.38 * ringNoise[Math.floor(rr * 399)])
      }
      const o = (y * S + x) * 4
      const v = Math.min(255, I * 255)
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Cardboard sleeve front: plain colour, a ring echoing the record, and the title.
export function sleeveTexture({ color, title = 'SIDE A' }) {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const col = new THREE.Color(color)
  g.fillStyle = `#${col.getHexString()}`
  g.fillRect(0, 0, S, S)
  const r = rng(77)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.035)'
    g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3)
  }
  const ink = luminance(col) > 0.5 ? '#1d1a17' : '#f5efe3'
  g.strokeStyle = ink
  g.globalAlpha = 0.5
  g.lineWidth = 3
  for (const rad of [430, 400, 150]) {
    g.beginPath()
    g.arc(S / 2, S / 2 + 20, rad, 0, Math.PI * 2)
    g.stroke()
  }
  g.globalAlpha = 1
  g.fillStyle = ink
  g.font = '400 130px "Instrument Serif", Georgia, serif'
  g.textBaseline = 'alphabetic'
  g.fillText(String(title).slice(0, 14), 70, 150)
  g.font = '500 28px "IBM Plex Mono", Menlo, monospace'
  g.fillText('REACT DIMENSIONS RECORDS', 72, 200)
  g.fillText('STEREO  ·  33⅓ RPM', 72, S - 62)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
