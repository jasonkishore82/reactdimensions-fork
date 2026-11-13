import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ebonyTexture, mahoganyTexture, mosaicTexture, rosewoodTexture, spruceTexture, tortoiseTexture } from './textures.js'
import { CHORDS, STRINGS, centsBetween, fretStretchTension, frequency, keyAngleFor, noteOf, pluckModes, springPerKeyRad, tensionAt } from './strings.js'
import { click, damp, knock, pluck as pluckSound, retune } from './audio.js'

// A dreadnought acoustic guitar standing on a floor stand. Units: 1 = 1 cm.
//
// Guitar frame: x across the top (bass side negative), y up the neck from the
// tail, z out of the soundboard. The top is the plane z = 0.
//
// The mechanism, all of it live:
//  - six steel strings, saddle to nut, 64.5 cm scale. Each is a sum of its
//    vibrating modes (strings.js), so a pluck starts as a triangle and runs
//    as the travelling kink of Helmholtz motion, then decays, high modes first.
//  - frets at L(1 - 2^(-k/12)); press one and the string stops there,
//    touching the fret crown, and sounds a semitone higher per fret.
//  - open-gear tuners: the key turns a worm that turns an 18-tooth gear on
//    the post, so 18 turns of the key are one turn of the post. Winding the
//    post stretches the string; the tension, and so the pitch, follow.
//  - the guitar rests in the stand's cradle and leans on its yoke; knock it
//    and it rocks about the cradle as a damped pendulum.

const L = 64.5
const Y_SADDLE = 21.3
const Y_NUT = Y_SADDLE + L
const fretY = (k) => Y_NUT - L * (1 - 2 ** (-k / 12))
const N_FRETS = 20
const Y_FB_END = fretY(N_FRETS) - 0.6
const Y_JOIN = 50
const FB_T = 0.6
const FRET_TOP = FB_T + 0.11
const Z_SAD = 1.2
const Z_NUT = 0.78
const Y_HOLE = 35.6
const R_HOLE = 5.1
const Y_BRIDGE = Y_SADDLE - 0.55
const Y_PIN = Y_BRIDGE - 0.6
const HS_ANGLE = THREE.MathUtils.degToRad(14)
const HS_Y = Y_NUT + 0.55
const HS_LEN = 18.6
const LEAN = 0.2
const TAIL_DEPTH = 12.4
const PIVOT_H = 10.5 // height of the cradle, where the guitar's tail rests

const fbHalf = (y) => (4.4 + ((Y_NUT - y) / (Y_NUT - Y_FB_END)) * 1.25) / 2
const hsHalf = (h) => 2.75 + 1.05 * (h / HS_LEN)
const depthAt = (y) => 10 + (TAIL_DEPTH - 10) * (1 - y / Y_JOIN)
const backZ = (x, y) => -depthAt(y) - 0.45 * (1 - Math.min(1, (x / 20) ** 2))

const xNut = (i) => -1.8 + i * 0.72
const xSad = (i) => -2.65 + i * 1.06
const ySad = (i) => Y_SADDLE + 0.04 * xSad(i) // slanted saddle: bass strings a touch longer
const strX = (i, y) => xSad(i) + ((y - ySad(i)) / (Y_NUT - ySad(i))) * (xNut(i) - xSad(i))
const strZ = (i, y) => Z_SAD + ((y - ySad(i)) / (Y_NUT - ySad(i))) * (Z_NUT - Z_SAD)
const visR = (i) => Math.max(STRINGS[i].radius * 100, 0.028)

// headstock frame (x, h along the headstock, z out of its face) to guitar frame
const hsPoint = (x, h, z) => new THREE.Vector3(x, HS_Y + h * Math.cos(HS_ANGLE) + z * Math.sin(HS_ANGLE), -h * Math.sin(HS_ANGLE) + z * Math.cos(HS_ANGLE))

// tuner layout: bass posts on the left, the low E nearest the nut so no strings cross
const TUNERS = STRINGS.map((_, i) => {
  const s = i < 3 ? -1 : 1
  const slot = i < 3 ? i : 5 - i
  const h = [4.6, 9.0, 13.4][slot]
  return { s, h, x: s * (hsHalf(h) - 1.15) }
})
const GEAR_R = 0.62
const WORM_R = 0.17
const GEAR_Z = -1.95

// ---------- geometry ----------

const HALF = [[0, 0], [6, 0.35], [11.5, 1.6], [15.8, 4.0], [18.6, 7.4], [19.75, 11.6], [19.6, 15.8], [18.2, 20.6], [15.9, 25.0], [14.0, 28.6], [13.6, 31.4], [13.95, 34.6], [14.55, 38.4], [14.55, 42.2], [13.4, 45.6], [10.6, 48.4], [6.0, 49.7], [0, 50]]

function outline() {
  const pts = [...HALF.map(([x, y]) => new THREE.Vector3(x, y, 0)), ...HALF.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector3(-x, y, 0))]
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  const p = curve.getSpacedPoints(320).slice(0, -1).map((v) => new THREE.Vector2(v.x, v.y))
  const n = p.map((_, i) => {
    const a = p[(i - 1 + p.length) % p.length]
    const b = p[(i + 1) % p.length]
    return new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize() // outward for a counter-clockwise loop
  })
  return { p, n }
}

function planarUV(g, sx, sy, ox = 0.5, oy = 0) {
  const pos = g.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / sx + ox
    uv[i * 2 + 1] = pos.getY(i) / sy + oy
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

function flipWinding(g) {
  const idx = g.index.array
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1]
    idx[i + 1] = idx[i + 2]
    idx[i + 2] = t
  }
}

// a loop of the outline, offset inward, as a flat band on the top
function bandGeometry(o, off0, off1, z) {
  const N = o.p.length
  const pos = []
  const idx = []
  for (let i = 0; i <= N; i++) {
    const p = o.p[i % N]
    const n = o.n[i % N]
    pos.push(p.x - n.x * off0, p.y - n.y * off0, z, p.x - n.x * off1, p.y - n.y * off1, z)
    if (i < N) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // make them face +z whatever the winding came out as
  const nr = g.attributes.normal
  for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 0, 1)
  return g
}

// a flat ring with polar UVs (u round the ring), for the rosette
function ringGeometry(r0, r1, seg = 128, repeat = 1) {
  const pos = []
  const uv = []
  const idx = []
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    pos.push(c * r0, s * r0, 0, c * r1, s * r1, 0)
    uv.push((i / seg) * repeat, 0, (i / seg) * repeat, 1)
    if (i < seg) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// the neck: a C-shaped section swept along the neck, swelling into the heel
// at the body and running on past the nut into the volute under the headstock
function neckGeometry() {
  const rings = []
  const X = new THREE.Vector3(1, 0, 0)
  const up = new THREE.Vector3(0, 0, 1)
  const N1 = 48
  for (let k = 0; k <= N1; k++) {
    const y = Y_JOIN + (k / N1) * (HS_Y - Y_JOIN)
    let d = 2.45 + ((y - Y_JOIN) / (Y_NUT - Y_JOIN)) * (2.15 - 2.45)
    const heel = THREE.MathUtils.smoothstep(Y_JOIN + 8.5 - y, 0, 8.5)
    d += (depthAt(Y_JOIN) + 0.35 - d) * heel ** 1.7
    rings.push({ o: new THREE.Vector3(0, y, 0), up, hw: fbHalf(Math.min(y, Y_NUT)) * 0.995, d, v: y })
  }
  const upH = new THREE.Vector3(0, Math.sin(HS_ANGLE), Math.cos(HS_ANGLE))
  for (let k = 1; k <= 8; k++) {
    const h = (k / 8) * 3.2
    const f = THREE.MathUtils.smoothstep(h, 0, 3.2)
    rings.push({ o: hsPoint(0, h, 0), up: upH, hw: THREE.MathUtils.lerp(fbHalf(Y_NUT), hsHalf(h), f) * 0.98, d: THREE.MathUtils.lerp(2.15, 1.42, f), v: HS_Y + h })
  }
  const P = 28
  const pos = []
  const uv = []
  const idx = []
  rings.forEach((r, k) => {
    for (let j = 0; j <= P; j++) {
      const a = (j / P) * Math.PI
      const x = r.hw * Math.cos(a)
      const dn = r.d * Math.pow(Math.sin(a), 0.8)
      const p = r.o.clone().addScaledVector(X, x).addScaledVector(r.up, -dn)
      pos.push(p.x, p.y, p.z)
      uv.push(j / P, r.v / 30)
      if (k < rings.length - 1 && j < P) {
        const a0 = k * (P + 1) + j
        const b0 = a0 + P + 1
        idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0)
      }
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

class Helix extends THREE.Curve {
  constructor(radius, length, turns, axis = 'z') {
    super()
    this.r = radius
    this.len = length
    this.turns = turns
    this.axis = axis
  }
  getPoint(t, out = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2
    const c = Math.cos(a) * this.r
    const s = Math.sin(a) * this.r
    const l = (t - 0.5) * this.len
    return this.axis === 'x' ? out.set(l, c, s) : out.set(c, s, l)
  }
}

function gearGeometry(teeth = 18, r = GEAR_R, thick = 0.2) {
  const sh = new THREE.Shape()
  const root = r - 0.09
  const steps = teeth * 4
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const rr = i % 4 === 1 || i % 4 === 2 ? r : root
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) sh.moveTo(x, y)
    else sh.lineTo(x, y)
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false })
  g.translate(0, 0, -thick / 2)
  return g
}

// a string's tube, rebuilt every frame from its base path plus its vibration
const SEG = 140
const RAD = 6
function stringGeometry() {
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array((SEG + 1) * RAD * 3)
  const nrm = new Float32Array((SEG + 1) * RAD * 3)
  const idx = []
  for (let j = 0; j <= SEG; j++) {
    for (let k = 0; k < RAD; k++) {
      const a = (k / RAD) * Math.PI * 2
      const o = (j * RAD + k) * 3
      nrm[o] = Math.cos(a)
      nrm[o + 2] = Math.sin(a)
      if (j < SEG) {
        const a0 = j * RAD + k
        const a1 = j * RAD + ((k + 1) % RAD)
        idx.push(a0, a1, a0 + RAD, a1, a1 + RAD, a0 + RAD)
      }
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}

function tube(points, r, seg = 8) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(2, points.length * 4), r, seg, false)
}

function useGeometry() {
  return useMemo(() => {
    const o = outline()
    const shape = new THREE.Shape(o.p)
    const hole = new THREE.Path()
    hole.absarc(0, Y_HOLE, R_HOLE, 0, Math.PI * 2, true)
    const topShape = new THREE.Shape(o.p)
    topShape.holes.push(hole)

    const top = planarUV(new THREE.ShapeGeometry(topShape, 48), 40, 52)

    const back = planarUV(new THREE.ShapeGeometry(shape, 12), 40, 52)
    {
      const p = back.attributes.position
      for (let i = 0; i < p.count; i++) p.setZ(i, backZ(p.getX(i), p.getY(i)))
      flipWinding(back)
      back.computeVertexNormals()
    }

    // sides: a ribbon round the outline from the top down to the arched back
    const sides = (() => {
      const N = o.p.length
      const pos = []
      const nrm = []
      const uv = []
      const idx = []
      let arc = 0
      for (let i = 0; i <= N; i++) {
        const p = o.p[i % N]
        const n = o.n[i % N]
        if (i > 0) arc += p.distanceTo(o.p[i - 1])
        pos.push(p.x, p.y, 0, p.x, p.y, backZ(p.x, p.y))
        nrm.push(n.x, n.y, 0, n.x, n.y, 0)
        uv.push(0, arc / 60, -backZ(p.x, p.y) / 26, arc / 60)
        if (i < N) {
          const a = i * 2
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setIndex(idx)
      return g
    })()

    const loop = (z) => new THREE.CatmullRomCurve3(o.p.map((p) => new THREE.Vector3(p.x, p.y, typeof z === 'function' ? z(p) : z)), true)
    const bindTop = new THREE.TubeGeometry(loop(-0.1), 480, 0.17, 6, true)
    const bindBack = new THREE.TubeGeometry(loop((p) => backZ(p.x, p.y) + 0.1), 480, 0.17, 6, true)
    const purfBlack = bandGeometry(o, 0.2, 0.3, 0.003)
    const purfWhite = bandGeometry(o, 0.3, 0.36, 0.003)
    const purfBlack2 = bandGeometry(o, 0.36, 0.42, 0.003)

    // the back's centre strip
    const strip = (() => {
      const pos = []
      const idx = []
      const n = 40
      for (let k = 0; k <= n; k++) {
        const y = 0.6 + (k / n) * 48.8
        pos.push(-0.28, y, backZ(0, y) - 0.004, 0.28, y, backZ(0, y) - 0.004)
        if (k < n) idx.push(k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      return g
    })()

    // the dark inside of the box, seen through the soundhole
    const inner = new THREE.Shape(o.p.map((p) => p.clone().multiplyScalar(0.985).add(new THREE.Vector2(0, 0.35))))
    const cavity = new THREE.ExtrudeGeometry(inner, { depth: 9.6, bevelEnabled: false, curveSegments: 4 })
    cavity.translate(0, 0, -9.9)
    const holeWall = new THREE.CylinderGeometry(R_HOLE, R_HOLE, 0.32, 64, 1, true).rotateX(Math.PI / 2).translate(0, Y_HOLE, -0.16)

    // rosette rings
    const rosette = [
      [5.35, 5.45, 'black'],
      [5.55, 5.68, 'ivory'],
      [5.7, 6.05, 'mosaic'],
      [6.07, 6.2, 'ivory'],
      [6.3, 6.38, 'black'],
    ].map(([a, b, m]) => [ringGeometry(a, b, 160, m === 'mosaic' ? 8 : 1), m])

    // pickguard, hugging the rosette on the treble side
    const pg = new THREE.Shape()
    const R = 6.6
    pg.moveTo(R * Math.cos(0.87), Y_HOLE + R * Math.sin(0.87))
    pg.bezierCurveTo(8.6, 41.6, 11.3, 38.4, 11.45, 33.2)
    pg.bezierCurveTo(11.6, 27.6, 9.8, 24.0, 6.9, 24.1)
    pg.bezierCurveTo(4.2, 24.2, 2.7, 26.4, 2.3, Y_HOLE + R * Math.sin(-1.22))
    pg.absarc(0, Y_HOLE, R, -1.22, 0.87, false)
    const pickguard = planarUV(new THREE.ShapeGeometry(pg, 24), 14, 14)

    // bridge, with a belly under the pins
    const bs = new THREE.Shape()
    const bw = 7.8
    bs.moveTo(-bw + 0.5, -1.1)
    bs.quadraticCurveTo(-3.1, -1.1, -2.3, -1.5)
    bs.lineTo(2.3, -1.5)
    bs.quadraticCurveTo(3.1, -1.1, bw - 0.5, -1.1)
    bs.quadraticCurveTo(bw, -1.1, bw, -0.6)
    bs.lineTo(bw, 0.6)
    bs.quadraticCurveTo(bw, 1.1, bw - 0.5, 1.1)
    bs.lineTo(-bw + 0.5, 1.1)
    bs.quadraticCurveTo(-bw, 1.1, -bw, 0.6)
    bs.lineTo(-bw, -0.6)
    bs.quadraticCurveTo(-bw, -1.1, -bw + 0.5, -1.1)
    const bridge = planarUV(new THREE.ExtrudeGeometry(bs, { depth: 0.72, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 2, curveSegments: 10 }), 6, 16)
    bridge.translate(0, Y_BRIDGE, 0.09)

    // fingerboard
    const fs = new THREE.Shape([
      new THREE.Vector2(-fbHalf(Y_FB_END), Y_FB_END),
      new THREE.Vector2(fbHalf(Y_FB_END), Y_FB_END),
      new THREE.Vector2(fbHalf(Y_NUT), Y_NUT),
      new THREE.Vector2(-fbHalf(Y_NUT), Y_NUT),
    ])
    const board = planarUV(new THREE.ExtrudeGeometry(fs, { depth: FB_T, bevelEnabled: false }), 7, 46)

    const neck = neckGeometry()

    // headstock slab
    const hs = new THREE.Shape()
    const top0 = HS_LEN - 0.9
    hs.moveTo(-hsHalf(0), 0)
    hs.lineTo(hsHalf(0), 0)
    hs.lineTo(hsHalf(top0), top0)
    hs.quadraticCurveTo(hsHalf(HS_LEN), HS_LEN, hsHalf(HS_LEN) - 0.9, HS_LEN)
    hs.quadraticCurveTo(0, HS_LEN + 0.35, -hsHalf(HS_LEN) + 0.9, HS_LEN)
    hs.quadraticCurveTo(-hsHalf(HS_LEN), HS_LEN, -hsHalf(top0), top0)
    hs.lineTo(-hsHalf(0), 0)
    const headstock = planarUV(new THREE.ExtrudeGeometry(hs, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 12 }), 9, 22)
    headstock.translate(0, 0, -1.5)

    // static string runs: pin to saddle, and nut to post
    const tails = STRINGS.map((_, i) => tube([new THREE.Vector3(xSad(i), Y_PIN, 0.93), new THREE.Vector3(xSad(i), ySad(i) - 0.15, Z_SAD - 0.02), new THREE.Vector3(xSad(i), ySad(i), Z_SAD)], visR(i), 6))
    const headRuns = STRINGS.map((_, i) => {
      const t = TUNERS[i]
      const pts = [new THREE.Vector3(xNut(i), Y_NUT - 0.01, Z_NUT), new THREE.Vector3(xNut(i), Y_NUT + 0.55, Z_NUT), hsPoint(t.x - t.s * 0.34, t.h, 0.55)]
      const path = new THREE.CurvePath()
      path.add(new THREE.LineCurve3(pts[0], pts[1]))
      path.add(new THREE.LineCurve3(pts[1], pts[2]))
      return new THREE.TubeGeometry(path, 12, visR(i), 6, false)
    })

    const fretWire = new THREE.CylinderGeometry(0.1, 0.1, 1, 10, 1).rotateZ(Math.PI / 2)
    const inlay = new THREE.CircleGeometry(0.3, 28)
    const gear = gearGeometry()
    const worm = new THREE.TubeGeometry(new Helix(WORM_R - 0.03, 0.9, 5, 'x'), 120, 0.045, 5, false)
    const coils = STRINGS.map((_, i) => new THREE.TubeGeometry(new Helix(0.3 + visR(i), 0.42, 2.5), 60, visR(i), 5, false).translate(0, 0, 0.55))

    // the stand's cradle (under the tail) and yoke (behind the neck), in the guitar frame
    const cradlePts = []
    for (let k = 0; k <= 16; k++) {
      const x = -12.5 + (k / 16) * 25
      const near = o.p.filter((p) => p.y < 12).reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best))
      cradlePts.push(new THREE.Vector3(x, near.y - 0.9, -TAIL_DEPTH / 2))
    }
    cradlePts[0].z = cradlePts[16].z = -TAIL_DEPTH / 2
    const cradle = tube(cradlePts, 0.75, 10)
    // front lips: run under the body's edge, then turn up only once clear of the top
    const lip = (p) => tube([new THREE.Vector3(p.x, p.y, -TAIL_DEPTH / 2), new THREE.Vector3(p.x, p.y, -3), new THREE.Vector3(p.x, p.y, 0.4), new THREE.Vector3(p.x, p.y + 0.9, 1.5), new THREE.Vector3(p.x, p.y + 1.8, 1.9)], 0.6, 10)
    const lipL = lip(cradlePts[0])
    const lipR = lip(cradlePts[16])
    const yokeY = 76.5
    const yokePts = []
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI
      yokePts.push(new THREE.Vector3(3.3 * Math.cos(a), yokeY, -1.0 - 2.1 * Math.sin(a)))
    }
    yokePts.unshift(new THREE.Vector3(3.3, yokeY, 0.4))
    yokePts.push(new THREE.Vector3(-3.3, yokeY, 0.4))
    const yoke = tube(yokePts, 0.55, 10)

    return { cradleEnds: [cradlePts[0], cradlePts[16]], o, top, back, sides, bindTop, bindBack, purfBlack, purfWhite, purfBlack2, strip, cavity, holeWall, rosette, pickguard, bridge, board, neck, headstock, tails, headRuns, fretWire, inlay, gear, worm, coils, cradle, lipL, lipR, yoke, yokeY }
  }, [])
}

function useMaterials(topColor, woodColor) {
  const tex = useMemo(() => ({ ebony: ebonyTexture(), mahogany: mahoganyTexture(), tortoise: tortoiseTexture(), mosaic: mosaicTexture() }), [])
  const spruce = useMemo(() => spruceTexture(topColor), [topColor])
  const rose = useMemo(() => rosewoodTexture(woodColor), [woodColor])
  const m = useMemo(() => {
    const gloss = { clearcoat: 1, clearcoatRoughness: 0.1 }
    return {
      top: new THREE.MeshPhysicalMaterial({ roughness: 0.42, ...gloss }),
      wood: new THREE.MeshPhysicalMaterial({ roughness: 0.48, ...gloss }),
      woodBack: new THREE.MeshPhysicalMaterial({ roughness: 0.48, ...gloss }),
      neck: new THREE.MeshPhysicalMaterial({ map: tex.mahogany, roughness: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      board: new THREE.MeshPhysicalMaterial({ map: tex.ebony, roughness: 0.55, clearcoat: 0.15 }),
      bridge: new THREE.MeshPhysicalMaterial({ map: tex.ebony, roughness: 0.45, clearcoat: 0.3 }),
      ivory: new THREE.MeshPhysicalMaterial({ color: '#efe2c4', roughness: 0.35, clearcoat: 0.8 }),
      black: new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.4 }),
      mosaic: new THREE.MeshStandardMaterial({ map: tex.mosaic, roughness: 0.4 }),
      tortoise: new THREE.MeshPhysicalMaterial({ map: tex.tortoise, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }),
      bone: new THREE.MeshPhysicalMaterial({ color: '#f2ead6', roughness: 0.45, clearcoat: 0.3 }),
      fret: new THREE.MeshStandardMaterial({ color: '#d9d9d6', metalness: 1, roughness: 0.2 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e6e6e8', metalness: 1, roughness: 0.14 }),
      brass: new THREE.MeshStandardMaterial({ color: '#cfa660', metalness: 1, roughness: 0.28 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.2, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.6 }),
      bronze: new THREE.MeshStandardMaterial({ color: '#c08f4f', metalness: 1, roughness: 0.33 }),
      steel: new THREE.MeshStandardMaterial({ color: '#dcdde0', metalness: 1, roughness: 0.22 }),
      cavity: new THREE.MeshStandardMaterial({ color: '#2a170c', roughness: 1, side: THREE.BackSide }),
      holeWall: new THREE.MeshStandardMaterial({ color: '#b98142', roughness: 0.8, side: THREE.BackSide }),
      stand: new THREE.MeshStandardMaterial({ color: '#1d1d1f', metalness: 0.4, roughness: 0.45 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.95 }),
      finger: new THREE.MeshStandardMaterial({ color: '#ff6a3d', roughness: 0.4, emissive: '#ff4a1c', emissiveIntensity: 0.25, transparent: true, opacity: 0.92 }),
      mute: new THREE.MeshStandardMaterial({ color: '#5a5a5e', roughness: 0.7 }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    }
  }, [tex])
  useEffect(() => {
    m.top.map = spruce
    m.top.needsUpdate = true
  }, [m, spruce])
  useEffect(() => {
    m.wood.map = rose
    m.woodBack.map = rose
    m.wood.needsUpdate = m.woodBack.needsUpdate = true
  }, [m, rose])
  useEffect(() => () => spruce.dispose(), [spruce])
  useEffect(() => () => rose.dispose(), [rose])
  useEffect(
    () => () => {
      Object.values(m).forEach((x) => x.dispose())
      Object.values(tex).forEach((x) => x.dispose())
    },
    [m, tex],
  )
  return m
}

// ---------- the guitar ----------

const MODES = 24

const Guitar = forwardRef(function Guitar({ topColor = '#d9a456', woodColor = '#4a2416', sound = true, vibration = 'slow-motion', showStand = true, onInfo }, ref) {
  const geo = useGeometry()
  const mat = useMaterials(topColor, woodColor)
  const { camera, gl, controls } = useThree()
  useEffect(() => () => Object.values(geo).flat(2).forEach((g) => g?.isBufferGeometry && g.dispose()), [geo])

  const stringGeos = useMemo(() => STRINGS.map(() => stringGeometry()), [])
  useEffect(() => () => stringGeos.forEach((g) => g.dispose()), [stringGeos])

  const guitarRef = useRef()
  const wobbleRef = useRef()
  const postRefs = useRef([])
  const keyRefs = useRef([])
  const fingerRefs = useRef([])
  const muteRefs = useRef([])

  // all the moving state lives here, outside React
  const s = useRef(null)
  if (!s.current) {
    s.current = {
      key: STRINGS.map(() => 0), // tuner key angles (rad); 0 is in tune
      fret: [0, 0, 0, 0, 0, 0],
      chord: 'Open',
      str: STRINGS.map(() => ({ A: new Float32Array(MODES), t: 0, active: false, dirty: true, dx: 1, dz: 0.2, damped: false, muted: false })),
      wob: { ax: 0, vx: 0, az: 0, vz: 0 },
      anim: null,
      drag: null,
      sel: 0,
      infoDirty: true,
      infoT: 0,
      lastClick: STRINGS.map(() => 0),
    }
  }
  const live = useRef({})
  live.current = { sound, vibration, onInfo }

  // --- physics helpers ---
  const tension = (i) => {
    const st = s.current
    const k = st.fret[i]
    let T = tensionAt(i, st.key[i])
    if (k > 0) {
      const y = fretY(k)
      const defl = Math.max(0, strZ(i, y) - FRET_TOP - visR(i)) / 100
      T += fretStretchTension(i, k, defl)
    }
    return T
  }
  const freq = (i) => frequency(i, tension(i), Math.max(0, s.current.fret[i]))
  const openFreq = (i) => frequency(i, tensionAt(i, s.current.key[i]), 0)

  const emit = () => {
    const st = s.current
    const f = freq(st.sel)
    const note = noteOf(f)
    live.current.onInfo?.({
      chord: st.chord,
      sel: { index: st.sel, hz: f, ...note, fret: st.fret[st.sel] },
      strings: STRINGS.map((d, i) => ({
        name: d.name,
        hz: openFreq(i),
        cents: centsBetween(openFreq(i), d.freq),
        tensionKg: tensionAt(i, st.key[i]) / 9.80665,
        fret: st.fret[i],
      })),
    })
  }

  // pluck string i at y (guitar frame), loudness 0..1, sideways direction sign
  const pluckString = (i, y, loud = 0.7, dir = 1) => {
    const st = s.current
    const str = st.str[i]
    const k = st.fret[i]
    const muted = k < 0
    const stop = k > 0 ? fretY(k) : Y_NUT
    const b = THREE.MathUtils.clamp((y - ySad(i)) / (stop - ySad(i)), 0.05, 0.95)
    const h = (0.12 + 0.24 * loud) * (muted ? 0.4 : 1) * Math.sqrt((stop - ySad(i)) / L)
    str.A = pluckModes(b, h, MODES)
    str.t = 0
    str.active = true
    str.damped = false
    str.muted = muted
    str.dx = dir
    str.dz = (Math.random() - 0.5) * 0.5
    st.sel = i
    st.infoDirty = true
    if (live.current.sound) pluckSound(i, freq(i), b, loud, muted)
    st.wob.vz += dir * 0.0012 * loud
  }

  const strum = (down = true, loud = 0.75) => {
    const order = down ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0]
    order.forEach((i, n) =>
      setTimeout(() => {
        const st = s.current
        if (!st) return
        pluckString(i, Y_HOLE - 3.5 + n * 0.3, loud * (0.85 + Math.random() * 0.2), down ? 1 : -1)
      }, n * 13),
    )
  }

  const setFret = (i, k) => {
    const st = s.current
    if (st.fret[i] === k) return
    st.fret[i] = k
    st.str[i].dirty = true
    st.chord = 'Custom'
    st.infoDirty = true
    // a finger landing on a ringing string: the note moves to the new length
    if (st.str[i].active && !st.str[i].muted && k >= 0) {
      if (live.current.sound) retune(i, freq(i))
    } else if (k < 0) {
      st.str[i].damped = true
      if (live.current.sound) damp(i)
    }
  }

  const setChord = (name) => {
    const shape = CHORDS[name]
    if (!shape) return
    const st = s.current
    shape.forEach((k, i) => {
      if (st.fret[i] !== k) {
        st.fret[i] = k
        st.str[i].dirty = true
        // changing chord lifts the fingers: ringing strings stop
        if (st.str[i].active) {
          st.str[i].damped = true
          if (live.current.sound) damp(i)
        }
      }
    })
    st.chord = name
    st.infoDirty = true
  }

  const animateKeys = (to, then) => {
    const st = s.current
    st.anim = { from: [...st.key], to, t: 0, dur: 1.6, then }
  }
  const tune = () => animateKeys(STRINGS.map(() => 0), 'strum')
  const detune = () =>
    animateKeys(
      STRINGS.map((_, i) => keyAngleFor(i, (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 45))),
      'strum',
    )

  useImperativeHandle(ref, () => ({ strum, setChord, tune, detune, pluck: (i) => pluckString(i, Y_HOLE - 3, 0.7, 1) }))

  useEffect(() => {
    s.current.infoDirty = true
  }, [onInfo])

  // --- pointer handling ---
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const inv = useMemo(() => new THREE.Matrix4(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])

  // where a pointer ray meets the plane of the strings, in the guitar frame
  const stringPlanePoint = (r) => {
    const g = guitarRef.current
    if (!g) return null
    g.updateWorldMatrix(true, false)
    inv.copy(g.matrixWorld).invert()
    const o = r.origin.clone().applyMatrix4(inv)
    const d = r.direction.clone().transformDirection(inv)
    if (Math.abs(d.z) < 1e-4) return null
    let z = 1.0
    let p = null
    for (let it = 0; it < 3; it++) {
      const t = (z - o.z) / d.z
      p = o.clone().addScaledVector(d, t)
      z = strZ(2, THREE.MathUtils.clamp(p.y, Y_SADDLE, Y_NUT))
    }
    return p
  }
  const rayFromClient = (cx, cy) => {
    const rect = gl.domElement.getBoundingClientRect()
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.ray
  }

  const grab = () => {
    if (controls) controls.enabled = false
  }

  const onStrumDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const p = stringPlanePoint(e.ray)
    if (!p) return
    grab()
    s.current.drag = { kind: 'strum', last: p, t: performance.now(), x0: e.nativeEvent.clientX, y0: e.nativeEvent.clientY, crossed: false, start: p }
  }

  const onFretDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const p = stringPlanePoint(e.ray)
    if (!p) return
    let best = -1
    let bd = 0.6
    for (let i = 0; i < 6; i++) {
      const d = Math.abs(p.x - strX(i, p.y))
      if (d < bd) {
        bd = d
        best = i
      }
    }
    if (best < 0) return
    const fromNut = Y_NUT - p.y
    if (fromNut <= 0) return
    const k = Math.ceil(-12 * Math.log2(1 - fromNut / L) - 1e-6)
    if (k < 1 || k > N_FRETS) return
    const st = s.current
    setFret(best, st.fret[best] === k ? 0 : k)
    st.sel = best
  }

  const onKeyDown = (i) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    grab()
    const st = s.current
    st.anim = null
    st.sel = i
    st.infoDirty = true
    st.drag = { kind: 'key', i, y0: e.nativeEvent.clientY, x0: e.nativeEvent.clientX, key0: st.key[i] }
    // tune by ear: let the open string ring while you turn
    if (!st.str[i].active || st.str[i].t > 2.5) {
      if (st.fret[i] < 0) st.fret[i] = 0
      pluckString(i, Y_HOLE - 3, 0.6, 1)
    }
  }

  const onBodyDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const g = guitarRef.current
    const p = g.worldToLocal(e.point.clone())
    const w = s.current.wob
    // a knock on the front pushes it back onto the yoke, then it rocks
    const front = e.face ? e.face.normal.z >= 0 : true
    w.vx += (front ? -1 : 1) * 0.02 * (0.4 + p.y / 60)
    w.vz += -Math.sign(p.x || 1) * 0.012
    if (live.current.sound) knock(0.8)
  }

  useEffect(() => {
    const move = (ev) => {
      const st = s.current
      const d = st.drag
      if (!d) return
      if (d.kind === 'strum') {
        const p = stringPlanePoint(rayFromClient(ev.clientX, ev.clientY))
        if (!p) return
        const now = performance.now()
        const dt = Math.max(4, now - d.t) / 1000
        const speed = Math.hypot(p.x - d.last.x, p.y - d.last.y) / dt // cm/s
        const loud = THREE.MathUtils.clamp(speed / 140, 0.25, 1)
        const order = p.x > d.last.x ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0]
        for (const i of order) {
          const xa = d.last.x - strX(i, d.last.y)
          const xb = p.x - strX(i, p.y)
          if (xa * xb < 0) {
            const f = xa / (xa - xb)
            const y = THREE.MathUtils.lerp(d.last.y, p.y, f)
            if (y > ySad(i) + 0.6 && y < Y_NUT - 0.5) {
              pluckString(i, y, loud, Math.sign(p.x - d.last.x))
              d.crossed = true
            }
          }
        }
        d.last = p
        d.t = now
      } else if (d.kind === 'key') {
        const fine = ev.shiftKey ? 0.2 : 1
        const delta = (d.y0 - ev.clientY + (ev.clientX - d.x0) * 0.35) * 0.028 * fine
        const i = d.i
        const max = keyAngleFor(i, 500)
        const min = (-0.9 * STRINGS[i].T0) / springPerKeyRad(i)
        const before = st.key[i]
        st.key[i] = THREE.MathUtils.clamp(d.key0 + delta, min, max)
        // the worm gear's faint tick, every quarter turn of the key
        if (Math.floor(before / (Math.PI / 2)) !== Math.floor(st.key[i] / (Math.PI / 2)) && live.current.sound) click(0.4)
        st.str[i].dirty = true
        st.infoDirty = true
        if (st.str[i].active && live.current.sound) retune(i, freq(i))
      }
    }
    const up = () => {
      const st = s.current
      const d = st.drag
      if (!d) return
      st.drag = null
      if (controls) controls.enabled = true
      // a click (no strum across a string) plucks the nearest string
      if (d.kind === 'strum' && !d.crossed) {
        const p = d.start
        let best = -1
        let bd = 0.7
        for (let i = 0; i < 6; i++) {
          const dd = Math.abs(p.x - strX(i, p.y))
          if (dd < bd) {
            bd = dd
            best = i
          }
        }
        if (best >= 0) pluckString(best, p.y, 0.65, Math.sign(p.x - strX(best, p.y)) || 1)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls, camera, gl])

  const cursor = (c) => () => {
    gl.domElement.style.cursor = c
  }

  // --- per frame ---
  const coef = useMemo(() => new Float32Array(MODES), [])
  useFrame((state, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)

    // tuner animation (Tune / Detune buttons): the keys turn, gears and posts follow
    if (st.anim) {
      const a = st.anim
      a.t += dt
      const k = Math.min(1, a.t / a.dur)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      for (let i = 0; i < 6; i++) {
        const before = st.key[i]
        st.key[i] = a.from[i] + (a.to[i] - a.from[i]) * e
        if (before !== st.key[i]) {
          st.str[i].dirty = true
          if (st.str[i].active && live.current.sound) retune(i, freq(i))
        }
      }
      st.infoDirty = true
      if (k >= 1) {
        st.anim = null
        if (a.then === 'strum') strum(true, 0.7)
      }
    }

    // the guitar rocking in its stand: a damped pendulum about the cradle
    const w = st.wob
    const om = 2 * Math.PI * 1.6
    const zeta = 0.13
    w.vx += (-om * om * w.ax - 2 * zeta * om * w.vx) * dt
    w.ax += w.vx * dt
    w.vz += (-om * om * 1.4 * w.az - 2 * zeta * om * w.vz) * dt
    w.az += w.vz * dt
    if (wobbleRef.current) {
      wobbleRef.current.rotation.x = w.ax
      wobbleRef.current.rotation.z = w.az
    }

    // tuner keys, gears and posts
    for (let i = 0; i < 6; i++) {
      const t = TUNERS[i]
      if (keyRefs.current[i]) keyRefs.current[i].rotation.x = st.key[i] * t.s
      if (postRefs.current[i]) postRefs.current[i].rotation.z = (st.key[i] / 18) * -t.s
      const k = st.fret[i]
      const f = fingerRefs.current[i]
      if (f) {
        f.visible = k > 0
        if (k > 0) {
          const y = fretY(k) + 0.38 * (fretY(k - 1) - fretY(k))
          f.position.set(strX(i, y), y, strZ(i, y) + 0.2)
        }
      }
      if (muteRefs.current[i]) muteRefs.current[i].visible = k < 0
    }

    // strings
    const realtime = live.current.vibration === 'real-time'
    const now = state.clock.elapsedTime
    for (let i = 0; i < 6; i++) {
      const str = st.str[i]
      if (!str.active && !str.dirty) continue
      const f0 = freq(i)
      let peak = 0
      if (str.active) {
        str.t += dt
        const fv = realtime ? f0 : 1.4 * Math.pow(f0 / 82.4, 0.4)
        const tt = realtime ? now : str.t
        for (let n = 1; n <= MODES; n++) {
          const rate = (str.muted ? 22 : 0.28 + n * f0 * 0.00055) + (str.damped ? 28 : 0)
          const c = str.A[n - 1] * Math.exp(-rate * str.t) * Math.cos(2 * Math.PI * n * fv * tt)
          coef[n - 1] = c
          peak = Math.max(peak, Math.abs(str.A[n - 1] * Math.exp(-rate * str.t)))
        }
        if (peak < 0.0008) {
          str.active = false
          coef.fill(0)
        }
      } else coef.fill(0)
      str.dirty = false

      const k = st.fret[i]
      const y0 = ySad(i)
      const yStop = k > 0 ? fretY(k) : Y_NUT
      const r = visR(i)
      const zF = FRET_TOP + r
      const pos = stringGeos[i].attributes.position.array
      const dl = Math.hypot(str.dx, str.dz) || 1
      const ux = str.dx / dl
      const uz = str.dz / dl
      for (let j = 0; j <= SEG; j++) {
        const y = y0 + (j / SEG) * (Y_NUT - y0)
        const x = strX(i, y)
        let z
        if (k > 0) z = y <= yStop ? THREE.MathUtils.lerp(Z_SAD, zF, (y - y0) / (yStop - y0)) : THREE.MathUtils.lerp(zF, Z_NUT, (y - yStop) / (Y_NUT - yStop))
        else z = strZ(i, y)
        let disp = 0
        if (str.active && y < yStop) {
          const u = (y - y0) / (yStop - y0)
          for (let n = 1; n <= MODES; n++) disp += coef[n - 1] * Math.sin(n * Math.PI * u)
        }
        const cx = x + disp * ux
        const cz = z + disp * uz
        for (let q = 0; q < RAD; q++) {
          const a = (q / RAD) * Math.PI * 2
          const o = (j * RAD + q) * 3
          pos[o] = cx + Math.cos(a) * r
          pos[o + 1] = y
          pos[o + 2] = cz + Math.sin(a) * r
        }
      }
      stringGeos[i].attributes.position.needsUpdate = true
    }

    st.infoT += dt
    if (st.infoDirty && st.infoT > 0.05) {
      st.infoDirty = false
      st.infoT = 0
      emit()
    }
  })

  // --- scene ---
  const frets = useMemo(() => Array.from({ length: N_FRETS }, (_, n) => fretY(n + 1)), [])
  const dots = useMemo(() => {
    const mid = (k) => (fretY(k) + fretY(k - 1)) / 2
    const d = [3, 5, 7, 9, 15, 17].map((k) => [0, mid(k)])
    d.push([-1.15, mid(12)], [1.15, mid(12)])
    return d
  }, [])

  // stand legs, in the world frame (built from where the cradle and yoke end up)
  const standLegs = useMemo(() => {
    const toWorld = (v) => {
      const p = v.clone().add(new THREE.Vector3(0, 0, TAIL_DEPTH / 2))
      p.applyAxisAngle(new THREE.Vector3(1, 0, 0), -LEAN)
      return p.add(new THREE.Vector3(0, PIVOT_H, 0))
    }
    const yokeBack = toWorld(new THREE.Vector3(0, geo.yokeY, -3.1))
    const cradleL = toWorld(geo.cradleEnds[0].clone().add(new THREE.Vector3(0, -0.4, 0)))
    const cradleR = toWorld(geo.cradleEnds[1].clone().add(new THREE.Vector3(0, -0.4, 0)))
    // The post rises behind the guitar to the yoke. The body is far deeper
    // than the neck, so a straight line to the yoke would pass through the
    // upper bout: route it behind the rearmost point of the guitar at every
    // height (taken from the real back, side, binding and neck vertices near
    // the centre line), with clearance for the tube and for the rocking.
    const CLEAR = 3.2
    const BAND = 3
    const rear = new Map() // height band -> rearmost (most negative) z
    for (const g of [geo.back, geo.sides, geo.bindBack, geo.neck]) {
      const p = g.attributes.position
      const v = new THREE.Vector3()
      for (let n = 0; n < p.count; n++) {
        v.fromBufferAttribute(p, n)
        if (Math.abs(v.x) > BAND) continue
        const w = toWorld(v)
        const b = Math.round(w.y)
        rear.set(b, Math.min(rear.get(b) ?? Infinity, w.z))
      }
    }
    const reqAt = (h) => {
      let z = Infinity
      for (let d = -6; d <= 6; d++) z = Math.min(z, rear.get(Math.round(h) + d) ?? Infinity) // smooth the bend
      return z - CLEAR
    }
    const top = yokeBack.y - 1.5
    const postPts = []
    for (let h = 8; h <= top; h += 4) postPts.push(new THREE.Vector3(0, h, Math.min(reqAt(h), yokeBack.z)))
    // never let the curve come forward then back: keep z non-increasing downward
    for (let n = postPts.length - 2; n >= 0; n--) postPts[n].z = Math.min(postPts[n].z, postPts[n + 1].z)
    postPts.push(yokeBack)
    const hub = new THREE.Vector3(0, 6, postPts[0].z - 1)
    const parts = [
      tube([hub, ...postPts], 0.75, 10),
      tube([cradleL, new THREE.Vector3(-8, 4.5, hub.z * 0.5), hub], 0.7, 10),
      tube([cradleR, new THREE.Vector3(8, 4.5, hub.z * 0.5), hub], 0.7, 10),
      tube([hub, new THREE.Vector3(-14, 2, 14), new THREE.Vector3(-21, 0.7, 16)], 0.7, 10),
      tube([hub, new THREE.Vector3(14, 2, 14), new THREE.Vector3(21, 0.7, 16)], 0.7, 10),
      tube([hub, new THREE.Vector3(0, 2.5, hub.z - 12), new THREE.Vector3(0, 0.7, hub.z - 20)], 0.7, 10),
    ]
    const feet = [new THREE.Vector3(-21, 0.7, 16), new THREE.Vector3(21, 0.7, 16), new THREE.Vector3(0, 0.7, hub.z - 20)]
    return { parts, feet, hub }
  }, [geo])
  useEffect(() => () => standLegs.parts.forEach((g) => g.dispose()), [standLegs])

  const pluckPlane = useMemo(() => {
    const y0 = Y_SADDLE + 0.6
    const y1 = Y_FB_END
    return { w: 9.5, h: y1 - y0, y: (y0 + y1) / 2 }
  }, [])
  const fretPlane = useMemo(() => ({ w: 6.4, h: Y_NUT - Y_FB_END, y: (Y_NUT + Y_FB_END) / 2 }), [])

  return (
    <group>
      <group position={[0, PIVOT_H, 0]}>
        <group ref={wobbleRef}>
          <group rotation-x={-LEAN}>
            <group ref={guitarRef} position={[0, 0, TAIL_DEPTH / 2]}>
              {/* body: knock on it */}
              <group onPointerDown={onBodyDown}>
                <mesh geometry={geo.top} material={mat.top} castShadow receiveShadow />
                <mesh geometry={geo.back} material={mat.woodBack} castShadow />
                <mesh geometry={geo.sides} material={mat.wood} castShadow receiveShadow />
                <mesh geometry={geo.bindTop} material={mat.ivory} />
                <mesh geometry={geo.bindBack} material={mat.ivory} />
                <mesh geometry={geo.strip} material={mat.ivory} />
                <mesh geometry={geo.neck} material={mat.neck} castShadow />
                <group position={[0, HS_Y, 0]} rotation-x={-HS_ANGLE}>
                  <mesh geometry={geo.headstock} material={mat.wood} castShadow />
                </group>
              </group>
              <mesh geometry={geo.purfBlack} material={mat.black} />
              <mesh geometry={geo.purfWhite} material={mat.ivory} />
              <mesh geometry={geo.purfBlack2} material={mat.black} />
              <mesh geometry={geo.cavity} material={mat.cavity} />
              <mesh geometry={geo.holeWall} material={mat.holeWall} />
              {geo.rosette.map(([g, m], i) => (
                <mesh key={i} geometry={g} material={mat[m]} position={[0, Y_HOLE, 0.004]} />
              ))}
              <mesh geometry={geo.pickguard} material={mat.tortoise} position-z={0.008} />

              {/* bridge, saddle and pins */}
              <mesh geometry={geo.bridge} material={mat.bridge} castShadow />
              <mesh material={mat.bone} position={[0, Y_SADDLE, 0.85]} rotation-z={0.04}>
                <boxGeometry args={[7.2, 0.3, 0.6]} />
              </mesh>
              {STRINGS.map((_, i) => (
                <group key={i} position={[xSad(i), Y_PIN, 0.81]}>
                  <mesh material={mat.bone} rotation-x={Math.PI / 2}>
                    <cylinderGeometry args={[0.2, 0.22, 0.14, 20]} />
                  </mesh>
                  <mesh material={mat.bone} position-z={0.07} scale={[1, 1, 0.45]}>
                    <sphereGeometry args={[0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  </mesh>
                  <mesh material={mat.black} position-z={0.162}>
                    <circleGeometry args={[0.065, 16]} />
                  </mesh>
                </group>
              ))}

              {/* fingerboard, frets, inlays, nut */}
              <mesh geometry={geo.board} material={mat.board} castShadow />
              {frets.map((y, n) => (
                <mesh key={n} geometry={geo.fretWire} material={mat.fret} position={[0, y, FB_T]} scale={[2 * fbHalf(y) + 0.02, 1, 1]} />
              ))}
              {dots.map(([x, y], n) => (
                <mesh key={n} geometry={geo.inlay} material={mat.pearl} position={[x, y, FB_T + 0.002]} />
              ))}
              <mesh material={mat.bone} position={[0, Y_NUT + 0.275, 0.38]}>
                <boxGeometry args={[2 * fbHalf(Y_NUT) + 0.04, 0.55, 0.76]} />
              </mesh>

              {/* strings */}
              {STRINGS.map((d, i) => (
                <group key={i}>
                  <mesh geometry={stringGeos[i]} material={d.wound ? mat.bronze : mat.steel} frustumCulled={false} />
                  <mesh geometry={geo.tails[i]} material={d.wound ? mat.bronze : mat.steel} />
                  <mesh geometry={geo.headRuns[i]} material={d.wound ? mat.bronze : mat.steel} />
                  <mesh ref={(m) => (fingerRefs.current[i] = m)} material={mat.finger} scale={[0.5, 0.62, 0.32]} visible={false}>
                    <sphereGeometry args={[1, 24, 16]} />
                  </mesh>
                  <mesh ref={(m) => (muteRefs.current[i] = m)} material={mat.mute} position={[strX(i, Y_NUT - 1.6), Y_NUT - 1.6, strZ(i, Y_NUT - 1.6) + 0.15]} scale={[0.32, 0.32, 0.18]} visible={false}>
                    <sphereGeometry args={[1, 16, 10]} />
                  </mesh>
                </group>
              ))}

              {/* tuners, in the headstock frame */}
              <group position={[0, HS_Y, 0]} rotation-x={-HS_ANGLE}>
                {[-1, 1].map((side) => (
                  <mesh key={side} material={mat.chrome} position={[side * (hsHalf(9) - 1.15), 9, -1.6]}>
                    <boxGeometry args={[1.5, 12.6, 0.08]} />
                  </mesh>
                ))}
                {TUNERS.map((t, i) => {
                  const hw = t.h - GEAR_R - WORM_R + 0.04
                  const edge = t.s * (hsHalf(hw) + 1.5) - t.x
                  return (
                    <group key={i}>
                      <mesh material={mat.chrome} position={[t.x, t.h, 0.08]} rotation-x={Math.PI / 2}>
                        <cylinderGeometry args={[0.44, 0.46, 0.16, 24]} />
                      </mesh>
                      <group ref={(m) => (postRefs.current[i] = m)} position={[t.x, t.h, 0]}>
                        <mesh material={mat.chrome} position-z={-0.4} rotation-x={Math.PI / 2}>
                          <cylinderGeometry args={[0.3, 0.3, 3.4, 20]} />
                        </mesh>
                        <mesh material={mat.chrome} position-z={1.3} scale={[1, 1, 0.5]}>
                          <sphereGeometry args={[0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                        </mesh>
                        <mesh geometry={geo.coils[i]} material={STRINGS[i].wound ? mat.bronze : mat.steel} />
                        {/* the cut end of the string, poking out of the post */}
                        <mesh material={STRINGS[i].wound ? mat.bronze : mat.steel} position={[0.55, 0, 0.95]} rotation-z={Math.PI / 2}>
                          <cylinderGeometry args={[visR(i), visR(i), 0.6, 6]} />
                        </mesh>
                        <mesh geometry={geo.gear} material={mat.brass} position-z={GEAR_Z} />
                      </group>
                      {/* worm, shaft and key */}
                      <group position={[t.x, hw, GEAR_Z]}>
                        <group ref={(m) => (keyRefs.current[i] = m)}>
                          <mesh geometry={geo.worm} material={mat.brass} />
                          <mesh material={mat.brass} rotation-z={Math.PI / 2}>
                            <cylinderGeometry args={[WORM_R - 0.05, WORM_R - 0.05, 0.9, 16]} />
                          </mesh>
                          <mesh material={mat.chrome} position-x={edge / 2} rotation-z={Math.PI / 2}>
                            <cylinderGeometry args={[0.1, 0.1, Math.abs(edge), 10]} />
                          </mesh>
                          <mesh material={mat.chrome} position-x={edge - t.s * 0.55} rotation-z={Math.PI / 2}>
                            <cylinderGeometry args={[0.16, 0.2, 0.35, 16]} />
                          </mesh>
                          <mesh material={mat.chrome} position-x={edge} scale={[0.42, 0.9, 0.3]} castShadow>
                            <sphereGeometry args={[1, 24, 16]} />
                          </mesh>
                        </group>
                        {/* brackets holding the worm shaft to the plate */}
                        {[-0.62, 0.62].map((dx) => (
                          <mesh key={dx} material={mat.chrome} position={[dx, 0, 0.18]}>
                            <boxGeometry args={[0.12, 0.42, 0.5]} />
                          </mesh>
                        ))}
                        {/* a generous invisible handle round the key */}
                        <mesh
                          material={mat.hit}
                          position-x={edge}
                          onPointerDown={onKeyDown(i)}
                          onPointerOver={cursor('grab')}
                          onPointerOut={cursor('')}
                        >
                          <sphereGeometry args={[1.25, 12, 8]} />
                        </mesh>
                      </group>
                    </group>
                  )
                })}
              </group>

              {/* hit areas: strum over the body, fret over the fingerboard */}
              <mesh material={mat.hit} position={[0, pluckPlane.y, 1.5]} onPointerDown={onStrumDown} onPointerOver={cursor('pointer')} onPointerOut={cursor('')}>
                <planeGeometry args={[pluckPlane.w, pluckPlane.h]} />
              </mesh>
              <mesh material={mat.hit} position={[0, fretPlane.y, 1.1]} onPointerDown={onFretDown} onPointerOver={cursor('pointer')} onPointerOut={cursor('')}>
                <planeGeometry args={[fretPlane.w, fretPlane.h]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* the stand's cradle and yoke: fixed, the guitar rocks against them */}
        {showStand && (
          <group rotation-x={-LEAN}>
            <group position={[0, 0, TAIL_DEPTH / 2]}>
              <mesh geometry={geo.cradle} material={mat.rubber} castShadow />
              <mesh geometry={geo.lipL} material={mat.rubber} castShadow />
              <mesh geometry={geo.lipR} material={mat.rubber} castShadow />
              <mesh geometry={geo.yoke} material={mat.rubber} castShadow />
            </group>
          </group>
        )}
      </group>
      {showStand && (
        <group>
          {standLegs.parts.map((g, n) => (
            <mesh key={n} geometry={g} material={mat.stand} castShadow />
          ))}
          {standLegs.feet.map((p, n) => (
            <mesh key={n} material={mat.rubber} position={[p.x, 0.6, p.z]}>
              <cylinderGeometry args={[1.1, 1.2, 1.2, 16]} />
            </mesh>
          ))}
          <mesh material={mat.stand} position={standLegs.hub}>
            <sphereGeometry args={[1.2, 16, 12]} />
          </mesh>
        </group>
      )}
    </group>
  )
})


export const GUITAR_EXTENT = { height: 116, center: 56, depth: -8 }
export default Guitar
