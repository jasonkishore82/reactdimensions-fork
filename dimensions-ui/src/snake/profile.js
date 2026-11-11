// Shape of the snake along its length. Units are scene units; `d` is the
// distance from the snout tip along the spine.
export const LENGTH = 12.5
export const SEGMENTS = 96 // spine points
export const SEG = LENGTH / (SEGMENTS - 1)
export const HEAD_D = 1.4 // the head and neck get extra rings for a smooth snout

const CAP = 0.22 // length of the rounded snout

// [distance, half-width, half-height]. The head is wide and flat, the neck
// narrower, the body thick, then a long taper to the tail tip.
const KEYS = [
  [CAP, 0.11, 0.066],
  [0.5, 0.185, 0.095],
  [0.85, 0.185, 0.108],
  [1.15, 0.15, 0.138],
  [1.8, 0.172, 0.162],
  [3.0, 0.205, 0.192],
  [0.45 * LENGTH, 0.218, 0.203],
  [0.72 * LENGTH, 0.2, 0.186],
  [0.9 * LENGTH, 0.12, 0.11],
  [0.985 * LENGTH, 0.03, 0.03],
  [LENGTH, 0.004, 0.004],
]

// Finite-difference tangents for Catmull-Rom style Hermite interpolation.
const TAN = KEYS.map((k, i) => {
  const a = KEYS[Math.max(i - 1, 0)]
  const b = KEYS[Math.min(i + 1, KEYS.length - 1)]
  const dd = b[0] - a[0] || 1
  return [(b[1] - a[1]) / dd, (b[2] - a[2]) / dd]
})

export const out = { w: 0, h: 0 }

export function profile(d, target = out) {
  const dd = Math.min(Math.max(d, 0), LENGTH)
  let cap = 1
  let x = dd
  if (dd < CAP) {
    const u = 1 - dd / CAP
    cap = Math.sqrt(Math.max(1 - u * u, 0))
    x = CAP
  }
  let i = 0
  while (i < KEYS.length - 2 && x > KEYS[i + 1][0]) i++
  const k0 = KEYS[i]
  const k1 = KEYS[i + 1]
  const h = k1[0] - k0[0]
  const t = Math.min(Math.max((x - k0[0]) / h, 0), 1)
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  target.w = Math.max((h00 * k0[1] + h10 * h * TAN[i][0] + h01 * k1[1] + h11 * h * TAN[i + 1][0]) * cap, 0)
  target.h = Math.max((h00 * k0[2] + h10 * h * TAN[i][1] + h01 * k1[2] + h11 * h * TAN[i + 1][1]) * cap, 0)
  return target
}

// Height of the spine above the floor when the belly rests on it.
export const groundY = (d) => profile(d, { w: 0, h: 0 }).h + 0.004
