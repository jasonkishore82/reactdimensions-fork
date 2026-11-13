import * as THREE from 'three'

// Rigid-body physics for round rubber dumbbells, with no physics library.
// SI units: metres, kilograms, seconds, real gravity.
//
// Shape: each dumbbell is two heads, rounded cylinders (radius R, width W,
// edge rounding RHO) on the ends of a handle, axis along local x. Contact
// points are the four rim circles of the heads (each a ring of points swept
// by a sphere of radius RHO, which is exactly the rounded edge), plus points
// down the handle. Against another dumbbell those points are tested against
// its exact signed distance (rounded cylinders and a capsule handle), both ways.
//
// Mass: a dumbbell is not a sphere. It is very easy to spin about its own
// axis and hard to swing end over end (about 5x harder at 10 kg). So the
// solver keeps the world angular momentum L and gets the spin from it,
// w = R I^-1 R^T L, which conserves L in flight: a tossed dumbbell wobbles
// and precesses the way a real one does.
//
// Contact: each penetrating point gets a normal impulse (a little bounce on
// hard hits, rubber is dead), a Coulomb friction impulse, and the rubber's
// rolling resistance, a torque against the spin of up to C_RR * R * N, which
// is what stops a rolling dumbbell instead of letting it roll forever.

export const G = 9.81
const MU = 0.85 // rubber on a gym floor, and on rubber
const C_RR = 0.015 // rolling resistance of rubber on a hard floor
const SAMPLES = 48
export const BOUNDS = { x: 1.6, z: 1.2 } // the room's walls, out of shot

// dimensions and mass properties for a dumbbell of `kg`, modelled on a 10 kg
// round rubber dumbbell: 16 cm heads, 7 cm wide, 13.5 cm knurled grip
export function dims(kg = 10) {
  const handleMass = 0.9
  const headMass = Math.max(0.4, (kg - handleMass) / 2)
  const s = Math.cbrt(headMass / 4.55)
  const R = 0.08 * s
  const W = 0.07 * s
  const h = W / 2
  const RHO = Math.min(0.012 * s, W * 0.3)
  const gripL = 0.135
  const gripR = 0.0165
  const collarL = 0.015
  const collarR = 0.021
  const c = gripL / 2 + collarL + h // centre of each head from the middle
  const handleL = 2 * (c - h)
  const m = 2 * headMass + handleMass
  const Ia = 2 * 0.5 * headMass * R * R + 0.5 * handleMass * gripR * gripR
  const It = 2 * (headMass * (3 * R * R + W * W) / 12 + headMass * c * c) + handleMass * (3 * gripR * gripR + handleL * handleL) / 12
  return { kg, R, W, h, RHO, gripL, gripR, collarL, collarR, c, handleL, m, I: new THREE.Vector3(Ia, It, It), length: 2 * (c + h) }
}

// sample points in the body frame, each with the radius of the sphere swept round it
export function samplePoints(d) {
  const pts = []
  for (const s of [-1, 1])
    for (const t of [-1, 1]) {
      const x = s * d.c + t * (d.h - d.RHO)
      for (let k = 0; k < SAMPLES; k++) {
        const a = (k / SAMPLES) * Math.PI * 2
        pts.push({ p: new THREE.Vector3(x, Math.cos(a) * (d.R - d.RHO), Math.sin(a) * (d.R - d.RHO)), r: d.RHO })
      }
    }
  const half = d.c - d.h
  for (let k = 0; k <= 6; k++) pts.push({ p: new THREE.Vector3(-half + (k / 6) * 2 * half, 0, 0), r: d.gripR })
  return pts
}

// signed distance from a body-frame point to the dumbbell, and the outward normal
const _n = new THREE.Vector3()
export function sdf(d, pt, outN) {
  let best = Infinity
  for (const s of [-1, 1]) {
    const a = pt.x - s * d.c
    const rr = Math.hypot(pt.y, pt.z)
    const ry = rr > 1e-7 ? pt.y / rr : 1
    const rz = rr > 1e-7 ? pt.z / rr : 0
    const qx = rr - (d.R - d.RHO)
    const qy = Math.abs(a) - (d.h - d.RHO)
    let dist
    if (qx > 0 || qy > 0) {
      const mx = Math.max(qx, 0)
      const my = Math.max(qy, 0)
      const len = Math.hypot(mx, my)
      dist = len - d.RHO
      _n.set((Math.sign(a) * my) / len, (ry * mx) / len, (rz * mx) / len)
    } else {
      dist = Math.max(qx, qy) - d.RHO
      if (qx > qy) _n.set(0, ry, rz)
      else _n.set(Math.sign(a) || 1, 0, 0)
    }
    if (dist < best) {
      best = dist
      outN.copy(_n)
    }
  }
  const half = d.c - d.h
  const cx = THREE.MathUtils.clamp(pt.x, -half, half)
  const dx = pt.x - cx
  const len = Math.hypot(dx, pt.y, pt.z)
  const dist = len - d.gripR
  if (dist < best && len > 1e-7) {
    best = dist
    outN.set(dx / len, pt.y / len, pt.z / len)
  }
  return best
}

export function makeBody(p, q) {
  return { p: p.clone(), q: q.clone(), v: new THREE.Vector3(), L: new THREE.Vector3(), w: new THREE.Vector3(), quiet: 0, asleep: false, grab: null, impact: 0, knock: 0, contact: false, rr: 0 }
}

// ---- rigid-body helpers ----
const qi = new THREE.Quaternion()
const tv = new THREE.Vector3()
function invI(b, d, vec, out) {
  qi.copy(b.q).invert()
  out.copy(vec).applyQuaternion(qi)
  out.set(out.x / d.I.x, out.y / d.I.y, out.z / d.I.z)
  return out.applyQuaternion(b.q)
}
function updateW(b, d) {
  invI(b, d, b.L, b.w)
}
const c1 = new THREE.Vector3()
const c2 = new THREE.Vector3()
// effective inverse mass of body b at offset r along unit n
function kAlong(b, d, r, n) {
  c1.crossVectors(r, n)
  invI(b, d, c1, c2)
  c1.crossVectors(c2, r)
  return 1 / d.m + c1.dot(n)
}
function impulse(b, d, r, J) {
  b.v.addScaledVector(J, 1 / d.m)
  c1.crossVectors(r, J)
  b.L.add(c1)
  updateW(b, d)
}
function pointVel(b, r, out) {
  return out.crossVectors(b.w, r).add(b.v)
}

const va = new THREE.Vector3()
const vb = new THREE.Vector3()
const rel = new THREE.Vector3()
const tan = new THREE.Vector3()
const J = new THREE.Vector3()

// A contact between a and b (b null = the floor or a wall) at world point
// wp, n pointing from b into a. Contacts are gathered first, then solved
// together over several passes with accumulated, clamped impulses (sequential
// impulses), so a dumbbell standing on the ring of its head rests still
// instead of rocking from one edge to the other.
function makeContact(a, b, d, wp, n, depth, h) {
  const ra = wp.clone().sub(a.p)
  const rb = b ? wp.clone().sub(b.p) : null
  const t1 = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0).cross(n).normalize()
  const t2 = n.clone().cross(t1)
  const k = (dir) => kAlong(a, d, ra, dir) + (b ? kAlong(b, d, rb, dir) : 0)
  const c = { a, b, ra, rb, n: n.clone(), t1, t2, kn: k(n), k1: k(t1), k2: k(t2), jn: 0, j1: 0, j2: 0 }
  const vn = relVel(c).dot(n)
  // rubber is dead: only a hard hit bounces, and only a little
  c.target = vn < -1.2 ? -0.22 * vn : 0
  c.bias = (0.12 / h) * Math.max(0, depth - 0.0005)
  c.vn0 = vn
  return c
}
function relVel(c) {
  pointVel(c.a, c.ra, va)
  if (c.b) pointVel(c.b, c.rb, vb)
  else vb.set(0, 0, 0)
  return rel.copy(va).sub(vb)
}
function apply(c, dir, j) {
  impulse(c.a, c.d, c.ra, J.copy(dir).multiplyScalar(j))
  if (c.b) impulse(c.b, c.d, c.rb, J.copy(dir).multiplyScalar(-j))
}
function solve(c) {
  let r = relVel(c)
  const vn = r.dot(c.n)
  const want = Math.max(c.target, c.bias)
  const jn = Math.max(0, c.jn + (want - vn) / c.kn)
  apply(c, c.n, jn - c.jn)
  c.jn = jn
  const lim = MU * c.jn
  for (const [t, k, key] of [[c.t1, c.k1, 'j1'], [c.t2, c.k2, 'j2']]) {
    r = relVel(c)
    const jt = THREE.MathUtils.clamp(c[key] - r.dot(t) / k, -lim, lim)
    apply(c, t, jt - c[key])
    c[key] = jt
  }
}

const PLANES = [
  [new THREE.Vector3(0, 1, 0), 0],
  [new THREE.Vector3(1, 0, 0), -BOUNDS.x],
  [new THREE.Vector3(-1, 0, 0), -BOUNDS.x],
  [new THREE.Vector3(0, 0, 1), -BOUNDS.z],
  [new THREE.Vector3(0, 0, -1), -BOUNDS.z],
]

const wp = new THREE.Vector3()
const wc = new THREE.Vector3()
const lp = new THREE.Vector3()
const nl = new THREE.Vector3()
const nw = new THREE.Vector3()
const gw = new THREE.Vector3()
const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
const dq = new THREE.Quaternion()

// advance every body by h seconds
export function step(bodies, d, pts, h) {
  for (const b of bodies) {
    if (b.asleep && !b.grab) continue
    b.v.y -= G * h
    b.contact = false
    b.rr = 0
    // held: a stiff, damped spring from the grab point to the pointer
    if (b.grab) {
      const r = gw.copy(b.grab.local).applyQuaternion(b.q)
      const at = wc.copy(b.p).add(r)
      for (const e of AX) {
        const err = tv.copy(b.grab.target).sub(at).dot(e)
        const vp = pointVel(b, r, va).dot(e)
        const want = err * 28
        const k = kAlong(b, d, r, e)
        let j = ((want - vp) / k) * 0.6
        const max = d.m * 80 * h
        j = THREE.MathUtils.clamp(j, -max, max)
        impulse(b, d, r, J.copy(e).multiplyScalar(j))
      }
      // the hand damps the swing a little
      b.L.multiplyScalar(Math.exp(-1.2 * h))
      updateW(b, d)
    }
  }

  const contacts = []
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    if (a.asleep && !a.grab) continue
    // floor and the invisible room walls
    for (const pt of pts) {
      wp.copy(pt.p).applyQuaternion(a.q).add(a.p)
      for (const [n, off] of PLANES) {
        const dist = wp.dot(n) - off - pt.r
        if (dist >= 0) continue
        wc.copy(wp).addScaledVector(n, -pt.r)
        const c = makeContact(a, null, d, wc, n, -dist, h)
        c.floor = n.y > 0.5
        contacts.push(c)
      }
    }
  }

  // dumbbell against dumbbell: each one's points against the other's shape
  for (let i = 0; i < bodies.length; i++)
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue
      const a = bodies[i]
      const b = bodies[j]
      if (a.asleep && b.asleep) continue
      if (a.p.distanceTo(b.p) > d.length + 0.02) continue
      qi.copy(b.q).invert()
      const bq = qi.clone()
      for (const pt of pts) {
        wp.copy(pt.p).applyQuaternion(a.q).add(a.p)
        lp.copy(wp).sub(b.p).applyQuaternion(bq)
        const dist = sdf(d, lp, nl) - pt.r
        if (dist >= 0) continue
        nw.copy(nl).applyQuaternion(b.q)
        wc.copy(wp).addScaledVector(nw, -pt.r)
        const c = makeContact(a, b, d, wc, nw, -dist, h)
        contacts.push(c)
        // a real knock wakes a sleeping dumbbell
        if (c.vn0 < -0.05) {
          wake(a)
          wake(b)
        }
      }
    }

  for (const c of contacts) c.d = d
  for (let it = 0; it < 8; it++) for (const c of contacts) solve(c)
  for (const c of contacts) {
    const hit = Math.max(0, -c.vn0)
    c.a.impact = Math.max(c.a.impact, hit)
    if (c.b) {
      c.b.impact = Math.max(c.b.impact, hit)
      c.a.knock = Math.max(c.a.knock, hit)
    }
    if (c.floor) {
      c.a.contact = true
      c.a.rr += c.jn
    }
  }

  for (const b of bodies) {
    if (b.asleep && !b.grab) {
      b.v.set(0, 0, 0)
      b.L.set(0, 0, 0)
      b.w.set(0, 0, 0)
      continue
    }
    // rolling resistance: a torque against the spin, from the floor's push
    if (b.contact && b.rr > 0) {
      const wl = b.w.length()
      if (wl > 1e-6) {
        tan.copy(b.w).divideScalar(wl)
        const maxJ = wl / invI(b, d, tan, c2).dot(tan)
        const j = Math.min(maxJ, C_RR * d.R * b.rr)
        b.L.addScaledVector(tan, -j)
        updateW(b, d)
      }
    }
    // integrate
    b.p.addScaledVector(b.v, h)
    updateW(b, d)
    const wl = b.w.length()
    if (wl > 1e-9) {
      dq.setFromAxisAngle(tan.copy(b.w).divideScalar(wl), wl * h)
      b.q.premultiply(dq).normalize()
      updateW(b, d) // same L, new orientation: the spin axis moves (precession)
    }
    // sleep when resting, so it lies perfectly still
    if (b.contact && !b.grab && b.v.length() < 0.012 && b.w.length() < 0.06) b.quiet += h
    else b.quiet = 0
    if (b.quiet > 0.5) {
      b.asleep = true
      b.v.set(0, 0, 0)
      b.L.set(0, 0, 0)
      b.w.set(0, 0, 0)
    }
  }
}

export function wake(b) {
  b.asleep = false
  b.quiet = 0
}

export { updateW, impulse }
