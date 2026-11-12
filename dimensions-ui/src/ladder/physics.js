// Planar rigid-body physics for a ladder against a wall (no physics library).
//
// The ladder moves in the vertical plane at right angles to the wall: x away
// from the wall, y up. It is a thin rectangle (its length by the depth of a
// stile), and contact points along its outline touch the floor (y = 0) and the
// wall (x = WALL_X). Every small step gravity pulls; each contact point that
// would go into the floor or the wall gets an impulse stopping it, and a
// friction impulse (up to mu times that push) stopping it sliding. Friction
// that is strong enough holds the ladder still; when it is not, the foot
// slides out and the top slides down the wall, exactly where statics says.
//
// A load (a paint can hooked on a rung) adds its mass at that rung, moving the
// centre of mass and raising the inertia.

export const WALL_X = 0
export const G = 19.6 // 1 unit = 0.5 m, so 9.8 m/s^2

// Critical angle from the vertical with floor and wall friction, for a centre
// of mass a fraction k of the way up from the foot (k = 1/2 for a bare ladder):
// tan(a) = mu_f / ((1 + mu_f mu_w) k - mu_f mu_w). Lean more than this and it
// slips. (Taking moments about the foot at the point of slipping.)
export function criticalLean(muFloor, muWall, k = 0.5) {
  const d = (1 + muFloor * muWall) * k - muFloor * muWall
  return d <= 0 ? Math.PI / 2 : Math.atan(muFloor / d)
}

// how far up the ladder the centre of mass is, as a fraction from the foot
export function comFraction(L) {
  const { c } = massProps(L)
  return 0.5 + c / L.length // the axis runs from the foot to the top
}

// state: { x, y, a, vx, vy, w } — x, y: the geometric centre; a: the angle of
// the ladder's axis (foot to top) from the floor; w: spin.
export function createLadder({ length, depth, mass = 1 }) {
  // contact points along the outline (local: along the axis s, across it t)
  const pts = []
  const n = 12
  for (let i = 0; i <= n; i++) {
    const s = -length / 2 + (length * i) / n
    pts.push([s, -depth / 2], [s, depth / 2])
  }
  return { length, depth, mass, pts, load: 0, loadAt: 0 }
}

// mass, centre of mass offset along the axis and inertia about it, with the load
function massProps(L) {
  const m = L.mass
  const mb = L.load
  const M = m + mb
  const c = (mb * L.loadAt) / M
  const I = (m * L.length * L.length) / 12 + m * c * c + mb * (L.loadAt - c) ** 2 + 1e-4
  return { M, c, I }
}

// centre of mass position for a geometric pose
export function comOf(L, s) {
  const { c } = massProps(L)
  return [s.x + Math.cos(s.a) * c, s.y + Math.sin(s.a) * c]
}

// step the simulation; muFloor / muWall: friction. Returns the hardest impact.
export function step(L, s, dt, muFloor, muWall, steps = 12) {
  if (!(dt > 1e-5)) return 0 // the first frame can have no time step
  const { M, c, I } = massProps(L)
  const h = dt / steps
  let hardest = 0
  // simulate the centre of mass, convert back to the geometric centre after
  let cx = s.x + Math.cos(s.a) * c
  let cy = s.y + Math.sin(s.a) * c
  const planes = [
    [0, 1, 0, muFloor], // floor: n = (0, 1), y >= 0
    [1, 0, WALL_X, muWall], // wall: n = (1, 0), x >= WALL_X
  ]
  for (let k = 0; k < steps; k++) {
    s.vy -= G * h
    s.vx *= 1 - h * 0.02
    s.vy *= 1 - h * 0.02
    s.w *= 1 - h * 0.05
    // gather this step's contacts: points at or into the floor or the wall
    const ux = Math.cos(s.a)
    const uy = Math.sin(s.a)
    const contacts = []
    for (const [nx, ny, d, mu] of planes) {
      for (const [ps, pt] of L.pts) {
        const rx = (ps - c) * ux - pt * uy
        const ry = (ps - c) * uy + pt * ux
        const dist = (cx + rx) * nx + (cy + ry) * ny - d
        if (dist > 0.002) continue
        const rn = rx * ny - ry * nx
        const tx = -ny
        const ty = nx
        const rt = rx * ty - ry * tx
        contacts.push({ rx, ry, nx, ny, tx, ty, mu, kn: 1 / (1 / M + (rn * rn) / I), kt: 1 / (1 / M + (rt * rt) / I), rn, rt, pen: Math.max(0, -dist), Pn: 0, Pt: 0, bounce: 0 })
      }
    }
    // restitution only for real impacts, decided once from the incoming speed
    for (const ct of contacts) {
      const vn = (s.vx - s.w * ct.ry) * ct.nx + (s.vy + s.w * ct.rx) * ct.ny
      if (-vn > hardest) hardest = -vn
      ct.bounce = vn < -3 ? -0.2 * vn : 0
    }
    // sequential impulses: accumulate per contact and clamp the totals, so
    // static friction can hold exactly instead of creeping
    for (let it = 0; it < 12; it++) {
      for (const ct of contacts) {
        const vpx = s.vx - s.w * ct.ry
        const vpy = s.vy + s.w * ct.rx
        const vn = vpx * ct.nx + vpy * ct.ny
        // a gentle push-out for any overlap (instead of moving the body)
        const bias = (0.2 / h) * Math.max(0, ct.pen - 0.001) + ct.bounce
        let dPn = ct.kn * (bias - vn)
        const Pn = Math.max(0, ct.Pn + dPn)
        dPn = Pn - ct.Pn
        ct.Pn = Pn
        s.vx += (dPn * ct.nx) / M
        s.vy += (dPn * ct.ny) / M
        s.w += (ct.rn * dPn) / I
        const vt = (s.vx - s.w * ct.ry) * ct.tx + (s.vy + s.w * ct.rx) * ct.ty
        let dPt = -ct.kt * vt
        const lim = ct.mu * ct.Pn
        const Pt = Math.max(-lim, Math.min(lim, ct.Pt + dPt))
        dPt = Pt - ct.Pt
        ct.Pt = Pt
        s.vx += (dPt * ct.tx) / M
        s.vy += (dPt * ct.ty) / M
        s.w += (ct.rt * dPt) / I
      }
    }
    cx += s.vx * h
    cy += s.vy * h
    s.a += s.w * h
  }
  s.x = cx - Math.cos(s.a) * c
  s.y = cy - Math.sin(s.a) * c
  return hardest
}

// The pose leaning on the wall with the foot at distance `foot` from it.
export function leaning(L, foot) {
  const f = Math.min(Math.max(foot, 0.05), L.length * 0.995)
  const a = Math.PI - Math.acos(f / L.length) // axis from foot (x = f) up to the wall
  // the foot corner sits on the floor and the top corner on the wall
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const half = L.length / 2
  // centre such that the lowest point touches y = 0 and the wall-most touches x = 0
  const s = { x: 0, y: 0, a, vx: 0, vy: 0, w: 0 }
  let minY = Infinity
  let minX = Infinity
  for (const [ps, pt] of L.pts) {
    minY = Math.min(minY, ps * uy + pt * ux)
    minX = Math.min(minX, ps * ux - pt * uy)
  }
  s.x = WALL_X - minX + 0.001
  s.y = -minY + 0.001
  void half
  return s
}
