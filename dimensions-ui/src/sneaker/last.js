import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// The shoe's shape. Shoemakers build a shoe round a "last" (a foot-shaped
// form); this file is the last plus the sole round it.
//
// Units are centimetres, a right shoe about EU 43: x runs heel -> toe,
// y is up from the floor, +z is the outer (lateral) side.

// ---- the footprint -------------------------------------------------------

// outline of the sole seen from below; the inner side pinches in at the arch
const OUTLINE_KEYS = [
  [-14.2, 0.1], [-13.6, 2.3], [-12, 3.6], [-9, 4.05], [-5, 4.2], [-1, 4.45], [3, 4.95], [6.5, 5.15],
  [9.5, 4.85], [12.1, 3.95], [13.8, 2.1], [14.3, -0.3], [13.7, -2.75], [11.8, -4.25], [8.5, -4.95],
  [5, -4.85], [1.5, -4.15], [-2, -3.55], [-5.5, -3.45], [-9, -3.75], [-12, -3.55], [-13.6, -2.2],
]
export const OUTLINE = new THREE.CatmullRomCurve3(
  OUTLINE_KEYS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
)
  .getSpacedPoints(280)
  .slice(0, -1)
  .map((v) => [v.x, v.z])

function polyDistance(px, pz) {
  let best = Infinity
  let inside = false
  const n = OUTLINE.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [ax, az] = OUTLINE[j]
    const [bx, bz] = OUTLINE[i]
    const ex = bx - ax
    const ez = bz - az
    const h = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez)))
    const dx = px - ax - ex * h
    const dz = pz - az - ez * h
    best = Math.min(best, dx * dx + dz * dz)
    if (az > pz !== bz > pz && px < ((bx - ax) * (pz - az)) / (bz - az) + ax) inside = !inside
  }
  best = Math.sqrt(best)
  return inside ? -best : best
}

// the footprint's signed distance, precomputed on a grid (negative inside)
const GX0 = -16
const GZ0 = -7
const GS = 0.1
const GW = 321
const GH = 141
const GRID = new Float32Array(GW * GH)
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) GRID[i + j * GW] = polyDistance(GX0 + i * GS, GZ0 + j * GS)

export function footprint(x, z) {
  const fx = (x - GX0) / GS
  const fz = (z - GZ0) / GS
  if (fx < 0 || fz < 0 || fx >= GW - 1 || fz >= GH - 1) return 3
  const i = fx | 0
  const j = fz | 0
  const tx = fx - i
  const tz = fz - j
  const a = GRID[i + j * GW]
  const b = GRID[i + 1 + j * GW]
  const c = GRID[i + (j + 1) * GW]
  const d = GRID[i + 1 + (j + 1) * GW]
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz
}

// ---- profiles along the length -----------------------------------------

// a smooth curve through points (cubic Hermite)
function curve(pts) {
  const m = pts.map((p, i) => {
    const a = pts[Math.max(i - 1, 0)]
    const b = pts[Math.min(i + 1, pts.length - 1)]
    return (b[1] - a[1]) / (b[0] - a[0])
  })
  return (x) => {
    const n = pts.length
    if (x <= pts[0][0]) return pts[0][1]
    if (x >= pts[n - 1][0]) return pts[n - 1][1]
    let i = 0
    while (x > pts[i + 1][0]) i++
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = x1 - x0
    const t = (x - x0) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1]
  }
}

// the top line of the upper seen from the side: heel tab, the dip under the
// ankle, the tongue, then down the vamp to the toe
export const TOP_LINE = [
  [-14.5, 11.3], [-13.6, 11.6], [-12, 10.9], [-9.5, 9.9], [-7, 9.7], [-5, 10.4], [-3.2, 11.6],
  [-1.5, 11.5], [1, 10.6], [4, 9.3], [7, 8.0], [9.5, 7.0], [11.6, 6.1], [13.2, 5.4], [14.6, 4.6],
]
// how tall the sole's sidewall is: high round the heel, a wave under the arch
const SIDEWALL = [[-14.4, 3.35], [-10, 3.3], [-6, 2.9], [-3, 2.45], [0, 2.5], [3.5, 2.8], [7, 2.5], [11, 2.15], [14.5, 2.05]]

const topLine = curve(TOP_LINE)
const sidewall = curve(SIDEWALL)
// the sole lifts off the floor at the toe ("toe spring") and a little at the heel
export const soleBottom = (x) => (x > 7 ? 1.5 * ((x - 7) / 7.3) ** 2 : x < -11.5 ? 0.5 * ((-11.5 - x) / 2.7) ** 2 : 0)
// how round the top of the upper is: soft and domed at the front, a thin
// padded wall round the heel
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const roundness = (x) => 0.9 + 1.5 * smoothstep(-4.5, -1, x)

// lookup tables so the field is cheap to sample
const T0 = -16
const TS = 0.02
const TN = 1601
const table = (fn) => Float32Array.from({ length: TN }, (_, i) => fn(T0 + i * TS))
const look = (a, x) => {
  const f = (x - T0) / TS
  if (f <= 0) return a[0]
  if (f >= TN - 1) return a[TN - 1]
  const i = f | 0
  return a[i] + (a[i + 1] - a[i]) * (f - i)
}
const YB = table(soleBottom)
const HS = table(sidewall)
const TT = table(topLine)
const RR = table(roundness)
export const soleTop = (x) => look(YB, x) + look(HS, x)

// ---- the upper as a distance field ---------------------------------------

const INSET = 0.26 // how far the upper sits in from the sole's edge
const WALL = 0.4 // the upper is a shell this thick
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a, b, k) => -smin(-a, -b, k)

function body(x, y, z) {
  const yb = look(YB, x)
  const s = yb + look(HS, x)
  const r = look(RR, x)
  // the sides lean in as they rise, the way an upper wraps the foot
  const d2 = footprint(x, z) + INSET + Math.max(0, y - s - 0.5) * 0.16
  const wx = d2 + r
  const wy = y - (look(TT, x) - r)
  const ox = Math.max(wx, 0)
  const oy = Math.max(wy, 0)
  const top = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(wx, wy), 0) - r
  return Math.max(top, yb + 1.2 - y)
}

// the space inside, where the foot goes: the body shrunk by the wall
// thickness, down to the insole
function cavity(x, y, z) {
  return Math.max(body(x, y, z) + WALL, soleTop(x) + 0.25 - y)
}

// the opening at the top the foot goes in through
function opening(x, y, z) {
  const u = (x + 7.6) / 5.4
  const v = (z - 0.15) / 2.3
  return Math.max((Math.sqrt(u * u + v * v) - 1) * 2.3, soleTop(x) + 0.25 - y)
}

// the tongue: a padded flap leaning back out of the throat, curling forward
const TA = [-0.6, 9.2]
const TB = [-3.7, 12.9]
const TL = Math.hypot(TB[0] - TA[0], TB[1] - TA[1])
const TU = [(TB[0] - TA[0]) / TL, (TB[1] - TA[1]) / TL]
function tongue(x, y, z) {
  if (x > 1.5 || x < -6 || y < 7.5) return 2
  const px = x - TA[0]
  const py = y - TA[1]
  const along = px * TU[0] + py * TU[1]
  const perp = -px * TU[1] + py * TU[0] + 0.022 * along * along
  const w = 2.2 - Math.max(0, along - (TL - 1.3)) * 0.9
  const qx = Math.abs(along - TL / 2) - TL / 2
  const qy = Math.abs(perp) - 0.3
  const qz = Math.abs(z) - w
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  const az = Math.max(qz, 0)
  return Math.sqrt(ax * ax + ay * ay + az * az) + Math.min(Math.max(qx, qy, qz), 0) - 0.3
}

// the padded collar: a soft rounded roll round the rim of the opening
function collar(x, y, z) {
  if (x > -1.5 || y < 7) return 2
  const u = (x + 7.6) / 5.4
  const v = (z - 0.15) / 2.3
  const e = (Math.sqrt(u * u + v * v) - 1) * 2.3 - 0.32 // out from the rim
  const h = y - (look(TT, x) - 0.62)
  return Math.sqrt(e * e + h * h) - 0.6
}

export function upper(x, y, z) {
  const b = body(x, y, z)
  const shell = Math.max(b, -Math.max(b + WALL, soleTop(x) + 0.25 - y))
  const d = smin(smax(shell, -opening(x, y, z), 0.3), collar(x, y, z), 0.35)
  return smin(d, tongue(x, y, z), 0.25)
}

// Marching cubes over a box round the upper, stretched per axis so the
// resolution goes where the shoe is (it's long and low).
export function buildUpper(res = 140) {
  const C = [0, 6.4, 0.1]
  const H = [15.0, 7.2, 6.0]
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 900000)
  mc.isolation = 0
  const f = mc.field
  const half = res / 2
  for (let k = 0; k < res; k++) {
    const pz = C[2] + ((k - half) / half) * H[2]
    for (let j = 0; j < res; j++) {
      const py = C[1] + ((j - half) / half) * H[1]
      const row = j * res + k * res * res
      for (let i = 0; i < res; i++) {
        const px = C[0] + ((i - half) / half) * H[0]
        const far = py < -0.4 || py > 13.7 || footprint(px, pz) > 0.4
        f[i + row] = far ? -1 : -upper(px, py, pz)
      }
    }
  }
  mc.update()
  const n = mc.count
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = C[a] + mc.positionArray[i * 3 + a] * H[a]
  mc.geometry.dispose()
  mc.material.dispose()
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g = mergeVertices(g, 1e-4)

  // normals from the field itself (smoother than the triangles'), and which
  // part each vertex belongs to: x = inside lining, y = tongue
  const p = g.attributes.position
  const nor = new Float32Array(p.count * 3)
  const part = new Float32Array(p.count * 2)
  const e = 0.02
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    v.set(
      upper(x + e, y, z) - upper(x - e, y, z),
      upper(x, y + e, z) - upper(x, y - e, z),
      upper(x, y, z + e) - upper(x, y, z - e),
    ).normalize()
    nor[i * 3] = v.x
    nor[i * 3 + 1] = v.y
    nor[i * 3 + 2] = v.z
    // inside surfaces sit a wall's thickness in from the outside
    const t = tongue(x, y, z)
    const tw = Math.max(0, Math.min(1, (0.16 - t) / 0.2))
    part[i * 2] = Math.max(0, Math.min(1, (-body(x, y, z) - 0.12) / 0.18)) * (1 - tw)
    part[i * 2 + 1] = tw
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('aPart', new THREE.BufferAttribute(part, 2))
  g.computeBoundingSphere()
  return g
}

// where the upper's top surface is at (x, z), and which way it faces
export function surfaceAt(x, z) {
  const step = 0.05
  let y = 14
  while (y > 0 && upper(x, y, z) > 0) y -= step
  let inside = y
  let outside = y + step
  for (let i = 0; i < 22; i++) {
    const m = (inside + outside) / 2
    if (upper(x, m, z) > 0) outside = m
    else inside = m
  }
  const yy = (inside + outside) / 2
  const e = 0.01
  const n = new THREE.Vector3(
    upper(x + e, yy, z) - upper(x - e, yy, z),
    upper(x, yy + e, z) - upper(x, yy - e, z),
    upper(x, yy, z + e) - upper(x, yy, z - e),
  ).normalize()
  return { y: yy, n }
}

// ---- the sole -------------------------------------------------------------

// outward direction at each outline point
const NORMALS = OUTLINE.map((p, i) => {
  const a = OUTLINE[(i - 1 + OUTLINE.length) % OUTLINE.length]
  const b = OUTLINE[(i + 1) % OUTLINE.length]
  let nx = b[1] - a[1]
  let nz = -(b[0] - a[0])
  const l = Math.hypot(nx, nz)
  nx /= l
  nz /= l
  if (polyDistance(p[0] + nx * 0.2, p[1] + nz * 0.2) < 0) return [-nx, -nz]
  return [nx, nz]
})

// The cupsole's wall, swept round the outline: a rounded outsole edge, a
// fine groove, the midsole bulging out a touch, then a lip the upper sits in.
// [outward offset, height]; `hs` is the wall height there.
const wallProfile = (hs) => [
  [-0.28, 0], [-0.12, 0.01], [-0.02, 0.08], [0.02, 0.22], [0.03, 0.45], [-0.07, 0.52], [-0.07, 0.6], [0.03, 0.68],
  [0.13, 1.15], [0.13, hs - 0.55], [0.07, hs - 0.18], [-0.06, hs - 0.02], [-0.22, hs], [-0.6, hs],
]

export function buildSole() {
  const N = OUTLINE.length
  const M = wallProfile(3).length
  const pos = new Float32Array(N * M * 3)
  for (let k = 0; k < N; k++) {
    const [x, z] = OUTLINE[k]
    const [nx, nz] = NORMALS[k]
    const yb = soleBottom(x)
    wallProfile(sidewall(x)).forEach(([o, h], j) => {
      const i = (k * M + j) * 3
      pos[i] = x + nx * o
      pos[i + 1] = yb + h
      pos[i + 2] = z + nz * o
    })
  }
  // wind the faces so they point outwards
  const P = (k, j) => new THREE.Vector3().fromArray(pos, (k * M + j) * 3)
  const cross = new THREE.Vector3().crossVectors(P(1, 9).sub(P(0, 9)), P(1, 10).sub(P(0, 9)))
  const flip = cross.x * NORMALS[0][0] + cross.z * NORMALS[0][1] < 0
  const idx = []
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N
    for (let j = 0; j < M - 1; j++) {
      const a = k * M + j
      const b = k1 * M + j
      const c = k * M + j + 1
      const d = k1 * M + j + 1
      if (flip) idx.push(a, d, b, a, c, d)
      else idx.push(a, b, d, a, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// where the outline crosses a line along z at x
function zRange(x) {
  let lo = Infinity
  let hi = -Infinity
  const n = OUTLINE.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [ax, az] = OUTLINE[j]
    const [bx, bz] = OUTLINE[i]
    if (ax > x !== bx > x) {
      const z = az + ((x - ax) / (bx - ax)) * (bz - az)
      lo = Math.min(lo, z)
      hi = Math.max(hi, z)
    }
  }
  return [lo, hi]
}

// the outsole (bottom face), as a grid so it can follow the toe spring;
// uv maps x/z onto the tread texture
export const TREAD_BOX = [-15, -6, 30, 12] // x0, z0, width, depth
export function buildOutsole() {
  const xs = OUTLINE.map((p) => p[0])
  const x0 = Math.min(...xs) + 0.16
  const x1 = Math.max(...xs) - 0.16
  const C = 140
  const R = 26
  const pos = []
  const uv = []
  for (let c = 0; c <= C; c++) {
    const x = x0 + ((x1 - x0) * c) / C
    let [lo, hi] = zRange(x)
    lo += 0.16
    hi -= 0.16
    if (hi < lo) lo = hi = (lo + hi) / 2
    for (let r = 0; r <= R; r++) {
      const z = lo + ((hi - lo) * r) / R
      pos.push(x, soleBottom(x) - 0.002, z)
      uv.push((x - TREAD_BOX[0]) / TREAD_BOX[2], (z - TREAD_BOX[1]) / TREAD_BOX[3])
    }
  }
  const idx = []
  for (let c = 0; c < C; c++)
    for (let r = 0; r < R; r++) {
      const a = c * (R + 1) + r
      const b = a + R + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // make sure it faces down
  if (g.attributes.normal.getY(R + 5) > 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
    g.setIndex(idx)
    g.computeVertexNormals()
  }
  return g
}

// points along the bottom, for finding which part touches the floor when
// the shoe tips
export const ROCKER = Array.from({ length: 58 }, (_, i) => {
  const x = -14.2 + i * 0.5
  return [x, soleBottom(x)]
})

// the eyelets: rows from the top of the lacing down to the toe
export const EYELET_X = [-1.2, 0.15, 1.5, 2.85, 4.2, 5.55]
export const EYELET_Z = 1.55

// the top line for the shader, as straight pieces (close enough for seams)
export const TOP_LINE_GLSL = `float rdT(float x) {
${TOP_LINE.slice(1)
  .map(([x1, y1], i) => {
    const [x0, y0] = TOP_LINE[i]
    return `  if (x < ${x1.toFixed(2)}) return mix(${y0.toFixed(2)}, ${y1.toFixed(2)}, clamp((x - (${x0.toFixed(2)})) / ${(x1 - x0).toFixed(2)}, 0.0, 1.0));`
  })
  .join('\n')}
  return ${TOP_LINE[TOP_LINE.length - 1][1].toFixed(2)};
}`
