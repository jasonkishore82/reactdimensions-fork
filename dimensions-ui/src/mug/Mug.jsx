import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clink, drip, sip, startPour } from './audio.js'

// A matte glazed mug with a hot drink in it. Units: centimetres, seconds.
//
// The liquid:
//  - sloshes. Its lowest mode in a round cup is a surface shaped like the
//    Bessel function J1(k r) cos(theta), with k = 1.841 / R, ringing at
//    w² = g k tanh(k h): for this mug, about 3.5 Hz when full and slower when
//    nearly empty. Each of its two directions is a lightly damped oscillator
//    pushed by the mug's acceleration (a steady push tilts the surface to
//    a/g, as it must).
//  - spills. When the wave reaches over the rim, liquid leaves at the high
//    side as drops, which fall under gravity and leave puddles that dry.
//  - fills from a stream that stays where it started: move the mug while
//    pouring and the stream lands on the table instead.
//  - cools by Newton's law, dT/dt = -(T - room) / tau, and steams while hot.
//
// The mug slides on the table under a stiff spring to the pointer, and when
// let go it slows by sliding friction (mu * g): the sudden stop is what
// throws the coffee forward.

const G = 981
const R_OUT = 4.1
const H = 9.6
const WALL = 0.45
const R_IN = R_OUT - WALL
const FLOOR = 0.75 // inside floor height
const RIM = H - WALL / 2 // top of the liquid space, where it overflows
const K = 1.8412 / R_IN // first sloshing mode
const ZETA = 0.035
const MU = 0.32 // glazed foot on a table
const ROOM = 21
const AREA = Math.PI * R_IN * R_IN
export const CAPACITY = Math.round(AREA * (RIM - FLOOR))
const POUR_RATE = 42 // ml/s
const POUR_TO = 300
const BOUNDS = { x: 15, z: 11 } // the visible table

export const DRINKS = {
  coffee: { color: '#2b160b', rough: 0.12 },
  latte: { color: '#b98a5c', rough: 0.3 },
  tea: { color: '#7a3d12', rough: 0.08 },
  matcha: { color: '#7c9c46', rough: 0.3 },
  cocoa: { color: '#4d2817', rough: 0.25 },
  water: { color: '#c9dde0', rough: 0.04 },
}

// J1 by its series, plenty for x up to 1.84
function J1(x) {
  const x2 = x * x
  return (x / 2) * (1 - x2 / 8 + (x2 * x2) / 192 - (x2 * x2 * x2) / 9216 + (x2 * x2 * x2 * x2) / 737280)
}
const J1R = J1(K * R_IN)

function mugGeometry() {
  const p = []
  const arc = (cx, cy, r, a0, a1, n = 10) => {
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n
      p.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r))
    }
  }
  // underside: a shallow recessed disc inside a rounded foot ring
  p.push(new THREE.Vector2(0, 0.3))
  p.push(new THREE.Vector2(2.85, 0.3))
  arc(2.85, 0.1, 0.2, Math.PI / 2, 0, 5) // down the ring's inner wall
  arc(3.15, 0.1, 0.1, Math.PI, Math.PI * 1.5, 4) // onto the foot
  arc(R_OUT - 0.65, 0.65, 0.65, -Math.PI / 2, 0, 12) // outer heel, a soft round
  p.push(new THREE.Vector2(R_OUT, H - WALL / 2))
  arc(R_OUT - WALL / 2, H - WALL / 2, WALL / 2, 0, Math.PI, 12) // the lip
  arc(R_IN - 0.7, FLOOR + 0.7, 0.7, 0, -Math.PI / 2, 10) // inside fillet
  p.push(new THREE.Vector2(0.0001, FLOOR))
  const g = new THREE.LatheGeometry(p, 128)
  return g
}

function handleGeometry() {
  const pts = [
    [3.75, 7.95],
    [5.4, 8.05],
    [6.6, 7.85],
    [7.25, 7.05],
    [7.38, 5.3],
    [7.25, 3.55],
    [6.6, 2.75],
    [5.4, 2.55],
    [3.75, 2.65],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0))
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 80, 0.52, 20, false)
  g.scale(1, 1, 1.32) // a flattened band, wider than it is thick
  return g
}

const RINGS = 14
const SEGS = 64
function surfaceGeometry() {
  const pos = []
  const idx = []
  pos.push(0, 0, 0)
  for (let i = 1; i <= RINGS; i++)
    for (let j = 0; j < SEGS; j++) {
      const r = (i / RINGS) * (R_IN - 0.03)
      const a = (j / SEGS) * Math.PI * 2
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r)
    }
  for (let j = 0; j < SEGS; j++) idx.push(0, 1 + ((j + 1) % SEGS), 1 + j)
  for (let i = 1; i < RINGS; i++)
    for (let j = 0; j < SEGS; j++) {
      const a = 1 + (i - 1) * SEGS + j
      const b = 1 + (i - 1) * SEGS + ((j + 1) % SEGS)
      const c = a + SEGS
      const d = b + SEGS
      idx.push(a, b, c, b, d, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// soft round steam puffs, sized in world units
function steamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 400 } },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      varying float vA;
      uniform float uScale;
      void main() {
        vA = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = vA * smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }`,
  })
}

const MAX_DROPS = 220
const MAX_PUDDLES = 90
const MAX_STEAM = 180

const Mug = forwardRef(function Mug({ color = '#a3dbc4', drink = 'coffee', background = '#e6e6e4', coolingSpeed = 30, sound = true, onInfo }, ref) {
  const geo = useMemo(() => ({ mug: mugGeometry(), handle: handleGeometry(), surface: surfaceGeometry(), drop: new THREE.SphereGeometry(0.17, 10, 8), puddle: new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), stream: new THREE.CylinderGeometry(0.3, 0.36, 1, 14, 1, true) }), [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const mat = useMemo(
    () => ({
      glaze: new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ffffff') }),
      liquid: new THREE.MeshPhysicalMaterial({ clearcoat: 1, clearcoatRoughness: 0.05 }),
      puddle: new THREE.MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -1 }),
      steam: steamMaterial(),
    }),
    [],
  )
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])
  useEffect(() => {
    mat.glaze.color.set(color)
    const d = DRINKS[drink] ?? DRINKS.coffee
    mat.liquid.color.set(d.color)
    mat.liquid.roughness = d.rough
  }, [mat, color, drink])

  const steamGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_STEAM * 3), 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(MAX_STEAM), 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_STEAM), 1))
    return g
  }, [])
  useEffect(() => () => steamGeo.dispose(), [steamGeo])

  const s = useRef(null)
  if (!s.current)
    s.current = {
      x: 0, z: 0, vx: 0, vz: 0,
      A: [0, 0], Av: [0, 0], // slosh: wave height at the +x and +z walls, cm
      V: 280, T: 82,
      drag: null,
      pour: null,
      drops: [], puddles: [], steam: [],
      steamAcc: 0, info: 0, lastClink: 0, lastDrip: 0,
    }
  const live = useRef({})
  live.current = { sound, onInfo, coolingSpeed, background, drink }

  const mugRef = useRef()
  const surfRef = useRef()
  const streamRef = useRef()
  const dropsRef = useRef()
  const puddlesRef = useRef()
  const steamRef = useRef()
  const { camera, controls, gl, size } = useThree()

  const pour = () => {
    const st = s.current
    if (st.pour) return
    st.pour = { x: st.x + 0.6, z: st.z - 0.4, t: 0, added: 0, snd: live.current.sound ? startPour() : null }
  }
  const stopPour = () => {
    const st = s.current
    st.pour?.snd?.stop()
    st.pour = null
  }
  const sipIt = () => {
    const st = s.current
    if (st.V < 1) return
    st.V = Math.max(0, st.V - 35)
    st.A[0] += 0.25
    if (live.current.sound) sip()
  }
  const empty = () => {
    stopPour()
    s.current.V = 0
  }
  // where the mug is and how high the drink stands, for the camera to follow
  const position = () => ({ x: s.current.x, z: s.current.z, level: FLOOR + s.current.V / AREA })
  useImperativeHandle(ref, () => ({ pour, sip: sipIt, empty, stopPour, position }))
  useEffect(() => () => s.current?.pour?.snd?.stop(), [])

  // ---- dragging the mug across the table ----
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const st = s.current
    plane.constant = -e.point.y
    st.drag = { ox: st.x - e.point.x, oz: st.z - e.point.z, tx: st.x, tz: st.z, cx: e.nativeEvent.clientX, cy: e.nativeEvent.clientY, moved: false, dir: e.ray.direction.clone() }
    if (controls) controls.enabled = false
    gl.domElement.style.cursor = 'grabbing'
  }
  useEffect(() => {
    const move = (ev) => {
      const d = s.current.drag
      if (!d) return
      if (Math.hypot(ev.clientX - d.cx, ev.clientY - d.cy) > 4) d.moved = true
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(plane, hit)) {
        d.tx = THREE.MathUtils.clamp(hit.x + d.ox, -BOUNDS.x, BOUNDS.x)
        d.tz = THREE.MathUtils.clamp(hit.z + d.oz, -BOUNDS.z, BOUNDS.z)
      }
    }
    const up = () => {
      const st = s.current
      const d = st.drag
      if (!d) return
      st.drag = null
      if (controls) controls.enabled = true
      gl.domElement.style.cursor = ''
      // a click: a little shove away from you
      if (!d.moved) {
        const dir = new THREE.Vector3(d.dir.x, 0, d.dir.z).normalize()
        st.vx += dir.x * 55
        st.vz += dir.z * 55
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
  }, [camera, controls, gl, plane, ray, ndc, hit])

  const tmpM = useMemo(() => new THREE.Matrix4(), [])
  const tmpC = useMemo(() => new THREE.Color(), [])
  const bg = useMemo(() => new THREE.Color(), [])
  const liq = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    if (!(dt > 0)) return // the first frame has no time step: acceleration would be 0/0
    const L = live.current
    const N = 6
    const h = dt / N
    const level = () => FLOOR + st.V / AREA
    let spilled = 0
    for (let n = 0; n < N; n++) {
      // the mug: a spring to the pointer while held, sliding friction when free
      const vx0 = st.vx
      const vz0 = st.vz
      if (st.drag) {
        const w = 26
        st.vx += (w * w * (st.drag.tx - st.x) - 2 * w * st.vx) * h
        st.vz += (w * w * (st.drag.tz - st.z) - 2 * w * st.vz) * h
      } else {
        const sp = Math.hypot(st.vx, st.vz)
        if (sp > 0) {
          const dv = Math.min(sp, MU * G * h)
          st.vx -= (st.vx / sp) * dv
          st.vz -= (st.vz / sp) * dv
        }
      }
      st.x += st.vx * h
      st.z += st.vz * h
      // the edge of the table area: a dead stop, and a clink
      for (const [k, kv, lim] of [['x', 'vx', BOUNDS.x], ['z', 'vz', BOUNDS.z]]) {
        if (Math.abs(st[k]) > lim) {
          st[k] = Math.sign(st[k]) * lim
          if (Math.abs(st[kv]) > 25 && L.sound && state.clock.elapsedTime - st.lastClink > 0.15) {
            clink(Math.abs(st[kv]) / 150)
            st.lastClink = state.clock.elapsedTime
          }
          st[kv] = 0
        }
      }
      const ax = (st.vx - vx0) / h
      const az = (st.vz - vz0) / h

      // slosh: two damped oscillators driven by the mug's acceleration
      const depth = Math.max(0.05, level() - FLOOR)
      const w2 = G * K * Math.tanh(K * depth)
      const w = Math.sqrt(w2)
      const drive = [ax, az]
      for (let i = 0; i < 2; i++) {
        const eq = -0.85 * R_IN * (drive[i] / G) // where a steady push would hold it
        st.Av[i] += (-2 * ZETA * w * st.Av[i] - w2 * (st.A[i] - eq)) * h
        st.A[i] += st.Av[i] * h
      }

      // over the rim: liquid leaves from the high side
      const amp = Math.hypot(st.A[0], st.A[1])
      const over = amp + level() - RIM
      if (st.V > 0 && over > 0) {
        const dV = Math.min(st.V, over * 900 * h)
        st.V -= dV
        spilled += dV
        const k = Math.max(0, 1 - over * 6 * h)
        st.A[0] *= k
        st.A[1] *= k
      }
    }
    if (st.V < 3) {
      st.A[0] = st.A[1] = st.Av[0] = st.Av[1] = 0
    }

    // drops from a spill, thrown off the high side of the rim
    if (spilled > 0) {
      const amp = Math.hypot(st.A[0], st.A[1]) || 1
      const ux = st.A[0] / amp
      const uz = st.A[1] / amp
      const count = Math.min(14, Math.ceil(spilled / 1.2))
      for (let i = 0; i < count && st.drops.length < MAX_DROPS; i++) {
        const a = Math.atan2(uz, ux) + (Math.random() - 0.5) * 0.9
        const r = R_OUT + 0.1
        const out = 18 + Math.random() * 30
        st.drops.push({
          x: st.x + Math.cos(a) * r, y: H + Math.random() * 0.4, z: st.z + Math.sin(a) * r,
          vx: st.vx * 0.9 + Math.cos(a) * out, vy: 8 + Math.random() * 16, vz: st.vz * 0.9 + Math.sin(a) * out,
          ml: spilled / count,
        })
      }
    }

    // pouring: a fixed stream; the mug may move out from under it
    if (st.pour) {
      const p = st.pour
      p.t += dt
      const dx = p.x - st.x
      const dz = p.z - st.z
      const rr = Math.hypot(dx, dz)
      const dV = POUR_RATE * dt
      let endY
      let onTable = false
      if (rr < R_IN - 0.35) {
        // into the drink: mix the heat in, and stir the surface
        const Tin = 88
        st.T = (st.T * st.V + Tin * dV) / Math.max(1e-6, st.V + dV)
        st.V = Math.min(CAPACITY + 5, st.V + dV)
        p.added += dV
        endY = level()
        st.Av[0] += (Math.random() - 0.5) * 6 * dt * 10
        st.Av[1] += (Math.random() - 0.5) * 6 * dt * 10
      } else if (dx > R_OUT - 0.2 && dx < 7.9 && Math.abs(dz) < 0.75) {
        // onto the handle, which sticks out along +x: it runs off the sides
        endY = dx < 6.9 ? 8.6 : 8.6 - (dx - 6.9) * 1.4
        if (Math.random() < dt * 30 && st.drops.length < MAX_DROPS) st.drops.push({ x: p.x, y: endY, z: p.z + Math.sign(dz || 1) * 0.7, vx: 0, vy: 0, vz: Math.sign(dz || 1) * 6, ml: dV })
      } else if (rr < R_OUT + 0.3) {
        // on the rim: it runs down the outside
        endY = H
        if (Math.random() < dt * 30 && st.drops.length < MAX_DROPS) st.drops.push({ x: p.x, y: H, z: p.z, vx: (dx / (rr || 1)) * 20, vy: 2, vz: (dz / (rr || 1)) * 20, ml: dV })
      } else {
        endY = 0
        onTable = true
        addPuddle(st, p.x + (Math.random() - 0.5) * 0.6, p.z + (Math.random() - 0.5) * 0.6, dV * 1.2)
      }
      p.snd?.set(RIM - level(), onTable)
      const sm = streamRef.current
      if (sm) {
        const top = 34
        sm.visible = true
        sm.position.set(p.x, (top + endY) / 2, p.z)
        sm.scale.set(1 + 0.08 * Math.sin(state.clock.elapsedTime * 40), top - endY, 1)
      }
      if (st.V >= POUR_TO) stopPour()
      else if (p.t > 14) stopPour()
    } else if (streamRef.current) streamRef.current.visible = false

    // drops in flight
    for (let i = st.drops.length - 1; i >= 0; i--) {
      const d = st.drops[i]
      d.vy -= G * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.z += d.vz * dt
      // falling past the mug's side: slide off it
      const mx = d.x - st.x
      const mz = d.z - st.z
      const mr = Math.hypot(mx, mz)
      if (mr < R_OUT && d.y < H && d.y > 0) {
        d.x = st.x + (mx / mr) * R_OUT
        d.z = st.z + (mz / mr) * R_OUT
        d.vx = (mx / mr) * 4
        d.vz = (mz / mr) * 4
      }
      if (d.y <= 0) {
        addPuddle(st, d.x, d.z, d.ml)
        if (L.sound && state.clock.elapsedTime - st.lastDrip > 0.05) {
          drip(0.6)
          st.lastDrip = state.clock.elapsedTime
        }
        st.drops.splice(i, 1)
      }
    }

    // cooling (Newton), sped up by coolingSpeed; real tau is about 25 minutes
    st.T = ROOM + (st.T - ROOM) * Math.exp((-dt * L.coolingSpeed) / 1500)

    // steam: puffs that rise, spread and fade, more when hotter
    const hot = st.V > 3 ? THREE.MathUtils.clamp((st.T - 42) / 45, 0, 1) : 0
    st.steamAcc += dt * 70 * hot
    while (st.steamAcc > 1 && st.steam.length < MAX_STEAM) {
      st.steamAcc -= 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * (R_IN - 0.5)
      st.steam.push({ x: st.x + Math.cos(a) * r, y: level() + 0.2, z: st.z + Math.sin(a) * r, vx: (Math.random() - 0.5) * 1.5, vy: 3.5 + Math.random() * 3, vz: (Math.random() - 0.5) * 1.5, t: 0, life: 1.8 + Math.random() * 1.6, a: 0.05 + 0.1 * hot })
    }
    if (st.steamAcc > 1) st.steamAcc = 1
    const sp = steamGeo.attributes.position.array
    const sa = steamGeo.attributes.aAlpha.array
    const ss = steamGeo.attributes.aSize.array
    const tt = state.clock.elapsedTime
    for (let i = st.steam.length - 1; i >= 0; i--) {
      const q = st.steam[i]
      q.t += dt
      if (q.t > q.life) {
        st.steam.splice(i, 1)
        continue
      }
      // a gentle curl, and the plume leans away from the mug's motion
      q.vx += (Math.sin(tt * 1.7 + q.y * 0.6 + i) * 3 - st.vx * 0.15) * dt
      q.vz += (Math.cos(tt * 1.3 + q.y * 0.5 + i * 0.7) * 3 - st.vz * 0.15) * dt
      q.x += q.vx * dt
      q.y += q.vy * dt
      q.z += q.vz * dt
    }
    for (let i = 0; i < MAX_STEAM; i++) {
      const q = st.steam[i]
      if (q) {
        const k = q.t / q.life
        sp[i * 3] = q.x
        sp[i * 3 + 1] = q.y
        sp[i * 3 + 2] = q.z
        sa[i] = q.a * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * 0.4)
        ss[i] = 0.9 + k * 3.2
      } else sa[i] = 0
    }
    steamGeo.attributes.position.needsUpdate = true
    steamGeo.attributes.aAlpha.needsUpdate = true
    steamGeo.attributes.aSize.needsUpdate = true
    steamGeo.setDrawRange(0, MAX_STEAM)
    mat.steam.uniforms.uScale.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))

    // draw: mug, surface, drops, puddles
    if (mugRef.current) mugRef.current.position.set(st.x, 0, st.z)
    const sm = surfRef.current
    if (sm) {
      sm.visible = st.V > 1
      sm.position.set(st.x, level(), st.z)
      // low down, the surface is narrower where the inside wall rounds into the floor
      const dy = FLOOR + 0.7 - level()
      const rs = dy > 0 ? (R_IN - 0.7 + Math.sqrt(Math.max(0, 0.49 - dy * dy))) / R_IN : 1
      sm.scale.set(rs, 1, rs)
      const pos = geo.surface.attributes.position
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v)
        const z = pos.getZ(v)
        const r = Math.hypot(x, z)
        const f = r > 1e-6 ? J1(K * r) / J1R / r : 0
        pos.setY(v, (st.A[0] * x + st.A[1] * z) * f) // = A cos(theta) J1(kr)/J1(kR)
      }
      pos.needsUpdate = true
      geo.surface.computeVertexNormals()
    }
    liq.set((DRINKS[L.drink] ?? DRINKS.coffee).color)
    if (dropsRef.current) {
      const im = dropsRef.current
      st.drops.forEach((d, i) => {
        tmpM.makeTranslation(d.x, d.y, d.z)
        im.setMatrixAt(i, tmpM)
      })
      im.count = st.drops.length
      im.instanceMatrix.needsUpdate = true
    }
    if (puddlesRef.current) {
      const im = puddlesRef.current
      bg.set(L.background)
      st.puddles.forEach((p, i) => {
        // spreads out thin, then slowly dries
        p.t += dt
        p.r += (p.target - p.r) * Math.min(1, dt * 4)
        const dry = Math.min(1, p.t / 40)
        tmpM.makeScale(p.r, 1, p.r).setPosition(p.x, 0.012 + i * 0.0002, p.z)
        im.setMatrixAt(i, tmpM)
        tmpC.copy(liq).lerp(bg, 0.06 + dry * 0.94)
        im.setColorAt(i, tmpC)
      })
      for (let i = st.puddles.length - 1; i >= 0; i--) if (st.puddles[i].t > 40) st.puddles.splice(i, 1)
      im.count = st.puddles.length
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }

    st.info += dt
    if (st.info > 0.1) {
      st.info = 0
      L.onInfo?.({ ml: st.V, T: st.T, pouring: !!st.pour, capacity: CAPACITY })
    }
  })

  return (
    <group>
      <group ref={mugRef} onPointerDown={onDown} onPointerOver={() => (gl.domElement.style.cursor = 'grab')} onPointerOut={() => !s.current.drag && (gl.domElement.style.cursor = '')}>
        <mesh geometry={geo.mug} material={mat.glaze} castShadow receiveShadow />
        <mesh geometry={geo.handle} material={mat.glaze} castShadow receiveShadow />
      </group>
      <mesh ref={surfRef} geometry={geo.surface} material={mat.liquid} receiveShadow />
      <mesh ref={streamRef} geometry={geo.stream} material={mat.liquid} visible={false} />
      <instancedMesh ref={dropsRef} args={[geo.drop, mat.liquid, MAX_DROPS]} count={0} frustumCulled={false} />
      <instancedMesh ref={puddlesRef} args={[geo.puddle, mat.puddle, MAX_PUDDLES]} count={0} frustumCulled={false} receiveShadow />
      <points ref={steamRef} geometry={steamGeo} material={mat.steam} frustumCulled={false} renderOrder={10} />
    </group>
  )
})

// a spill lands: merge into a nearby puddle or start a new one; area grows with volume
function addPuddle(st, x, z, ml) {
  const near = st.puddles.find((p) => Math.hypot(p.x - x, p.z - z) < p.r * 0.8 + 0.5)
  if (near) {
    near.ml += ml
    near.target = Math.min(7, Math.sqrt(near.ml / (Math.PI * 0.12)))
    near.t = Math.min(near.t, 2)
    return
  }
  if (st.puddles.length >= MAX_PUDDLES) st.puddles.shift()
  st.puddles.push({ x, z, ml, r: 0.15, target: Math.min(7, Math.sqrt(ml / (Math.PI * 0.12))), t: 0 })
}

export default Mug
