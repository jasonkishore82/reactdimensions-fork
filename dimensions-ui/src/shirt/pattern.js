import * as THREE from 'three'
import { createCloth, link, gridLinks, finish } from './cloth.js'

// The shirt's pattern and the invisible "ghost mannequin" it hangs on.
// Units: 1 = 0.5 m. y is up, +z is the front, +x is the wearer's left.

// mannequin cross-sections: height -> half-width (x) and half-depth (z)
const BODY = [
  [1.5, 0.13, 0.12],
  [1.4, 0.16, 0.14], // neck base
  [1.32, 0.38, 0.22],
  [1.24, 0.47, 0.25], // shoulders
  [1.05, 0.45, 0.28], // chest
  [0.8, 0.42, 0.27],
  [0.55, 0.39, 0.25], // waist
  [0.25, 0.41, 0.26],
  [-0.2, 0.43, 0.27],
]
export function bodyAt(y) {
  if (y >= BODY[0][0]) return [BODY[0][1], BODY[0][2]]
  for (let i = 1; i < BODY.length; i++) {
    const [y1, x1, z1] = BODY[i]
    const [y0, x0, z0] = BODY[i - 1]
    if (y >= y1) {
      const t = (y0 - y) / (y0 - y1)
      // smooth between sections, so the cloth has no creases at the joins
      const s = t * t * (3 - 2 * t)
      return [x0 + (x1 - x0) * s, z0 + (z1 - z0) * s]
    }
  }
  const l = BODY[BODY.length - 1]
  return [l[1], l[2]]
}

export const EASE = 0.026 // the shirt stands this far off the body
export const Y_TOP = 1.4 // neckline
export const PIN_Y = 1.2 // the yoke and shoulders are held by the mannequin
export const D = 0.085 // half the placket overlap, as an angle at the front
export const OVERLAY = 0.012 // the buttonhole side lies this far over the button side
// curved shirttail: lowest at the front and back, higher at the sides
export const hem = (th) => -0.06 + 0.16 * Math.abs(Math.sin(th)) ** 1.6
export const BUTTON_Y = [1.15, 0.96, 0.77, 0.58, 0.39, 0.2]

// arms (for the sleeves and collisions): shoulder joint to wrist
export function arm(side) {
  const S = new THREE.Vector3(side * 0.43, 1.12, 0)
  const W = new THREE.Vector3(side * 0.68, 0.02, 0.07)
  return { S, W, dir: W.clone().sub(S).normalize(), len: W.distanceTo(S) }
}
export const ARM_R = [0.072, 0.05] // at the shoulder and at the wrist

// Build every piece into one cloth: the torso (one sheet wrapping right round,
// its two front edges overlapping as the placket) and two sleeves.
export function buildShirt() {
  // torso columns: angle round the body from the button-side edge (-D) through
  // the front centre (0), round the back, to the buttonhole-side edge (2pi + D)
  const N = 54
  const th = [-D, 0]
  for (let i = 0; i <= N; i++) th.push(D + ((2 * Math.PI - 2 * D) * i) / N)
  th.push(2 * Math.PI, 2 * Math.PI + D)
  const TC = th.length
  const TR = 36
  // sleeves
  const SC = 20
  const SR = 26
  const total = TC * TR + 2 * SC * SR
  const c = createCloth(total)
  const uv = new Float32Array(total * 2)

  // ---- torso ----
  const tIdx = (u, v) => v * TC + u
  for (let v = 0; v < TR; v++)
    for (let u = 0; u < TC; u++) {
      const a = th[u]
      const f = v / (TR - 1)
      const y = Y_TOP - f * (Y_TOP - hem(a))
      const [rx, rz] = bodyAt(y)
      // the buttonhole side's placket lies over the button side
      const t = THREE.MathUtils.clamp((a - (2 * Math.PI - 2 * D)) / D, 0, 1)
      const over = OVERLAY * t * t * (3 - 2 * t)
      const i = tIdx(u, v)
      c.rest[i * 3] = (rx + EASE + over) * Math.sin(a)
      c.rest[i * 3 + 1] = y
      c.rest[i * 3 + 2] = (rz + EASE + over) * Math.cos(a)
      uv[i * 2] = (a + D) / (2 * Math.PI + 2 * D)
      uv[i * 2 + 1] = 1 - f
      if (y > PIN_Y) c.inv[i] = 0
    }
  gridLinks(c, TC, TR, 0, false)
  const torsoIndex = []
  for (let v = 0; v < TR - 1; v++)
    for (let u = 0; u < TC - 1; u++) {
      const a = tIdx(u, v)
      const b = tIdx(u + 1, v)
      const d = tIdx(u, v + 1)
      const e = tIdx(u + 1, v + 1)
      torsoIndex.push(a, d, b, b, d, e)
    }

  // buttons: the button-side front centre (column 1) to the buttonhole side (column TC - 2)
  const rowAt = (y) => {
    let best = 0
    for (let v = 0; v < TR; v++) {
      const yy = c.rest[tIdx(1, v) * 3 + 1]
      if (Math.abs(yy - y) < Math.abs(c.rest[tIdx(1, best) * 3 + 1] - y)) best = v
    }
    return best
  }
  const buttons = BUTTON_Y.map((y) => {
    const v = rowAt(y)
    return { v, button: tIdx(1, v), hole: tIdx(TC - 2, v), edgeA: tIdx(0, v), edgeB: tIdx(TC - 1, v) }
  })

  // ---- sleeves ----
  const sleeves = []
  for (const side of [-1, 1]) {
    const base = TC * TR + (side < 0 ? 0 : SC * SR)
    const { S, W, dir, len } = arm(side)
    // ring frame round the arm
    // e1 points away from the body on both sides, e2 to the front (right) or back (left),
    // matching the armhole oval below so the sleeve doesn't twist where it joins
    const e1 = new THREE.Vector3(0, 0, 1).cross(dir).multiplyScalar(side).normalize()
    const e2 = dir.clone().cross(e1).normalize()
    // the armhole: an upright oval on the side of the torso
    const AH = { c: new THREE.Vector3(side * 0.45, 1.06, 0.0), ry: 0.17, rz: 0.13 }
    const slack = 1.07 // the sleeve is cut longer than the arm, so it bunches
    const restAt = (t, k, out, packed) => {
      const ang = (k / SC) * Math.PI * 2
      // along the arm
      const along = (packed ? len - 0.03 : (len - 0.03) * slack) * t
      const r = 0.135 + (0.088 - 0.135) * t
      const ax = S.clone().addScaledVector(dir, along)
      const ring = ax
        .clone()
        .addScaledVector(e1, Math.cos(ang) * r)
        .addScaledVector(e2, Math.sin(ang) * r)
      // near the top, blend into the armhole oval on the torso's side
      const hole = new THREE.Vector3(AH.c.x + side * 0.01, AH.c.y + Math.cos(ang) * AH.ry, AH.c.z + Math.sin(ang) * AH.rz * side)
      const b = THREE.MathUtils.smoothstep(t, 0, 0.22)
      out.copy(hole).lerp(ring, b)
      return out
    }
    const tmp = new THREE.Vector3()
    for (let v = 0; v < SR; v++)
      for (let k = 0; k < SC; k++) {
        const i = base + v * SC + k
        const t = v / (SR - 1)
        restAt(t, k, tmp, false)
        c.rest.set([tmp.x, tmp.y, tmp.z], i * 3)
        uv[i * 2] = k / SC
        uv[i * 2 + 1] = 1 - t
        if (v === 0 || v === SR - 1) c.inv[i] = 0
      }
    gridLinks(c, SC, SR, base, true)
    sleeves.push({ side, base, restAt })
  }
  finish(c)
  // start the sleeves packed onto the arm (shorter than cut), so they bunch
  const tmp = new THREE.Vector3()
  for (const sl of sleeves)
    for (let v = 0; v < SR; v++)
      for (let k = 0; k < SC; k++) {
        const i = sl.base + v * SC + k
        sl.restAt(v / (SR - 1), k, tmp, true)
        c.pos.set([tmp.x, tmp.y, tmp.z], i * 3)
        c.prev.set([tmp.x, tmp.y, tmp.z], i * 3)
      }

  // sleeve index (a wrapping tube; one more column of vertices for the seam's uv)
  const sleeveIndex = []
  for (let v = 0; v < SR - 1; v++)
    for (let k = 0; k < SC; k++) {
      const k2 = (k + 1) % SC
      const a = v * SC + k
      const b = v * SC + k2
      const d = (v + 1) * SC + k
      const e = (v + 1) * SC + k2
      sleeveIndex.push(a, b, d, b, e, d)
    }

  return { cloth: c, uv, th, TC, TR, SC, SR, torsoIndex, sleeveIndex, buttons, sleeves }
}

// ---------- fabric ----------
export const FABRICS = {
  oxford: { rough: 0.88, sheen: 0.55, sheenRough: 0.75, bend: 0.2, shear: 0.5, bump: 1.2 },
  poplin: { rough: 0.7, sheen: 0.35, sheenRough: 0.6, bend: 0.14, shear: 0.45, bump: 0.5 },
  linen: { rough: 0.96, sheen: 0.25, sheenRough: 0.85, bend: 0.05, shear: 0.3, bump: 1.6 },
  denim: { rough: 0.92, sheen: 0.3, sheenRough: 0.8, bend: 0.45, shear: 0.7, bump: 2 },
}

// the weave, as a tiling bump map
export function weaveTexture(kind) {
  const S = 128
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = '#808080'
  g.fillRect(0, 0, S, S)
  const thread = (x, y, w, h, light) => {
    const grd = w > h ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0)
    grd.addColorStop(0, '#5a5a5a')
    grd.addColorStop(0.5, light)
    grd.addColorStop(1, '#5a5a5a')
    g.fillStyle = grd
    g.fillRect(x, y, w, h)
  }
  if (kind === 'oxford') {
    // basket weave: pairs of threads over and under in blocks
    const b = 16
    for (let y = 0; y < S; y += b)
      for (let x = 0; x < S; x += b) {
        const across = ((x + y) / b) % 2 === 0
        for (let k = 0; k < 2; k++) {
          if (across) thread(x, y + k * (b / 2), b, b / 2, '#b8b8b8')
          else thread(x + k * (b / 2), y, b / 2, b, '#c4c4c4')
        }
      }
  } else if (kind === 'poplin') {
    const b = 8
    for (let y = 0; y < S; y += b) for (let x = 0; x < S; x += b) (x + y) / b % 2 === 0 ? thread(x, y, b, b, '#a8a8a8') : thread(x, y, b, b, '#b0b0b0')
  } else if (kind === 'linen') {
    // uneven slubby threads both ways
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * S
      thread(0, y, S, 2 + Math.random() * 5, `rgb(${150 + Math.random() * 60 | 0},${150 + Math.random() * 60 | 0},${150 + Math.random() * 60 | 0})`)
      const x = Math.random() * S
      thread(x, 0, 2 + Math.random() * 4, S, `rgb(${140 + Math.random() * 60 | 0},${140 + Math.random() * 60 | 0},${140 + Math.random() * 60 | 0})`)
    }
  } else {
    // denim twill: diagonal ribs
    g.strokeStyle = '#c8c8c8'
    g.lineWidth = 5
    for (let i = -S; i < S * 2; i += 10) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + S, S)
      g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// fine colour variation of the yarn (oxford mixes a white weft with a coloured warp)
function heather(g, W, H, color, kind) {
  const base = new THREE.Color(color)
  const hsl = {}
  base.getHSL(hsl)
  // tiny single-thread flecks, scaled to the canvas, so the cloth reads as
  // woven yarn up close and as an even colour from a distance
  const n = Math.round((W * H) / (kind === 'linen' ? 60 : 40))
  const spread = kind === 'oxford' ? 0.07 : kind === 'linen' ? 0.08 : kind === 'denim' ? 0.06 : 0.035
  for (let i = 0; i < n; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const light = (Math.random() - 0.5) * spread
    g.fillStyle = `hsla(${hsl.h * 360},${hsl.s * 100}%,${Math.min(100, Math.max(0, (hsl.l + light) * 100))}%,0.35)`
    const horiz = Math.random() < 0.5
    const len = kind === 'linen' ? 2 + Math.random() * 7 : 1 + Math.random() * 3
    g.fillRect(x, y, horiz ? len : 1, horiz ? 1 : len)
  }
}

// The torso's own texture: the cloth, with the placket, its stitching, the
// buttonholes, the chest pocket, the back yoke, side seams and hem, all laid
// out in the same (angle, height) coordinates as the cloth.
export function torsoTexture(color, stitch, kind) {
  const W = 2048
  const H = 1024
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, W, H)
  heather(g, W, H, color, kind)
  const U = (a) => ((a + D) / (2 * Math.PI + 2 * D)) * W
  const V = (a, y) => ((Y_TOP - y) / (Y_TOP - hem(a))) * H
  const dark = new THREE.Color(color).multiplyScalar(0.78).getStyle()
  const seam = (pts, w = 2.2, col = dark) => {
    g.strokeStyle = col
    g.lineWidth = w
    g.setLineDash([])
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.stroke()
  }
  const stitches = (pts) => {
    g.strokeStyle = stitch
    g.lineWidth = 1.6
    g.setLineDash([7, 5])
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.stroke()
    g.setLineDash([])
  }
  const vline = (a, y0, y1) => {
    const out = []
    for (let k = 0; k <= 30; k++) {
      const y = y0 + ((y1 - y0) * k) / 30
      out.push([U(a), V(a, y)])
    }
    return out
  }
  const hline = (a0, a1, y) => {
    const out = []
    for (let k = 0; k <= 60; k++) {
      const a = a0 + ((a1 - a0) * k) / 60
      out.push([U(a), V(a, y)])
    }
    return out
  }
  const bottom = (a) => hem(a) + 0.001

  // side seams
  for (const a of [Math.PI / 2, (3 * Math.PI) / 2]) seam(vline(a, 1.06, bottom(a)), 1.6)
  // back yoke
  seam(hline(Math.PI / 2 + 0.25, (3 * Math.PI) / 2 - 0.25, 1.21))
  stitches(hline(Math.PI / 2 + 0.25, (3 * Math.PI) / 2 - 0.25, 1.195))
  // box pleat below the yoke at the back centre
  seam(vline(Math.PI - 0.03, 1.21, 1.12), 1.4)
  seam(vline(Math.PI + 0.03, 1.21, 1.12), 1.4)

  // the front placket on the buttonhole side, with its fold edge and stitching
  const pa = 2 * Math.PI - D
  const pb = 2 * Math.PI + D
  g.fillStyle = new THREE.Color(color).multiplyScalar(1.02).getStyle()
  g.fillRect(U(pa), 0, U(pb) - U(pa), H)
  seam(vline(pb - 0.004, Y_TOP, bottom(0)), 2.5, new THREE.Color(color).multiplyScalar(0.7).getStyle())
  stitches(vline(pa + 0.012, Y_TOP, bottom(0)))
  stitches(vline(pb - 0.016, Y_TOP, bottom(0)))
  // buttonholes, upright on the placket
  for (const y of BUTTON_Y) {
    const x = U(2 * Math.PI)
    const v0 = V(0, y + 0.022)
    const v1 = V(0, y - 0.022)
    g.fillStyle = new THREE.Color(color).multiplyScalar(0.62).getStyle()
    g.fillRect(x - 5, v0, 10, v1 - v0)
    g.fillStyle = new THREE.Color(color).multiplyScalar(0.3).getStyle()
    g.fillRect(x - 1.2, v0 + 3, 2.4, v1 - v0 - 6)
  }
  // the button side's facing, along its edge
  stitches(vline(-D + 0.03, Y_TOP, bottom(0)))

  // chest pocket on the wearer's left
  const p0 = 0.22
  const p1 = 0.64
  const yt = 1.07
  const yb = 0.86
  const pocket = [...vline(p0, yt, yb + 0.03), [U((p0 + p1) / 2), V((p0 + p1) / 2, yb)], ...vline(p1, yb + 0.03, yt).map((p) => p)]
  g.fillStyle = 'rgba(0,0,0,0.035)'
  g.beginPath()
  pocket.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
  g.fill()
  seam(pocket, 2, dark)
  seam(hline(p0, p1, yt), 2.6, new THREE.Color(color).multiplyScalar(0.72).getStyle())
  stitches(hline(p0 + 0.01, p1 - 0.01, yt - 0.018))
  stitches([...vline(p0 + 0.012, yt - 0.018, yb + 0.03), [U((p0 + p1) / 2), V((p0 + p1) / 2, yb + 0.012)], ...vline(p1 - 0.012, yb + 0.03, yt - 0.018)])

  // the hem, turned up and stitched
  const hemPts = []
  for (let k = 0; k <= 120; k++) {
    const a = -D + ((2 * Math.PI + 2 * D) * k) / 120
    hemPts.push([U(a), V(a, hem(a) + 0.02)])
  }
  stitches(hemPts)

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function plainTexture(color, stitch, kind, { seamU = null, placket = false } = {}) {
  const W = 1024
  const H = 1024
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, W, H)
  heather(g, W, H, color, kind)
  if (seamU != null) {
    g.strokeStyle = new THREE.Color(color).multiplyScalar(0.8).getStyle()
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(seamU * W, 0)
    g.lineTo(seamU * W, H)
    g.stroke()
  }
  if (placket) {
    // the sleeve's placket slit above the cuff, on the back of the sleeve
    g.strokeStyle = new THREE.Color(color).multiplyScalar(0.72).getStyle()
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(W * 0.5, H * 0.82)
    g.lineTo(W * 0.5, H)
    g.stroke()
    g.strokeStyle = stitch
    g.setLineDash([6, 5])
    g.lineWidth = 1.5
    g.strokeRect(W * 0.5 - 10, H * 0.8, 20, H * 0.2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
