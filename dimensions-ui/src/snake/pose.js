import { LENGTH, SEG, SEGMENTS, groundY } from './profile.js'

// A path is built as a polyline, then resampled at equal arc length so each
// spine point gets a target position.
const MAX = 1400
const path = new Float32Array(MAX * 3)
const cum = new Float32Array(MAX)
let n = 0
const push = (x, y, z) => {
  if (n >= MAX) return
  path[n * 3] = x
  path[n * 3 + 1] = y
  path[n * 3 + 2] = z
  n++
}

// Uniform Catmull-Rom for one coordinate.
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)

const ctrl = new Float32Array(12 * 3)

function spline(count, steps) {
  for (let i = 0; i < count - 1; i++) {
    const i0 = Math.max(i - 1, 0)
    const i3 = Math.min(i + 2, count - 1)
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      push(
        cr(ctrl[i0 * 3], ctrl[i * 3], ctrl[(i + 1) * 3], ctrl[i3 * 3], t),
        cr(ctrl[i0 * 3 + 1], ctrl[i * 3 + 1], ctrl[(i + 1) * 3 + 1], ctrl[i3 * 3 + 1], t),
        cr(ctrl[i0 * 3 + 2], ctrl[i * 3 + 2], ctrl[(i + 1) * 3 + 2], ctrl[i3 * 3 + 2], t),
      )
    }
  }
  push(ctrl[(count - 1) * 3], ctrl[(count - 1) * 3 + 1], ctrl[(count - 1) * 3 + 2])
}

const BASE_Y = 0.21 // spine height when lying on the floor (body radius)
const BEND_R = 0.55 // radius of the bend between neck and coil
const COIL_TURN = 5.4 // radians of coil
const COIL_R0 = 0.88
const COIL_GROWTH = 0.082 // radius gained per radian, so the coil doesn't overlap itself

// Cobra-style pose: head up on an S-curved neck, body coiled on the floor,
// tail trailing away. `head` is the head position; `face` and `body` are yaw
// angles (the head turns quickly, the coil only slowly).
export function rearTargets(T, head, face, body, time, sigma = 1) {
  n = 0
  const fx = Math.cos(face)
  const fz = Math.sin(face)
  const bx = Math.cos(body)
  const bz = Math.sin(body)
  const hx = head.x
  const hy = head.y
  const hz = head.z
  const Bx = 0
  const Bz = 0

  // Neck: bows backwards behind the head, then drops to the base.
  const set = (i, x, y, z) => {
    ctrl[i * 3] = x
    ctrl[i * 3 + 1] = y
    ctrl[i * 3 + 2] = z
  }
  const mx = (a, b, t) => a + (b - a) * t
  set(0, hx, hy, hz)
  set(1, hx - fx * 0.42, hy + 0.05, hz - fz * 0.42)
  set(2, hx - fx * 1.1, hy - 0.32, hz - fz * 1.1)
  set(3, mx(hx, Bx, 0.5) - fx * 1.3, mx(hy, BASE_Y, 0.5), mx(hz, Bz, 0.5) - fz * 1.02)
  set(4, mx(hx, Bx, 0.8) - bx * 0.7, mx(hy, BASE_Y, 0.8) + 0.05, mx(hz, Bz, 0.8) - bz * 0.7)
  set(5, Bx, BASE_Y + BEND_R, Bz) // neck comes straight down to here
  spline(6, 9)

  // Coil: leaves the base behind and to one side, then spirals outwards.
  const hbx = -bx * 0.55 - bz * 0.85 * sigma
  const hbz = -bz * 0.55 + bx * 0.85 * sigma
  const hl = Math.hypot(hbx, hbz)
  const hdx = hbx / hl
  const hdz = hbz / hl
  // A quarter-circle bend (radius wider than the body) turns the vertical neck
  // into the horizontal coil without pinching.
  for (let k = 1; k <= 10; k++) {
    const t = (k / 10) * (Math.PI / 2)
    push(Bx + hdx * BEND_R * (1 - Math.cos(t)), BASE_Y + BEND_R * (1 - Math.sin(t)), Bz + hdz * BEND_R * (1 - Math.cos(t)))
  }
  const sx0 = Bx + hdx * BEND_R
  const sz0 = Bz + hdz * BEND_R
  // centre lies to the side the coil turns towards
  const pdx = -hdz * sigma
  const pdz = hdx * sigma
  const cx = sx0 + pdx * COIL_R0
  const cz = sz0 + pdz * COIL_R0
  const th0 = Math.atan2(sz0 - cz, sx0 - cx)
  let a = 0
  let rr = COIL_R0
  while (a < COIL_TURN) {
    rr = COIL_R0 + COIL_GROWTH * a
    const th = th0 + sigma * a
    push(cx + Math.cos(th) * rr, BASE_Y, cz + Math.sin(th) * rr)
    a += 0.1 / rr
  }

  // Tail: leaves the coil tangentially, undulates, curls at the tip.
  const thEnd = th0 + sigma * a
  let psi = Math.atan2(Math.cos(thEnd) * sigma, -Math.sin(thEnd) * sigma) // heading along the spiral
  let px = cx + Math.cos(thEnd) * rr
  let pz = cz + Math.sin(thEnd) * rr
  const ds = 0.1
  let used = 0
  for (let i = 1; i < n; i++) used += Math.hypot(path[i * 3] - path[(i - 1) * 3], path[i * 3 + 1] - path[(i - 1) * 3 + 1], path[i * 3 + 2] - path[(i - 1) * 3 + 2])
  const tailLen = Math.max(LENGTH - used, 1) + 1.2
  for (let s = 0; s < tailLen; s += ds) {
    const decay = Math.exp(-s / 1.1)
    psi += (sigma * decay * 0.9 + 0.95 * Math.sin((s * Math.PI * 2) / 3.2 - time * 1.3) * (1 - decay)) * ds
    if (s > tailLen - 1.8) psi += sigma * 0.7 * ((s - (tailLen - 1.8)) / 1.8) * ds * 2
    px += Math.cos(psi) * ds
    pz += Math.sin(psi) * ds
    push(px, BASE_Y, pz)
  }

  // Resample at equal arc length into the spine targets.
  cum[0] = 0
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(path[i * 3] - path[(i - 1) * 3], path[i * 3 + 1] - path[(i - 1) * 3 + 1], path[i * 3 + 2] - path[(i - 1) * 3 + 2])
  let seg = 1
  for (let i = 0; i < SEGMENTS; i++) {
    const d = i * SEG
    while (seg < n - 1 && cum[seg] < d) seg++
    const span = cum[seg] - cum[seg - 1] || 1
    const t = Math.min(Math.max((d - cum[seg - 1]) / span, 0), 1)
    const a0 = (seg - 1) * 3
    const a1 = seg * 3
    const y = path[a0 + 1] + (path[a1 + 1] - path[a0 + 1]) * t
    T[i].set(
      path[a0] + (path[a1] - path[a0]) * t,
      Math.max(y, groundY(d)),
      path[a0 + 2] + (path[a1 + 2] - path[a0 + 2]) * t,
    )
  }
  return cum[n - 1]
}
