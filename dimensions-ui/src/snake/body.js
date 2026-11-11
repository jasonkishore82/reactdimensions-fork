import * as THREE from 'three'
import { HEAD_D, LENGTH, SEG, SEGMENTS, profile } from './profile.js'

const RADIAL = 28
const HEAD_RINGS = 40
const BODY_RINGS = 230

// Where the eyes, nostrils and tongue sit, as distances from the snout.
export const EYE_D = 0.36
export const EYE_PHI = 1.3 // radians from the centre of the back
export const NOSTRIL_D = 0.11
export const NOSTRIL_PHI = 0.95

const BELLY_EXP = 2.7 // >2 makes the belly flatter than an ellipse

const sgnpow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e)

// Builds the tube once; `update` rewrites vertices from the spine each frame.
export function createSnakeBody() {
  const dists = []
  for (let j = 0; j < HEAD_RINGS; j++) dists.push(HEAD_D * Math.pow(j / HEAD_RINGS, 1.6))
  for (let j = 0; j <= BODY_RINGS; j++) dists.push(HEAD_D + ((LENGTH - HEAD_D) * j) / BODY_RINGS)
  const rings = dists.length
  const verts = rings * (RADIAL + 1)

  const position = new Float32Array(verts * 3)
  const normal = new Float32Array(verts * 3)
  const uv = new Float32Array(verts * 2)
  const index = []
  for (let j = 0; j < rings; j++) {
    for (let k = 0; k <= RADIAL; k++) {
      uv[(j * (RADIAL + 1) + k) * 2] = k / RADIAL
      uv[(j * (RADIAL + 1) + k) * 2 + 1] = dists[j] / LENGTH
    }
  }
  for (let j = 0; j < rings - 1; j++) {
    for (let k = 0; k < RADIAL; k++) {
      const a = j * (RADIAL + 1) + k
      const b = a + 1
      const c = a + RADIAL + 1
      const d = c + 1
      index.push(a, b, c, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setIndex(index)

  // Per-ring scratch data
  const ringPos = new Float32Array(rings * 3)
  const ringTan = new Float32Array(rings * 3)
  const ringBelly = new Float32Array(rings * 3)
  const sin = new Float32Array(RADIAL + 1)
  const cos = new Float32Array(RADIAL + 1)
  for (let k = 0; k <= RADIAL; k++) {
    sin[k] = Math.sin((k / RADIAL) * Math.PI * 2)
    cos[k] = Math.cos((k / RADIAL) * Math.PI * 2)
  }

  const t = new THREE.Vector3()
  const tPrev = new THREE.Vector3()
  const b = new THREE.Vector3()
  const back = new THREE.Vector3()
  const side = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const prof = { w: 0, h: 0 }

  // Frame on a ring for placing features: surface point + outward normal.
  const frame = { pos: new THREE.Vector3(), nrm: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), side: new THREE.Vector3() }

  function sampleRing(D, d, outP, outT) {
    const s = Math.min(Math.max(d / SEG, 0), SEGMENTS - 1.0001)
    const i = Math.floor(s)
    const u = s - i
    const p0 = D[Math.max(i - 1, 0)]
    const p1 = D[i]
    const p2 = D[i + 1]
    const p3 = D[Math.min(i + 2, SEGMENTS - 1)]
    const u2 = u * u
    const u3 = u2 * u
    for (const ax of ['x', 'y', 'z']) {
      const a0 = p0[ax], a1 = p1[ax], a2 = p2[ax], a3 = p3[ax]
      outP[ax] = 0.5 * (2 * a1 + (-a0 + a2) * u + (2 * a0 - 5 * a1 + 4 * a2 - a3) * u2 + (-a0 + 3 * a1 - 3 * a2 + a3) * u3)
      outT[ax] = 0.5 * (-a0 + a2 + 2 * (2 * a0 - 5 * a1 + 4 * a2 - a3) * u + 3 * (-a0 + 3 * a1 - 3 * a2 + a3) * u2)
    }
    outT.normalize()
  }

  const pv = new THREE.Vector3()
  const tv = new THREE.Vector3()

  function update(D, breath = 0) {
    // 1. Centre line and tangents
    for (let j = 0; j < rings; j++) {
      sampleRing(D, dists[j], pv, tv)
      ringPos[j * 3] = pv.x
      ringPos[j * 3 + 1] = pv.y
      ringPos[j * 3 + 2] = pv.z
      ringTan[j * 3] = tv.x
      ringTan[j * 3 + 1] = tv.y
      ringTan[j * 3 + 2] = tv.z
    }
    // 2. Belly direction, carried from the tail (resting on the floor) up to
    //    the head with minimal twist. This keeps the pale belly on the inside
    //    of every bend and facing down on the ground.
    for (let j = rings - 1; j >= 0; j--) {
      t.set(ringTan[j * 3], ringTan[j * 3 + 1], ringTan[j * 3 + 2])
      if (j === rings - 1) b.set(0, -1, 0)
      else {
        q.setFromUnitVectors(tPrev, t)
        b.applyQuaternion(q)
      }
      b.addScaledVector(t, -b.dot(t)).normalize()
      ringBelly[j * 3] = b.x
      ringBelly[j * 3 + 1] = b.y
      ringBelly[j * 3 + 2] = b.z
      tPrev.copy(t)
    }
    // 3. Vertices
    for (let j = 0; j < rings; j++) {
      const d = dists[j]
      profile(d, prof)
      const swell = 1 + breath * Math.exp(-Math.pow((d - 4) / 2.5, 2))
      const w = prof.w * swell
      const h = prof.h * swell
      t.set(ringTan[j * 3], ringTan[j * 3 + 1], ringTan[j * 3 + 2])
      b.set(ringBelly[j * 3], ringBelly[j * 3 + 1], ringBelly[j * 3 + 2])
      back.copy(b).multiplyScalar(-1)
      side.crossVectors(t, back).normalize()
      const cx = ringPos[j * 3]
      const cy = ringPos[j * 3 + 1]
      const cz = ringPos[j * 3 + 2]
      for (let k = 0; k <= RADIAL; k++) {
        const c = cos[k]
        const sn = sin[k]
        const e = c < 0 ? BELLY_EXP : 2
        const cs = sgnpow(c, 2 / e)
        const ss = sgnpow(sn, 2 / e)
        const x = side.x * w * ss + back.x * h * cs
        const y = side.y * w * ss + back.y * h * cs
        const z = side.z * w * ss + back.z * h * cs
        const o = (j * (RADIAL + 1) + k) * 3
        position[o] = cx + x
        position[o + 1] = cy + y
        position[o + 2] = cz + z
        // gradient of the (super)ellipse, so shading is smooth across the seam
        const gn = sgnpow(cs, e - 1) / Math.max(h, 1e-4)
        const gs = sgnpow(ss, e - 1) / Math.max(w, 1e-4)
        let nx = back.x * gn + side.x * gs
        let ny = back.y * gn + side.y * gs
        let nz = back.z * gn + side.z * gs
        const nl = Math.hypot(nx, ny, nz) || 1
        normal[o] = nx / nl
        normal[o + 1] = ny / nl
        normal[o + 2] = nz / nl
      }
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.normal.needsUpdate = true
  }

  // Surface point on the head at distance d from the snout, angle phi from the
  // centre of the back (positive = side +1). Used for eyes and nostrils.
  function surfacePoint(D, d, phi, sideSign, offset, out) {
    sampleRing(D, d, pv, tv)
    // belly vector at this distance: find the nearest ring
    let jBest = 0
    for (let j = 0; j < rings; j++) if (dists[j] >= d) { jBest = j; break }
    b.set(ringBelly[jBest * 3], ringBelly[jBest * 3 + 1], ringBelly[jBest * 3 + 2])
    back.copy(b).multiplyScalar(-1)
    side.crossVectors(tv, back).normalize()
    profile(d, prof)
    const c = Math.cos(phi)
    const sn = Math.sin(phi) * sideSign
    out.pos.copy(pv).addScaledVector(back, prof.h * c).addScaledVector(side, prof.w * sn)
    out.nrm.copy(back).multiplyScalar(c / Math.max(prof.h, 1e-4)).addScaledVector(side, sn / Math.max(prof.w, 1e-4)).normalize()
    out.pos.addScaledVector(out.nrm, offset)
    out.fwd.copy(tv).multiplyScalar(-1) // towards the snout
    out.up.copy(back)
    out.side.copy(side)
    return out
  }

  return { geometry, update, surfacePoint, frame, sampleRing }
}
