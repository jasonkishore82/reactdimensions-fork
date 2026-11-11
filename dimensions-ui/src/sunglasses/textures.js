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

// Tortoiseshell: soft dark blotches over a warm amber base. Tiles seamlessly.
export function tortoiseTexture({ amber, dark }) {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  const a = new THREE.Color(amber)
  const d = new THREE.Color(dark)
  const n = noise2(5)
  const n2 = noise2(23)
  // sampling a periodic domain keeps the edges matching
  const per = (fn, x, y, f) => {
    const u = (x / S) * f
    const v = (y / S) * f
    const wx = u / f
    const wy = v / f
    return (
      fn(u, v) * (1 - wx) * (1 - wy) +
      fn(u - f, v) * wx * (1 - wy) +
      fn(u, v - f) * (1 - wx) * wy +
      fn(u - f, v - f) * wx * wy
    )
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = per((px, py) => n(px + 40, py + 40), x, y, 7) * 0.65 + per((px, py) => n2(px + 80, py + 80), x, y, 17) * 0.35
      let t = Math.min(Math.max((v - 0.42) / 0.22, 0), 1)
      t = t * t * (3 - 2 * t)
      const o = (y * S + x) * 4
      img.data[o] = (a.r + (d.r - a.r) * t) * 255
      img.data[o + 1] = (a.g + (d.g - a.g) * t) * 255
      img.data[o + 2] = (a.b + (d.b - a.b) * t) * 255
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.55, 0.55)
  t.anisotropy = 8
  return t
}

// Lens tint: dark at the top fading lighter towards the bottom (a gradient
// lens), or the same all over.
export function lensTexture({ color, gradient }) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')
  const base = new THREE.Color(color)
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.62)
  const grad = g.createLinearGradient(0, 0, 0, 256)
  if (gradient) {
    grad.addColorStop(0, `#${base.getHexString()}`)
    grad.addColorStop(0.5, `#${base.getHexString()}`)
    grad.addColorStop(1, `#${light.getHexString()}`)
  } else {
    grad.addColorStop(0, `#${base.getHexString()}`)
    grad.addColorStop(1, `#${base.getHexString()}`)
  }
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false // canvas top = lens top
  return t
}
