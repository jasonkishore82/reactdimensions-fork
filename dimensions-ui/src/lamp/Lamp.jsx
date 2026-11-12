import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A balanced-arm desk lamp. 1 unit is about 10 cm. A weighted base carries a
// turret that turns; the turret's two plates hold the shoulder bolt; the lower
// arm (a pair of rods) runs to the elbow bolt, where the upper arm's wider pair
// of rods straddles it; the shade hangs on the head bolt between the upper
// rods. Two springs, anchored on the turret and the arms, stretch as the joints
// open. A real spotlight inside the shade lights the desk.
//
// Posing is two-link geometry: drag an arm and the head joint follows the
// pointer, the elbow found from the two arm lengths (elbow up, like the real
// thing). The joints don't jump there: each is a damped spring with inertia,
// so the arm overshoots a little and settles when you let go, and the shade
// swings on its hinge as the head moves. Every step is checked before it is
// taken (shade and arms against the desk, the base, the other arm and the
// power strip); a joint that would collide stops at the contact and bounces
// slightly, while the others carry on, so the arm slides along obstacles.

const BASE_R = 1.3
const BASE_H = 0.3
const SHOULDER_Y = 0.85 // shoulder bolt height
const LOWER = 3.6
const UPPER = 3.4
const LOWER_Z = 0.11 // lower rods either side of the centre plane
const UPPER_Z = 0.2 // upper rods, outside the lower ones
const SHADE = { top: 0.36, mouth: 1.0, depth: 1.3, neck: 0.45 }
// the cap's centre and the mouth, measured down the shade's axis from the head bolt
const CAP_C = SHADE.neck + SHADE.top
const MOUTH = CAP_C + SHADE.depth
const LIMITS = { lower: [-0.7, 1.05], tiltMin: -0.45, tiltMax: 1.45 }
// the power strip on the desk (world space), and the socket the lamp is plugged into
const STRIP = { x: -3.8, z: 2.6, len: 3.2, w: 0.8, h: 0.35 }
const PLUG = { x: STRIP.x + 0.9, z: STRIP.z, top: STRIP.h + 0.62 }

// Coils along +y, unit length: scaled along y to span between two anchors,
// so the coils open up as the spring stretches.
function helixGeometry(coils = 16, radius = 0.075, wire = 0.022) {
  const pts = []
  const n = coils * 16
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = t * coils * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t, Math.sin(a) * radius))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 6, false)
}

// Shoulder and elbow angles (from straight up, positive leaning forward) that
// put the head joint at (x, y) in the arm's plane.
function solve(x, y, L1, L2) {
  const px = x
  const py = y - SHOULDER_Y
  let d = Math.hypot(px, py)
  d = THREE.MathUtils.clamp(d, Math.abs(L1 - L2) + 0.3, L1 + L2 - 0.05)
  const phi = Math.atan2(px, py)
  const alpha = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
  const a1 = THREE.MathUtils.clamp(phi - alpha, LIMITS.lower[0], LIMITS.lower[1]) // elbow up and back
  const ex = L1 * Math.sin(a1)
  const ey = SHOULDER_Y + L1 * Math.cos(a1)
  const tx = ex + (x - ex) // aim the upper arm at the target from wherever the elbow ended up
  const ty = ey + (y - ey)
  const a2 = Math.atan2(tx - ex, ty - ey)
  return { a1, a2 }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// The shade's outline in its own plane (x across, y up; the axis points down
// from the bolt), used for collision tests: the cap, then down one side,
// across the mouth and up the other.
const SHADE_OUTLINE = (() => {
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const f = -Math.PI / 2 + (i / 8) * Math.PI
    pts.push([SHADE.top * Math.sin(f), -CAP_C + SHADE.top * Math.cos(f)])
  }
  for (let i = 1; i <= 6; i++) {
    const d = (i / 6) * SHADE.depth
    pts.push([SHADE.top + (SHADE.mouth + 0.035 - SHADE.top) * (i / 6), -CAP_C - d])
  }
  for (let i = 1; i < 6; i++) pts.push([(SHADE.mouth + 0.035) * (1 - (2 * i) / 6), -MOUTH])
  for (let i = 6; i >= 1; i--) {
    const d = (i / 6) * SHADE.depth
    pts.push([-(SHADE.top + (SHADE.mouth + 0.035 - SHADE.top) * (i / 6)), -CAP_C - d])
  }
  return pts
})()

// distance between segments p1-p2 and q1-q2 (2D)
function segDist(p1x, p1y, p2x, p2y, q1x, q1y, q2x, q2y) {
  const ptSeg = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    const t = THREE.MathUtils.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    return Math.hypot(px - ax - t * dx, py - ay - t * dy)
  }
  const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  const d1 = cross(q1x, q1y, q2x, q2y, p1x, p1y)
  const d2 = cross(q1x, q1y, q2x, q2y, p2x, p2y)
  const d3 = cross(p1x, p1y, p2x, p2y, q1x, q1y)
  const d4 = cross(p1x, p1y, p2x, p2y, q2x, q2y)
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0
  return Math.min(ptSeg(p1x, p1y, q1x, q1y, q2x, q2y), ptSeg(p2x, p2y, q1x, q1y, q2x, q2y), ptSeg(q1x, q1y, p1x, p1y, p2x, p2y), ptSeg(q2x, q2y, p1x, p1y, p2x, p2y))
}

function insidePoly(px, py, poly) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// Is a point in the arm plane at (x, y), turned with the turret by yaw, inside
// the power strip or the plug standing in it (grown by a margin)?
function hitsStrip(x, y, yaw, m) {
  const wx = x * Math.cos(yaw)
  const wz = -x * Math.sin(yaw)
  if (y < STRIP.h + m && Math.abs(wx - STRIP.x) < STRIP.len / 2 + m && Math.abs(wz - STRIP.z) < STRIP.w / 2 + m) return true
  return y < PLUG.top + 0.4 + m && Math.hypot(wx - PLUG.x, wz - PLUG.z) < 0.5 + m
}

// Is this pose free of collisions? a1, a2: arm angles from straight up; tilt:
// the shade's angle from straight down (positive swings it forward).
function poseOk(a1, a2, tilt, yaw, L1, L2) {
  if (a1 < LIMITS.lower[0] - 1e-6 || a1 > LIMITS.lower[1] + 1e-6) return false
  if (tilt < LIMITS.tiltMin - 1e-6 || tilt > LIMITS.tiltMax + 1e-6) return false
  // the arms can fold, but not flat onto each other
  if (Math.abs(wrap(a2 - a1)) > Math.PI - 0.35) return false
  // the shade can't swing into its own upper arm (the rods run back from the bolt)
  if (Math.abs(wrap(tilt + a2)) < 0.62) return false
  const sx = 0
  const sy = SHOULDER_Y
  const ex = L1 * Math.sin(a1)
  const ey = SHOULDER_Y + L1 * Math.cos(a1)
  const hx = ex + L2 * Math.sin(a2)
  const hy = ey + L2 * Math.cos(a2)
  if (ey < 0.25 || hy < 0.3) return false
  // upper arm: above the desk, the base and the strip
  for (let i = 0; i <= 6; i++) {
    const x = ex + ((hx - ex) * i) / 6
    const y = ey + ((hy - ey) * i) / 6
    if (y < 0.1) return false
    if (Math.abs(x) < BASE_R + 0.06 && y < BASE_H + 0.1) return false
    if (hitsStrip(x, y, yaw, 0.08)) return false
  }
  // the shade, placed in the arm plane
  const c = Math.cos(tilt)
  const s = Math.sin(tilt)
  const poly = SHADE_OUTLINE.map(([x, y]) => [hx + x * c - y * s, hy + x * s + y * c])
  for (const [x, y] of poly) {
    if (y < 0.04) return false // the desk
    if (Math.abs(x) < BASE_R + 0.06 && y < BASE_H + 0.06) return false // the base
    if (Math.abs(x) < 0.5 && y < SHOULDER_Y + 0.28) return false // the turret and shoulder plates
    if (hitsStrip(x, y, yaw, 0.15)) return false
  }
  // the lower arm must not pass through the shade
  if (insidePoly(ex, ey, poly) || insidePoly(sx, sy, poly)) return false
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[(i + 1) % poly.length]
    if (segDist(sx, sy, ex, ey, ax, ay, bx, by) < 0.09) return false
  }
  return true
}

function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  return [
    v,
    (next) => {
      setV(next)
      onChange?.({ [key]: next })
    },
  ]
}

// bodyColor: the paint. lightColor, brightness: the bulb. armLength: scales
// both arms. on: the light (click the switch on the base). Drag an arm to move
// the head, the shade to tilt it, the base to turn the lamp.
export default function Lamp({
  bodyColor = '#1f5f74',
  lightColor = '#ffd9a3',
  brightness = 0.8,
  armLength = 1,
  on: onProp = true,
  onChange,
}) {
  const [on, setOn] = useTwoWay(onProp, 'on', onChange)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(null)
  useCursor(hover || !!dragging, dragging ? 'grabbing' : 'grab')
  const { camera, controls } = useThree()
  const L1 = LOWER * armLength
  const L2 = UPPER * armLength

  const geo = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(BASE_R, BASE_R + 0.08, BASE_H, 64),
      baseTop: new THREE.CylinderGeometry(BASE_R - 0.15, BASE_R, 0.06, 64),
      turret: new THREE.CylinderGeometry(0.32, 0.36, 0.3, 32),
      plate: new THREE.BoxGeometry(0.42, 0.62, 0.04),
      lever: new THREE.BoxGeometry(0.5, 0.1, 0.1),
      bolt: new THREE.CylinderGeometry(0.07, 0.07, 1, 16).rotateX(Math.PI / 2),
      boltHead: new THREE.CylinderGeometry(0.11, 0.11, 0.05, 6).rotateX(Math.PI / 2),
      rod: new THREE.CylinderGeometry(0.045, 0.045, 1, 12).translate(0, 0.5, 0),
      spring: helixGeometry(),
      shade: new THREE.CylinderGeometry(SHADE.top, SHADE.mouth, SHADE.depth, 48, 1, true).translate(0, -CAP_C - SHADE.depth / 2, 0),
      shadeCap: new THREE.SphereGeometry(SHADE.top, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, -CAP_C, 0),
      shadeRim: new THREE.TorusGeometry(SHADE.mouth, 0.035, 8, 48).rotateX(Math.PI / 2).translate(0, -MOUTH, 0),
      // the knuckle sits on the head bolt between the upper rods; the neck runs
      // from it down into the top of the shade's cap, where a collar holds it
      knuckle: new THREE.BoxGeometry(0.24, 0.28, 2 * UPPER_Z - 0.05).translate(0, -0.03, 0),
      neck: new THREE.CylinderGeometry(0.075, 0.1, SHADE.neck - 0.08, 16).translate(0, -0.12 - (SHADE.neck - 0.08) / 2, 0),
      collar: new THREE.CylinderGeometry(0.15, 0.17, 0.08, 24).translate(0, -SHADE.neck, 0),
      bulb: new THREE.SphereGeometry(0.22, 24, 16),
      // the bulb holder runs from the top of the cap down to the bulb's screw base
      socket: new THREE.CylinderGeometry(0.11, 0.13, SHADE.top + 0.14, 16).translate(0, -SHADE.neck - (SHADE.top + 0.14) / 2, 0),
      button: new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24),
      tab: new THREE.BoxGeometry(1, 0.08, 0.02),
      // an invisible, fatter arm so it is easy to take hold of
      grip: new THREE.CylinderGeometry(0.3, 0.3, 1, 12).translate(0, 0.5, 0),
    }),
    [],
  )
  // the cord: out of the grommet at the back of the base, along the desk, and
  // up into the top of the plug in the power strip
  const cableGeo = useMemo(() => {
    const P = (x, y, z) => new THREE.Vector3(x, y, z)
    const pts = [
      P(-BASE_R + 0.02, 0.13, 0),
      P(-BASE_R - 0.12, 0.1, 0.02),
      P(-BASE_R - 0.35, 0.046, 0.12),
      P(-1.8, 0.046, 0.7),
      P(-2.15, 0.046, 1.45),
      P(-2.45, 0.046, 1.75),
      P(PLUG.x + 0.2, 0.3, 1.88),
      P(PLUG.x + 0.12, 0.9, 2.12),
      P(PLUG.x + 0.02, PLUG.top + 0.3, PLUG.z - 0.12),
      P(PLUG.x, PLUG.top, PLUG.z), // into the boot
    ]
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 140, 0.045, 8, false)
  }, [])
  const mats = useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({ metalness: 0.3, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      inside: new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.5, side: THREE.BackSide }),
      chrome: new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.2 }),
      steel: new THREE.MeshStandardMaterial({ color: '#8a9097', metalness: 0.9, roughness: 0.35 }),
      black: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.7 }),
      bulb: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffd9a3', emissiveIntensity: 0, roughness: 0.2 }),
      button: new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.45 }),
      grip: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  )
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      cableGeo.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, cableGeo, mats],
  )
  useEffect(() => {
    mats.paint.color.set(bodyColor)
    mats.bulb.emissive.set(lightColor)
  }, [mats, bodyColor, lightColor])

  // ---- pose ----
  const st = useRef({
    yaw: 0.35,
    a1: -0.32,
    a2: 1.62,
    tilt: 0.55,
    v1: 0, // joint speeds
    v2: 0,
    vt: 0,
    t1: -0.32, // where the joints are being pulled to
    t2: 1.62,
    tt: 0.55,
    hvx: 0, // the head's speed, for the shade's swing
    light: onProp ? 1 : 0,
    press: 0,
  })
  const live = useRef({})
  live.current = { on, brightness, lightColor, L1, L2 }
  const drag = useRef(null) // { kind, x0, y0, yaw0, tilt0 }

  const yawRef = useRef()
  const lowerRef = useRef()
  const upperRef = useRef()
  const headRef = useRef()
  const spring1 = useRef()
  const spring2 = useRef()
  const lightRef = useRef()
  const targetRef = useRef()
  const buttonRef = useRef()
  useEffect(() => {
    lightRef.current.target = targetRef.current
  }, [])

  useEffect(() => {
    const up = () => {
      // let go: the joints spring back to where they were released, carrying
      // their speed, so the arm overshoots and settles
      const s = st.current
      if (drag.current) {
        s.t1 = s.a1
        s.t2 = s.a2
        s.tt = s.tilt
      }
      drag.current = null
      setDragging(null)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  const grab = (kind) => (e) => {
    e.stopPropagation()
    const s = st.current
    drag.current = { kind, x0: e.clientX, y0: e.clientY, yaw0: s.yaw, tilt0: s.tilt }
    setDragging(kind)
    if (controls) controls.enabled = false
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const s = st.current
    if (d.kind === 'base') {
      // turn only as far as the shade and arms stay clear of the power strip
      const w = live.current
      const yaw = d.yaw0 + (e.clientX - d.x0) * 0.01
      if (poseOk(s.a1, s.a2, s.tilt, yaw, w.L1, w.L2)) s.yaw = yaw
    }
    if (d.kind === 'shade') s.tt = THREE.MathUtils.clamp(d.tilt0 - (e.clientY - d.y0) * 0.01, LIMITS.tiltMin, LIMITS.tiltMax) // drag up to swing it forward
  }
  useEffect(() => {
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  })

  const plane = useMemo(() => new THREE.Plane(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const nrm = useMemo(() => new THREE.Vector3(), [])
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  // place a spring between two points given in the arm plane (x forward, y up)
  const span = (mesh, ax, ay, bx, by) => {
    tmpA.set(ax, ay, 0)
    tmpB.set(bx - ax, by - ay, 0)
    const len = tmpB.length()
    mesh.position.copy(tmpA)
    mesh.quaternion.setFromUnitVectors(Y, tmpB.normalize())
    mesh.scale.set(1, len, 1)
  }

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const w = live.current

    // dragging an arm: the head joint follows the pointer in the arm's plane
    if (drag.current?.kind === 'arm') {
      const g = yawRef.current
      g.updateMatrixWorld()
      nrm.set(0, 0, 1).transformDirection(g.matrixWorld)
      hit.setFromMatrixPosition(g.matrixWorld)
      plane.setFromNormalAndCoplanarPoint(nrm, hit)
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        g.worldToLocal(hit)
        // the joints are pulled towards this pose; collisions are handled below
        const sol = solve(hit.x, Math.max(hit.y, 0.4), w.L1, w.L2)
        s.t1 = sol.a1
        s.t2 = sol.a2
      }
    }

    // physics, in small steps: each joint is a damped spring towards its
    // target. A joint's step is kept only if the pose stays collision-free;
    // otherwise it stops at the contact with a small bounce.
    const N = dt > 1e-5 ? 4 : 0 // the first frame can have no time step
    const h = dt / 4
    const K = 170
    const C = 2 * 0.62 * Math.sqrt(K) // a little under critical: one soft overshoot
    const KT = 70
    const CT = 2 * 0.3 * Math.sqrt(KT) // the shade swings more freely on its hinge
    for (let i = 0; i < N; i++) {
      const hx0 = w.L1 * Math.sin(s.a1) + w.L2 * Math.sin(s.a2)

      s.v1 += (K * (s.t1 - s.a1) - C * s.v1) * h
      const n1 = s.a1 + s.v1 * h
      if (poseOk(n1, s.a2, s.tilt, s.yaw, w.L1, w.L2)) s.a1 = n1
      else s.v1 *= -0.15

      s.v2 += (K * wrap(s.t2 - s.a2) - C * s.v2) * h
      const n2 = s.a2 + s.v2 * h
      if (poseOk(s.a1, n2, s.tilt, s.yaw, w.L1, w.L2)) s.a2 = n2
      else s.v2 *= -0.15

      // the head's sideways acceleration swings the shade, a pendulum on a stiff hinge
      const hvx = (w.L1 * Math.sin(s.a1) + w.L2 * Math.sin(s.a2) - hx0) / h
      const ax = (hvx - s.hvx) / h
      s.hvx = hvx
      const swing = drag.current?.kind === 'shade' ? 0 : THREE.MathUtils.clamp(-ax * 0.06, -30, 30)
      s.vt += (KT * (s.tt - s.tilt) - CT * s.vt + swing) * h
      const nt = THREE.MathUtils.clamp(s.tilt + s.vt * h, LIMITS.tiltMin, LIMITS.tiltMax)
      if (poseOk(s.a1, s.a2, nt, s.yaw, w.L1, w.L2)) s.tilt = nt
      else s.vt *= -0.2
    }
    // a target that can't be reached: once let go, stop straining towards it
    if (!drag.current) {
      s.t1 += (s.a1 - s.t1) * Math.min(1, dt * 0.8)
      s.t2 += (s.a2 - s.t2) * Math.min(1, dt * 0.8)
      s.tt += (s.tilt - s.tt) * Math.min(1, dt * 0.8)
    }

    yawRef.current.rotation.y = s.yaw
    lowerRef.current.rotation.z = -s.a1
    // the upper arm hangs off the elbow at its absolute angle
    upperRef.current.position.set(w.L1 * Math.sin(s.a1), SHOULDER_Y + w.L1 * Math.cos(s.a1), 0)
    upperRef.current.rotation.z = -s.a2
    headRef.current.position.set(0, w.L2, 0)
    // the shade keeps its own tilt from straight down, whatever the arm does
    // (it hangs from the upper arm, so undo that arm's angle first)
    headRef.current.rotation.z = s.a2 + s.tilt

    // springs: shoulder spring from the turret lever to the lower arm; elbow
    // spring from the lower arm to the upper arm, both on the back side
    const ex = w.L1 * Math.sin(s.a1)
    const ey = SHOULDER_Y + w.L1 * Math.cos(s.a1)
    const back1 = [-Math.cos(s.a1), Math.sin(s.a1)] // perpendicular to the lower arm, to the back
    const back2 = [-Math.cos(s.a2), Math.sin(s.a2)]
    span(spring1.current, -0.3, SHOULDER_Y - 0.28, 1.5 * Math.sin(s.a1) + back1[0] * 0.17, SHOULDER_Y + 1.5 * Math.cos(s.a1) + back1[1] * 0.17)
    span(spring2.current, ex - 0.7 * Math.sin(s.a1) + back1[0] * 0.32, ey - 0.7 * Math.cos(s.a1) + back1[1] * 0.32, ex + 0.95 * Math.sin(s.a2) + back2[0] * 0.32, ey + 0.95 * Math.cos(s.a2) + back2[1] * 0.32)

    // the light: the bulb glows, the spot lights the desk
    s.light += ((w.on ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 14))
    lightRef.current.intensity = s.light * w.brightness * 70
    lightRef.current.color.set(w.lightColor)
    mats.bulb.emissiveIntensity = s.light * (0.6 + w.brightness * 2.4)
    s.press = Math.max(0, s.press - dt * 6)
    buttonRef.current.position.y = BASE_H + 0.06 - Math.sin(Math.min(1, s.press) * Math.PI) * 0.035
  })

  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }

  const rods = (len, z, mat) => [
    ...[-z, z].map((zz) => <mesh key={zz} geometry={geo.rod} material={mat} position={[0, 0, zz]} scale={[1, len, 1]} castShadow />),
    <mesh key="grip" geometry={geo.grip} material={mats.grip} scale={[1, len, 1]} />,
  ]

  return (
    <group>
      {/* base, switch and cable */}
      <mesh geometry={geo.base} material={mats.paint} position-y={BASE_H / 2} castShadow receiveShadow onPointerDown={grab('base')} {...hoverProps} />
      <mesh geometry={geo.baseTop} material={mats.steel} position-y={BASE_H + 0.03} receiveShadow onPointerDown={grab('base')} {...hoverProps} />
      <mesh
        ref={buttonRef}
        geometry={geo.button}
        material={mats.button}
        position={[0.85, BASE_H + 0.06, 0.55]}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          st.current.press = 1
          setOn(!on)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      />
      <mesh geometry={cableGeo} material={mats.black} castShadow />
      {/* rubber grommet where the cord leaves the base */}
      <mesh material={mats.black} position={[-BASE_R + 0.02, 0.13, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.085, 0.085, 0.12, 16]} />
      </mesh>
      <PowerStrip />

      {/* everything above the base turns with the turret */}
      <group ref={yawRef}>
        <mesh geometry={geo.turret} material={mats.steel} position-y={BASE_H + 0.06 + 0.15} castShadow onPointerDown={grab('base')} {...hoverProps} />
        {/* two plates hold the shoulder bolt; the spring lever sticks out behind */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.plate} material={mats.steel} position={[0, SHOULDER_Y - 0.12, s * (LOWER_Z + 0.08)]} castShadow />
        ))}
        <mesh geometry={geo.lever} material={mats.steel} position={[-0.2, SHOULDER_Y - 0.28, 0]} />
        <mesh geometry={geo.bolt} material={mats.chrome} position-y={SHOULDER_Y} scale={[1, 1, 2 * (LOWER_Z + 0.12)]} />

        {/* lower arm: a pair of rods from the shoulder bolt to the elbow bolt */}
        <group ref={lowerRef} position-y={SHOULDER_Y} onPointerDown={grab('arm')} {...hoverProps}>
          {rods(L1, LOWER_Z, mats.paint)}
          {/* spring pins, on tabs behind the rods: the shoulder spring's top, the elbow spring's bottom */}
          {[
            [0.17, 1.5],
            [0.32, L1 - 0.7],
          ].map(([off, along]) => (
            <SpringPin key={along} off={off} along={along} z={LOWER_Z} geo={geo} mats={mats} />
          ))}
        </group>

        {/* upper arm: a wider pair that straddles the lower arm at the elbow */}
        <group ref={upperRef}>
          <mesh geometry={geo.bolt} material={mats.chrome} scale={[1, 1, 2 * UPPER_Z + 0.08]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.boltHead} material={mats.chrome} position-z={s * (UPPER_Z + 0.04)} />
          ))}
          <group onPointerDown={grab('arm')} {...hoverProps}>
            {rods(L2, UPPER_Z, mats.paint)}
            <SpringPin off={0.32} along={0.95} z={UPPER_Z} geo={geo} mats={mats} />
          </group>

          {/* head: the shade hangs on its bolt between the upper rods */}
          <group ref={headRef}>
            <mesh geometry={geo.bolt} material={mats.chrome} scale={[1, 1, 2 * UPPER_Z + 0.08]} />
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={geo.boltHead} material={mats.chrome} position-z={s * (UPPER_Z + 0.04)} />
            ))}
            <group onPointerDown={grab('shade')} {...hoverProps}>
              <mesh geometry={geo.knuckle} material={mats.steel} castShadow />
              <mesh geometry={geo.neck} material={mats.steel} castShadow />
              <mesh geometry={geo.collar} material={mats.steel} />
              <mesh geometry={geo.shadeCap} material={mats.paint} castShadow />
              {/* the cap's lining, so looking into the shade you see its closed top */}
              <mesh geometry={geo.shadeCap} material={mats.inside} />
              <mesh geometry={geo.shade} material={mats.paint} castShadow />
              <mesh geometry={geo.shade} material={mats.inside} />
              <mesh geometry={geo.shadeRim} material={mats.paint} />
            </group>
            <mesh geometry={geo.socket} material={mats.black} />
            <mesh geometry={geo.bulb} material={mats.bulb} position-y={-CAP_C - 0.3} />
            <spotLight ref={lightRef} position={[0, -CAP_C - 0.32, 0]} angle={0.62} penumbra={0.55} distance={22} decay={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} />
            <object3D ref={targetRef} position={[0, -CAP_C - 6, 0]} />
          </group>
        </group>
      </group>

      {/* springs are drawn in the turret's frame, between their anchors */}
      <group rotation-y={0}>
        <SpringFrame yawRef={yawRef}>
          <mesh ref={spring1} geometry={geo.spring} material={mats.chrome} castShadow />
          <mesh ref={spring2} geometry={geo.spring} material={mats.chrome} castShadow />
        </SpringFrame>
      </group>
    </group>
  )
}

// A power strip on the desk with the lamp's plug in the socket nearest the
// lamp: a face plate seated in the recess, a ribbed grip body and a
// strain-relief boot the cord comes out of. The strip's own lead runs off the
// desk.
function PowerStrip() {
  const lead = useMemo(() => {
    const P = (x, y, z) => new THREE.Vector3(x, y, z)
    const pts = [P(STRIP.x - STRIP.len / 2 + 0.02, 0.15, STRIP.z), P(STRIP.x - STRIP.len / 2 - 0.4, 0.05, STRIP.z + 0.1), P(-9, 0.05, STRIP.z + 1.2), P(-16, 0.05, STRIP.z + 1.6)]
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 80, 0.05, 8, false)
  }, [])
  const m = useMemo(
    () => ({
      white: new THREE.MeshStandardMaterial({ color: '#efede8', roughness: 0.45 }),
      recess: new THREE.MeshStandardMaterial({ color: '#d6d3cc', roughness: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.8 }),
      plug: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.55 }),
      led: new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: 1.6 }),
    }),
    [],
  )
  useEffect(
    () => () => {
      lead.dispose()
      Object.values(m).forEach((x) => x.dispose())
    },
    [lead, m],
  )
  return (
    <group>
      <group position={[STRIP.x, 0, STRIP.z]}>
        {/* the body, with rounded ends */}
        <mesh material={m.white} position-y={STRIP.h / 2} castShadow receiveShadow>
          <boxGeometry args={[STRIP.len - STRIP.w, STRIP.h, STRIP.w]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.white} position={[(s * (STRIP.len - STRIP.w)) / 2, STRIP.h / 2, 0]} castShadow>
            <cylinderGeometry args={[STRIP.w / 2, STRIP.w / 2, STRIP.h, 32]} />
          </mesh>
        ))}
        {/* round socket recesses, each with two pin holes */}
        {[-0.9, 0, 0.9].map((x) => (
          <group key={x} position={[x, STRIP.h, 0]}>
            <mesh material={m.recess} position-y={0.002}>
              <cylinderGeometry args={[0.3, 0.3, 0.01, 32]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} material={m.dark} position={[s * 0.1, 0.004, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.01, 12]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* rocker switch with its light */}
        <mesh material={m.white} position={[-1.45, STRIP.h + 0.04, 0]} rotation-z={0.15}>
          <boxGeometry args={[0.22, 0.08, 0.34]} />
        </mesh>
        <mesh material={m.led} position={[-1.45, STRIP.h + 0.085, 0]} rotation-z={0.15}>
          <boxGeometry args={[0.08, 0.01, 0.2]} />
        </mesh>
      </group>
      <mesh geometry={lead} material={m.white} castShadow />

      {/* the lamp's plug, standing in its socket */}
      <group position={[PLUG.x, STRIP.h, PLUG.z]}>
        <mesh material={m.plug} position-y={0.04}>
          <cylinderGeometry args={[0.27, 0.27, 0.06, 32]} />
        </mesh>
        <mesh material={m.plug} position-y={0.3} castShadow>
          <cylinderGeometry args={[0.17, 0.22, 0.46, 24]} />
        </mesh>
        {[0.2, 0.28, 0.36].map((y) => (
          <mesh key={y} material={m.plug} position-y={y} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.212 - (y - 0.07) * 0.1, 0.012, 6, 24]} />
          </mesh>
        ))}
        <mesh material={m.plug} position-y={PLUG.top - STRIP.h - 0.05}>
          <cylinderGeometry args={[0.07, 0.15, 0.2, 16]} />
        </mesh>
      </group>
    </group>
  )
}

// A pin behind an arm's pair of rods, held on two tabs, where a spring hooks on.
function SpringPin({ off, along, z, geo, mats }) {
  return (
    <group position={[-off, along, 0]}>
      <mesh geometry={geo.bolt} material={mats.chrome} scale={[0.6, 0.6, 2 * z + 0.02]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.tab} material={mats.steel} position={[off / 2, 0, s * z]} scale={[off + 0.06, 1, 1]} />
      ))}
    </group>
  )
}

// Keeps its children turned with the turret, so the springs share the arms' plane.
function SpringFrame({ yawRef, children }) {
  const ref = useRef()
  useFrame(() => {
    if (yawRef.current) ref.current.rotation.y = yawRef.current.rotation.y
  })
  return <group ref={ref}>{children}</group>
}
