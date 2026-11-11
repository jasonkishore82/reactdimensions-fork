// Lens outlines. Every outline is a closed, anticlockwise list of [x, y] points
// for the wearer's RIGHT lens as seen from the front: the nose side is at -x,
// the temple side at +x. The left lens is simply a mirror image.

export const SHAPES = ['wayfarer', 'aviator', 'round', 'cat-eye', 'square', 'hexagon']

const sgnpow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e)

function superEllipse(n, a, b, N) {
  const pts = []
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    pts.push([a * sgnpow(Math.cos(t), 2 / n), b * sgnpow(Math.sin(t), 2 / n)])
  }
  return pts
}

// Round the corners of a polygon (Chaikin subdivision).
function chaikin(pts, iterations, k = 0.25) {
  let p = pts
  for (let it = 0; it < iterations; it++) {
    const out = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k])
      out.push([a[0] + (b[0] - a[0]) * (1 - k), a[1] + (b[1] - a[1]) * (1 - k)])
    }
    p = out
  }
  return p
}

// Redistribute points at equal arc length.
function resample(pts, N) {
  const n = pts.length
  const cum = [0]
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1]
    const b = pts[i % n]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = cum[n]
  const out = []
  let seg = 1
  for (let i = 0; i < N; i++) {
    const d = (i / N) * total
    while (seg < n && cum[seg] < d) seg++
    const a = pts[seg - 1]
    const b = pts[seg % n]
    const t = (d - cum[seg - 1]) / (cum[seg] - cum[seg - 1] || 1)
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

// w, h: overall lens width and height.
export function lensOutline(shape, w, h, N = 128) {
  const a = w / 2
  const b = h / 2
  switch (shape) {
    case 'round':
      return superEllipse(2, a, b, N)
    case 'square':
      return superEllipse(4.4, a, b, N)
    case 'hexagon': {
      const hex = [0, 1, 2, 3, 4, 5].map((i) => {
        const t = (i / 6) * Math.PI * 2
        return [a * Math.cos(t), b * Math.sin(t)]
      })
      {
        // rounding the corners shrinks it, so scale back up to the size asked for
        const r = resample(chaikin(hex, 4, 0.2), N)
        const bb = bounds(r)
        return r.map(([x, y]) => [(x / (bb.maxX - bb.minX)) * w, (y / (bb.maxY - bb.minY)) * h])
      }
    }
    case 'wayfarer':
      // straight heavy brow, rounder bottom, outer corner lifted
      return superEllipse(3.1, a, b, N).map(([x, y]) => {
        const xn = x / a
        const yn = y / b
        const yy = y + h * 0.12 * xn + (yn > 0 ? -h * 0.05 * yn : 0)
        return [x * (1 + 0.04 * yn), yy]
      })
    case 'aviator':
      // teardrop: wide at the top, tapering down and in towards the nose
      return superEllipse(2.15, a, b, N).map(([x, y]) => {
        const yn = y / b
        const low = Math.max(0, -yn)
        return [x * (1 - 0.2 * low) - w * 0.1 * Math.pow(low, 1.6), y * (yn > 0 ? 0.94 : 1)]
      })
    case 'cat-eye':
      // outer top corner swept up into a point
      return superEllipse(2.8, a, b, N).map(([x, y]) => {
        const xn = x / a
        const yn = y / b
        const sweep = Math.pow(Math.max(0, xn - 0.05), 1.7) * (yn > -0.45 ? 1 : 0.15)
        const low = Math.max(0, -yn)
        return [x * (1 - 0.12 * low) * (1 + 0.06 * sweep), (yn < 0 ? y * 0.76 : y * 0.9) + h * 0.42 * sweep]
      })
    default:
      return superEllipse(2.6, a, b, N)
  }
}

// How wide the frame is around the lens at a point. Some styles have a heavy
// brow or a flicked outer corner.
export function rimWidth(shape, t, xn, yn) {
  if (shape === 'wayfarer') return t * (1 + 0.55 * Math.pow(Math.max(0, yn), 1.5) - 0.1 * Math.max(0, -yn))
  if (shape === 'cat-eye') return t * (1 + 0.5 * Math.max(0, xn) * Math.max(0, yn))
  return t
}

// Push an outline outwards by `width(x, y)` along its normals.
export function offsetOutline(pts, width) {
  const n = pts.length
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const tx = b[0] - a[0]
    const ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    const d = width(p[0], p[1])
    return [p[0] + (ty / l) * d, p[1] + (-tx / l) * d]
  })
}

// Light smoothing along a closed outline, to iron out kinks.
export function smoothOutline(pts, iterations = 3) {
  let p = pts
  for (let it = 0; it < iterations; it++) {
    p = p.map((q, i) => {
      const a = p[(i - 1 + p.length) % p.length]
      const b = p[(i + 1) % p.length]
      return [q[0] * 0.5 + (a[0] + b[0]) * 0.25, q[1] * 0.5 + (a[1] + b[1]) * 0.25]
    })
  }
  return p
}

export function bounds(pts) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return { minX, maxX, minY, maxY }
}

// The outline point that maximises a·x + b·y (for finding where parts attach).
export function pick(pts, ax, ay) {
  let best = pts[0]
  let bv = -Infinity
  for (const p of pts) {
    const v = p[0] * ax + p[1] * ay
    if (v > bv) {
      bv = v
      best = p
    }
  }
  return best
}
