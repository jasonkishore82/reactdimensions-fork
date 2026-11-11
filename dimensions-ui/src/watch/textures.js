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

export const luminance = (c) => {
  const k = new THREE.Color(c)
  return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b
}

function tex(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  return t
}

const cvs = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// ----------------------------------------------------------------- strap

// Strap artwork, laid out along its length: v = 0 at the top lug, running
// round the back to the bottom lug at v = 1. Holes sit on the bottom half so
// they show from the front.
export function strapTexture({ style, color, accent }) {
  const U = 256
  const V = 2048
  const c = cvs(U, V)
  const b = cvs(U, V)
  const g = c.getContext('2d')
  const bg = b.getContext('2d')
  const base = new THREE.Color(color)
  const hex = `#${base.getHexString()}`
  const acc = `#${new THREE.Color(accent).getHexString()}`
  g.fillStyle = hex
  g.fillRect(0, 0, U, V)
  bg.fillStyle = '#808080'
  bg.fillRect(0, 0, U, V)
  const r = rng(11)
  const dark = luminance(color) < 0.35

  if (style === 'leather') {
    // grain
    for (let i = 0; i < 9000; i++) {
      const x = r() * U
      const y = r() * V
      const s = 1 + r() * 2.2
      g.fillStyle = r() > 0.5 ? `rgba(255,235,210,${dark ? 0.05 : 0.04})` : 'rgba(0,0,0,0.08)'
      g.beginPath()
      g.arc(x, y, s, 0, Math.PI * 2)
      g.fill()
      bg.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'
      bg.beginPath()
      bg.arc(x, y, s, 0, Math.PI * 2)
      bg.fill()
    }
    // darker, rounded edges
    const eg = g.createLinearGradient(0, 0, U, 0)
    eg.addColorStop(0, 'rgba(0,0,0,0.35)')
    eg.addColorStop(0.06, 'rgba(0,0,0,0)')
    eg.addColorStop(0.94, 'rgba(0,0,0,0)')
    eg.addColorStop(1, 'rgba(0,0,0,0.35)')
    g.fillStyle = eg
    g.fillRect(0, 0, U, V)
    // stitching along both edges
    g.strokeStyle = acc
    g.lineWidth = 4
    g.lineCap = 'round'
    g.setLineDash([16, 9])
    bg.strokeStyle = '#000'
    bg.lineWidth = 4
    bg.lineCap = 'round'
    bg.setLineDash([16, 9])
    for (const x of [U * 0.09, U * 0.91]) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, V)
      g.stroke()
      bg.beginPath()
      bg.moveTo(x, 0)
      bg.lineTo(x, V)
      bg.stroke()
    }
    g.setLineDash([])
    bg.setLineDash([])
  } else if (style === 'sport') {
    // smooth rubber: soft sheen and a field of small vent holes
    const sg = g.createLinearGradient(0, 0, U, 0)
    sg.addColorStop(0, 'rgba(0,0,0,0.22)')
    sg.addColorStop(0.5, 'rgba(255,255,255,0.08)')
    sg.addColorStop(1, 'rgba(0,0,0,0.22)')
    g.fillStyle = sg
    g.fillRect(0, 0, U, V)
  } else if (style === 'nylon') {
    // woven: fine horizontal ribs, with two edge stripes in the accent colour
    for (let y = 0; y < V; y += 5) {
      g.fillStyle = y % 10 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.06)'
      g.fillRect(0, y, U, 2.5)
      bg.fillStyle = y % 10 === 0 ? '#2a2a2a' : '#c8c8c8'
      bg.fillRect(0, y, U, 3)
    }
    g.fillStyle = acc
    g.fillRect(U * 0.14, 0, U * 0.07, V)
    g.fillRect(U * 0.79, 0, U * 0.07, V)
    for (let y = 0; y < V; y += 5) {
      g.fillStyle = y % 10 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)'
      g.fillRect(U * 0.14, y, U * 0.07, 2.5)
      g.fillRect(U * 0.79, y, U * 0.07, 2.5)
    }
  }

  // Adjustment holes (leather and sport)
  if (style === 'leather' || style === 'sport') {
    const holes = []
    if (style === 'leather') for (let i = 0; i < 7; i++) holes.push([U / 2, V * (0.78 + i * 0.026)])
    else
      for (let i = 0; i < 9; i++) {
        holes.push([U * 0.3, V * (0.77 + i * 0.02)])
        holes.push([U * 0.7, V * (0.77 + i * 0.02)])
        holes.push([U * 0.5, V * (0.78 + i * 0.02)])
      }
    for (const [x, y] of holes) {
      const rad = style === 'leather' ? 13 : 6.5
      g.fillStyle = 'rgba(0,0,0,0.85)'
      g.beginPath()
      g.arc(x, y, rad, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.12)'
      g.lineWidth = 2
      g.stroke()
      bg.fillStyle = '#000'
      bg.beginPath()
      bg.arc(x, y, rad + 2, 0, Math.PI * 2)
      bg.fill()
    }
  }
  const map = tex(c)
  const bump = tex(b, false)
  for (const t of [map, bump]) {
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.flipY = false // canvas top = the strap's top lug, so the holes land on the bottom strap
  }
  return { map, bump, dispose: () => { map.dispose(); bump.dispose() } }
}

// ------------------------------------------------------------------ dials

const TAU = Math.PI * 2

// Dial artwork on a 1024 square; the dial is a disc of radius R = 512 px.
export function dialTexture({ color, style, label = 'REACT DIMENSIONS' }) {
  const S = 1024
  const c = cvs(S, S)
  const g = c.getContext('2d')
  const R = S / 2
  const base = new THREE.Color(color)
  g.fillStyle = `#${base.getHexString()}`
  g.fillRect(0, 0, S, S)
  const light = luminance(color) > 0.45
  // sunburst: fine radial brushing and a soft glow
  const r = rng(4)
  for (let i = 0; i < 1400; i++) {
    const a = r() * TAU
    g.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${0.025 + r() * 0.04})` : `rgba(0,0,0,${0.025 + r() * 0.05})`
    g.lineWidth = 0.8 + r() * 1.4
    g.beginPath()
    g.moveTo(R + Math.cos(a) * 20, R + Math.sin(a) * 20)
    g.lineTo(R + Math.cos(a) * R, R + Math.sin(a) * R)
    g.stroke()
  }
  const glow = g.createRadialGradient(R * 0.8, R * 0.7, 20, R, R, R)
  glow.addColorStop(0, 'rgba(255,255,255,0.12)')
  glow.addColorStop(1, 'rgba(0,0,0,0.22)')
  g.fillStyle = glow
  g.fillRect(0, 0, S, S)

  const ink = light ? '#1b1a18' : '#f2eee3'
  g.translate(R, R)
  g.fillStyle = ink
  g.strokeStyle = ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  // minute track
  g.lineCap = 'butt'
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2
    const five = i % 5 === 0
    if (style === 'diver' && five) continue
    g.lineWidth = five ? 5 : 2.5
    g.beginPath()
    g.moveTo(Math.cos(a) * R * (five ? 0.86 : 0.9), Math.sin(a) * R * (five ? 0.86 : 0.9))
    g.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95)
    g.stroke()
  }

  if (style === 'numerals') {
    g.font = `400 ${R * 0.2}px "Instrument Serif", Georgia, serif`
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * TAU - Math.PI / 2
      g.fillText(String(h), Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72 + 4)
    }
  } else if (style === 'diver') {
    // big luminous markers
    const lume = light ? '#e7e2c8' : '#f4f1d8'
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * TAU - Math.PI / 2
      g.save()
      g.rotate(a + Math.PI / 2)
      g.fillStyle = lume
      g.strokeStyle = light ? '#1b1a18' : '#0a0a0a'
      g.lineWidth = 8
      if (h === 0) {
        g.beginPath()
        g.moveTo(0, -R * 0.9)
        g.lineTo(-R * 0.09, -R * 0.7)
        g.lineTo(R * 0.09, -R * 0.7)
        g.closePath()
        g.stroke()
        g.fill()
      } else if (h % 3 === 0) {
        g.beginPath()
        g.roundRect(-R * 0.045, -R * 0.88, R * 0.09, R * 0.2, 6)
        g.stroke()
        g.fill()
      } else {
        g.beginPath()
        g.arc(0, -R * 0.78, R * 0.055, 0, TAU)
        g.stroke()
        g.fill()
      }
      g.restore()
    }
  } else {
    // index: applied baton markers
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * TAU - Math.PI / 2
      g.save()
      g.rotate(a + Math.PI / 2)
      g.fillStyle = ink
      g.fillRect(-R * (h % 3 === 0 ? 0.03 : 0.018), -R * 0.84, R * (h % 3 === 0 ? 0.06 : 0.036), R * (h % 3 === 0 ? 0.2 : 0.13))
      g.restore()
    }
  }

  // logo and caption
  g.fillStyle = ink
  g.font = `600 ${R * 0.065}px "IBM Plex Mono", Menlo, monospace`
  g.fillText(label, 0, -R * 0.3)
  g.font = `500 ${R * 0.045}px "IBM Plex Mono", Menlo, monospace`
  g.globalAlpha = 0.8
  g.fillText('AUTOMATIC', 0, R * 0.34)
  g.fillText('WATER RESISTANT', 0, R * 0.42)
  g.globalAlpha = 1
  return tex(c)
}

// Rotating bezel insert with a 60-minute scale (diver style).
export function bezelTexture({ color }) {
  const S = 1024
  const c = cvs(S, S)
  const g = c.getContext('2d')
  const R = S / 2
  g.translate(R, R)
  const base = new THREE.Color(color)
  g.fillStyle = `#${base.getHexString()}`
  g.beginPath()
  g.arc(0, 0, R, 0, TAU)
  g.fill()
  const ink = luminance(color) > 0.5 ? '#161616' : '#f3efe2'
  g.fillStyle = ink
  g.strokeStyle = ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2
    g.lineWidth = i % 5 === 0 ? 7 : 3.5
    const rin = i % 5 === 0 ? 0.88 : 0.93
    g.beginPath()
    g.moveTo(Math.cos(a) * R * rin, Math.sin(a) * R * rin)
    g.lineTo(Math.cos(a) * R * 0.985, Math.sin(a) * R * 0.985)
    g.stroke()
    if (i % 10 === 0 && i > 0) {
      g.save()
      g.rotate(a + Math.PI / 2)
      g.font = `600 ${R * 0.08}px "IBM Plex Mono", Menlo, monospace`
      g.fillText(String(i), 0, -R * 0.8)
      g.restore()
    }
  }
  g.beginPath()
  g.arc(0, -R * 0.9, R * 0.04, 0, TAU)
  g.fillStyle = '#e8402a'
  g.fill()
  return tex(c)
}

// -------------------------------------------------------- smart watch face

// Paints one frame of the smart watch screen. Called about once a second.
export function drawSmartFace(g, W, H, { face, bg, accent, now }) {
  const light = luminance(bg) > 0.6
  const ink = light ? '#111114' : '#ffffff'
  const dim = light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.55)'
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  const hh = now.getHours()
  const mm = now.getMinutes()
  const ss = now.getSeconds()
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const pad = (n) => String(n).padStart(2, '0')
  const dayFrac = (hh * 60 + mm) / 1440
  g.textBaseline = 'alphabetic'

  if (face === 'analog') {
    const cx = W / 2
    const cy = H / 2 + 6
    const R = W * 0.46
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU
      const five = i % 5 === 0
      g.strokeStyle = five ? ink : dim
      g.lineWidth = five ? 7 : 3
      g.beginPath()
      g.moveTo(cx + Math.sin(a) * R * (five ? 0.84 : 0.92), cy - Math.cos(a) * R * (five ? 0.84 : 0.92))
      g.lineTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R)
      g.stroke()
    }
    g.fillStyle = dim
    g.font = '600 30px "IBM Plex Mono", Menlo, monospace'
    g.textAlign = 'center'
    g.fillText(`${days[now.getDay()]} ${now.getDate()}`, cx + R * 0.4, cy + 11)
    g.fillStyle = accent
    g.fillText('72', cx - R * 0.42, cy + 11)
    const hand = (angle, len, w, col) => {
      g.strokeStyle = col
      g.lineWidth = w
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(cx - Math.sin(angle) * 24, cy + Math.cos(angle) * 24)
      g.lineTo(cx + Math.sin(angle) * len, cy - Math.cos(angle) * len)
      g.stroke()
    }
    hand(((hh % 12) + mm / 60) / 12 * TAU, R * 0.5, 14, ink)
    hand((mm + ss / 60) / 60 * TAU, R * 0.8, 10, ink)
    hand((ss / 60) * TAU, R * 0.86, 5, accent)
    g.fillStyle = accent
    g.beginPath()
    g.arc(cx, cy, 11, 0, TAU)
    g.fill()
    return
  }

  if (face === 'digital') {
    g.textAlign = 'center'
    g.fillStyle = ink
    g.font = '300 170px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText(`${pad(hh)}`, W / 2, H * 0.4)
    g.fillStyle = accent
    g.fillText(`${pad(mm)}`, W / 2, H * 0.66)
    g.fillStyle = dim
    g.font = '600 30px "IBM Plex Mono", Menlo, monospace'
    g.fillText(`${days[now.getDay()]} ${now.getDate()} · ${pad(ss)}s`, W / 2, H * 0.82)
    // battery
    g.strokeStyle = dim
    g.lineWidth = 3
    g.strokeRect(W / 2 - 34, H * 0.9, 68, 22)
    g.fillStyle = accent
    g.fillRect(W / 2 - 30, H * 0.9 + 4, 46, 14)
    return
  }

  // rings: time on top, three activity rings below
  g.textAlign = 'left'
  g.fillStyle = ink
  g.font = '600 118px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText(`${pad(hh)}:${pad(mm)}`, 34, 132)
  g.fillStyle = accent
  g.font = '600 32px "IBM Plex Mono", Menlo, monospace'
  g.fillText(`${days[now.getDay()]} ${now.getDate()}`, 38, 184)
  const cx = W / 2
  const cy = H * 0.62
  const rings = [
    [118, accent, Math.min(0.92, 0.25 + dayFrac * 0.8)],
    [86, '#9bff3d', Math.min(0.95, 0.15 + dayFrac * 0.9)],
    [54, '#2de0ff', Math.min(0.9, 0.35 + dayFrac * 0.5)],
  ]
  for (const [rad, col, p] of rings) {
    g.lineWidth = 28
    g.lineCap = 'round'
    g.strokeStyle = col
    g.globalAlpha = 0.22
    g.beginPath()
    g.arc(cx, cy, rad, 0, TAU)
    g.stroke()
    g.globalAlpha = 1
    g.beginPath()
    g.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + p * TAU)
    g.stroke()
  }
}
