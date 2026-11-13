import { useEffect, useRef } from 'react'

// Letters as solid blocks with real 2D rigid-body physics. They drop into
// the box one after another, land, knock into each other, tip over and pile
// up. Grab a letter to pick it up by that point and throw it.
//
// Each letter is a box with mass and a moment of inertia. Contacts come from
// the separating-axis test plus edge clipping (up to two points per pair),
// and a sequential-impulse solver resolves them with friction and a little
// bounce, iterated so stacks stay standing.
const G = 2600 // px/s^2
const MU = 0.6
const BOUNCE = 0.15
const ITER = 12
const SUB = 3

const rot = (a, x, y) => [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y]
const cross = (ax, ay, bx, by) => ax * by - ay * bx

// contacts between boxes A and B; normal points from A to B
function collide(A, B) {
  const axes = [
    [A, rot(A.a, 1, 0), A.hx, rot(A.a, 0, 1), A.hy],
    [A, rot(A.a, 0, 1), A.hy, rot(A.a, 1, 0), A.hx],
    [B, rot(B.a, 1, 0), B.hx, rot(B.a, 0, 1), B.hy],
    [B, rot(B.a, 0, 1), B.hy, rot(B.a, 1, 0), B.hx],
  ]
  const dx = B.x - A.x
  const dy = B.y - A.y
  let best = null
  for (let i = 0; i < 4; i++) {
    const [owner, u] = axes[i]
    const other = owner === A ? B : A
    const ux = rot(other.a, 1, 0)
    const uy = rot(other.a, 0, 1)
    const ext = (owner === A ? A : B)[i % 2 === 0 ? 'hx' : 'hy']
    const proj = Math.abs(other.hx * (u[0] * ux[0] + u[1] * ux[1])) + Math.abs(other.hy * (u[0] * uy[0] + u[1] * uy[1]))
    const d = dx * u[0] + dy * u[1]
    const sep = Math.abs(d) - ext - proj
    if (sep > 0) return []
    // prefer A's faces slightly, to keep the reference face stable
    if (!best || sep > best.sep + (i >= 2 ? 0.5 : 0)) best = { i, sep, d, u, ext }
  }
  const refIsA = best.i < 2
  const ref = refIsA ? A : B
  const inc = refIsA ? B : A
  // face normal of the reference box, pointing toward the incident box
  const s = refIsA ? Math.sign(best.d) || 1 : -(Math.sign(best.d) || 1)
  const n = [best.u[0] * s, best.u[1] * s]
  const t = [-n[1], n[0]]
  const ext = best.ext
  const side = axes[best.i][4]
  const fc = [ref.x + n[0] * ext, ref.y + n[1] * ext]
  // incident face: the one facing most against n
  const faces = [
    [rot(inc.a, 1, 0), inc.hx, inc.hy],
    [rot(inc.a, -1, 0), inc.hx, inc.hy],
    [rot(inc.a, 0, 1), inc.hy, inc.hx],
    [rot(inc.a, 0, -1), inc.hy, inc.hx],
  ]
  let f = faces[0]
  for (const q of faces) if (q[0][0] * n[0] + q[0][1] * n[1] < f[0][0] * n[0] + f[0][1] * n[1]) f = q
  const c = [inc.x + f[0][0] * f[1], inc.y + f[0][1] * f[1]]
  const ft = [-f[0][1], f[0][0]]
  let pts = [
    [c[0] + ft[0] * f[2], c[1] + ft[1] * f[2]],
    [c[0] - ft[0] * f[2], c[1] - ft[1] * f[2]],
  ]
  // clip the incident edge to the reference face's side planes
  const clip = (P, ox, oy, k) => {
    const out = []
    const d0 = (P[0][0] - ox) * t[0] * k + (P[0][1] - oy) * t[1] * k
    const d1 = (P[1][0] - ox) * t[0] * k + (P[1][1] - oy) * t[1] * k
    if (d0 <= 0) out.push(P[0])
    if (d1 <= 0) out.push(P[1])
    if (d0 * d1 < 0) {
      const a = d0 / (d0 - d1)
      out.push([P[0][0] + (P[1][0] - P[0][0]) * a, P[0][1] + (P[1][1] - P[0][1]) * a])
    }
    return out
  }
  pts = clip(pts, fc[0] + t[0] * side, fc[1] + t[1] * side, 1)
  if (pts.length < 2) return []
  pts = clip(pts, fc[0] - t[0] * side, fc[1] - t[1] * side, -1)
  if (pts.length < 2) return []
  const out = []
  for (const p of pts) {
    const sep = (p[0] - fc[0]) * n[0] + (p[1] - fc[1]) * n[1]
    if (sep <= 1) out.push({ x: p[0], y: p[1], sep, nx: refIsA ? n[0] : -n[0], ny: refIsA ? n[1] : -n[1], pn: 0, pt: 0 })
  }
  return out
}

function solve(A, B, cs, h) {
  for (const k of cs) {
    const rax = k.x - A.x
    const ray = k.y - A.y
    const rbx = k.x - B.x
    const rby = k.y - B.y
    const rvx = B.vx - B.w * rby - (A.vx - A.w * ray)
    const rvy = B.vy + B.w * rbx - (A.vy + A.w * rax)
    // normal
    const rna = cross(rax, ray, k.nx, k.ny)
    const rnb = cross(rbx, rby, k.nx, k.ny)
    const kn = A.im + B.im + A.ii * rna * rna + B.ii * rnb * rnb
    const vn = rvx * k.nx + rvy * k.ny
    if (k.bounce === undefined) k.bounce = vn < -200 ? -vn * BOUNCE : 0
    const bias = Math.max(0, -k.sep - 0.5) * (0.25 / h)
    let dpn = (-vn + bias + k.bounce) / kn
    const pn0 = k.pn
    k.pn = Math.max(0, pn0 + dpn)
    dpn = k.pn - pn0
    let px = dpn * k.nx
    let py = dpn * k.ny
    // friction, limited by the normal impulse
    const tx = -k.ny
    const ty = k.nx
    const rta = cross(rax, ray, tx, ty)
    const rtb = cross(rbx, rby, tx, ty)
    const kt = A.im + B.im + A.ii * rta * rta + B.ii * rtb * rtb
    const vt = rvx * tx + rvy * ty
    let dpt = -vt / kt
    const pt0 = k.pt
    k.pt = Math.max(-MU * k.pn, Math.min(MU * k.pn, pt0 + dpt))
    dpt = k.pt - pt0
    px += dpt * tx
    py += dpt * ty
    A.vx -= px * A.im
    A.vy -= py * A.im
    A.w -= cross(rax, ray, px, py) * A.ii
    B.vx += px * B.im
    B.vy += py * B.im
    B.w += cross(rbx, rby, px, py) * B.ii
  }
}

export default function TumbleText({
  text = 'TUMBLE',
  stagger = 160,
  spin = 1,
  ink = '#1c1a16',
  accent = '#ff4d1a',
  background = '#f7f7f8',
  style,
}) {
  const box = useRef()
  const spans = useRef([])

  useEffect(() => {
    const el = box.current
    let W = el.clientWidth
    let H = el.clientHeight
    const letters = spans.current.filter(Boolean)
    const wall = (x, y, hx, hy) => ({ x, y, a: 0, hx, hy, vx: 0, vy: 0, w: 0, im: 0, ii: 0, static: true })
    // the floor sits a little above the bottom edge so the letters land on a
    // visible line rather than at the clip
    const floorAt = () => H * 0.86
    const statics = [wall(W / 2, floorAt() + 500, W, 500), wall(-500, H / 2, 500, H * 2), wall(W + 500, H / 2, 500, H * 2)]
    let total = 0
    const bodies = letters.map((s, i) => {
      const r = s.getBoundingClientRect()
      // the block is the letter's ink box, not its line box
      const hx = Math.max(6, r.width * 0.46)
      const hy = Math.max(8, r.height * 0.36)
      total += hx * 2 + 6
      const m = hx * hy * 4 * 0.001
      return { s, hx, hy, x: 0, y: -hy - 40, a: (Math.random() - 0.5) * 0.6 * spin, vx: 0, vy: 0, w: (Math.random() - 0.5) * 6 * spin, im: 1 / m, ii: 1 / ((m * (4 * hx * hx + 4 * hy * hy)) / 12), live: false, at: i * stagger }
    })
    // drop them in roughly where they'd sit in the word
    let cx = W / 2 - total / 2
    for (const b of bodies) {
      b.x = cx + b.hx + (Math.random() - 0.5) * 20
      cx += b.hx * 2 + 6
      b.s.style.opacity = '0'
    }
    let drag = null
    let raf = 0
    let last = 0
    let t = 0
    // the box can still be settling its size when this runs, so the floor
    // and walls follow its current size
    const fit = () => {
      W = el.clientWidth
      H = el.clientHeight
      statics[0].x = W / 2
      statics[0].y = floorAt() + 500
      statics[0].hx = W
      statics[1].y = statics[2].y = H / 2
      statics[1].hy = statics[2].hy = H * 2
      statics[2].x = W + 500
    }
    const step = (h) => {
      for (const b of bodies) {
        if (!b.live) continue
        b.vy += G * h
        if (drag && drag.b === b) {
          // pull the grabbed point toward the pointer like a stiff spring
          const [gx, gy] = rot(b.a, drag.lx, drag.ly)
          const px = b.x + gx
          const py = b.y + gy
          const fx = (drag.x - px) * 40 - b.vx * 6
          const fy = (drag.y - py) * 40 - b.vy * 6 - G
          b.vx += fx * h
          b.vy += fy * h
          b.w += cross(gx, gy, fx, fy) * h * (b.ii / b.im) * 0.6
          b.w *= 0.96
        }
      }
      const pairs = []
      const live = bodies.filter((b) => b.live)
      for (let i = 0; i < live.length; i++) {
        for (const s of statics) {
          const cs = collide(s, live[i])
          if (cs.length) pairs.push([s, live[i], cs])
        }
        for (let j = i + 1; j < live.length; j++) {
          const A = live[i]
          const B = live[j]
          if (Math.abs(A.x - B.x) > A.hx + B.hx + A.hy + B.hy || Math.abs(A.y - B.y) > A.hx + B.hx + A.hy + B.hy) continue
          const cs = collide(A, B)
          if (cs.length) pairs.push([A, B, cs])
        }
      }
      for (let it = 0; it < ITER; it++) for (const [A, B, cs] of pairs) solve(A, B, cs, h)
      for (const b of live) {
        b.x += b.vx * h
        b.y += b.vy * h
        b.a += b.w * h
        b.w *= 0.999
      }
    }
    const frame = (now) => {
      last ||= now
      const dt = Math.min(1 / 30, (now - last) / 1000)
      last = now
      t += dt * 1000
      fit()
      for (const b of bodies) {
        if (!b.live && t >= b.at) {
          b.live = true
          b.s.style.opacity = '1'
        }
      }
      for (let i = 0; i < SUB; i++) step(dt / SUB)
      for (const b of bodies) b.s.style.transform = `translate(${(b.x - b.hx / 0.46 / 2).toFixed(1)}px, ${(b.y - b.hy / 0.36 / 2).toFixed(1)}px) rotate(${b.a.toFixed(4)}rad)`
      raf = requestAnimationFrame(frame)
    }
    const local = (e) => {
      const r = el.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const down = (e) => {
      const [x, y] = local(e)
      for (const b of [...bodies].reverse()) {
        if (!b.live) continue
        const [lx, ly] = rot(-b.a, x - b.x, y - b.y)
        if (Math.abs(lx) <= b.hx + 4 && Math.abs(ly) <= b.hy + 4) {
          drag = { b, lx, ly, x, y }
          el.setPointerCapture(e.pointerId)
          el.style.cursor = 'grabbing'
          return
        }
      }
    }
    const move = (e) => {
      if (!drag) return
      ;[drag.x, drag.y] = local(e)
    }
    const up = () => {
      drag = null
      el.style.cursor = ''
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [text, stagger, spin])

  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
      {[...String(text)].map((c, i) =>
        c === ' ' ? null : (
          <span
            key={`${i}-${c}`}
            ref={(n) => (spans.current[i] = n)}
            aria-hidden="true"
            style={{ position: 'absolute', left: 0, top: 0, lineHeight: 1, color: i % 3 === 1 ? accent : ink, willChange: 'transform', opacity: 0, cursor: 'grab' }}
          >
            {c}
          </span>
        ),
      )}
      <div aria-hidden="true" style={{ position: 'absolute', left: '6%', right: '6%', top: '86%', height: 1, background: `${ink}26` }} />
    </div>
  )
}
