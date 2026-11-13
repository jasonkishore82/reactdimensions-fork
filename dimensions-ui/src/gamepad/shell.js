import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'

// The controller shell as one smooth surface. It's described as a signed
// distance field (negative inside) built from a few rounded shapes blended
// together, which is what gives it the moulded, seamless look: the shoulders
// flow into long tapered grips with no join. Marching cubes turns the field
// into a mesh once, at load.
//
// Units are centimetres: x right, y up, z towards the player. 16 cm wide.

export const STICKS = [[-2.65, 0.05], [2.65, 0.05]]
const WELL_R = 1.3 // the round wells the sticks sit in
const WELL_DEPTH = 0.3

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a, b, k) => -smin(-a, -b, k)

function roundBox(px, py, pz, cx, cy, cz, bx, by, bz, r) {
  const qx = Math.abs(px - cx) - bx
  const qy = Math.abs(py - cy) - by
  const qz = Math.abs(pz - cz) - bz
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r
}

// a capsule from a to b whose radius tapers r1 -> r2; `ys` squashes it
// vertically so the section is a wide oval, like a grip
function taper(px, py, pz, a, b, r1, r2, ys) {
  const ay = a[1] * ys
  const pax = px - a[0]
  const pay = py * ys - ay
  const paz = pz - a[2]
  const bax = b[0] - a[0]
  const bay = b[1] * ys - ay
  const baz = b[2] - a[2]
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1)
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (r1 + (r2 - r1) * h)
}

// the grips: shoulder -> belly -> tip, splaying out then curling in, and
// angling down away from the face
const GRIP = [
  [[5.95, 0.1, -1.0], 2.05],
  [[6.05, -0.15, 2.4], 1.85],
  [[5.3, -1.55, 4.75], 1.38],
]
const YS = 1.3

// the shell without the stick wells (used to sit parts on the surface)
export function shellBase(px, py, pz) {
  const x = Math.abs(px) // symmetric
  // centre body and the two rounded shoulders that carry the buttons
  let d = roundBox(x, py, pz, 0, 0.2, -1.45, 4.6, 0.55, 2.95, 0.75)
  d = smin(d, roundBox(x, py, pz, 5.6, -0.05, -2.5, 1.2, 0.35, 1.45, 1.25), 1.2)
  // grips
  const g = smin(
    taper(x, py, pz, GRIP[0][0], GRIP[1][0], GRIP[0][1], GRIP[1][1], YS),
    taper(x, py, pz, GRIP[1][0], GRIP[2][0], GRIP[1][1], GRIP[2][1], YS),
    0.6,
  )
  return smin(d, g, 1.8)
}

export function shell(px, py, pz) {
  let d = shellBase(px, py, pz)
  for (const [sx, sz] of STICKS) {
    const well = Math.max(Math.hypot(px - sx, pz - sz) - WELL_R, 1.5 - WELL_DEPTH - py)
    d = smax(d, -well, 0.22)
  }
  return d
}

export function buildShell(res = 112) {
  const H = 9.2 // half the side of the sampled cube
  const C = [0, -0.4, 0.5]
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 200000)
  mc.isolation = 0
  const f = mc.field
  const half = res / 2
  for (let z = 0; z < res; z++) {
    const pz = C[2] + ((z - half) / half) * H
    for (let y = 0; y < res; y++) {
      const py = C[1] + ((y - half) / half) * H
      for (let x = 0; x < res; x++) {
        const px = C[0] + ((x - half) / half) * H
        // far from the shell: just "outside", skip the maths
        const far = Math.abs(px) > 8.8 || py < -3.2 || py > 2.3 || pz < -6 || pz > 6.9
        f[x + y * res + z * res * res] = far ? -1 : -shell(px, py, pz)
      }
    }
  }
  mc.update()
  const n = mc.count
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    pos[i * 3] = C[0] + mc.positionArray[i * 3] * H
    pos[i * 3 + 1] = C[1] + mc.positionArray[i * 3 + 1] * H
    pos[i * 3 + 2] = C[2] + mc.positionArray[i * 3 + 2] * H
    v.set(mc.normalArray[i * 3], mc.normalArray[i * 3 + 1], mc.normalArray[i * 3 + 2]).normalize()
    nor[i * 3] = v.x
    nor[i * 3 + 1] = v.y
    nor[i * 3 + 2] = v.z
  }
  mc.geometry.dispose()
  mc.material.dispose()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.computeBoundingSphere()
  return g
}

// where the top surface is at (x, z), and which way it faces, so parts can
// sit flush on it
export function surfaceAt(x, z, field = shellBase) {
  const step = 0.05
  let y = 2.6
  while (y > -3 && field(x, y, z) > 0) y -= step
  let inside = y
  let outside = y + step
  for (let i = 0; i < 24; i++) {
    const m = (inside + outside) / 2
    if (field(x, m, z) > 0) outside = m
    else inside = m
  }
  const yy = (inside + outside) / 2
  const e = 0.01
  const n = new THREE.Vector3(
    field(x + e, yy, z) - field(x - e, yy, z),
    field(x, yy + e, z) - field(x, yy - e, z),
    field(x, yy, z + e) - field(x, yy, z - e),
  ).normalize()
  return { y: yy, n }
}

// The face panel ("cove"): the smooth inner panel round the touchpad and
// sticks that runs down the inside of each grip. It's drawn in the shader by
// a 2D distance field over x/z: a different finish inside, a fine groove on
// the line. Kept here so the outline lives next to the shape.
export const COVE_GLSL = /* glsl */ `
float rdSmin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float rdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float rdSeg(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float rdCove(vec2 p) {
  vec2 q = vec2(abs(p.x), p.y);
  float d = rdBox(p - vec2(0.0, -2.75), vec2(3.0, 2.05), 0.55);
  d = rdSmin(d, length(q - vec2(2.65, 0.05)) - 1.72, 0.9);
  d = rdSmin(d, rdBox(p - vec2(0.0, 1.35), vec2(3.0, 1.1), 0.3), 0.6);
  d = rdSmin(d, rdSeg(q, vec2(3.95, 1.5), vec2(4.75, 6.4), 0.5), 0.8);
  return d;
}
`
