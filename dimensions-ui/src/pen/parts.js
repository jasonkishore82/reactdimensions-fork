import * as THREE from 'three'

// The pen's shapes, all in its own frame: 1 unit = 10 mm, the axis along +x
// with the nib pointing +x, the clip (when capped) on +y.
//
//   knob    -6.64 .. -5.42  the piston knob, which turns the spindle
//   barrel  -5.42 ..  2.47  with the ink window at 1.25 .. 2.25
//   section  2.55 ..  4.52  threads for the cap at the back
//   nib      4.30 ..  7.06  on a finned feed
//   cap      6.58 long, 16.6 mm across, screwed on over the section
//
// Capped it is 158 mm long, a big classic piston filler.

export const NIB_TIP = 7.06
export const TURNS = 2.5 // knob turns from empty to full
export const PISTON = { front: 1.85, back: -3.55, half: 0.25 } // head centre, empty .. full
export const CHAMBER_FRONT = 2.3
export const SPINDLE = { x0: -6.3, x1: -3.95, r: 0.15 }
export const CAP = { len: 6.58, half: 3.29, onX: 2.55, travel: 0.2, spin: Math.PI * 2.5, outX: 7.8, postX: -4.6, postApproach: -5.6, lift: 2.1 }

// a lathe round the x axis from [x, r] pairs
export function lathe(pts, seg = 72) {
  const g = new THREE.LatheGeometry(
    pts.map(([x, r]) => new THREE.Vector2(Math.max(r, 0), x)),
    seg,
  )
  g.rotateZ(-Math.PI / 2)
  return g
}
// a raised metal band between x0 and x1
const band = (x0, x1, r) => [
  [x0, r - 0.016],
  [x0 + 0.007, r],
  [x1 - 0.007, r],
  [x1, r - 0.016],
]

// ---- profiles ----
const KNOB = [[-6.645, 0], [-6.64, 0.2], [-6.615, 0.4], [-6.56, 0.54], [-6.46, 0.63], [-6.3, 0.68], [-5.9, 0.695], [-5.42, 0.703]]
const BARREL = [[-5.42, 0.705], [-4.5, 0.735], [-3, 0.77], [-1.5, 0.79], [0, 0.8], [1.25, 0.797]]
const WINDOW = [[1.25, 0.797], [1.75, 0.795], [2.25, 0.792]]
const BARREL_FRONT = [[2.25, 0.792], [2.47, 0.789], [2.48, 0.74]]
function sectionProfile() {
  const p = [[2.5, 0.6], [2.53, 0.705]]
  for (let x = 2.58; x < 3.0; x += 0.07) p.push([x, 0.7], [x + 0.035, 0.728])
  p.push([3.02, 0.7], [3.6, 0.665], [4.2, 0.61], [4.4, 0.586])
  return p
}
const SECTION_RING = [[4.4, 0.588], [4.41, 0.602], [4.49, 0.596], [4.515, 0.57], [4.52, 0.47]]
const SECTION_FACE = [[4.52, 0.47], [4.522, 0.3], [4.524, 0]]

// cap: mouth at x = 0, closed top at +x, one closed shell (inner wall, lip,
// outer wall) so it never shows a hole
const CAP_SHELL = [[5.92, 0], [5.86, 0.45], [5.62, 0.66], [4.8, 0.72], [2, 0.745], [0.06, 0.748], [0, 0.765], [0.012, 0.81], [0.05, 0.826], [0.3, 0.83], [2, 0.834], [3.5, 0.82], [4.8, 0.787], [5.6, 0.746], [5.86, 0.726]]
const CAP_TOP = [[6.06, 0.718], [6.25, 0.665], [6.4, 0.565], [6.5, 0.43], [6.54, 0.345]]
const CAP_DISC = [[6.565, 0.27], [6.578, 0.15], [6.582, 0]]
function capRadius(x) {
  const outer = CAP_SHELL.slice(8)
  for (let i = 1; i < outer.length; i++) {
    if (x <= outer[i][0]) {
      const [x0, r0] = outer[i - 1]
      const [x1, r1] = outer[i]
      return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0)
    }
  }
  return 0.72
}

// ---- the nib: a curved sheet drawn on a cylinder, flattening and dipping towards the tip ----
const NIB0 = 4.3
const NIB_SHOULDER = 4.85
const NIB_R = 0.42
const NIB_T = 0.026
const NIB_V = 0.54 // half the texture's width
function nibHalfWidth(u) {
  if (u < NIB_SHOULDER) return 0.47 + 0.05 * Math.sin(((u - NIB0) / (NIB_SHOULDER - NIB0)) * Math.PI * 0.5)
  const t = Math.min(1, (u - NIB_SHOULDER) / (NIB_TIP - NIB_SHOULDER))
  return 0.016 + 0.504 * (1 - Math.pow(t, 1.35))
}
function nibFrame(u) {
  const t = Math.max(0, (u - NIB_SHOULDER) / (NIB_TIP - NIB_SHOULDER))
  const R = NIB_R * (1 + 0.7 * t)
  const top = NIB_R - 0.37 * Math.pow(t, 2.1)
  return { R, yc: top - R }
}
export function nibGeometry() {
  const N = 90
  const M = 30
  const pos = []
  const uv = []
  const idx = []
  const rows = N + 1
  const cols = M + 1
  for (const layer of [0, 1]) {
    for (let i = 0; i <= N; i++) {
      const u = NIB0 + ((NIB_TIP - NIB0) * i) / N
      const hw = nibHalfWidth(u)
      const { R, yc } = nibFrame(u)
      const r = layer ? R - NIB_T : R
      for (let j = 0; j <= M; j++) {
        const v = -hw + (2 * hw * j) / M
        const a = v / R
        pos.push(u, yc + r * Math.cos(a), -r * Math.sin(a))
        uv.push((u - NIB0) / (NIB_TIP - NIB0), (v + NIB_V) / (2 * NIB_V))
      }
    }
  }
  const at = (layer, i, j) => layer * rows * cols + i * cols + j
  const quad = (a, b, c, d) => idx.push(a, b, d, b, c, d)
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      quad(at(0, i, j), at(0, i + 1, j), at(0, i + 1, j + 1), at(0, i, j + 1))
      quad(at(1, i, j + 1), at(1, i + 1, j + 1), at(1, i + 1, j), at(1, i, j))
    }
    quad(at(1, i, 0), at(1, i + 1, 0), at(0, i + 1, 0), at(0, i, 0))
    quad(at(0, i, M), at(0, i + 1, M), at(1, i + 1, M), at(1, i, M))
  }
  for (let j = 0; j < M; j++) quad(at(0, N, j), at(1, N, j), at(1, N, j + 1), at(0, N, j + 1))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// the feed under the nib, with its comb of fins along the bottom
export function feedGeometry() {
  const s = new THREE.Shape()
  s.moveTo(4.3, 0.24)
  s.lineTo(5.6, 0.22)
  s.quadraticCurveTo(6.15, 0.18, 6.32, 0.07)
  s.quadraticCurveTo(6.36, -0.02, 6.25, -0.03)
  s.lineTo(5.6, -0.18)
  s.lineTo(5.48, -0.25)
  for (let x = 5.48; x > 4.56; x -= 0.115) {
    s.lineTo(x, -0.38)
    s.lineTo(x - 0.06, -0.38)
    s.lineTo(x - 0.06, -0.27)
    s.lineTo(x - 0.115, -0.27)
  }
  s.lineTo(4.3, -0.4)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8 })
  g.translate(0, 0, -0.15)
  return g
}

// the clip, lying along the cap's top (+y) from its ring to a rounded tip
export const CLIP = { root: 6.02, tip: 1.62 }
function clipGap(x) {
  if (x > 5.55) return 0.075 * (1 - (x - 5.55) / (CLIP.root - 5.55)) - 0.03
  return 0.045 + 0.03 * ((x - CLIP.tip) / (5.55 - CLIP.tip))
}
export function clipGeometry() {
  const T = 0.06
  const hz = (x) => 0.095 + (0.135 - 0.095) * ((x - CLIP.tip) / (CLIP.root - CLIP.tip))
  const s = new THREE.Shape()
  const xs = []
  for (let x = CLIP.root; x > CLIP.tip + 0.01; x -= 0.12) xs.push(x)
  s.moveTo(CLIP.root, -hz(CLIP.root))
  for (const x of xs) s.lineTo(x, -hz(x))
  s.absarc(CLIP.tip, 0, hz(CLIP.tip), -Math.PI / 2, Math.PI / 2, true)
  for (const x of [...xs].reverse()) s.lineTo(x, hz(x))
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2, curveSegments: 16 })
  g.rotateX(Math.PI / 2) // shape y -> z, depth -> -y
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const xc = Math.min(Math.max(x, CLIP.tip), CLIP.root)
    p.setY(i, p.getY(i) + T + capRadius(xc) + clipGap(xc))
  }
  g.computeVertexNormals()
  return g
}
export const clipBall = () => ({ x: CLIP.tip + 0.02, y: capRadius(CLIP.tip) + clipGap(CLIP.tip) + 0.02 })

// a helical thread round the spindle
class Helix extends THREE.Curve {
  constructor(r, x0, x1, pitch, phase) {
    super()
    Object.assign(this, { r, x0, x1, pitch, phase })
  }
  getPoint(t, out = new THREE.Vector3()) {
    const x = this.x0 + (this.x1 - this.x0) * t
    const a = this.phase + ((x - this.x0) / this.pitch) * Math.PI * 2
    return out.set(x, this.r * Math.cos(a), this.r * Math.sin(a))
  }
}
export function threadGeometries() {
  const pitch = (PISTON.front - PISTON.back) / TURNS
  return [0, 1, 2].map((k) => new THREE.TubeGeometry(new Helix(SPINDLE.r, SPINDLE.x0, SPINDLE.x1, pitch, (k * Math.PI * 2) / 3), 120, 0.032, 6, false))
}

export function makeGeometry() {
  return {
    knob: lathe(KNOB),
    knobRingA: lathe(band(-5.47, -5.41, 0.715)),
    knobRingB: lathe(band(-5.66, -5.62, 0.71)),
    barrel: lathe(BARREL),
    window: lathe(WINDOW, 72),
    barrelFront: lathe(BARREL_FRONT),
    frontRing: lathe(band(2.47, 2.555, 0.797)),
    section: lathe(sectionProfile(), 72),
    sectionRing: lathe(SECTION_RING),
    sectionFace: lathe(SECTION_FACE, 48),
    nib: nibGeometry(),
    feed: feedGeometry(),
    capShell: lathe(CAP_SHELL),
    capBandA: lathe(band(0.3, 0.5, 0.838)),
    capBandB: lathe(band(0.6, 0.665, 0.838)),
    capRing: lathe(band(5.85, 6.07, 0.735)),
    capTop: lathe(CAP_TOP),
    capDiscRing: lathe([[6.52, 0.36], [6.545, 0.355], [6.565, 0.32], [6.568, 0.27]]),
    capDisc: lathe(CAP_DISC, 48),
    clip: clipGeometry(),
    clipBall: new THREE.SphereGeometry(0.105, 20, 12),
    // the works
    head: new THREE.CylinderGeometry(0.57, 0.57, PISTON.half * 2, 40).rotateZ(Math.PI / 2),
    seal: new THREE.TorusGeometry(0.575, 0.03, 8, 40).rotateY(Math.PI / 2),
    ink: new THREE.CylinderGeometry(0.585, 0.585, 1, 40, 1, true).rotateZ(Math.PI / 2),
    inkCap: new THREE.CircleGeometry(0.585, 40).rotateY(-Math.PI / 2),
    tube: new THREE.CylinderGeometry(0.22, 0.22, 1, 24).rotateZ(Math.PI / 2),
    tubeOuter: new THREE.CylinderGeometry(0.27, 0.27, 1, 24).rotateZ(Math.PI / 2),
    spindle: new THREE.CylinderGeometry(SPINDLE.r - 0.02, SPINDLE.r - 0.02, SPINDLE.x1 - SPINDLE.x0, 20).rotateZ(Math.PI / 2).translate((SPINDLE.x0 + SPINDLE.x1) / 2, 0, 0),
    threads: threadGeometries(),
    channel: new THREE.CylinderGeometry(0.07, 0.07, 2.1, 12).rotateZ(Math.PI / 2).translate(3.35, 0, 0),
    drop: new THREE.SphereGeometry(0.07, 12, 8),
  }
}

// ---- collision spheres (frame-local centre, radius, mass) ----
const S = (x, y, z, r, m) => ({ c: new THREE.Vector3(x, y, z), r, m })
export function penSpheres() {
  const out = [
    [-6.0, 0, 0.64], [-5.1, 0, 0.7], [-4.2, 0, 0.74], [-3.3, 0, 0.765], [-2.4, 0, 0.78], [-1.5, 0, 0.79], [-0.6, 0, 0.8], [0.3, 0, 0.8], [1.2, 0, 0.795], [2.1, 0, 0.79],
    [2.9, 0, 0.71], [3.6, 0, 0.665], [4.2, 0, 0.6], [4.8, 0.02, 0.43], [5.4, 0.12, 0.3], [5.95, 0.12, 0.22], [6.45, 0.09, 0.13], [6.85, 0.06, 0.07], [7.02, 0.04, 0.04],
  ].map(([x, y, r]) => S(x, y, 0, r, 0))
  // about 23 g, spread like the material: heavier where it is wider
  const total = out.reduce((a, s) => a + s.r * s.r, 0)
  out.forEach((s) => (s.m = (23 * s.r * s.r) / total))
  return out
}
export const NIB_TIP_LOCAL = new THREE.Vector3(7.04, 0.035, 0)
export function capSpheres() {
  const ball = clipBall()
  const body = [[0.75, 0.82], [1.7, 0.83], [2.65, 0.825], [3.6, 0.81], [4.55, 0.78], [5.45, 0.72], [6.05, 0.6]].map(([x, r]) => S(x, 0, 0, r, 1.1))
  const clip = [S(ball.x, ball.y, 0, 0.11, 0.25), S(3.5, capRadius(3.5) + 0.11, 0, 0.1, 0.25), S(5.3, capRadius(5.3) + 0.1, 0, 0.1, 0.3)]
  return [...body, ...clip]
}

// ---- textures ----
const NIB_W = 1024
const NIB_H = Math.round((NIB_W * (2 * NIB_V)) / (NIB_TIP - NIB0))
// finish: two-tone | gold | rhodium. gold: the gold's colour.
export function nibTexture(finish, gold) {
  const c = Object.assign(document.createElement('canvas'), { width: NIB_W, height: NIB_H })
  const g = c.getContext('2d')
  const k = NIB_W / (NIB_TIP - NIB0)
  const X = (u) => (u - NIB0) * k
  const Y = (v) => (NIB_V - v) * k
  const silver = '#e6e9ee'
  g.fillStyle = finish === 'rhodium' ? silver : gold
  g.fillRect(0, 0, NIB_W, NIB_H)
  // the outline, inset, so the decoration follows the nib's edge
  const outline = (inset, u0, u1) => {
    g.beginPath()
    for (let u = u0; u <= u1; u += 0.02) g.lineTo(X(u), Y(Math.max(0, nibHalfWidth(u) - inset)))
    for (let u = u1; u >= u0; u -= 0.02) g.lineTo(X(u), Y(-Math.max(0, nibHalfWidth(u) - inset)))
    g.closePath()
  }
  if (finish === 'two-tone') {
    // a plated centre panel that runs out towards the tip
    g.fillStyle = silver
    outline(0.1, 5.05, 6.72)
    g.fill()
    g.fillStyle = gold
    outline(0.19, 5.18, 5.9)
    g.fill()
  }
  // engraved line round the edge, and scrollwork on the shoulders
  g.strokeStyle = 'rgba(60, 40, 12, 0.55)'
  g.lineWidth = 2
  outline(0.05, 4.62, 6.78)
  g.stroke()
  g.lineWidth = 1.6
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const u = 4.85 + i * 0.22
      const v = side * (0.28 - i * 0.05)
      g.beginPath()
      g.arc(X(u), Y(v), 10 + i * 2, 0, Math.PI * 1.6, side < 0)
      g.stroke()
      g.beginPath()
      g.moveTo(X(u) + 10, Y(v))
      g.quadraticCurveTo(X(u + 0.15), Y(v * 0.6), X(u + 0.3), Y(v * 0.75))
      g.stroke()
    }
  }
  // generic hallmarks and the nib size
  g.fillStyle = 'rgba(60, 40, 12, 0.7)'
  g.font = '600 34px Georgia, serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('18K', X(4.78), Y(0.06))
  g.font = '500 24px Georgia, serif'
  g.fillText('750', X(4.78), Y(-0.08))
  g.font = 'italic 600 30px Georgia, serif'
  g.fillText('M', X(5.3), Y(0))
  // breather hole and slit
  g.fillStyle = '#060606'
  g.beginPath()
  g.arc(X(5.64), Y(0), 0.048 * k, 0, Math.PI * 2)
  g.fill()
  g.fillRect(X(5.64), Y(0) - 3, X(NIB_TIP) - X(5.64), 6)
  // tipping pellet
  g.fillStyle = '#bfc4cb'
  g.fillRect(X(6.96), 0, NIB_W, NIB_H)
  g.fillStyle = '#060606'
  g.fillRect(X(6.96), Y(0) - 3, NIB_W, 6)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// fine ribbing for the ink window and threads (a bump map along the axis)
export function ribTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 8, height: 128 })
  const g = c.getContext('2d')
  for (let y = 0; y < 128; y++) {
    const v = 128 + 120 * Math.sin((y / 128) * Math.PI * 2 * 14)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 8, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// A ruled sheet the pen writes on. Returns the canvas so ink can be drawn on it.
export const PAPER = { w: 29.7, h: 21 }
export function createPaper() {
  const W = 2048
  const H = Math.round((W * PAPER.h) / PAPER.w)
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  const k = W / PAPER.w
  const clear = () => {
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    g.fillStyle = '#f7f4ec'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(120,110,90,${Math.random() * 0.05})`
      g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1)
    }
    g.strokeStyle = 'rgba(80, 125, 200, 0.28)'
    g.lineWidth = 2
    for (let z = 2.4; z < PAPER.h - 0.6; z += 0.8) {
      g.beginPath()
      g.moveTo(0, z * k)
      g.lineTo(W, z * k)
      g.stroke()
    }
    g.strokeStyle = 'rgba(210, 70, 70, 0.4)'
    g.beginPath()
    g.moveTo(3 * k, 0)
    g.lineTo(3 * k, H)
    g.stroke()
  }
  clear()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  // world (x, z) on the sheet to canvas pixels
  const px = (x, z) => [(x + PAPER.w / 2) * k, (z + PAPER.h / 2) * k]
  return {
    tex,
    clear() {
      clear()
      tex.needsUpdate = true
    },
    stroke(x0, z0, x1, z1, color, width) {
      const [a, b] = px(x0, z0)
      const [cc, d] = px(x1, z1)
      g.globalAlpha = 0.88
      g.strokeStyle = color
      g.lineCap = 'round'
      g.lineWidth = width * k
      g.beginPath()
      g.moveTo(a, b)
      g.lineTo(cc, d)
      g.stroke()
      g.globalAlpha = 1
    },
    blot(x, z, color, size) {
      const [a, b] = px(x, z)
      g.fillStyle = color
      g.globalAlpha = 0.85
      const r = size * k
      g.beginPath()
      for (let i = 0; i <= 20; i++) {
        const t = (i / 20) * Math.PI * 2
        const rr = r * (0.82 + Math.random() * 0.3)
        g.lineTo(a + Math.cos(t) * rr, b + Math.sin(t) * rr)
      }
      g.fill()
      for (let i = 0; i < 5; i++) {
        const t = Math.random() * Math.PI * 2
        const d = r * (1.3 + Math.random() * 1.2)
        g.beginPath()
        g.arc(a + Math.cos(t) * d, b + Math.sin(t) * d, r * (0.08 + Math.random() * 0.16), 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    },
    dispose() {
      tex.dispose()
    },
  }
}

export const TRIMS = { gold: '#e2b45e', rose: '#e8a98d', platinum: '#d9dde3' }
