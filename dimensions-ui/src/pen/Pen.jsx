import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { G, createBody, frameMatrix, pointVelocity, setFrame, setSpheres, step, toLocal, toWorld, wake } from './physics.js'
import { CAP, CHAMBER_FRONT, NIB_TIP, NIB_TIP_LOCAL, PAPER, PISTON, SPINDLE, TRIMS, TURNS, capSpheres, clipBall, createPaper, makeGeometry, nibTexture, penSpheres, ribTexture } from './parts.js'
import { createPenAudio } from './audio.js'

// A piston-filling fountain pen on a sheet of ruled paper, with real rigid-body
// physics (physics.js) and a working mechanism:
//
// - Pick it up anywhere and it hangs from that point, swinging and turning
//   under gravity; let go and it drops, bounces and rolls until the clip stops
//   it. Throw it and it slides and tumbles to a stop.
// - Click the cap: it unscrews (one and a quarter turns), pulls off and drops
//   onto the paper. Click it again and it flies back and posts on the end;
//   once more and it comes off the end and screws back on over the nib.
// - Drag across the knob at the back to turn it: a spindle drives the piston
//   along the barrel, and the ink window shows ink or the piston head. Turn it
//   to empty with the cap off and ink drips from the nib onto the paper.
// - Drag the pen by its back end with the cap off and the nib trails on the
//   paper and writes. Double-click the paper for a clean sheet.

export const ARENA = { x: 13.4, z: 9 }
const PLANES = [
  { n: new THREE.Vector3(0, 1, 0), d: 0, floor: true },
  { n: new THREE.Vector3(1, 0, 0), d: -ARENA.x },
  { n: new THREE.Vector3(-1, 0, 0), d: -ARENA.x },
  { n: new THREE.Vector3(0, 0, 1), d: -ARENA.z },
  { n: new THREE.Vector3(0, 0, -1), d: -ARENA.z },
]
const LIFT = 3.4 // how high the hand carries the point it holds
const NEXT_CAP = { on: 'off', off: 'posted', posted: 'on' }
const X = new THREE.Vector3(1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const ONE = new THREE.Vector3(1, 1, 1)
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const qAxis = (axis, a) => new THREE.Quaternion().setFromAxisAngle(axis, a)
const ease = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0))
const pistonX = (L) => PISTON.front + (PISTON.back - PISTON.front) * L

// The cap's pose on the pen, by its centre and rotation in the pen's frame
// (its own frame has the mouth at 0 and the closed top at +x).
const mouthOf = (pose, out) => out.set(-CAP.half, 0, 0).applyQuaternion(pose.q).add(pose.c)
const poseAt = (mouthX, q, L, lift = 0) => ({
  c: V(CAP.half, 0, 0).applyQuaternion(q).add(V(mouthX, 0, 0)).addScaledVector(L, lift),
  q: q.clone(),
})

// The cap's moves between on, off and posted. L is "up", in the pen's frame,
// at right angles to its axis, so the cap always swings over the top.
function capStages(from, to, L, curQ) {
  const qS = qAxis(X, CAP.spin) // unscrewed one and a quarter turns
  const qP = qAxis(L, Math.PI).multiply(qS) // turned end for end
  const P = (x, q, lift = 0) => poseAt(x, q, L, lift)
  const unscrew = [
    { type: 'sound', name: 'thread' },
    { type: 'screw', dur: 0.75, a0: 0, a1: CAP.spin, x0: CAP.onX, x1: CAP.onX + CAP.travel },
    { type: 'move', dur: 0.32, to: P(CAP.outX, qS) },
  ]
  const screwOn = [
    { type: 'move', dur: 0.32, to: P(CAP.onX + CAP.travel, qS) },
    { type: 'sound', name: 'thread' },
    { type: 'screw', dur: 0.75, a0: CAP.spin, a1: 0, x0: CAP.onX + CAP.travel, x1: CAP.onX },
    { type: 'sound', name: 'click' },
  ]
  const postOn = [
    { type: 'move', dur: 0.22, to: P(CAP.postApproach, qP) },
    { type: 'move', dur: 0.16, to: P(CAP.postX, qP) },
    { type: 'sound', name: 'click' },
  ]
  switch (`${from}>${to}`) {
    case 'on>off':
      return [...unscrew, { type: 'release', dir: 1 }]
    case 'on>posted':
      return [...unscrew, { type: 'move', dur: 0.22, to: P(CAP.outX, qS, CAP.lift) }, { type: 'move', dur: 0.6, to: P(CAP.postApproach, qP, CAP.lift) }, ...postOn]
    case 'posted>on':
      return [
        { type: 'move', dur: 0.18, to: P(CAP.postApproach, curQ) },
        { type: 'move', dur: 0.22, to: P(CAP.postApproach, curQ, CAP.lift) },
        { type: 'move', dur: 0.6, to: P(CAP.outX, qS, CAP.lift) },
        { type: 'move', dur: 0.22, to: P(CAP.outX, qS) },
        ...screwOn,
      ]
    case 'posted>off':
      return [{ type: 'move', dur: 0.25, to: P(-7.1, curQ) }, { type: 'release', dir: -1 }]
    case 'off>on':
      return [{ type: 'flight', dur: 0.65, to: P(CAP.outX, qS, CAP.lift) }, { type: 'move', dur: 0.22, to: P(CAP.outX, qS) }, ...screwOn]
    case 'off>posted':
      return [{ type: 'flight', dur: 0.65, to: P(CAP.postApproach, qP, CAP.lift) }, ...postOn]
    default:
      return []
  }
}

function createSim(capState) {
  const base = penSpheres()
  const capT = capSpheres()
  const withCap = base.concat(capT.map((s) => ({ c: s.c.clone(), r: s.r, m: s.m })))
  const pen = createBody(base)
  const capBody = createBody(capT)
  const cs = {
    state: capState,
    busy: null,
    pending: null,
    attached: capState !== 'off',
    pose: capState === 'posted' ? poseAt(CAP.postX, qAxis(UP, Math.PI), UP) : poseAt(CAP.onX, new THREE.Quaternion(), UP),
    flight: null, // the cap's world pose while it flies back to the pen
  }
  const s = { pen, capBody, base, capT, withCap, cs }
  fitCap(s)
  // lying on the paper, clip up, turned a little
  setFrame(pen, V(-0.8, 0.85, 0.6), qAxis(UP, 0.2))
  if (capState === 'off') setFrame(capBody, V(-2.5, 0.84, 3.6), qAxis(UP, -0.45))
  capBody.kinematic = capState !== 'off'
  return s
}

// the pen's collision spheres, with the cap's added wherever it sits on it
const _m = new THREE.Vector3()
function fitCap(s) {
  const { cs, pen } = s
  if (!cs.attached) return setSpheres(pen, s.base)
  const mouth = mouthOf(cs.pose, _m)
  s.capT.forEach((t, i) => s.withCap[s.base.length + i].c.copy(t.c).applyQuaternion(cs.pose.q).add(mouth))
  setSpheres(pen, s.withCap)
}

// the latest value, for handlers that outlive a render
function useLatest(v) {
  const r = useRef(v)
  r.current = v
  return r
}

// cap: on | off | posted. ink: 0..1, how full (where the piston is). inkColor,
// resinColor, trim (gold | rose | platinum), nibFinish (two-tone | gold |
// rhodium). xray: see the piston, spindle and ink through the barrel.
export default function Pen({
  cap: capProp = 'on',
  ink: inkProp = 0.7,
  inkColor = '#1e2d6b',
  resinColor = '#0b0b0d',
  trim = 'gold',
  nibFinish = 'two-tone',
  xray = false,
  sound = false,
  onChange,
  hudRef,
}) {
  const { camera, controls } = useThree()
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)
  useCursor(hover || dragging, dragging ? 'grabbing' : 'grab')
  const onChangeRef = useLatest(onChange)
  const inkColorRef = useLatest(inkColor)

  // ---- geometry, materials, textures ----
  const geo = useMemo(() => makeGeometry(), [])
  const rib = useMemo(() => ribTexture(), [])
  const paper = useMemo(() => createPaper(), [])
  const gold = TRIMS[trim] || TRIMS.gold
  const nibTex = useMemo(() => nibTexture(nibFinish, gold), [nibFinish, gold])
  const mats = useMemo(
    () => ({
      resin: new THREE.MeshPhysicalMaterial({ roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 }),
      gold: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.2, envMapIntensity: 1.3 }),
      nib: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.17, side: THREE.DoubleSide, envMapIntensity: 1.3 }),
      feed: new THREE.MeshStandardMaterial({ color: '#121214', roughness: 0.55 }),
      window: new THREE.MeshPhysicalMaterial({ transmission: 1, thickness: 0.35, roughness: 0.1, ior: 1.49, color: '#c2bcb0', bumpMap: rib, bumpScale: 2, envMapIntensity: 1.2 }),
      bore: new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.6, side: THREE.BackSide }),
      ink: new THREE.MeshStandardMaterial({ roughness: 0.25 }),
      piston: new THREE.MeshStandardMaterial({ color: '#1b1b1e', roughness: 0.45 }),
      seal: new THREE.MeshStandardMaterial({ color: '#c8cdd4', metalness: 0.7, roughness: 0.35 }),
      brass: new THREE.MeshStandardMaterial({ color: '#c9a35a', metalness: 1, roughness: 0.3 }),
      drop: new THREE.MeshStandardMaterial({ roughness: 0.08 }),
    }),
    [rib],
  )
  useEffect(() => {
    mats.nib.map = nibTex
    mats.nib.needsUpdate = true
    return () => nibTex.dispose()
  }, [mats, nibTex])
  useEffect(() => {
    mats.resin.color.set(resinColor)
    mats.gold.color.set(gold)
    mats.ink.color.set(inkColor)
    mats.drop.color.set(inkColor)
  }, [mats, resinColor, gold, inkColor])
  useEffect(() => {
    const r = mats.resin
    r.transparent = xray
    r.opacity = xray ? 0.16 : 1
    r.depthWrite = !xray
    r.side = xray ? THREE.DoubleSide : THREE.FrontSide
    r.needsUpdate = true
  }, [mats, xray])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => (Array.isArray(g) ? g.forEach((x) => x.dispose()) : g.dispose()))
      Object.values(mats).forEach((m) => m.dispose())
      rib.dispose()
      paper.dispose()
    },
    [geo, mats, rib, paper],
  )
  // ---- sound ----
  const audio = useRef(null)
  const soundOn = useLatest(sound)
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, arg) => {
    if (!soundOn.current) return
    if (!audio.current) audio.current = createPenAudio()
    audio.current?.[name](arg)
  }

  // ---- simulation ----
  const sim = useRef(null)
  if (!sim.current) sim.current = createSim(['on', 'off', 'posted'].includes(capProp) ? capProp : 'on')
  const lvl = useRef({ L: clamp01(inkProp), target: clamp01(inkProp), anim: false, notify: false, sent: clamp01(inkProp), notch: 0, spill: 0 })
  const wantCap = useRef(sim.current.cs.state)
  const grab = useRef(null)
  const press = useRef(null)
  const knobDelta = useRef({ x: 0, y: 0 })
  const drops = useRef([])
  const nibTrail = useRef(null)
  const impactAt = useRef({ pen: 0, cap: 0 })
  const hudText = useRef('')

  const startCap = (to) => {
    const s = sim.current
    const cs = s.cs
    if (cs.busy) {
      cs.pending = to
      return
    }
    if (to === cs.state) return
    // "up" in the pen's frame, at right angles to its axis
    const L = UP.clone().applyQuaternion(s.pen.q.clone().invert())
    L.x = 0
    if (L.length() < 0.3) L.set(0, 1, 0)
    L.normalize()
    cs.busy = { list: capStages(cs.state, to, L, cs.pose.q), i: 0, started: false, t: 0, to }
    wake(s.pen)
  }
  useEffect(() => {
    if (capProp !== wantCap.current && ['on', 'off', 'posted'].includes(capProp)) {
      wantCap.current = capProp
      startCap(capProp)
    }
  }, [capProp])
  useEffect(() => {
    const l = lvl.current
    const v = clamp01(inkProp)
    if (Math.abs(v - l.sent) > 0.004) {
      l.target = v
      l.anim = true
      l.notify = false
      l.sent = v
    }
  }, [inkProp])

  const sendInk = () => {
    const l = lvl.current
    l.sent = Math.round(l.L * 100) / 100
    onChangeRef.current?.({ ink: l.sent })
  }

  const click = (kind) => {
    const s = sim.current
    if (kind === 'cap') {
      const cur = s.cs.busy ? s.cs.busy.to : s.cs.state
      const next = NEXT_CAP[cur]
      wantCap.current = next
      startCap(next)
      onChangeRef.current?.({ cap: next })
    } else if (kind === 'knob') {
      const l = lvl.current
      l.target = l.L > 0.5 ? 0 : 1
      l.anim = true
      l.notify = true
    } else {
      // a flick: a little hop and a roll
      const p = s.pen
      wake(p)
      p.v.y += 32
      p.w.addScaledVector(X.clone().applyQuaternion(p.q), Math.random() < 0.5 ? -16 : 16)
    }
  }

  const onDown = (kind) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    press.current = { kind, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, point: e.point.clone(), active: false }
    if (controls) controls.enabled = false
  }
  const hoverOn = (e) => {
    e.stopPropagation()
    setHover(true)
  }
  const hoverOff = () => setHover(false)

  useEffect(() => {
    const move = (e) => {
      const p = press.current
      if (!p) return
      if (!p.active && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) {
        p.active = true
        const s = sim.current
        if (p.kind === 'knob') {
          lvl.current.anim = false
          knobDelta.current = { x: e.clientX - p.x, y: e.clientY - p.y }
        } else {
          const freeCap = p.kind === 'cap' && !s.cs.attached
          if (freeCap && s.cs.busy) return // it is flying back to the pen
          const body = freeCap ? s.capBody : s.pen
          grab.current = { body, local: toLocal(body, p.point, V()), target: p.point.clone() }
          wake(body)
        }
        setDragging(true)
      } else if (p.active && p.kind === 'knob') {
        knobDelta.current.x += e.clientX - p.lastX
        knobDelta.current.y += e.clientY - p.lastY
      }
      p.lastX = e.clientX
      p.lastY = e.clientY
    }
    const up = () => {
      const p = press.current
      if (!p) return
      press.current = null
      if (!p.active) click(p.kind)
      else if (p.kind === 'knob') sendInk()
      grab.current = null
      setDragging(false)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  // ---- per frame ----
  const penRef = useRef()
  const capRef = useRef()
  const knobRef = useRef()
  const pistonRef = useRef()
  const inkRef = useRef()
  const sleeveRef = useRef()
  const dropsRef = useRef()
  const tmp = useMemo(
    () => ({
      penM: new THREE.Matrix4(),
      capM: new THREE.Matrix4(),
      m: new THREE.Matrix4(),
      plane: new THREE.Plane(UP, -LIFT),
      hit: V(),
      a: V(),
      b: V(),
      s: V(),
      q: new THREE.Quaternion(),
    }),
    [],
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = sim.current
    const { pen, capBody, cs } = s
    const l = lvl.current

    // the cap's moves
    frameMatrix(pen, tmp.penM)
    const b = cs.busy
    if (b) {
      let st = b.list[b.i]
      while (st && (st.type === 'sound' || st.type === 'release')) {
        if (st.type === 'sound') play(st.name)
        else {
          // let go of the cap where it is, with the pen's motion and a pop
          const mouthW = mouthOf(cs.pose, V()).applyMatrix4(tmp.penM)
          const qW = pen.q.clone().multiply(cs.pose.q)
          cs.attached = false
          fitCap(s)
          setFrame(capBody, mouthW, qW)
          const axis = X.clone().applyQuaternion(pen.q)
          pointVelocity(pen, capBody.p, capBody.v)
          capBody.v.addScaledVector(axis, st.dir * 24).addScaledVector(UP, 16)
          capBody.w.copy(pen.w).addScaledVector(UP, (Math.random() - 0.5) * 4)
          capBody.kinematic = false
          wake(capBody)
          wake(pen)
        }
        b.i++
        st = b.list[b.i]
      }
      if (st) {
        if (!b.started) {
          b.started = true
          b.t = 0
          if (st.type === 'flight') {
            if (grab.current?.body === capBody) grab.current = null
            capBody.kinematic = true
            b.from = { c: toWorld(capBody, V(CAP.half, 0, 0), V()), q: capBody.q.clone() }
          } else b.from = { c: cs.pose.c.clone(), q: cs.pose.q.clone() }
        }
        b.t = Math.min(1, b.t + dt / st.dur)
        const e = ease(b.t)
        if (st.type === 'move') {
          cs.pose.c.lerpVectors(b.from.c, st.to.c, e)
          cs.pose.q.slerpQuaternions(b.from.q, st.to.q, e)
        } else if (st.type === 'screw') {
          const a = st.a0 + (st.a1 - st.a0) * e
          cs.pose.q.setFromAxisAngle(X, a)
          cs.pose.c.set(st.x0 + (st.x1 - st.x0) * e + CAP.half, 0, 0)
        } else if (st.type === 'flight') {
          const tc = st.to.c.clone().applyMatrix4(tmp.penM)
          const tq = pen.q.clone().multiply(st.to.q)
          const c = V().lerpVectors(b.from.c, tc, e).addScaledVector(UP, Math.sin(Math.PI * e) * 2.5)
          cs.flight = { c, q: b.from.q.clone().slerp(tq, e) }
          if (b.t >= 1) {
            cs.flight = null
            cs.attached = true
            cs.pose = { c: st.to.c.clone(), q: st.to.q.clone() }
          }
        }
        if (cs.attached) {
          fitCap(s)
          wake(pen)
        }
        if (b.t >= 1) {
          b.i++
          b.started = false
        }
      }
      if (b.i >= b.list.length) {
        cs.state = b.to
        cs.busy = null
        const p = cs.pending
        cs.pending = null
        if (p && p !== cs.state) startCap(p)
      }
    }

    // the hand: carry the held point at a fixed height under the pointer
    const g = grab.current
    if (g) {
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(tmp.plane, tmp.hit)) {
        tmp.hit.x = THREE.MathUtils.clamp(tmp.hit.x, -ARENA.x, ARENA.x)
        tmp.hit.z = THREE.MathUtils.clamp(tmp.hit.z, -ARENA.z, ARENA.z)
        g.target.copy(tmp.hit)
      }
    }

    // physics
    const bodies = [pen, capBody]
    step(bodies, dt, { planes: PLANES, grab: g })
    const now = state.clock.elapsedTime
    if (pen.impact > 22 && now - impactAt.current.pen > 0.07) {
      impactAt.current.pen = now
      play('knock', pen.impact / 160)
    }
    if (!capBody.kinematic && capBody.impact > 22 && now - impactAt.current.cap > 0.07) {
      impactAt.current.cap = now
      play('knock', capBody.impact / 220)
    }
    frameMatrix(pen, tmp.penM)

    // the piston knob
    const before = l.L
    if (press.current?.active && press.current.kind === 'knob') {
      // turn by the pointer's travel across the pen's axis on screen
      const a = toWorld(pen, V(-6.2, 0, 0), tmp.a).project(camera)
      const c = toWorld(pen, V(-4.2, 0, 0), tmp.b).project(camera)
      let ax = (c.x - a.x) * state.size.width
      let ay = -(c.y - a.y) * state.size.height
      const n = Math.hypot(ax, ay)
      const kd = knobDelta.current
      const travel = n > 4 ? (kd.x * -ay + kd.y * ax) / n : kd.x
      knobDelta.current = { x: 0, y: 0 }
      l.L = clamp01(l.L + (travel * 0.022) / (TURNS * Math.PI * 2))
      l.target = l.L
    } else if (l.anim) {
      const d = l.target - l.L
      const stepL = 0.42 * dt
      if (Math.abs(d) <= stepL) {
        l.L = l.target
        l.anim = false
        if (l.notify) sendInk()
        l.notify = false
      } else l.L += Math.sign(d) * stepL
    }
    const notch = Math.floor(l.L * TURNS * 10)
    if (notch !== l.notch) {
      l.notch = notch
      play('tick')
    }

    // is the nib out of the cap?
    const mouthLocal = cs.attached ? mouthOf(cs.pose, tmp.s) : null
    const covered = cs.attached && mouthLocal.x < NIB_TIP + 0.1 && X.clone().applyQuaternion(cs.pose.q).x > 0.5
    const tip = toWorld(pen, NIB_TIP_LOCAL, V())

    // pushing the piston forward with the nib out: ink drips from the nib
    if (l.L < before && !covered) {
      l.spill += before - l.L
      while (l.spill > 0.035) {
        l.spill -= 0.035
        const list = drops.current
        if (list.length < 40) {
          const v = pointVelocity(pen, tip, V())
          v.x += (Math.random() - 0.5) * 3
          v.z += (Math.random() - 0.5) * 3
          list.push({ p: tip.clone(), v, size: 0.13 + Math.random() * 0.1 })
          play('drip')
        }
      }
    }
    let dirty = false
    const inst = dropsRef.current
    const list = drops.current
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i]
      d.v.y -= G * dt
      d.p.addScaledVector(d.v, dt)
      if (d.p.y < 0.03) {
        if (Math.abs(d.p.x) < PAPER.w / 2 && Math.abs(d.p.z) < PAPER.h / 2) {
          paper.blot(d.p.x, d.p.z, inkColorRef.current, d.size)
          dirty = true
        }
        list.splice(i, 1)
      }
    }
    if (inst) {
      for (let i = 0; i < 40; i++) {
        const d = list[i]
        if (d) tmp.m.compose(d.p, tmp.q.identity(), tmp.s.set(1, 1 + Math.min(1.5, Math.abs(d.v.y) / 120), 1))
        else tmp.m.makeScale(0, 0, 0)
        inst.setMatrixAt(i, tmp.m)
      }
      inst.instanceMatrix.needsUpdate = true
    }

    // writing: the nib on the paper with ink in the pen leaves a line
    const writing = !covered && tip.y < 0.08 && l.L > 0.01 && Math.abs(tip.x) < PAPER.w / 2 && Math.abs(tip.z) < PAPER.h / 2
    const last = nibTrail.current
    if (writing && last) {
      const dd = Math.hypot(tip.x - last.x, tip.z - last.z)
      if (dd > 0.004 && dd < 3) {
        paper.stroke(last.x, last.z, tip.x, tip.z, inkColorRef.current, 0.045 + Math.min(0.03, dd * 0.01))
        dirty = true
      }
    }
    nibTrail.current = writing ? tip.clone() : null
    if (dirty) paper.tex.needsUpdate = true

    // place everything
    const pg = penRef.current
    if (pg) tmp.penM.decompose(pg.position, pg.quaternion, tmp.s)
    const cg = capRef.current
    if (cg) {
      if (cs.attached) {
        tmp.capM.compose(mouthOf(cs.pose, tmp.a), cs.pose.q, ONE).premultiply(tmp.penM)
      } else if (cs.flight) {
        tmp.capM.compose(mouthOf(cs.flight, tmp.a), cs.flight.q, ONE)
      } else frameMatrix(capBody, tmp.capM)
      tmp.capM.decompose(cg.position, cg.quaternion, tmp.s)
    }
    if (knobRef.current) knobRef.current.rotation.x = l.L * TURNS * Math.PI * 2
    const P = pistonX(l.L)
    if (pistonRef.current) pistonRef.current.position.x = P
    if (inkRef.current) {
      const x0 = P + PISTON.half
      const len = CHAMBER_FRONT - x0
      inkRef.current.visible = len > 0.01
      inkRef.current.scale.x = Math.max(len, 0.001)
      inkRef.current.position.x = (x0 + CHAMBER_FRONT) / 2
    }
    if (sleeveRef.current) {
      // the middle stage of the telescoping piston rod, between spindle and rod
      const x0 = SPINDLE.x1 - 0.6
      const x1 = P - 2.15
      sleeveRef.current.visible = x1 - x0 > 0.05
      sleeveRef.current.scale.x = Math.max(x1 - x0, 0.001)
      sleeveRef.current.position.x = (x0 + x1) / 2
    }

    // readout
    if (hudRef?.current) {
      const text = `INK ${String(Math.round(l.L * 100)).padStart(3, ' ')}%   CAP ${(cs.busy ? '…' : cs.state).toUpperCase()}`
      if (text !== hudText.current) {
        hudText.current = text
        hudRef.current.textContent = text
      }
    }
  })

  const ball = clipBall()
  const shadow = { castShadow: true }
  const penEvents = { onPointerDown: onDown('pen'), onPointerOver: hoverOn, onPointerOut: hoverOff }
  const capEvents = { onPointerDown: onDown('cap'), onPointerOver: hoverOn, onPointerOut: hoverOff }
  const knobEvents = { onPointerDown: onDown('knob'), onPointerOver: hoverOn, onPointerOut: hoverOff }

  return (
    <group>
      {/* the paper */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow onDoubleClick={() => paper.clear()}>
        <planeGeometry args={[PAPER.w, PAPER.h]} />
        <meshStandardMaterial map={paper.tex} roughness={0.92} />
      </mesh>

      <group ref={penRef}>
        <group ref={knobRef}>
          <mesh geometry={geo.knob} material={mats.resin} {...shadow} {...knobEvents} />
          <mesh geometry={geo.knobRingA} material={mats.gold} {...knobEvents} />
          <mesh geometry={geo.knobRingB} material={mats.gold} {...knobEvents} />
          <mesh geometry={geo.spindle} material={mats.brass} />
          {geo.threads.map((t, i) => (
            <mesh key={i} geometry={t} material={mats.brass} />
          ))}
        </group>
        <mesh geometry={geo.barrel} material={mats.resin} {...shadow} {...penEvents} />
        <mesh geometry={geo.bore} material={mats.bore} visible={!xray} />
        <mesh geometry={geo.window} material={mats.window} {...penEvents} />
        <mesh geometry={geo.barrelFront} material={mats.resin} {...penEvents} />
        <mesh geometry={geo.frontRing} material={mats.gold} {...penEvents} />
        <mesh geometry={geo.section} material={mats.resin} {...shadow} {...penEvents} />
        <mesh geometry={geo.sectionRing} material={mats.gold} {...penEvents} />
        <mesh geometry={geo.sectionFace} material={mats.feed} {...penEvents} />
        <mesh geometry={geo.feed} material={mats.feed} {...shadow} {...penEvents} />
        <mesh geometry={geo.nib} material={mats.nib} {...shadow} {...penEvents} />
        <mesh geometry={geo.channel} material={mats.feed} />

        {/* the piston: head with two seals, and the rod behind it */}
        <group ref={pistonRef}>
          <mesh geometry={geo.head} material={mats.piston} />
          <mesh geometry={geo.seal} material={mats.seal} position-x={-0.14} />
          <mesh geometry={geo.seal} material={mats.seal} position-x={0.14} />
          <mesh geometry={geo.tube} material={mats.piston} position-x={-1.35} scale-x={2.2} />
        </group>
        <mesh ref={sleeveRef} geometry={geo.tubeOuter} material={mats.piston} />
        <mesh ref={inkRef} geometry={geo.ink} material={mats.ink} />
      </group>

      <group ref={capRef}>
        <mesh geometry={geo.capShell} material={mats.resin} {...shadow} {...capEvents} />
        <mesh geometry={geo.capTop} material={mats.resin} {...shadow} {...capEvents} />
        <mesh geometry={geo.capBandA} material={mats.gold} {...capEvents} />
        <mesh geometry={geo.capBandB} material={mats.gold} {...capEvents} />
        <mesh geometry={geo.capRing} material={mats.gold} {...capEvents} />
        <mesh geometry={geo.capDiscRing} material={mats.gold} {...capEvents} />
        <mesh geometry={geo.capDisc} material={mats.resin} {...capEvents} />
        <mesh geometry={geo.clip} material={mats.gold} {...shadow} {...capEvents} />
        <mesh geometry={geo.clipBall} material={mats.gold} position={[ball.x, ball.y, 0]} scale={[1.25, 0.75, 1]} {...capEvents} />
      </group>

      <instancedMesh ref={dropsRef} args={[geo.drop, mats.drop, 40]} frustumCulled={false} />
    </group>
  )
}
