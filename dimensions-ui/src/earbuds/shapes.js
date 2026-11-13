import * as THREE from 'three'

// Geometry for the earbuds and their case. Units: 1 = 1 cm. The case sits on
// the floor (y = 0), its front facing +z.

// signed power, for superellipsoids
const sp = (v, e) => Math.sign(v) * Math.abs(v) ** e

// The case is a superellipsoid: rounded like a pebble from the front, with a
// rounded-rectangle footprint from above.
export const CASE = { a: 3.0, b: 2.25, c: 1.2, e1: 0.44, e2: 0.66 } // soft corners in front, a stadium from above
export const CASE_Y = CASE.b // the centre of the case, above the floor
export const SPLIT = 0.62 // where the lid meets the base, above the centre (the lid is ~37% of the height)
export const SHELL = 0.12 // lid wall thickness

// latitude where the surface reaches height y (relative to the centre)
export const phiAt = (y, b = CASE.b, e1 = CASE.e1) => Math.asin(THREE.MathUtils.clamp(sp(y / b, 1 / e1), -1, 1))

// the case's outline at height y: closed curve in x/z
export function sectionAt(y, a = CASE.a, b = CASE.b, c = CASE.c, n = 96) {
  const k = sp(Math.cos(phiAt(y, b)), CASE.e1)
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    pts.push([a * k * sp(Math.cos(t), CASE.e2), c * k * sp(Math.sin(t), CASE.e2)])
  }
  return pts
}

// a band of the superellipsoid between two latitudes
export function superBand(phi0, phi1, a = CASE.a, b = CASE.b, c = CASE.c, segU = 96, segV = 40) {
  const pos = []
  const idx = []
  for (let j = 0; j <= segV; j++) {
    const phi = phi0 + ((phi1 - phi0) * j) / segV
    const k = sp(Math.cos(phi), CASE.e1)
    const y = b * sp(Math.sin(phi), CASE.e1)
    for (let i = 0; i <= segU; i++) {
      const t = (i / segU) * Math.PI * 2
      pos.push(a * k * sp(Math.cos(t), CASE.e2), y, c * k * sp(Math.sin(t), CASE.e2))
    }
  }
  for (let j = 0; j < segV; j++)
    for (let i = 0; i < segU; i++) {
      const p = j * (segU + 1) + i
      const q = p + segU + 1
      idx.push(p, q, p + 1, p + 1, q, q + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // weld the seam's normals so it doesn't show a line
  const n = g.attributes.normal
  for (let j = 0; j <= segV; j++) {
    const a0 = j * (segU + 1)
    const a1 = a0 + segU
    const x = (n.getX(a0) + n.getX(a1)) / 2
    const yy = (n.getY(a0) + n.getY(a1)) / 2
    const z = (n.getZ(a0) + n.getZ(a1)) / 2
    n.setXYZ(a0, x, yy, z)
    n.setXYZ(a1, x, yy, z)
  }
  return g
}

// the two wells in the base's top, one per earbud (x = ±WELL.x)
// slot: where the stem goes down, offset towards the case's end (the stem is on the bud's outer side)
export const WELL = { x: 1.24, rx: 1.02, rz: 0.72, depth: 0.7, slotX: 0.56, slotR: 0.34, slotDepth: 1.3 }

// a flat face in the x/z plane at height y: an outline, optionally with holes
export function plate(outline, holes = [], y = 0, up = true) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)))
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))))
  const g = new THREE.ShapeGeometry(shape, 24)
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2)
  if (!up) g.scale(1, 1, -1) // keep the outline in place when flipped
  g.translate(0, y, 0)
  return g
}

export function ellipse(cx, cz, rx, rz, n = 48, reverse = false) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = ((reverse ? -i : i) / n) * Math.PI * 2
    pts.push([cx + Math.cos(t) * rx, cz + Math.sin(t) * rz])
  }
  return pts
}

// ---- the earbud ----
// Local frame (the right bud; the left is mirrored in x): the head's centre at
// the origin, the ear tip pointing along +z (into the ear), up +y. The stem
// does not hang from the middle of the head: it runs down the head's outer
// side (-z), flush with its outer edge, so from the front the bud reads as a
// "P". The stem is wider front-to-back than side-to-side, and its touch strip
// is on the forward face (+x).
export const BUD = {
  hx: 0.55, // head half-size across
  hy: 0.6, // up
  hz: 0.72, // along the tip's axis
  stemZ: -0.4, // the stem's axis, towards the outer side
  stemTop: -0.12,
  stemLen: 1.62,
  stemRx: 0.2,
  stemRz: 0.27,
  tipLen: 0.44,
  tipR: 0.4,
  tipTilt: 0.32, // the tip points a little downwards
}
export const BUD_BOTTOM = BUD.stemTop - BUD.stemLen - 0.12

export function budGeometries() {
  // head: an egg, fuller at the outer end and narrowing towards the tip
  const head = new THREE.SphereGeometry(1, 56, 40)
  head.scale(BUD.hx, BUD.hy, BUD.hz)
  {
    const p = head.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, p.getZ(i) / BUD.hz)
      const k = 1 - 0.24 * t ** 1.6
      // the underside tucks up towards the tip, the top stays full
      const y = p.getY(i)
      p.setXYZ(i, p.getX(i) * k, y * (y < 0 ? k * (1 - 0.12 * t) : k), p.getZ(i))
    }
    head.computeVertexNormals()
  }
  // the stem: an oval tube that flares where it meets the head, capped below.
  // The profile runs bottom to top, so the lathe's faces point outward.
  const prof = [new THREE.Vector2(0.001, -BUD.stemLen - 0.12), new THREE.Vector2(0.86, -BUD.stemLen - 0.07)]
  for (let i = 28; i >= 0; i--) {
    const t = i / 28
    const flare = 1 + 0.75 * Math.max(0, 1 - t / 0.3) ** 2
    prof.push(new THREE.Vector2((1 - 0.05 * t) * flare, -t * BUD.stemLen))
  }
  const stem = new THREE.LatheGeometry(prof, 40)
  stem.scale(BUD.stemRx, 1, BUD.stemRz)
  stem.translate(0, BUD.stemTop, BUD.stemZ)
  // the ear tip: an oval silicone dome on a short nozzle, tilted down a little
  const tipProfile = [
    [0.001, 0.0],
    [0.2, 0.0],
    [0.21, 0.1],
    [0.33, 0.13],
    [BUD.tipR, 0.24],
    [0.36, 0.36],
    [0.27, 0.42],
    [0.14, BUD.tipLen],
    [0.001, BUD.tipLen + 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const tip = new THREE.LatheGeometry(tipProfile, 44)
  tip.scale(0.92, 1, 1.08) // oval, taller than wide
  tip.rotateX(Math.PI / 2 + BUD.tipTilt)
  const tipAt = new THREE.Vector3(0, -0.1, BUD.hz * 0.8)
  tip.translate(tipAt.x, tipAt.y, tipAt.z)
  const grille = new THREE.CircleGeometry(0.16, 24)
  const ring = new THREE.TorusGeometry(1, 0.11, 8, 40)
  ring.rotateX(Math.PI / 2)
  ring.scale(BUD.stemRx * 0.86, 1, BUD.stemRz * 0.86)
  ring.translate(0, BUD.stemTop - BUD.stemLen - 0.02, BUD.stemZ)
  const dot = new THREE.CircleGeometry(1, 20)
  dot.scale(0.11, 0.06, 1)
  const vent = new THREE.CircleGeometry(1, 24)
  vent.scale(0.13, 0.045, 1)
  // the touch strip: a long rounded slot on the stem's forward face
  const strip = new THREE.Shape()
  const sw = 0.1
  const y0 = BUD.stemTop - BUD.stemLen + 0.22
  const y1 = BUD.stemTop - 0.42
  strip.absarc(0, y0, sw, Math.PI, Math.PI * 2)
  strip.absarc(0, y1, sw, 0, Math.PI)
  const touch = new THREE.ShapeGeometry(strip, 16)
  touch.rotateY(Math.PI / 2) // face +x
  touch.translate(BUD.stemRx + 0.003, 0, BUD.stemZ)
  return { head, stem, tip, grille, ring, dot, vent, touch, tipAt }
}

// points on the bud used for contacts when it lies loose
export const BUD_POINTS = (() => {
  const pts = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * BUD.hx * 0.9, Math.sin(a) * BUD.hy * 0.92, -0.1))
    pts.push(new THREE.Vector3(0, Math.sin(a) * BUD.hy * 0.8, Math.cos(a) * BUD.hz * 0.92))
  }
  // the end of the ear tip
  pts.push(new THREE.Vector3(0, -0.1 - Math.sin(BUD.tipTilt) * BUD.tipLen, BUD.hz * 0.8 + Math.cos(BUD.tipTilt) * BUD.tipLen))
  for (const y of [-0.8, -1.3, BUD_BOTTOM + 0.04]) for (const sg of [-1, 1]) pts.push(new THREE.Vector3(sg * BUD.stemRx * 0.9, y, BUD.stemZ), new THREE.Vector3(0, y, BUD.stemZ + sg * BUD.stemRz * 0.9))
  return pts
})()
