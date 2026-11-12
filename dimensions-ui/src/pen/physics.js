import * as THREE from 'three'

// Small 3D rigid-body physics for the pen and its cap (no physics library).
//
// A body is a set of spheres fixed in its own frame. A row of spheres down the
// axis makes a round barrel that rolls; spheres on the clip stick out past it,
// so a rolling pen stops on its clip just as a real one does. Each sphere has a
// mass, which gives the centre of mass and the full inertia tensor, so a pen
// with its cap posted on the end is heavier at the back and hangs differently.
//
// Every small step gravity pulls, then contacts (spheres against the desk and
// the invisible walls, and spheres of one body against the other's) are solved
// with sequential impulses: a normal push that never pulls, Coulomb friction
// clamped to mu times that push, a little restitution for hard hits, and
// rolling and spinning resistance so a pen lying on paper comes to rest.
//
// Units: 1 unit = 10 mm, so gravity is 981 units/s^2 (9.81 m/s^2).

export const G = 981
const HZ = 480 // substep rate
const ITER = 8
const MU = 0.32 // resin on paper
const REST = 0.28
const REST_MIN = 14 // below this closing speed a contact does not bounce
const ROLL = 0.035 // rolling resistance (a length: how far the push sits ahead)
const SPIN = 0.05 // resistance to spinning flat on the desk
const SLOP = 0.004

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _d = new THREE.Vector3()
const _m4 = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const ONE = new THREE.Vector3(1, 1, 1)

// spheres: [{ c: Vector3 (frame-local centre), r, m }]
export function createBody(spheres) {
  const b = {
    p: new THREE.Vector3(), // centre of mass, world
    q: new THREE.Quaternion(),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(),
    com: new THREE.Vector3(), // centre of mass in the body's own frame
    m: 1,
    invM: 1,
    IinvL: new THREE.Matrix3(),
    Iinv: new THREE.Matrix3(),
    R: new THREE.Matrix3(),
    Rt: new THREE.Matrix3(),
    spheres: [],
    wc: [],
    bound: 1,
    kinematic: false,
    asleep: false,
    still: 0,
    touching: false,
    impact: 0,
  }
  setSpheres(b, spheres, false)
  sync(b)
  return b
}

// Replace a body's spheres (a cap going on or coming off). The frame stays
// where it is; the centre of mass and inertia are worked out again.
export function setSpheres(b, spheres, keepFrame = true) {
  let m = 0
  const c = new THREE.Vector3()
  for (const s of spheres) {
    m += s.m
    c.addScaledVector(s.c, s.m)
  }
  c.divideScalar(m)
  let xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0, bound = 0
  for (const s of spheres) {
    const dx = s.c.x - c.x
    const dy = s.c.y - c.y
    const dz = s.c.z - c.z
    const self = 0.4 * s.m * s.r * s.r
    xx += s.m * (dy * dy + dz * dz) + self
    yy += s.m * (dx * dx + dz * dz) + self
    zz += s.m * (dx * dx + dy * dy) + self
    xy -= s.m * dx * dy
    xz -= s.m * dx * dz
    yz -= s.m * dy * dz
    bound = Math.max(bound, Math.hypot(dx, dy, dz) + s.r)
  }
  b.IinvL.set(xx, xy, xz, xy, yy, yz, xz, yz, zz).invert()
  if (keepFrame) b.p.add(_a.copy(c).sub(b.com).applyQuaternion(b.q))
  b.com.copy(c)
  b.m = m
  b.invM = 1 / m
  b.bound = bound
  b.spheres = spheres
  while (b.wc.length < spheres.length) b.wc.push(new THREE.Vector3())
  b.wc.length = spheres.length
}

// rotation, world inverse inertia and world sphere centres from p and q
export function sync(b) {
  _m4.makeRotationFromQuaternion(b.q)
  b.R.setFromMatrix4(_m4)
  b.Rt.copy(b.R).transpose()
  b.Iinv.copy(b.R).multiply(b.IinvL).multiply(b.Rt)
  for (let i = 0; i < b.spheres.length; i++) b.wc[i].copy(b.spheres[i].c).sub(b.com).applyMatrix3(b.R).add(b.p)
}

export const toWorld = (b, local, out) => out.copy(local).sub(b.com).applyQuaternion(b.q).add(b.p)
export const toLocal = (b, world, out) => out.copy(world).sub(b.p).applyQuaternion(_q.copy(b.q).invert()).add(b.com)

// the body's frame (not its centre of mass) as a matrix
export function frameMatrix(b, out) {
  _a.copy(b.com).applyQuaternion(b.q)
  return out.compose(_b.copy(b.p).sub(_a), b.q, ONE)
}
// place the body's frame at pos with rotation q
export function setFrame(b, pos, q) {
  b.q.copy(q)
  b.p.copy(b.com).applyQuaternion(q).add(pos)
  sync(b)
}

export function pointVelocity(b, world, out) {
  _c.copy(world).sub(b.p)
  return out.crossVectors(b.w, _c).add(b.v)
}

// impulse J (world) at offset r from the centre of mass
export function applyImpulse(b, J, r) {
  b.v.addScaledVector(J, b.invM)
  _d.crossVectors(r, J).applyMatrix3(b.Iinv)
  b.w.add(_d)
}

export function wake(b) {
  b.asleep = false
  b.still = 0
}

const active = (b) => !b.kinematic && !b.asleep

// ---- contacts ----
const pool = []
let count = 0
function contact() {
  if (count === pool.length) pool.push({ n: new THREE.Vector3(), pt: new THREE.Vector3(), rA: new THREE.Vector3(), rB: new THREE.Vector3(), t1: new THREE.Vector3(), t2: new THREE.Vector3() })
  return pool[count++]
}

function kOf(A, B, rA, rB, d) {
  let k = A.invM + _a.crossVectors(rA, d).applyMatrix3(A.Iinv).cross(rA).dot(d)
  if (B) k += B.invM + _a.crossVectors(rB, d).applyMatrix3(B.Iinv).cross(rB).dot(d)
  return k
}
function relVel(c, out) {
  pointVelocity(c.A, c.pt, out)
  if (c.B) out.sub(pointVelocity(c.B, c.pt, _b))
  return out
}
function push(c, J) {
  if (active(c.A)) applyImpulse(c.A, J, c.rA)
  if (c.B && active(c.B)) applyImpulse(c.B, _c.copy(J).negate(), c.rB)
}

function substep(bodies, h, env) {
  for (const b of bodies) {
    if (!active(b)) continue
    b.v.y -= G * h
    b.v.multiplyScalar(1 - 0.05 * h)
    b.w.multiplyScalar(1 - 0.3 * h)
  }

  // the hand: a stiff damped spring from a point on the body to the pointer
  const g = env.grab
  if (g && active(g.body)) {
    const b = g.body
    sync(b)
    const P = toWorld(b, g.local, new THREE.Vector3())
    const r = new THREE.Vector3().subVectors(P, b.p)
    const vp = new THREE.Vector3().crossVectors(b.w, r).add(b.v)
    const F = new THREE.Vector3().subVectors(g.target, P).multiplyScalar(900 * b.m).addScaledVector(vp, -42 * b.m)
    F.clampLength(0, b.m * G * 8)
    applyImpulse(b, F.multiplyScalar(h), r)
    b.w.multiplyScalar(1 - 4 * h)
  }

  for (const b of bodies) if (!b.kinematic) sync(b)

  // find contacts
  count = 0
  for (const b of bodies) {
    if (b.kinematic) continue
    b.touching = false
    if (b.asleep) continue
    for (let i = 0; i < b.spheres.length; i++) {
      const w = b.wc[i]
      const r = b.spheres[i].r
      for (const pl of env.planes) {
        const dist = pl.n.dot(w) - pl.d
        if (dist >= r) continue
        const c = contact()
        c.A = b
        c.B = null
        c.n.copy(pl.n)
        c.pt.copy(w).addScaledVector(pl.n, -r)
        c.pen = r - dist
        c.floor = pl.floor
      }
    }
  }
  for (let x = 0; x < bodies.length; x++) {
    for (let y = x + 1; y < bodies.length; y++) {
      const A = bodies[x]
      const B = bodies[y]
      if (A.kinematic || B.kinematic || (A.asleep && B.asleep)) continue
      if (A.p.distanceTo(B.p) > A.bound + B.bound) continue
      for (let i = 0; i < A.spheres.length; i++) {
        for (let j = 0; j < B.spheres.length; j++) {
          const rr = A.spheres[i].r + B.spheres[j].r
          _a.subVectors(A.wc[i], B.wc[j])
          const d2 = _a.lengthSq()
          if (d2 >= rr * rr || d2 < 1e-12) continue
          const dist = Math.sqrt(d2)
          const c = contact()
          c.A = A
          c.B = B
          c.n.copy(_a).divideScalar(dist) // from B towards A
          c.pt.copy(B.wc[j]).addScaledVector(c.n, B.spheres[j].r)
          c.pen = rr - dist
          c.floor = false
          if (A.asleep) wake(A)
          if (B.asleep) wake(B)
        }
      }
    }
  }

  // prepare
  for (let i = 0; i < count; i++) {
    const c = pool[i]
    c.rA.subVectors(c.pt, c.A.p)
    if (c.B) c.rB.subVectors(c.pt, c.B.p)
    c.t1.set(Math.abs(c.n.x) < 0.9 ? 1 : 0, Math.abs(c.n.x) < 0.9 ? 0 : 1, 0).cross(c.n).normalize()
    c.t2.crossVectors(c.n, c.t1)
    c.kn = kOf(c.A, c.B, c.rA, c.rB, c.n)
    c.k1 = kOf(c.A, c.B, c.rA, c.rB, c.t1)
    c.k2 = kOf(c.A, c.B, c.rA, c.rB, c.t2)
    const vn = relVel(c, _d).dot(c.n)
    c.bias = Math.min((0.2 / h) * Math.max(0, c.pen - SLOP), 6) + (vn < -REST_MIN ? -REST * vn : 0)
    c.ln = c.l1 = c.l2 = 0
    c.A.touching = true
    if (c.B) c.B.touching = true
    c.A.impact = Math.max(c.A.impact, -vn)
    if (c.B) c.B.impact = Math.max(c.B.impact, -vn)
  }

  // solve
  const J = new THREE.Vector3()
  for (let it = 0; it < ITER; it++) {
    for (let i = 0; i < count; i++) {
      const c = pool[i]
      const v = relVel(c, _d)
      const old = c.ln
      c.ln = Math.max(0, old + (c.bias - v.dot(c.n)) / c.kn)
      push(c, J.copy(c.n).multiplyScalar(c.ln - old))

      relVel(c, v)
      const o1 = c.l1
      const o2 = c.l2
      let l1 = o1 - v.dot(c.t1) / c.k1
      let l2 = o2 - v.dot(c.t2) / c.k2
      const max = MU * c.ln
      const mag = Math.hypot(l1, l2)
      if (mag > max) {
        l1 *= max / mag
        l2 *= max / mag
      }
      c.l1 = l1
      c.l2 = l2
      push(c, J.copy(c.t1).multiplyScalar(l1 - o1).addScaledVector(c.t2, l2 - o2))
    }
  }

  // rolling and spinning resistance against the desk
  for (let i = 0; i < count; i++) {
    const c = pool[i]
    if (!c.floor || c.ln <= 0 || !active(c.A)) continue
    const b = c.A
    const wn = b.w.dot(c.n)
    resist(b, _a.copy(b.w).addScaledVector(c.n, -wn), ROLL * c.ln)
    resist(b, _a.copy(c.n).multiplyScalar(wn), SPIN * c.ln)
  }

  // integrate
  for (const b of bodies) {
    if (!active(b)) continue
    b.v.clampLength(0, 500)
    b.w.clampLength(0, 90)
    b.p.addScaledVector(b.v, h)
    const q = b.q
    const { x: wx, y: wy, z: wz } = b.w
    const hh = 0.5 * h
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w
    q.x += hh * (wx * qw + wy * qz - wz * qy)
    q.y += hh * (wy * qw + wz * qx - wx * qz)
    q.z += hh * (wz * qw + wx * qy - wy * qx)
    q.w += hh * (-wx * qx - wy * qy - wz * qz)
    q.normalize()
  }
}

// an angular impulse of at most `amount` against the spin `part`, never reversing it
function resist(b, part, amount) {
  const mag = part.length()
  if (mag < 1e-5) return
  const dw = part.divideScalar(mag).multiplyScalar(amount).applyMatrix3(b.Iinv)
  const along = dw.length()
  if (along > mag) dw.multiplyScalar(mag / along)
  b.w.sub(dw)
}

// env: { planes: [{ n, d, floor }], grab: { body, local, target } | null }
export function step(bodies, dt, env) {
  for (const b of bodies) b.impact = 0
  const n = Math.min(16, Math.max(1, Math.ceil(dt * HZ)))
  const h = dt / n
  for (let s = 0; s < n; s++) substep(bodies, h, env)
  for (const b of bodies) {
    if (!active(b)) continue
    sync(b)
    const held = env.grab && env.grab.body === b
    if (!held && b.touching && b.v.length() < 1.2 && b.w.length() < 0.7) b.still += dt
    else b.still = 0
    if (b.still > 0.45) {
      b.asleep = true
      b.v.set(0, 0, 0)
      b.w.set(0, 0, 0)
    }
  }
}
