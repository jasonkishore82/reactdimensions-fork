import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { COVE_GLSL, STICKS, buildShell, surfaceAt } from './shell.js'
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
// The shell is one moulded surface (see shell.js). Units are centimetres:
// x right, y up, z towards the player.

// ---- small part geometry ----

// a button cap: flat top with a rounded edge, as a lathe
function capGeometry(r, h, round = 0.07) {
  const pts = [new THREE.Vector2(0, h)]
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2)
    pts.push(new THREE.Vector2(r - round + Math.sin(a) * round, h - round + Math.cos(a) * round))
  }
  pts.push(new THREE.Vector2(r, 0))
  // lathe profiles run bottom to top, or the faces point inwards
  return new THREE.LatheGeometry(pts.reverse(), 48)
}

// thumbstick cap: dished top with a raised, rounded rim
function stickCapGeometry() {
  const pts = [[0, 0.2], [0.3, 0.215], [0.55, 0.26], [0.7, 0.32], [0.78, 0.33], [0.84, 0.29], [0.86, 0.16], [0.82, 0.04], [0.6, 0], [0.3, -0.04]].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(pts.reverse(), 48)
}

// one d-pad key: an arrow-ended key pointing at the centre (this one points
// "up", away from the player); the others are the same key turned
function dpadKeyGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.32, 0.44)
  s.lineTo(0, 0.14)
  s.lineTo(0.32, 0.44)
  s.lineTo(0.32, 0.86)
  s.quadraticCurveTo(0.32, 0.97, 0.21, 0.97)
  s.lineTo(-0.21, 0.97)
  s.quadraticCurveTo(-0.32, 0.97, -0.32, 0.86)
  s.lineTo(-0.32, 0.44)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 4, curveSegments: 6 })
  g.rotateX(-Math.PI / 2) // shape y -> -z, extrusion -> up
  return g
}

// touchpad: straight along the back, tapering towards the front, where the
// edge is gently arched
function padGeometry() {
  const top = 2.95 // half width at the back
  const bot = 2.45 // half width at the front
  const s = new THREE.Shape()
  s.moveTo(-top + 0.35, 1.5)
  s.lineTo(top - 0.35, 1.5)
  s.quadraticCurveTo(top, 1.5, top - 0.02, 1.15)
  s.lineTo(bot + 0.05, -1.0)
  s.quadraticCurveTo(bot, -1.38, bot - 0.42, -1.42)
  s.quadraticCurveTo(0, -1.62, -bot + 0.42, -1.42)
  s.quadraticCurveTo(-bot, -1.38, -bot - 0.05, -1.0)
  s.lineTo(-top + 0.02, 1.15)
  s.quadraticCurveTo(-top, 1.5, -top + 0.35, 1.5)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 3, curveSegments: 12 })
  g.rotateX(-Math.PI / 2)
  return g
}

// a light strip: a thin tube laid on the surface along a curve
function stripGeometry(sx) {
  const pts = [[-4.25, 3.15], [-3.4, 3.1], [-2.4, 2.88], [-1.55, 2.6]].map(([z, x]) => {
    const p = surfaceAt(sx * x, z)
    return new THREE.Vector3(sx * x, p.y + 0.02, z)
  })
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.035, 8, false)
}

// layout: [x, z], measured off the controller
const P = {
  dpad: [-5.0, -2.3],
  face: [4.95, -2.25],
  ls: STICKS[0],
  rs: STICKS[1],
  pad: [0, -2.95],
  create: [-3.75, -4.0],
  options: [3.75, -4.0],
  home: [0, 1.05],
  mic: [0, 1.65],
}
const FACE = { north: [0, -1.2], east: [1.2, 0], south: [0, 1.2], west: [-1.2, 0] }
const DPAD = { up: 0, right: -Math.PI / 2, down: Math.PI, left: Math.PI / 2 }

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

const UP = new THREE.Vector3(0, 1, 0)
// a spot on the surface: where it is and the turn that sits a part flush on it
function flush(x, z, lift = 0) {
  const { y, n } = surfaceAt(x, z)
  return { position: [x + n.x * lift, y + n.y * lift, z + n.z * lift], quaternion: new THREE.Quaternion().setFromUnitVectors(UP, n) }
}

// the body's finish: matte, with the face panel drawn in by its outline and
// a micro-dot texture on the undersides of the grips
function bodyMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.6 })
  m.userData.panel = { value: new THREE.Color('#292a2e') }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPanel = m.userData.panel
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRdPos;\nvarying vec3 vRdN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRdPos = position;\nvRdN = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uPanel;\nvarying vec3 vRdPos;\nvarying vec3 vRdN;\n${COVE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rdD = rdCove(vRdPos.xz);
        float rdW = max(fwidth(rdD), 1e-4);
        float rdUp = smoothstep(-0.3, 0.15, vRdN.y);
        float rdIn = (1.0 - smoothstep(-rdW, rdW, rdD)) * rdUp;
        diffuseColor.rgb = mix(diffuseColor.rgb, uPanel, rdIn);
        float rdSeam = (1.0 - smoothstep(0.02, 0.02 + rdW * 1.5, abs(rdD))) * rdUp;
        diffuseColor.rgb *= 1.0 - 0.6 * rdSeam;
        // micro-dots on the grips' undersides, where the fingers wrap
        vec2 rdC = fract(vec2(vRdPos.x, vRdPos.z + vRdPos.y) * 7.0) - 0.5;
        float rdDot = (1.0 - smoothstep(0.16, 0.24, length(rdC))) * smoothstep(0.0, -0.45, vRdN.y) * step(1.0, vRdPos.z);
        diffuseColor.rgb *= 1.0 - 0.18 * rdDot;`,
      )
  }
  m.customProgramCacheKey = () => 'rd-gamepad-body'
  return m
}

const Gamepad = forwardRef(function Gamepad(
  { bodyColor = '#2a2b2f', panelColor = '#292a2e', buttonColor = '#1b1c1f', lightColor = '#4c8dff', triggerResistance = 0.6, sound = true, keys, onStatus },
  ref,
) {
  const { controls } = useThree()
  const geo = useMemo(
    () => ({
      body: buildShell(),
      cap: capGeometry(0.5, 0.26, 0.1),
      small: capGeometry(0.16, 0.08, 0.04),
      stick: stickCapGeometry(),
      pad: padGeometry(),
      key: dpadKeyGeometry(),
      stripL: stripGeometry(-1),
      stripR: stripGeometry(1),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  // where every surface part sits, worked out once from the shell
  const spots = useMemo(() => {
    const out = {}
    for (const k of ['dpad', 'create', 'options', 'home', 'mic', 'pad']) out[k] = flush(...P[k])
    for (const [name, [dx, dz]] of Object.entries(FACE)) out[name] = flush(P.face[0] + dx, P.face[1] + dz)
    for (const k of ['ls', 'rs']) out[k] = surfaceAt(...P[k]).y
    for (const sx of [-1, 1]) out[sx < 0 ? 'backL' : 'backR'] = surfaceAt(sx * 5.4, -4.6).y
    return out
  }, [])

  const mats = useMemo(
    () => ({
      body: bodyMaterial(),
      button: new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
      pad: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      rubber: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      hole: new THREE.MeshStandardMaterial({ color: '#09090a', roughness: 1 }),
      light: new THREE.MeshStandardMaterial({ color: '#000000', toneMapped: false }),
      touch: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  )
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.body.userData.panel.value.set(panelColor)
    mats.button.color.set(buttonColor)
    mats.pad.color.set(panelColor).multiplyScalar(0.92)
    mats.rubber.color.set(buttonColor).multiplyScalar(0.9)
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
  const reg = (name, y = 0) => (el) => {
    if (el) el.userData.y = y
    parts.current[name] = el
  }
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
      el.position.y = el.userData.y - st.b[name].p * travel
      if (name === 'l1' || name === 'r1') el.rotation.x = st.b[name].p * 0.08
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
      if (el) el.rotation.x = el.userData.rx + st[k].p * 0.45
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
    v3.copy(e.point)
    root.current?.worldToLocal(v3)
    s.current.touch = { x: v3.x, z: v3.z }
  }

  // a part set flush on the surface; the inner group is what presses.
  // (A render function, not a component, so parts aren't remounted on render.)
  const seat = (spot, name, children, rotY = 0, key = name) => (
    <group key={key} position={spot.position} quaternion={spot.quaternion}>
      <group rotation-y={rotY}>
        <group ref={reg(name)}>{children}</group>
      </group>
    </group>
  )

  return (
    <group ref={root}>
      <mesh geometry={geo.body} material={mats.body} castShadow receiveShadow />

      {/* touchpad, with a light strip down each side */}
      {seat(spots.pad, 'pad', <mesh geometry={geo.pad} material={mats.pad} position-y={-0.02} onPointerDown={down('pad')} onPointerMove={onPadMove} />)}
      <mesh ref={reg('touch')} position={[0, spots.pad.position[1] + 0.07, P.pad[1]]} rotation-x={-Math.PI / 2} material={mats.touch} raycast={() => null}>
        <circleGeometry args={[0.38, 32]} />
      </mesh>
      <mesh geometry={geo.stripL} material={mats.light} />
      <mesh geometry={geo.stripR} material={mats.light} />

      {/* speaker grille: two staggered rows */}
      {Array.from({ length: 9 }, (_, i) => {
        const row = i < 5 ? 0 : 1
        const x = row ? (i - 5 - 1.5) * 0.24 : (i - 2) * 0.24
        const z = -1.0 + row * 0.22
        const { y } = surfaceAt(x, z)
        return (
          <mesh key={i} position={[x, y + 0.003, z]} material={mats.hole} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.065, 12]} />
          </mesh>
        )
      })}

      {/* d-pad: four arrow keys on one rocker */}
      <group position={spots.dpad.position} quaternion={spots.dpad.quaternion}>
        <group ref={reg('dpad')}>
          {Object.entries(DPAD).map(([name, rot]) => (
            <group key={name} rotation-y={rot}>
              <mesh geometry={geo.key} material={mats.button} position-y={-0.04} onPointerDown={down(name)} castShadow />
            </group>
          ))}
        </group>
      </group>

      {/* face buttons: plain domed caps */}
      {Object.keys(FACE).map((name) => seat(spots[name], name, <mesh geometry={geo.cap} material={mats.button} position-y={-0.06} onPointerDown={down(name)} castShadow />))}

      {/* sticks: each on a pivot below the floor of its well */}
      {['ls', 'rs'].map((k) => {
        const [x, z] = P[k]
        const floor = spots[k]
        return (
          <group key={k} position={[x, 0, z]}>
            <group ref={reg(k, floor - 0.45)} position-y={floor - 0.45} scale={0.98}>
              <mesh position={[0, 0.5, 0]} material={mats.rubber} onPointerDown={down(k)}>
                <sphereGeometry args={[0.66, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh position={[0, 0.85, 0]} material={mats.rubber} onPointerDown={down(k)}>
                <cylinderGeometry args={[0.28, 0.32, 0.6, 24]} />
              </mesh>
              <mesh geometry={geo.stick} position={[0, 1.15, 0]} material={mats.rubber} onPointerDown={down(k)} castShadow />
              <mesh position={[0, 1.47, 0]} rotation-x={Math.PI / 2} material={mats.button}>
                <torusGeometry args={[0.8, 0.03, 8, 48]} />
              </mesh>
            </group>
          </group>
        )
      })}

      {/* small buttons */}
      {[['create', -0.25], ['options', 0.25]].map(([name, rot]) => seat(spots[name], name, <RoundedBox args={[0.26, 0.2, 0.62]} radius={0.09} smoothness={3} material={mats.button} position-y={-0.04} onPointerDown={down(name)} />, rot))}
      {seat(spots.home, 'home', <RoundedBox args={[0.78, 0.16, 0.3]} radius={0.075} smoothness={3} material={mats.button} position-y={-0.03} onPointerDown={down('home')} />)}
      {seat(spots.mic, 'mic', <mesh geometry={geo.small} material={mats.button} position-y={-0.03} onPointerDown={down('mic')} />)}

      {/* shoulder buttons and triggers along the back edge */}
      {[-1, 1].map((sx) => {
        const bumper = sx < 0 ? 'l1' : 'r1'
        const trig = sx < 0 ? 'lt' : 'rt'
        const x = sx * 5.5
        const y = spots[sx < 0 ? 'backL' : 'backR'] - 0.42
        return (
          <group key={sx}>
            {/* bumper: a thin lip along the back edge */}
            <group ref={reg(bumper, y)} position={[x, y, -5.12]} rotation-y={-sx * 0.08}>
              <RoundedBox args={[2.2, 0.3, 0.62]} radius={0.13} smoothness={4} material={mats.button} onPointerDown={down(bumper)} castShadow />
            </group>
            {/* trigger: hinged at the top, the paddle hangs down behind the body */}
            <group ref={(el) => { if (el) el.userData.rx = 0; parts.current[trig] = el }} position={[x, y - 0.25, -5.05]} rotation-y={-sx * 0.08}>
              <RoundedBox args={[2.0, 1.9, 0.42]} radius={0.2} smoothness={4} material={mats.button} position={[0, -1.0, -0.32]} rotation-x={0.35} onPointerDown={down(trig)} castShadow />
            </group>
          </group>
        )
      })}
    </group>
  )
})

export default Gamepad
