import * as THREE from 'three'

// Tileable 3D noise for the cloud, baked once into two small 3D textures:
//   shape  (64³): R = Perlin-Worley (the billowy body), G/B/A = Worley fBm at
//                 rising frequencies (used to carve the body).
//   detail (32³): R/G/B = finer Worley fBm, for the wispy, eroded edges.
// Everything wraps, so the textures repeat without seams as the wind moves them.

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Worley (cellular) noise with `cells` feature points per axis; 1 at a point, 0 far away.
function makeWorley(cells, rng) {
  const pts = new Float32Array(cells * cells * cells * 3)
  for (let i = 0; i < pts.length; i++) pts[i] = rng()
  return (x, y, z) => {
    const px = x * cells
    const py = y * cells
    const pz = z * cells
    const cx = Math.floor(px)
    const cy = Math.floor(py)
    const cz = Math.floor(pz)
    let best = 1e9
    for (let dz = -1; dz <= 1; dz++) {
      const kz = (((cz + dz) % cells) + cells) % cells
      for (let dy = -1; dy <= 1; dy++) {
        const ky = (((cy + dy) % cells) + cells) % cells
        for (let dx = -1; dx <= 1; dx++) {
          const kx = (((cx + dx) % cells) + cells) % cells
          const o = ((kz * cells + ky) * cells + kx) * 3
          const ox = cx + dx + pts[o] - px
          const oy = cy + dy + pts[o + 1] - py
          const oz = cz + dz + pts[o + 2] - pz
          const d = ox * ox + oy * oy + oz * oz
          if (d < best) best = d
        }
      }
    }
    return 1 - Math.min(Math.sqrt(best), 1)
  }
}

// Gradient (Perlin) noise that repeats every `period` lattice cells. Returns about -1..1.
function makePerlin(period, rng) {
  const g = new Float32Array(period * period * period * 3)
  for (let i = 0; i < g.length; i += 3) {
    const u = rng() * 2 - 1
    const a = rng() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    g[i] = s * Math.cos(a)
    g[i + 1] = s * Math.sin(a)
    g[i + 2] = u
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
  const dot = (ix, iy, iz, fx, fy, fz) => {
    const o = (((iz % period) * period + (iy % period)) * period + (ix % period)) * 3
    return g[o] * fx + g[o + 1] * fy + g[o + 2] * fz
  }
  return (x, y, z) => {
    const px = x * period
    const py = y * period
    const pz = z * period
    const ix = Math.floor(px)
    const iy = Math.floor(py)
    const iz = Math.floor(pz)
    const fx = px - ix
    const fy = py - iy
    const fz = pz - iz
    const u = fade(fx)
    const v = fade(fy)
    const w = fade(fz)
    const l = (a, b, t) => a + (b - a) * t
    return (
      l(
        l(l(dot(ix, iy, iz, fx, fy, fz), dot(ix + 1, iy, iz, fx - 1, fy, fz), u), l(dot(ix, iy + 1, iz, fx, fy - 1, fz), dot(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz), u), v),
        l(l(dot(ix, iy, iz + 1, fx, fy, fz - 1), dot(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1), u), l(dot(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1), dot(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1), u), v),
        w,
      ) * 1.6
    )
  }
}

function texture3D(data, size) {
  const t = new THREE.Data3DTexture(data, size, size, size)
  t.format = THREE.RGBAFormat
  t.type = THREE.UnsignedByteType
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping
  t.unpackAlignment = 1
  t.needsUpdate = true
  return t
}

const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)))

let cache = null

// Built once per page (about a quarter of a second) and shared by every cloud.
export function getCloudNoise() {
  if (cache) return cache
  const rng = mulberry32(1337)
  const W = {}
  for (const f of [2, 4, 8, 16, 32, 64]) W[f] = makeWorley(f, rng)
  const fbm = (f, x, y, z) => W[f](x, y, z) * 0.625 + W[f * 2](x, y, z) * 0.25 + (W[f * 4] ? W[f * 4](x, y, z) : 0.5) * 0.125
  const P = [makePerlin(4, rng), makePerlin(8, rng), makePerlin(16, rng)]

  const S = 64
  const shape = new Uint8Array(S * S * S * 4)
  for (let z = 0, i = 0; z < S; z++) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++, i += 4) {
        const u = (x + 0.5) / S
        const v = (y + 0.5) / S
        const w = (z + 0.5) / S
        const perlin = Math.min(1, Math.max(0, (P[0](u, v, w) + P[1](u, v, w) * 0.5 + P[2](u, v, w) * 0.25) * 0.5 + 0.5))
        const w4 = fbm(4, u, v, w)
        shape[i] = byte(w4 + perlin * (1 - w4) - 0.0) // Perlin-Worley
        shape[i + 1] = byte(w4)
        shape[i + 2] = byte(fbm(8, u, v, w))
        shape[i + 3] = byte(fbm(16, u, v, w))
      }
    }
  }

  const D = 32
  const detail = new Uint8Array(D * D * D * 4)
  for (let z = 0, i = 0; z < D; z++) {
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < D; x++, i += 4) {
        const u = (x + 0.5) / D
        const v = (y + 0.5) / D
        const w = (z + 0.5) / D
        detail[i] = byte(fbm(2, u, v, w))
        detail[i + 1] = byte(fbm(4, u, v, w))
        detail[i + 2] = byte(fbm(8, u, v, w))
        detail[i + 3] = 255
      }
    }
  }

  cache = { shape: texture3D(shape, S), detail: texture3D(detail, D) }
  return cache
}

// A cumulus silhouette: a broad base of large puffs, smaller towers stacked on
// top and a crown. Positions in units of the cloud's size; `seed` reshuffles it.
export function cumulusPuffs(seed = 1) {
  const r = mulberry32(seed * 9973 + 17)
  const rand = (a, b) => a + (b - a) * r()
  const puffs = []
  const row = (n, x0, x1, y0, y1, r0, r1, zs) => {
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1) + rand(-0.12, 0.12)
      puffs.push([x, rand(y0, y1), rand(-zs, zs), rand(r0, r1)])
    }
  }
  row(6, -1.35, 1.35, 0.32, 0.42, 0.42, 0.58, 0.32)
  row(3, -0.9, 0.9, 0.3, 0.38, 0.38, 0.48, 0.55) // depth, so it is not a flat wall
  row(5, -0.95, 0.95, 0.72, 0.92, 0.36, 0.48, 0.28)
  const shift = rand(-0.35, 0.35)
  row(3, -0.5 + shift, 0.55 + shift, 1.1, 1.3, 0.3, 0.4, 0.2)
  row(2, -0.18 + shift, 0.22 + shift, 1.42, 1.52, 0.24, 0.3, 0.12)
  return puffs
}
