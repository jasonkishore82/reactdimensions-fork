import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bounds, lensOutline, offsetOutline, pick, rimWidth, smoothOutline } from './shapes.js'

const RIM_DEPTH = 0.17 // how far the rim stands out front to back
const LENS_BULGE = 0.11 // how far the lens domes forward in the middle

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
      bevelThickness: 0.03,
      bevelSize: 0.03,
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

  // ---- Nose pads ----
  const padAnchor = pick(inner.filter((p) => p[1] < 0.05 * b && p[1] > -0.6 * b), -1, 0.2)
  const pad = {
    x: cx + padAnchor[0] + 0.12,
    y: padAnchor[1],
    z: 0.0 + bend(cx + padAnchor[0], wrap) - 0.06,
  }

  // ---- Temple (arm) ----
  const hingeP = pick(outer, 1, 0.45)
  const hinge = { x: cx + hingeP[0], y: hingeP[1], z: bend(cx + hingeP[0], wrap) + 0.02 }
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
  const pts = full.getPoints(80)
  const split = 56 // where the tip sleeve begins
  const r = metal ? wireR * 0.75 : thickness * 0.34
  const mainGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, split + 1)), 50, r, 10, false)
  const tipGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(split)), 30, r * (metal ? 1.35 : 1.0), 10, false)
  // acetate temples are flat bands: taller than they are thick
  if (!metal) {
    mainGeo.scale(0.85, 1.9, 1)
    tipGeo.scale(0.85, 1.9, 1)
  }

  const front = bounds(outer)
  return {
    cx,
    rim,
    lensGeo,
    bridges,
    pad,
    hinge,
    mainGeo,
    tipGeo,
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
