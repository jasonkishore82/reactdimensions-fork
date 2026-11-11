import * as THREE from 'three'

// Units are metres. x = length (front is +x), y = up, z = width.
export const LEN = 5.68
export const FRONT = LEN / 2
export const REAR = -LEN / 2
export const HALF_W = 1.0 // half body width
export const BELT = 1.2 // height of the straight shoulder line
export const SILL = 0.52 // bottom of the steel body
export const WHEEL_R = 0.43
export const FRONT_AXLE = 1.9
export const REAR_AXLE = -1.91

// The roof is two straight lines: nose -> peak -> tailgate.
const NOSE_Y = 1.05
const PEAK = { x: -0.2, y: 1.79 }
const TAIL_Y = 1.32

export function topline(x) {
  if (x >= PEAK.x) return NOSE_Y + ((PEAK.y - NOSE_Y) * (FRONT - x)) / (FRONT - PEAK.x)
  return PEAK.y + ((TAIL_Y - PEAK.y) * (PEAK.x - x)) / (PEAK.x - REAR)
}

// x where the hood line rises above the shoulder line
const HOOD_BREAK = FRONT - ((BELT - NOSE_Y) * (FRONT - PEAK.x)) / (PEAK.y - NOSE_Y)

// Cabin cross-sections: top half-width at each station.
export const STATIONS = [
  { x: HOOD_BREAK, wt: HALF_W },
  { x: 1.25, wt: 0.88 }, // windshield base
  { x: PEAK.x, wt: 0.74 }, // roof peak / B-pillar
  { x: -1.3, wt: 0.8 }, // end of side glass
  { x: REAR, wt: 0.86 }, // tailgate
].map((s) => ({ ...s, yt: s.x === HOOD_BREAK ? BELT : topline(s.x) }))

// Wheel-arch outline (angular, like the reference) around an axle.
export function archPoints(a, grow = 0, bottom = SILL) {
  const g = grow
  return [
    [a + 0.66 + g, bottom],
    [a + 0.66 + g, 0.78 + g * 0.5],
    [a + 0.42 + g * 0.5, 1.0 + g],
    [a - 0.38 - g * 0.5, 1.0 + g],
    [a - 0.62 - g, 0.8 + g * 0.5],
    [a - 0.62 - g, bottom],
  ]
}

// Lower body: the side profile with arch cut-outs, extruded across the width.
export function lowerBodyGeometry() {
  const s = new THREE.Shape()
  s.moveTo(FRONT, SILL)
  s.lineTo(FRONT, NOSE_Y)
  s.lineTo(HOOD_BREAK, BELT)
  s.lineTo(REAR, BELT)
  s.lineTo(REAR, SILL)
  for (const a of [REAR_AXLE, FRONT_AXLE]) {
    const pts = archPoints(a).reverse()
    for (const [x, y] of pts) s.lineTo(x, y)
  }
  s.lineTo(FRONT, SILL)
  const g = new THREE.ExtrudeGeometry(s, { depth: HALF_W * 2, bevelEnabled: false })
  g.translate(0, 0, -HALF_W)
  // Planar UVs in metres so the brushed texture has a consistent scale.
  setWorldUV(g, (p) => [p.x, p.y + p.z * 0.3])
  // Split off the arch walls so the wheel wells can be dark plastic.
  return splitTriangles(g.index ? g.toNonIndexed() : g, (c, n) => {
    if (Math.abs(n.z) > 0.9) return false // side panels
    if (c.y > 1.02 || c.y < SILL + 0.001) return false // hood/bottom
    return [FRONT_AXLE, REAR_AXLE].some((a) => c.x > a - 0.63 && c.x < a + 0.67)
  })
}

// Split a non-indexed geometry into [rest, matched] by a per-triangle test.
function splitTriangles(g, test) {
  const pos = g.attributes.position
  const uv = g.attributes.uv
  const out = [{ p: [], u: [] }, { p: [], u: [] }]
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    const centre = a.clone().add(b).add(c).divideScalar(3)
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
    const o = out[test(centre, n) ? 1 : 0]
    for (let k = 0; k < 3; k++) {
      o.p.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k))
      o.u.push(uv.getX(i + k), uv.getY(i + k))
    }
  }
  return out.map(({ p, u }) => {
    const r = new THREE.BufferGeometry()
    r.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    r.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2))
    r.computeVertexNormals()
    return r
  })
}

// Front bumper: an angular block with chamfered top and bottom edges.
export function bumperGeometry(x0, x1, y0, y1, halfW, chamfer = 0.05) {
  const s = new THREE.Shape()
  s.moveTo(x0, y0)
  s.lineTo(x1 - chamfer, y0)
  s.lineTo(x1, y0 + chamfer)
  s.lineTo(x1, y1 - chamfer * 0.6)
  s.lineTo(x1 - chamfer * 0.6, y1)
  s.lineTo(x0, y1)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: halfW * 2,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  })
  g.translate(0, 0, -halfW)
  return g
}

function setWorldUV(g, fn) {
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const [u, v] = fn(p)
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

// Build a flat-shaded mesh from a list of convex polygons.
export function polysGeometry(polys, uvFn = (p) => [p.x, p.y + p.z * 0.3]) {
  const verts = []
  for (const poly of polys) {
    for (let i = 1; i < poly.length - 1; i++) {
      verts.push(poly[0], poly[i], poly[i + 1])
    }
  }
  const g = new THREE.BufferGeometry().setFromPoints(verts)
  setWorldUV(g, uvFn)
  g.computeVertexNormals()
  return g
}

const v = (x, y, z) => new THREE.Vector3(x, y, z)

// Faces of the cabin between two stations.
export function cabinFaces(A, B) {
  return {
    left: [v(A.x, BELT, -HALF_W), v(B.x, BELT, -HALF_W), v(B.x, B.yt, -B.wt), v(A.x, A.yt, -A.wt)],
    right: [v(A.x, BELT, HALF_W), v(A.x, A.yt, A.wt), v(B.x, B.yt, B.wt), v(B.x, BELT, HALF_W)],
    top: [v(A.x, A.yt, -A.wt), v(B.x, B.yt, -B.wt), v(B.x, B.yt, B.wt), v(A.x, A.yt, A.wt)],
  }
}

export function cabinGeometry() {
  const polys = []
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const f = cabinFaces(STATIONS[i], STATIONS[i + 1])
    // The first segment's sides are triangles (the hood wedge).
    if (i === 0) {
      polys.push(f.left.filter((_, k) => k !== 3), f.right.filter((_, k) => k !== 1))
    } else {
      polys.push(f.left, f.right)
    }
    polys.push(f.top)
  }
  const r = STATIONS[STATIONS.length - 1]
  polys.push([v(REAR, BELT, -HALF_W), v(REAR, r.yt, -r.wt), v(REAR, r.yt, r.wt), v(REAR, BELT, HALF_W)])
  return polysGeometry(polys)
}

// Shrink a convex planar polygon by `d` (keeps edges parallel), then lift it
// off the surface along its normal. Used for glass panels with a steel frame.
export function insetPanel(points, d, lift = 0.006, outwardHint = new THREE.Vector3(0, 0.8, 0)) {
  const n = new THREE.Vector3()
    .subVectors(points[1], points[0])
    .cross(new THREE.Vector3().subVectors(points[2], points[0]))
    .normalize()
  const centre = points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(points.length)
  const out = centre.clone().sub(outwardHint)
  if (n.dot(out) < 0) n.negate()

  const u = new THREE.Vector3().subVectors(points[1], points[0]).normalize()
  const w = new THREE.Vector3().crossVectors(n, u)
  const P = points.map((p) => {
    const q = new THREE.Vector3().subVectors(p, centre)
    return new THREE.Vector2(q.dot(u), q.dot(w))
  })
  const N = P.length
  const lines = P.map((a, i) => {
    const b = P[(i + 1) % N]
    const dir = new THREE.Vector2().subVectors(b, a).normalize()
    let nrm = new THREE.Vector2(-dir.y, dir.x)
    // point the edge normal toward the centroid (origin)
    if (nrm.dot(a) > 0) nrm.negate()
    return { p: a.clone().addScaledVector(nrm, d), dir }
  })
  const res = lines.map((L1, i) => {
    const L0 = lines[(i - 1 + N) % N]
    const cross = L0.dir.x * L1.dir.y - L0.dir.y * L1.dir.x
    const diff = new THREE.Vector2().subVectors(L1.p, L0.p)
    const t = (diff.x * L1.dir.y - diff.y * L1.dir.x) / cross
    return L0.p.clone().addScaledVector(L0.dir, t)
  })
  return res.map((q) =>
    centre.clone().addScaledVector(u, q.x).addScaledVector(w, q.y).addScaledVector(n, lift),
  )
}

// Fender flare: a U-shaped band around the arch, extruded outward.
export function flareGeometry(axle) {
  const outer = archPoints(axle, 0.12, SILL - 0.1)
  const inner = archPoints(axle, 0, SILL - 0.1).reverse()
  const s = new THREE.Shape()
  s.moveTo(...outer[0])
  for (const p of outer.slice(1)) s.lineTo(...p)
  for (const p of inner) s.lineTo(...p)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
  })
}

// Tyre: lathe a rounded profile, axis along z.
export function tyreGeometry() {
  const r = WHEEL_R
  const hw = 0.165
  const pts = [
    [0.31, -hw],
    [r - 0.05, -hw],
    [r - 0.01, -hw + 0.04],
    [r, -hw + 0.08],
    [r, hw - 0.08],
    [r - 0.01, hw - 0.04],
    [r - 0.05, hw],
    [0.31, hw],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(pts, 72)
  g.rotateX(Math.PI / 2)
  return g
}
