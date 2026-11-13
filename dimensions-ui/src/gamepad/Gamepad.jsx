import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { click } from './audio.js'

// A twin-stick game controller with working parts. Every moving part runs on
// its own spring-damper, so it moves like the real mechanism:
//   sticks    tilt up to 24°, spring back to centre with a small overshoot,
//             and click down
//   buttons   travel down and back up; the d-pad is one rocker that tips
//             towards the arm pressed
//   triggers  analog, hinged at the top; "resistance" adds a wall part-way
//             through the pull that takes more force to get past
//   rumble    a heavy, slow motor in the left grip and a light, fast one in
//             the right shake the whole body
// Input comes from the pointer, the keyboard (via `keys`) and, when one is
// connected, a real gamepad (the Gamepad API, standard mapping), all merged.
//
// Layout units are roughly centimetres: x right, y up, z towards the player.

// The shell is two pieces, like the real thing: the outer body (grips, rim,
// d-pad and face buttons) and, set into it, the smooth inner cove that holds
// the touchpad and sticks and runs down between the grips.
const DEPTH = 0.7
const BEVEL = 1.0
const TOP = DEPTH + BEVEL // top of the flat shell before shaping
const BOTTOM = -BEVEL

// bends the flat extrusion: the grips hang down and away and thicken towards
// their tips, and the face domes very slightly across its width
function shapeY(x, y, z) {
  const t = (y - BOTTOM) / (TOP - BOTTOM) // 0 at the underside, 1 on the face
  return y + t * 0.1 * (1 - Math.min(1, (x / 8) ** 2))
}
const topAt = (x, z) => shapeY(x, TOP, z)

// outlines seen from above, right half from the top centre clockwise (x, z);
// mirrored for the left. Traced from the controller: 16 cm wide, 10.7 deep,
// long tapered grips splayed outwards, and the deep hollow between them.
// The shell outline stops at the grip roots; the round grip tubes carry on
// from there to the tips.
const SHELL = [[0, -4.75], [2.5, -4.8], [4.5, -4.85], [6.0, -4.75], [7.2, -4.1], [7.8, -3.0], [8.0, -1.6], [8.0, 0.0], [7.8, 1.3], [7.4, 2.0], [6.6, 2.5], [5.6, 2.6], [4.6, 2.4], [3.9, 2.15], [2.5, 1.75], [1.2, 1.6], [0, 1.55]]

// the handles: round in section, tapering, angled down and out, with a
// rounded tip, built as a tube of ellipses along a curve
function gripGeometry(sign) {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(sign * 5.6, 0.4, -0.6),
    new THREE.Vector3(sign * 5.95, 0.36, 2.3),
    new THREE.Vector3(sign * 5.5, 0.1, 3.6),
    new THREE.Vector3(sign * 4.7, -0.4, 4.8),
    new THREE.Vector3(sign * 4.3, -0.9, 5.9),
  ])
  const N = 48
  const M = 32
  const pos = []
  const idx = []
  const up0 = new THREE.Vector3(0, 1, 0)
  const T = new THREE.Vector3()
  const side = new THREE.Vector3()
  const up = new THREE.Vector3()
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const p = path.getPointAt(t)
    path.getTangentAt(t, T)
    up.copy(up0).addScaledVector(T, -up0.dot(T)).normalize()
    side.crossVectors(T, up).normalize()
    // wide and shallow where it meets the body, rounder towards the hand
    let a = 2.1 - 1.05 * t
    let b = 1.42 - 0.3 * t
    const cap = t > 0.82 ? Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.18) ** 2)) : 1
    a *= cap
    b *= cap
    for (let j = 0; j < M; j++) {
      const th = (j / M) * Math.PI * 2
      pos.push(p.x + side.x * a * Math.cos(th) + up.x * b * Math.sin(th), p.y + side.y * a * Math.cos(th) + up.y * b * Math.sin(th), p.z + side.z * a * Math.cos(th) + up.z * b * Math.sin(th))
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a0 = i * M + j
      const a1 = i * M + ((j + 1) % M)
      const b0 = a0 + M
      const b1 = a1 + M
      idx.push(a0, b0, a1, a1, b0, b1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return finish(g)
}
const COVE = [[0, -4.3], [2.5, -4.35], [3.5, -4.2], [4.15, -3.6], [4.35, -2.5], [4.35, -1.0], [4.2, 0.3], [3.9, 1.2], [3.5, 1.6], [2.6, 1.45], [1.2, 1.3], [0, 1.27]]

function outline(half, samples) {
  const left = half.slice(1, -1).reverse().map(([x, z]) => [-x, z])
  const pts = [...half, ...left].map(([x, z]) => new THREE.Vector3(x, -z, 0))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  return new THREE.Shape(curve.getSpacedPoints(samples).map((p) => new THREE.Vector2(p.x, p.y)))
}

function finish(g) {
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  g.computeVertexNormals()
  return g
}

function bodyGeometry() {
  const g = new THREE.ExtrudeGeometry(outline(SHELL, 320), { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: 0.75, bevelSegments: 10, steps: 1 })
  g.rotateX(-Math.PI / 2) // outline in x/z, thickness up y
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, shapeY(pos.getX(i), pos.getY(i), pos.getZ(i)))
  return finish(g)
}

// the cove: a thin plate that follows the face, standing a hair proud of it
function coveGeometry() {
  const g = new THREE.ExtrudeGeometry(outline(COVE, 220), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 4, steps: 1 })
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, topAt(pos.getX(i), pos.getZ(i)) - 0.1 + pos.getY(i))
  return finish(g)
}

// the light strips bow out round the touchpad's sides
function barGeometry() {
  const g = new THREE.TorusGeometry(3.4, 0.035, 8, 48, 0.86)
  g.rotateZ(-0.43)
  g.rotateX(-Math.PI / 2)
  return g
}

// a button cap: flat top with a rounded edge, as a lathe
function capGeometry(r, h, round = 0.07) {
  const pts = [new THREE.Vector2(0, h)]
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push(new THREE.Vector2(r - round + Math.sin(a) * round, h - round + Math.cos(a) * round))
  }
  pts.push(new THREE.Vector2(r, 0))
  return new THREE.LatheGeometry(pts, 40)
}

// thumbstick cap: dished top with a raised rim
function stickCapGeometry() {
  const pts = [[0, 0.2], [0.3, 0.215], [0.55, 0.26], [0.7, 0.32], [0.78, 0.33], [0.84, 0.29], [0.86, 0.16], [0.82, 0.04], [0.6, 0], [0.3, -0.04]].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(pts, 48)
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function padGeometry() {
  const g = new THREE.ExtrudeGeometry(roundedRect(6.0, 2.6, 0.6), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 3, curveSegments: 10 })
  g.rotateX(-Math.PI / 2)
  return g
}

// layout: [x, z], measured off the controller
const P = {
  dpad: [-4.85, -2.6],
  face: [5.05, -2.6],
  ls: [-2.55, -0.6],
  rs: [2.55, -0.6],
  pad: [0, -3.05],
  create: [-3.7, -4.1],
  options: [3.7, -4.1],
  home: [0, -0.3],
  mic: [0, 0.65],
}
const FACE = { north: [0, -1.35], east: [1.35, 0], south: [0, 1.35], west: [-1.35, 0] }
const DPAD = { up: [0, -0.66, 0], right: [0.66, 0, -Math.PI / 2], down: [0, 0.66, Math.PI], left: [-0.66, 0, Math.PI / 2] }

// Gamepad API standard mapping
const GP = { south: 0, east: 1, west: 2, north: 3, l1: 4, r1: 5, create: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, home: 16, pad: 17 }
const KEYS = { south: 'Digit1', east: 'Digit2', west: 'Digit3', north: 'Digit4', l1: 'KeyQ', r1: 'KeyE', l3: 'KeyF', r3: 'KeyH', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', options: 'Enter', pad: 'Space' }
const BUTTONS = Object.keys(GP)
// how far each kind of button travels (cm)
const TRAVEL = { l1: 0.12, r1: 0.12, pad: 0.05, create: 0.05, options: 0.05, home: 0.06, mic: 0.04, l3: 0.18, r3: 0.18 }

const spring = (st, target, k, zeta, dt) => {
  const c = 2 * Math.sqrt(k) * zeta
  const acc = k * (target - st.p) - c * st.v
  st.v += acc * dt
  st.p += st.v * dt
}

const Gamepad = forwardRef(function Gamepad(
  { bodyColor = '#2a2b2f', panelColor = '#292a2e', buttonColor = '#1b1c1f', lightColor = '#4c8dff', triggerResistance = 0.6, sound = true, keys, onStatus },
  ref,
) {
  const { controls } = useThree()
  const geo = useMemo(
    () => ({ body: bodyGeometry(), gripL: gripGeometry(-1), gripR: gripGeometry(1), cove: coveGeometry(), bar: barGeometry(), cap: capGeometry(0.58, 0.24), small: capGeometry(0.3, 0.12, 0.05), stick: stickCapGeometry(), pad: padGeometry() }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const mats = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6 }),
      panel: new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4 }),
      button: new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.3 }),
      rubber: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      hole: new THREE.MeshStandardMaterial({ color: '#09090a', roughness: 1 }),
      light: new THREE.MeshStandardMaterial({ color: '#000000', toneMapped: false }),
      touch: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  )
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.panel.color.set(panelColor)
    mats.button.color.set(buttonColor)
    mats.rubber.color.set(buttonColor).multiplyScalar(0.85)
    mats.light.emissive.set(lightColor)
  }, [mats, bodyColor, panelColor, buttonColor, lightColor])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  // ---- state ----
  const s = useRef(null)
  if (!s.current) {
    const b = {}
    for (const n of [...BUTTONS, 'mic']) b[n] = { p: 0, v: 0, was: false }
    s.current = {
      b,
      ls: { x: { p: 0, v: 0 }, y: { p: 0, v: 0 } },
      rs: { x: { p: 0, v: 0 }, y: { p: 0, v: 0 } },
      lt: { p: 0, v: 0, wall: false },
      rt: { p: 0, v: 0, wall: false },
      ptr: null, // pointer holding a part
      taps: {}, // short presses from clicks: name -> until (s)
      rumble: { low: 0, high: 0, until: 0 },
      activity: 0,
      pad: null, // gamepad id when one is connected
      touch: null,
      t: 0,
    }
  }
  const live = useRef({})
  live.current = { triggerResistance, sound, keys, onStatus }

  const parts = useRef({})
  const reg = (name) => (el) => (parts.current[name] = el)
  const root = useRef()

  const rumble = (low = 1, high = 0.6, ms = 500) => {
    const st = s.current
    st.rumble.until = st.t + ms / 1000
    st.rumble.holdLow = low
    st.rumble.holdHigh = high
    // a real controller shakes too
    const gp = navigator.getGamepads?.().find((g) => g && g.id === st.pad)
    gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: low, weakMagnitude: high }).catch?.(() => {})
  }
  useImperativeHandle(ref, () => ({ rumble }))

  // ---- pointer ----
  const down = (name) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const st = s.current
    st.ptr = { name, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, dx: 0, dy: 0, moved: false }
    if (controls) controls.enabled = false
  }
  useEffect(() => {
    const move = (ev) => {
      const p = s.current.ptr
      if (!p) return
      p.dx = ev.clientX - p.x
      p.dy = ev.clientY - p.y
      if (Math.hypot(p.dx, p.dy) > 4) p.moved = true
    }
    const up = () => {
      const st = s.current
      const p = st.ptr
      if (!p) return
      st.ptr = null
      if (controls) controls.enabled = true
      // a click on a stick, without moving it, clicks it down
      if ((p.name === 'ls' || p.name === 'rs') && !p.moved) st.taps[p.name === 'ls' ? 'l3' : 'r3'] = st.t + 0.16
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

  const v3 = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    st.t += dt
    const L = live.current
    const keySet = L.keys?.current ?? new Set()
    const ptr = st.ptr

    // a connected gamepad, if any
    let gp = null
    const pads = navigator.getGamepads?.() ?? []
    for (const g of pads) if (g && g.connected) { gp = g; break }
    const id = gp?.id ?? null
    if (id !== st.pad) {
      st.pad = id
      L.onStatus?.(id)
    }
    const gb = (i) => (gp?.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0)

    // ---- buttons ----
    const SUB = 3
    for (const name of [...BUTTONS, 'mic']) {
      const b = st.b[name]
      let target = 0
      if (ptr?.name === name) target = 1
      if (KEYS[name] && keySet.has(KEYS[name])) target = 1
      if (GP[name] !== undefined) target = Math.max(target, gb(GP[name]))
      if (st.taps[name] > st.t) target = 1
      const pressed = target > 0.5
      if (pressed && !b.was) {
        st.activity = 1
        if (L.sound) click(name.length <= 5 && TRAVEL[name] ? 1.6 : 1.1)
        st.rumble.high = Math.max(st.rumble.high, 0.25)
      }
      b.was = pressed
      for (let i = 0; i < SUB; i++) spring(b, target, 1400, 0.55, dt / SUB)
    }

    // ---- sticks ----
    for (const k of ['ls', 'rs']) {
      const stick = st[k]
      let tx = 0
      let ty = 0
      if (ptr?.name === k && ptr.moved) {
        tx = ptr.dx / 55
        ty = ptr.dy / 55
      }
      const [kl, kr, ku, kd] = k === 'ls' ? ['KeyA', 'KeyD', 'KeyW', 'KeyS'] : ['KeyJ', 'KeyL', 'KeyI', 'KeyK']
      tx += (keySet.has(kr) ? 1 : 0) - (keySet.has(kl) ? 1 : 0)
      ty += (keySet.has(kd) ? 1 : 0) - (keySet.has(ku) ? 1 : 0)
      if (gp) {
        const ax = gp.axes[k === 'ls' ? 0 : 2] ?? 0
        const ay = gp.axes[k === 'ls' ? 1 : 3] ?? 0
        if (Math.hypot(ax, ay) > 0.08) {
          tx += ax
          ty += ay
        }
      }
      const len = Math.hypot(tx, ty)
      if (len > 1) {
        tx /= len
        ty /= len
      }
      if (len > 0.2) st.activity = Math.max(st.activity, 0.6)
      // a little under-damped: let go and it overshoots the centre once
      for (let i = 0; i < SUB; i++) {
        spring(stick.x, tx, 650, 0.38, dt / SUB)
        spring(stick.y, ty, 650, 0.38, dt / SUB)
      }
    }

    // ---- triggers ----
    for (const k of ['lt', 'rt']) {
      const tr = st[k]
      let target = 0
      if (ptr?.name === k) target = 1
      if (keySet.has(k === 'lt' ? 'KeyZ' : 'KeyC')) target = 1
      if (gp) target = Math.max(target, gb(k === 'lt' ? 6 : 7))
      const res = L.triggerResistance
      // the wall: from about 40% of the pull it takes much more force to go on
      const inWall = THREE.MathUtils.smoothstep(tr.p, 0.36, 0.46)
      const pushing = target > tr.p ? 1 : 0
      const kk = 260 * (1 - 0.88 * res * inWall * pushing)
      for (let i = 0; i < SUB; i++) spring(tr, target, kk, 0.9, dt / SUB)
      tr.p = THREE.MathUtils.clamp(tr.p, 0, 1)
      const past = tr.p > 0.46
      if (past && !tr.wall && res > 0.2) {
        st.rumble.high = Math.max(st.rumble.high, 0.5 * res)
        if (L.sound) click(0.8, 0.6 * res)
      }
      tr.wall = past
      if (target > 0.1) st.activity = Math.max(st.activity, 0.6)
    }

    // ---- rumble ----
    const r = st.rumble
    if (r.until > st.t) {
      r.low = Math.max(r.low, r.holdLow)
      r.high = Math.max(r.high, r.holdHigh)
    }
    r.low *= Math.exp(-dt * 7)
    r.high *= Math.exp(-dt * 12)
    st.activity *= Math.exp(-dt * 2.5)

    // ---- draw ----
    const g = parts.current
    for (const name of [...BUTTONS, 'mic']) {
      const el = g[name]
      if (!el || name === 'l3' || name === 'r3' || name in DPAD) continue
      const travel = TRAVEL[name] ?? 0.16
      if (name === 'l1' || name === 'r1') {
        el.position.y = el.userData.y - st.b[name].p * travel
        el.rotation.x = st.b[name].p * 0.08
      } else el.position.y = el.userData.y - st.b[name].p * travel
    }
    // the d-pad rocks on a centre pivot towards whichever arm is down
    if (g.dpad) {
      const b = st.b
      g.dpad.rotation.x = (b.down.p - b.up.p) * 0.16
      g.dpad.rotation.z = (b.left.p - b.right.p) * 0.16
    }
    for (const k of ['ls', 'rs']) {
      const el = g[k]
      if (!el) continue
      const stick = st[k]
      const max = THREE.MathUtils.degToRad(24)
      el.rotation.set(stick.y.p * max, 0, -stick.x.p * max)
      el.position.y = el.userData.y - st.b[k === 'ls' ? 'l3' : 'r3'].p * TRAVEL.l3
    }
    for (const k of ['lt', 'rt']) {
      const el = g[k]
      if (el) el.rotation.x = el.userData.rx - st[k].p * 0.5
    }
    mats.light.emissiveIntensity = 1.4 + st.activity * 2.2

    // finger on the touchpad: a soft spot where it touches
    if (ptr?.name === 'pad' || st.touch) {
      mats.touch.opacity += ((ptr?.name === 'pad' ? 0.18 : 0) - mats.touch.opacity) * Math.min(1, dt * 14)
      if (mats.touch.opacity < 0.005) st.touch = null
    }
    if (st.touch && g.touch) g.touch.position.set(st.touch.x, g.touch.position.y, st.touch.z)

    // shake: slow, heavy left motor; fast, light right motor
    if (root.current) {
      const t = st.t
      root.current.position.set(
        Math.sin(t * 61) * r.low * 0.035 + Math.sin(t * 173) * r.high * 0.012,
        Math.cos(t * 53) * r.low * 0.02 + Math.cos(t * 191) * r.high * 0.008,
        0,
      )
      root.current.rotation.set(Math.sin(t * 47) * r.low * 0.006, 0, Math.sin(t * 59) * r.low * 0.01 + Math.sin(t * 181) * r.high * 0.003)
    }
  })

  const onPadMove = (e) => {
    const p = e.point
    v3.copy(p)
    root.current?.worldToLocal(v3)
    s.current.touch = { x: v3.x, z: v3.z }
  }

  const at = (x, z, lift = 0) => [x, topAt(x, z) + lift, z]

  return (
    <group ref={root}>
      <mesh geometry={geo.body} material={mats.body} castShadow receiveShadow />
      <mesh geometry={geo.gripL} material={mats.body} castShadow receiveShadow />
      <mesh geometry={geo.gripR} material={mats.body} castShadow receiveShadow />
      <mesh geometry={geo.cove} material={mats.panel} receiveShadow />

      {/* touchpad, with light strips bowing round each side */}
      <group ref={(el) => { if (el) el.userData.y = topAt(...P.pad) + 0.03; reg('pad')(el) }} position={at(P.pad[0], P.pad[1], 0.03)}>
        <mesh geometry={geo.pad} material={mats.body} onPointerDown={down('pad')} onPointerMove={onPadMove} />
      </group>
      <mesh ref={reg('touch')} position={at(0, P.pad[1], 0.155)} rotation-x={-Math.PI / 2} material={mats.touch} raycast={() => null}>
        <circleGeometry args={[0.38, 32]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={geo.bar} position={at(-sx * 0.35, P.pad[1], 0.07)} scale={[sx, 1, 1]} material={mats.light} />
      ))}

      {/* speaker grille */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = ((i % 6) - 2.5) * 0.22
        const z = -1.55 + Math.floor(i / 6) * 0.24
        return (
          <mesh key={i} position={at(x, z, 0.002)} material={mats.hole} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.065, 12]} />
          </mesh>
        )
      })}

      {/* d-pad: four arms on one rocker */}
      <group ref={reg('dpad')} position={at(P.dpad[0], P.dpad[1], 0.02)}>
        {Object.entries(DPAD).map(([name, [x, z, rot]]) => (
          <group key={name} ref={(el) => { if (el) el.userData.y = 0; reg(name)(el) }} position={[x, 0, z]} rotation-y={rot}>
            <RoundedBox args={[0.6, 0.26, 0.82]} radius={0.1} smoothness={3} material={mats.button} position={[0, 0.1, 0]} onPointerDown={down(name)} castShadow />
            <mesh position={[0, 0.235, -0.18]} rotation-x={-Math.PI / 2} material={mats.hole}>
              <circleGeometry args={[0.05, 3]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* face buttons */}
      {Object.entries(FACE).map(([name, [dx, dz]]) => {
        const x = P.face[0] + dx
        const z = P.face[1] + dz
        const y = topAt(x, z) - 0.02
        return (
          <group key={name} ref={(el) => { if (el) el.userData.y = y; reg(name)(el) }} position={[x, y, z]}>
            <mesh geometry={geo.cap} material={mats.button} onPointerDown={down(name)} castShadow />
            <mesh position={[0, 0.245, 0]} rotation-x={-Math.PI / 2} material={mats.hole}>
              <ringGeometry args={[0.13, 0.17, 24]} />
            </mesh>
          </group>
        )
      })}

      {/* sticks: a socket in the body, then the stick on a pivot below the surface */}
      {['ls', 'rs'].map((k) => {
        const [x, z] = P[k]
        const y = topAt(x, z)
        return (
          <group key={k}>
            <mesh position={[x, y + 0.005, z]} rotation-x={-Math.PI / 2} material={mats.hole}>
              <circleGeometry args={[0.95, 40]} />
            </mesh>
            <mesh position={[x, y, z]} rotation-x={Math.PI / 2} material={mats.body}>
              <torusGeometry args={[0.97, 0.04, 10, 48]} />
            </mesh>
            <group ref={(el) => { if (el) el.userData.y = y - 0.45; reg(k)(el) }} position={[x, y - 0.45, z]} scale={1.15}>
              <mesh position={[0, 0.5, 0]} material={mats.rubber} onPointerDown={down(k)}>
                <sphereGeometry args={[0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh position={[0, 0.85, 0]} material={mats.rubber} onPointerDown={down(k)}>
                <cylinderGeometry args={[0.28, 0.32, 0.6, 24]} />
              </mesh>
              <mesh geometry={geo.stick} position={[0, 1.15, 0]} material={mats.rubber} onPointerDown={down(k)} castShadow />
              <mesh position={[0, 1.47, 0]} rotation-x={Math.PI / 2} material={mats.button}>
                <torusGeometry args={[0.8, 0.035, 8, 48]} />
              </mesh>
            </group>
          </group>
        )
      })}

      {/* small buttons */}
      {[['create', -0.35], ['options', 0.35]].map(([name, rot]) => {
        const [x, z] = P[name]
        const y = topAt(x, z) - 0.04
        return (
          <group key={name} ref={(el) => { if (el) el.userData.y = y; reg(name)(el) }} position={[x, y, z]} rotation-y={rot}>
            <RoundedBox args={[0.3, 0.2, 0.7]} radius={0.09} smoothness={3} material={mats.button} onPointerDown={down(name)} />
          </group>
        )
      })}
      {(() => {
        const [x, z] = P.home
        const y = topAt(x, z) - 0.03
        return (
          <group ref={(el) => { if (el) el.userData.y = y; reg('home')(el) }} position={[x, y, z]}>
            <mesh geometry={geo.small} material={mats.button} onPointerDown={down('home')} />
          </group>
        )
      })()}
      {(() => {
        const [x, z] = P.mic
        const y = topAt(x, z) - 0.04
        return (
          <group ref={(el) => { if (el) el.userData.y = y; reg('mic')(el) }} position={[x, y, z]}>
            <RoundedBox args={[0.7, 0.14, 0.22]} radius={0.06} smoothness={3} material={mats.button} onPointerDown={down('mic')} />
          </group>
        )
      })()}

      {/* shoulder buttons and triggers along the back edge */}
      {[-1, 1].map((sx) => {
        const bumper = sx < 0 ? 'l1' : 'r1'
        const trig = sx < 0 ? 'lt' : 'rt'
        const x = sx * 5.2
        const y = topAt(x, -4.4) - 0.3
        return (
          <group key={sx}>
            {/* bumper: a thin lip over the back edge */}
            <group ref={(el) => { if (el) el.userData.y = y; reg(bumper)(el) }} position={[x, y, -5.0]} rotation-y={-sx * 0.1}>
              <RoundedBox args={[2.4, 0.3, 0.8]} radius={0.13} smoothness={4} material={mats.button} onPointerDown={down(bumper)} castShadow />
            </group>
            {/* hinge at the top; the paddle hangs back and down behind the body */}
            <group ref={(el) => { if (el) el.userData.rx = 0.3; reg(trig)(el) }} position={[x, y - 0.5, -4.75]} rotation={[0.3, -sx * 0.1, 0]}>
              <RoundedBox args={[2.2, 0.45, 2.2]} radius={0.22} smoothness={4} material={mats.button} position={[0, -0.3, -0.95]} rotation-x={-0.9} onPointerDown={down(trig)} castShadow />
            </group>
          </group>
        )
      })}
    </group>
  )
})

export default Gamepad
