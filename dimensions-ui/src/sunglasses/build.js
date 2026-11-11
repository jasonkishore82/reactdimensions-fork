import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bounds, lensOutline, offsetOutline, pick, rimWidth, smoothOutline } from './shapes.js'

const RIM_DEPTH = 0.17 // how far the rim stands out front to back
const RIM_BEVEL = 0.03
const LENS_BULGE = 0.11 // how far the lens domes forward in the middle
// The hinge sits this far behind the back of the rim, on an end piece, so a
// folded arm lies behind the frame instead of cutting through it.
const HINGE_BACK = 0.1
const TIP_AT = 0.7 // where along the arm the tip sleeve begins

// Frames curve round the face: the further from the centre, the further back.
const bend = (x, wrap) => -wrap * 0.085 * x * x

function warp(geo, wrap) {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + bend(p.getX(i), wrap))
  return geo
}

function shapeFrom(outer, inner) {
  const s = new THREE.Shape()
  outer.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  if (inner) {
    const h = new THREE.Path()
    inner.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)))
    h.closePath()
    s.holes.push(h)
  }
  return s
}

const closedTube = (pts3, radius, segs = 200) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3, true, 'centripetal'), segs, radius, 10, true)

const openTube = (pts3, radius, segs = 60) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3, false, 'catmullrom', 0.4), segs, radius, 10, false)

// A flat bar swept along a curve that lies in the y/z plane: a rounded
// rectangle `w(s)` wide (across x) and `h(s)` tall, closed at both ends.
// Used for acetate arms, which are taller than they are thick.
function sweepBar(curve, s0, s1, w, h, N = 40) {
  const X = new THREE.Vector3(1, 0, 0)
  const prof = []
  const corner = (cx, cy, a0, rc) => {
    for (let k = 0; k <= 3; k++) {
      const a = a0 + (k / 3) * (Math.PI / 2)
      prof.push([cx + Math.cos(a) * rc, cy + Math.sin(a) * rc])
    }
  }
  const pos = []
  const idx = []
  const rings = []
  for (let i = 0; i <= N; i++) {
    const s = s0 + ((s1 - s0) * i) / N
    const p = curve.getPointAt(s)
    const t = curve.getTangentAt(s)
    const o = new THREE.Vector3().crossVectors(X, t).normalize()
    const hw = w(s) / 2
    const hh = h(s) / 2
    const rc = Math.min(hw, hh) * 0.7
    prof.length = 0
    corner(hw - rc, hh - rc, 0, rc)
    corner(-hw + rc, hh - rc, Math.PI / 2, rc)
    corner(-hw + rc, -hh + rc, Math.PI, rc)
    corner(hw - rc, -hh + rc, Math.PI * 1.5, rc)
    rings.push(pos.length / 3)
    for (const [px, py] of prof) pos.push(p.x + px, p.y + o.y * py, p.z + o.z * py)
  }
  const m = 16
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < m; j++) {
      const a = rings[i] + j
      const b = rings[i] + ((j + 1) % m)
      const c = rings[i + 1] + j
      const d = rings[i + 1] + ((j + 1) % m)
      idx.push(a, c, b, b, c, d)
    }
  }
  // caps
  for (const [ring, flip] of [
    [rings[0], true],
    [rings[N], false],
  ]) {
    const ci = pos.length / 3
    let cx = 0
    let cy = 0
    let cz = 0
    for (let j = 0; j < m; j++) {
      cx += pos[(ring + j) * 3]
      cy += pos[(ring + j) * 3 + 1]
      cz += pos[(ring + j) * 3 + 2]
    }
    pos.push(cx / m, cy / m, cz / m)
    for (let j = 0; j < m; j++) {
      const a = ring + j
      const b = ring + ((j + 1) % m)
      if (flip) idx.push(ci, b, a)
      else idx.push(ci, a, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Everything for the RIGHT half, positioned in place, plus the bridge. The left
// half is drawn as a mirror image, so it never needs building.
export function buildGlasses({ shape, lensW, lensH, bridge, thickness, templeLen, wrap, metal }) {
  const inner = lensOutline(shape, lensW, lensH)
  const a = lensW / 2
  const b = lensH / 2
  const wireR = 0.03 + thickness * 0.1

  // ---- Rim (built around the lens centre; moved into place afterwards) ----
  const outer = metal
    ? offsetOutline(inner, () => wireR * 0.8)
    : smoothOutline(offsetOutline(inner, (x, y) => rimWidth(shape, thickness, x / a, y / b)), 4)
  // The gap between the two rims at the nose is exactly `bridge`.
  const cx = bridge / 2 - bounds(outer).minX + (metal ? 0 : 0.03) // 0.03: the rim bevel

  let rim
  if (metal) {
    // thin wire frame: a tube hugging the lens edge
    const pts = outer.map(([x, y]) => new THREE.Vector3(x + cx, y, RIM_DEPTH / 2))
    rim = warp(closedTube(pts, wireR), wrap)
    rim.computeVertexNormals()
  } else {
    const g = new THREE.ExtrudeGeometry(shapeFrom(outer, inner), {
      depth: RIM_DEPTH,
      bevelEnabled: true,
      bevelThickness: RIM_BEVEL,
      bevelSize: RIM_BEVEL,
      bevelSegments: 4,
      curveSegments: 1,
    })
    g.translate(cx, 0, 0)
    warp(g, wrap)
    rim = toCreasedNormals(g, 0.7)
  }

  // ---- Lens ----
  // A curved (convex) sheet: rings of the outline, shrinking towards the centre
  // and bulging forwards. Curvature is what makes a lens catch highlights.
  const lensGeo = curvedLens(inner, cx, RIM_DEPTH / 2, LENS_BULGE)
  warp(lensGeo, wrap)
  lensGeo.computeVertexNormals()

  // ---- Bridge ----
  const bridges = []
  const anchorTop = pick(outer, -1, 0.9) // upper nose-side point of the rim
  const anchorLow = pick(outer.filter((p) => p[1] < 0.15 * b), -1, -0.15)
  const bz = RIM_DEPTH / 2
  const curve = (p, q, arch, r) => {
    const pts = [
      new THREE.Vector3(cx + p[0], p[1], bz + bend(cx + p[0], wrap)),
      new THREE.Vector3(0, q + arch, bz + 0.02),
      new THREE.Vector3(-(cx + p[0]), p[1], bz + bend(cx + p[0], wrap)),
    ]
    // extra point so the arch keeps its shape
    const c = new THREE.CatmullRomCurve3([pts[0], new THREE.Vector3(pts[0].x * 0.5, q + arch * 0.8, bz + 0.01), pts[1], new THREE.Vector3(pts[2].x * 0.5, q + arch * 0.8, bz + 0.01), pts[2]], false, 'catmullrom', 0.5)
    return new THREE.TubeGeometry(c, 40, r, 10, false)
  }
  if (metal) {
    bridges.push(curve(anchorTop, anchorTop[1], shape === 'aviator' ? 0.16 : 0.12, wireR * 0.9))
    if (shape === 'aviator') bridges.push(curve(anchorLow, anchorLow[1], 0.05, wireR * 0.8)) // the second bar of an aviator
  } else {
    const heavy = shape === 'wayfarer' || shape === 'square'
    bridges.push(curve(anchorTop, anchorTop[1] - (heavy ? 0.04 : 0), heavy ? 0.04 : 0.12, thickness * (heavy ? 0.62 : 0.45)))
  }

  // Where the back of the rim is at a given x (the frame curves round the face).
  const rimBack = (x) => (metal ? bend(x, wrap) + RIM_DEPTH / 2 - wireR : bend(x, wrap) - RIM_BEVEL)

  // ---- Nose pads ----
  // On the nose-side edge of the rim, behind it, where they would meet the
  // nose. Metal frames hold them out on a short arm.
  const padAnchor = pick(inner.filter((p) => p[1] < 0.05 * b && p[1] > -0.6 * b), -1, 0.2)
  const padX = cx + padAnchor[0] - (metal ? 0.0 : thickness * 0.4)
  const pad = {
    x: padX - (metal ? 0.04 : 0),
    y: padAnchor[1] - 0.04,
    z: rimBack(padX) - (metal ? 0.1 : 0.035),
  }
  let padArm = null
  if (metal) {
    padArm = openTube(
      [new THREE.Vector3(padX + wireR * 0.5, padAnchor[1] + 0.04, bend(padX, wrap) + RIM_DEPTH / 2), new THREE.Vector3(padX - 0.03, padAnchor[1] - 0.01, rimBack(padX) - 0.05), new THREE.Vector3(pad.x, pad.y, pad.z)],
      wireR * 0.45,
      16,
    )
  }

  // ---- Hinge and end piece ----
  // The hinge is behind the rim's outer edge, on an end piece that runs back
  // from the rim. The arm pivots about it.
  const hingeP = pick(outer, 1, 0.45)
  const hx = cx + hingeP[0]
  const hinge = { x: hx, y: hingeP[1], z: rimBack(hx) - HINGE_BACK }
  const barrelR = metal ? 0.04 : 0.045
  const endPiece = metal
    ? {
        // a wire stub from the rim back to the hinge knuckle
        geo: openTube([new THREE.Vector3(hx - wireR * 0.6, hinge.y, bend(hx, wrap) + RIM_DEPTH / 2), new THREE.Vector3(hx - wireR * 0.2, hinge.y, rimBack(hx) - 0.02), new THREE.Vector3(hx, hinge.y, hinge.z + barrelR)], wireR * 0.9, 16),
        position: [0, 0, 0],
      }
    : {
        // a block from inside the rim back to just short of the knuckle
        geo: new THREE.BoxGeometry(0.12, 0.24, HINGE_BACK + 0.05 - (barrelR + 0.01)),
        position: [hx - 0.05, hinge.y, (rimBack(hx) + 0.05 + hinge.z + barrelR + 0.01) / 2],
      }

  // ---- Temple (arm) ----
  // Straight back from the hinge, then hooking down behind the ear.
  const L = templeLen
  const profile = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -L * 0.3),
    new THREE.Vector3(0, 0, -L * 0.62),
    new THREE.Vector3(0, 0, -L * 0.8),
    new THREE.Vector3(0, -0.06, -L * 0.9),
    new THREE.Vector3(0, -0.3, -L * 0.97),
    new THREE.Vector3(0, -0.58, -L * 1.0),
  ]
  const full = new THREE.CatmullRomCurve3(profile, false, 'catmullrom', 0.4)
  let mainGeo
  let tipGeo
  if (metal) {
    const pts = full.getPoints(80)
    const split = Math.round(80 * TIP_AT)
    const r = wireR * 0.75
    mainGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, split + 1)), 50, r, 10, false)
    tipGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(split)), 30, r * 1.35, 10, false)
  } else {
    // acetate arms are flat bars, deep at the hinge and tapering to the tip
    const w = () => thickness * 0.58
    const h = (s) => thickness * 1.3 * (1 - 0.45 * Math.min(1, s / TIP_AT)) + 0.06
    mainGeo = sweepBar(full, 0, TIP_AT, w, h, 36)
    tipGeo = sweepBar(full, TIP_AT, 1, (s) => w(s) * 1.05, (s) => h(TIP_AT) * (1 - 0.3 * ((s - TIP_AT) / (1 - TIP_AT)) ** 2) * 1.05, 24)
  }
  const armHalfDepth = metal ? wireR * 0.75 : thickness * 0.29

  const front = bounds(outer)
  return {
    cx,
    rim,
    lensGeo,
    bridges,
    pad,
    padArm,
    hinge,
    barrelR,
    endPiece,
    mainGeo,
    tipGeo,
    armHalfDepth,
    metal,
    wireR,
    // overall size, for framing the camera
    width: (cx + front.maxX) * 2,
    top: front.maxY,
    bottom: front.minY,
    templeLen: L,
  }
}

function curvedLens(outline, cx, z0, bulge) {
  const rings = 14
  const n = outline.length
  const bb = bounds(outline)
  const pos = []
  const uv = []
  for (let i = 0; i <= rings; i++) {
    const s = i / rings
    for (let j = 0; j < n; j++) {
      const x = outline[j][0] * s
      const y = outline[j][1] * s
      pos.push(cx + x, y, z0 + bulge * (1 - s * s))
      uv.push((x - bb.minX) / (bb.maxX - bb.minX), (y - bb.minY) / (bb.maxY - bb.minY))
    }
  }
  const idx = []
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * n + j
      const b = i * n + ((j + 1) % n)
      const c = (i + 1) * n + j
      const d = (i + 1) * n + ((j + 1) % n)
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}
