// A small cloth solver (position-based dynamics, no physics library).
//
// Cloth is a set of particles joined by distance constraints: structural
// (to the next particle along and across), shear (diagonals) and bending
// (to the particle two along, which resists folding). Each step moves the
// particles by their own momentum and gravity (Verlet), then nudges every
// constrained pair back towards its rest length a few times over. A pinned
// particle has no inverse mass and stays put. Collisions are a callback that
// pushes particles out of the body.

export function createCloth(count) {
  return {
    n: count,
    pos: new Float32Array(count * 3),
    prev: new Float32Array(count * 3),
    rest: new Float32Array(count * 3),
    inv: new Float32Array(count).fill(1),
    force: new Float32Array(count * 3), // external push this step (opening, wind, drag)
    a: [],
    b: [],
    len: [],
    k: [],
    kind: [], // 0 structural, 1 shear, 2 bend
  }
}

export function link(c, i, j, kind = 0) {
  const p = c.rest
  const d = Math.hypot(p[j * 3] - p[i * 3], p[j * 3 + 1] - p[i * 3 + 1], p[j * 3 + 2] - p[i * 3 + 2])
  c.a.push(i)
  c.b.push(j)
  c.len.push(d)
  c.kind.push(kind)
}

// freeze the constraint lists into typed arrays and start at rest
export function finish(c) {
  c.a = Int32Array.from(c.a)
  c.b = Int32Array.from(c.b)
  c.len = Float32Array.from(c.len)
  c.kind = Uint8Array.from(c.kind)
  c.k = new Float32Array(c.a.length)
  c.pos.set(c.rest)
  c.prev.set(c.rest)
  return c
}

// stiffness per kind of constraint (0..1 per iteration)
export function setStiffness(c, structural, shear, bend) {
  const s = [structural, shear, bend]
  for (let i = 0; i < c.k.length; i++) c.k[i] = s[c.kind[i]]
}

// grid helper: a (cols x rows) sheet, optionally wrapping around in u
export function gridLinks(c, cols, rows, base, wrap = false) {
  const id = (u, v) => base + v * cols + (((u % cols) + cols) % cols)
  const uMax = wrap ? cols : cols - 1
  for (let v = 0; v < rows; v++)
    for (let u = 0; u < cols; u++) {
      if (u < uMax) link(c, id(u, v), id(u + 1, v), 0)
      if (v < rows - 1) link(c, id(u, v), id(u, v + 1), 0)
      if (v < rows - 1 && u < uMax) {
        link(c, id(u, v), id(u + 1, v + 1), 1)
        link(c, id(u + 1, v), id(u, v + 1), 1)
      }
      if (u < (wrap ? cols : cols - 2)) link(c, id(u, v), id(u + 2, v), 2)
      if (v < rows - 2) link(c, id(u, v), id(u, v + 2), 2)
    }
}

// one time step: integrate, then satisfy constraints and collisions
export function simulate(c, dt, { gravity = 19.6, damping = 0.985, iterations = 8, extra = null, collide = null }) {
  const { pos, prev, inv, force } = c
  const dt2 = dt * dt
  for (let i = 0; i < c.n; i++) {
    if (inv[i] === 0) continue
    const o = i * 3
    for (let k = 0; k < 3; k++) {
      const p = pos[o + k]
      const v = (p - prev[o + k]) * damping
      prev[o + k] = p
      pos[o + k] = p + v + force[o + k] * dt2 - (k === 1 ? gravity * dt2 : 0)
    }
  }
  const { a, b, len, k } = c
  for (let it = 0; it < iterations; it++) {
    for (let e = 0; e < a.length; e++) {
      const i = a[e] * 3
      const j = b[e] * 3
      const wi = inv[a[e]]
      const wj = inv[b[e]]
      const w = wi + wj
      if (w === 0) continue
      const dx = pos[j] - pos[i]
      const dy = pos[j + 1] - pos[i + 1]
      const dz = pos[j + 2] - pos[i + 2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d < 1e-9) continue
      const s = ((d - len[e]) / d) * k[e]
      const si = (s * wi) / w
      const sj = (s * wj) / w
      pos[i] += dx * si
      pos[i + 1] += dy * si
      pos[i + 2] += dz * si
      pos[j] -= dx * sj
      pos[j + 1] -= dy * sj
      pos[j + 2] -= dz * sj
    }
    extra?.()
    collide?.(pos, inv)
  }
}

// pull two particles (possibly in different cloths) to a target distance
export function pair(pa, ia, wa, pb, ib, wb, target, k = 1) {
  const w = wa + wb
  if (w === 0) return
  const i = ia * 3
  const j = ib * 3
  const dx = pb[j] - pa[i]
  const dy = pb[j + 1] - pa[i + 1]
  const dz = pb[j + 2] - pa[i + 2]
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (d < 1e-9) return
  const s = ((d - target) / d) * k
  pa[i] += (dx * s * wa) / w
  pa[i + 1] += (dy * s * wa) / w
  pa[i + 2] += (dz * s * wa) / w
  pb[j] -= (dx * s * wb) / w
  pb[j + 1] -= (dy * s * wb) / w
  pb[j + 2] -= (dz * s * wb) / w
}
