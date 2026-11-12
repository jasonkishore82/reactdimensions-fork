import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { click } from './audio.js'

// An n×n×n twisty puzzle. Each piece (cubie) keeps its own position and
// orientation; a turn rotates every cubie in one layer about one axis.
//
// Turns run on a spring: while you drag, the layer follows the pointer; when
// you let go it keeps its momentum, then the spring pulls it to the nearest
// quarter turn (with a little overshoot) and it clicks into place. The rest of
// the cube is pushed back the other way by the same torque, so it rocks
// slightly as each turn lands.

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
const QUARTER = Math.PI / 2
// sticker face name for each [axis, sign]
const FACE = { '0,1': 'right', '0,-1': 'left', '1,1': 'up', '1,-1': 'down', '2,1': 'front', '2,-1': 'back' }
// how each sticker plane (which faces +z) is turned to face its side
const STICKER_ROT = {
  '0,1': [0, QUARTER, 0], '0,-1': [0, -QUARTER, 0],
  '1,1': [-QUARTER, 0, 0], '1,-1': [QUARTER, 0, 0],
  '2,1': [0, 0, 0], '2,-1': [0, Math.PI, 0],
}
// keyboard / named moves: [axis, sign of the face]; a clockwise turn of a
// face, seen from that face, is a negative turn about its outward axis
const MOVES = { R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1] }
// middle slices turn the same way as the face named in brackets: M (L), E (D), S (F)
const SLICES = { M: [0, 1], E: [1, 1], S: [2, -1] }

const near = (a, b) => Math.abs(a - b) < 0.01
const snapHalf = (v) => Math.round(v * 2) / 2

function makeCubies(n) {
  const h = (n - 1) / 2
  const out = []
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++) {
        const p = [x - h, y - h, z - h]
        const stickers = []
        p.forEach((v, axis) => {
          if (near(v, h)) stickers.push([axis, 1])
          if (near(v, -h)) stickers.push([axis, -1])
        })
        if (stickers.length) out.push({ home: p, stickers })
      }
  return out
}

function roundedSquare(size, r) {
  const h = size / 2
  const s = new THREE.Shape()
  s.moveTo(-h + r, -h)
  s.lineTo(h - r, -h)
  s.quadraticCurveTo(h, -h, h, -h + r)
  s.lineTo(h, h - r)
  s.quadraticCurveTo(h, h, h - r, h)
  s.lineTo(-h + r, h)
  s.quadraticCurveTo(-h, h, -h, h - r)
  s.lineTo(-h, -h + r)
  s.quadraticCurveTo(-h, -h, -h + r, -h)
  return new THREE.ShapeGeometry(s, 6)
}

// rotations of a cube are made of quarter turns, so the matrix entries are
// exactly -1, 0 or 1; rounding them stops float error building up
function snapQuat(q) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q)
  const e = m.elements
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[i] = Math.round(e[i])
  return q.setFromRotationMatrix(m).normalize()
}

const Cube = forwardRef(function Cube(
  { size = 3, colors, bodyColor = '#111111', speed = 1, sound = false, onTurn },
  ref,
) {
  const n = size
  const h = (n - 1) / 2
  const { camera, controls, size: view } = useThree()
  const cubies = useMemo(() => makeCubies(n), [n])
  const groups = useRef([])
  const root = useRef()
  const s = useRef(null)
  if (!s.current || s.current.n !== n) {
    s.current = {
      n,
      state: cubies.map((c) => ({ pos: new THREE.Vector3(...c.home), quat: new THREE.Quaternion() })),
      turn: null,
      queue: [],
      history: [],
      drag: null,
      tilt: { ang: new THREE.Vector3(), vel: new THREE.Vector3() },
    }
  }
  const live = useRef({})
  live.current = { speed, sound, onTurn }

  const stickerGeo = useMemo(() => roundedSquare(0.78, 0.12), [])
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0 }), [])
  const faceMats = useMemo(
    () => Object.fromEntries(Object.values(FACE).map((f) => [f, new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 })])),
    [],
  )
  useEffect(() => {
    bodyMat.color.set(bodyColor)
    for (const f of Object.keys(faceMats)) faceMats[f].color.set(colors[f])
  }, [bodyColor, colors, bodyMat, faceMats])
  useEffect(() => () => {
    stickerGeo.dispose()
    bodyMat.dispose()
    Object.values(faceMats).forEach((m) => m.dispose())
  }, [stickerGeo, bodyMat, faceMats])

  const membersOf = (axis, layer) => s.current.state.flatMap((c, i) => (near(c.pos.getComponent(axis), layer) ? [i] : []))

  const isSolved = () => {
    const seen = {}
    const v = new THREE.Vector3()
    for (let i = 0; i < cubies.length; i++) {
      for (const [axis, sign] of cubies[i].stickers) {
        v.copy(AXES[axis]).multiplyScalar(sign).applyQuaternion(s.current.state[i].quat)
        const key = `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`
        const face = FACE[`${axis},${sign}`]
        if (seen[key] && seen[key] !== face) return false
        seen[key] = face
      }
    }
    return true
  }

  // a turn has landed on a whole number of quarters: bake it into the cubies
  const commit = (t) => {
    const st = s.current
    const quarters = ((Math.round(t.target / QUARTER) % 4) + 4) % 4
    st.turn = null
    if (quarters) {
      const q = new THREE.Quaternion().setFromAxisAngle(AXES[t.axis], quarters * QUARTER)
      for (const i of t.members) {
        const c = st.state[i]
        c.pos.applyQuaternion(q)
        c.pos.set(snapHalf(c.pos.x), snapHalf(c.pos.y), snapHalf(c.pos.z))
        snapQuat(c.quat.premultiply(q))
      }
      if (t.tag !== 'solve') {
        // merge with the last move when it turned the same layer
        const last = st.history[st.history.length - 1]
        if (last && last.axis === t.axis && near(last.layer, t.layer)) {
          last.quarters = (last.quarters + quarters) % 4
          if (!last.quarters) st.history.pop()
        } else st.history.push({ axis: t.axis, layer: t.layer, quarters })
      }
      if (live.current.sound) click(t.tag === 'user' ? 1 : 0.6)
    }
    live.current.onTurn?.({ tag: t.tag, turned: quarters !== 0, solved: isSolved(), drained: !st.queue.length })
  }

  const enqueue = (moves) => {
    s.current.queue.push(...moves)
  }

  useImperativeHandle(ref, () => ({
    scramble() {
      const st = s.current
      if (st.turn?.dragging) return
      const layers = Array.from({ length: n }, (_, i) => i - h)
      const count = n === 2 ? 12 : 20 + (n - 3) * 8
      const moves = []
      let prev = -1
      while (moves.length < count) {
        const axis = Math.floor(Math.random() * 3)
        if (axis === prev) continue
        prev = axis
        const layer = layers[Math.floor(Math.random() * n)]
        moves.push({ axis, layer, quarters: [1, -1, 2][Math.floor(Math.random() * 3)], tag: 'scramble' })
      }
      enqueue(moves)
    },
    // undo every recorded turn, newest first
    solve() {
      const st = s.current
      if (st.turn?.dragging) return
      const moves = st.history
        .slice()
        .reverse()
        .map((m) => ({ axis: m.axis, layer: m.layer, quarters: m.quarters === 1 ? -1 : m.quarters === 3 ? 1 : 2, tag: 'solve' }))
      st.history = []
      enqueue(moves)
    },
    reset() {
      const st = s.current
      st.turn = null
      st.queue = []
      st.history = []
      st.drag = null
      st.state.forEach((c, i) => {
        c.pos.set(...cubies[i].home)
        c.quat.identity()
      })
      if (controls) controls.enabled = true
    },
    // a named move, e.g. move('R'), move('U', true) for U'
    move(name, prime = false) {
      const face = MOVES[name]
      const slice = n % 2 === 1 ? SLICES[name] : null
      if (!face && !slice) return
      const [axis, sign] = face ?? slice
      const layer = face ? sign * h : 0
      const quarters = (face ? -sign : sign) * (prime ? -1 : 1)
      enqueue([{ axis, layer, quarters, tag: 'user' }])
    },
  }))

  // ---- dragging a layer ----
  const toScreen = (v) => {
    const p = v.clone().project(camera)
    return new THREE.Vector2(((p.x + 1) / 2) * view.width, ((1 - p.y) / 2) * view.height)
  }

  const onDown = (i) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const st = s.current
    if (st.turn || st.queue.length || !e.face) return
    const nrm = e.face.normal.clone().transformDirection(e.object.matrixWorld)
    // the cube itself sits still (only the camera orbits), so the face normal
    // is one of the six world axes, give or take the rounded edges
    const a = [Math.abs(nrm.x), Math.abs(nrm.y), Math.abs(nrm.z)]
    const axis = a.indexOf(Math.max(...a))
    st.drag = {
      i,
      axis,
      sign: Math.sign(nrm.getComponent(axis)),
      point: e.point.clone(),
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      started: false,
    }
    if (controls) controls.enabled = false
  }

  useEffect(() => {
    const move = (ev) => {
      const st = s.current
      const d = st.drag
      if (!d) return
      const dx = ev.clientX - d.x
      const dy = ev.clientY - d.y
      if (!d.started) {
        if (Math.hypot(dx, dy) < 6) return
        // which way along the face is the pointer going? try both in-face axes
        const p0 = toScreen(d.point)
        let best = null
        for (let j = 0; j < 3; j++) {
          if (j === d.axis) continue
          const sv = toScreen(d.point.clone().addScaledVector(AXES[j], 0.5)).sub(p0)
          const len = sv.length()
          if (len < 1e-3) continue
          const score = Math.abs((dx * sv.x + dy * sv.y) / len)
          if (!best || score > best.score) best = { j, dir: sv.divideScalar(len), pxPerUnit: len / 0.5, score }
        }
        if (!best) return
        // turning about (normal × motion) moves the touched face along the motion
        const turnAxis = AXES[d.axis].clone().multiplyScalar(d.sign).cross(AXES[best.j])
        const t = [Math.abs(turnAxis.x), Math.abs(turnAxis.y), Math.abs(turnAxis.z)]
        const axis = t.indexOf(Math.max(...t))
        const layer = snapHalf(st.state[d.i].pos.getComponent(axis))
        // radius of the touched point about the turn axis: angle = arc / radius
        const pt = d.point.clone().setComponent(axis, 0)
        Object.assign(d, {
          started: true,
          dir: best.dir,
          pxPerUnit: best.pxPerUnit,
          turnSign: Math.sign(turnAxis.getComponent(axis)),
          radius: Math.max(0.8, pt.length()),
          lastT: performance.now(),
          lastAngle: 0,
        })
        st.turn = { axis, layer, members: membersOf(axis, layer), angle: 0, vel: 0, target: 0, dragging: true, tag: 'user' }
      }
      const t = st.turn
      if (!t) return
      const along = (dx * d.dir.x + dy * d.dir.y) / d.pxPerUnit
      const angle = (d.turnSign * along) / d.radius
      const now = performance.now()
      const dt = Math.max(1, now - d.lastT) / 1000
      t.vel = t.vel * 0.5 + ((angle - d.lastAngle) / dt) * 0.5
      t.angle = angle
      d.lastT = now
      d.lastAngle = angle
    }
    const up = () => {
      const st = s.current
      const d = st.drag
      if (!d) return
      st.drag = null
      if (controls) controls.enabled = true
      const t = st.turn
      if (!t || !t.dragging) return
      // a pointer that stopped before letting go has no momentum left
      if (performance.now() - d.lastT > 90) t.vel = 0
      t.dragging = false
      // where the momentum would carry it, then the nearest quarter to that
      const carry = t.angle + THREE.MathUtils.clamp(t.vel, -14, 14) * 0.12
      t.target = Math.round(carry / QUARTER) * QUARTER
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [camera, controls, view.width, view.height])

  // ---- physics + drawing ----
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (!st.turn && st.queue.length) {
      const m = st.queue.shift()
      st.turn = { axis: m.axis, layer: m.layer, members: membersOf(m.axis, m.layer), angle: 0, vel: 0, target: m.quarters * QUARTER, dragging: false, tag: m.tag }
    }

    const t = st.turn
    if (t && !t.dragging) {
      const fast = t.tag === 'scramble' || t.tag === 'solve' ? 2.4 : 1
      const k = 210 * (live.current.speed * fast) ** 2
      const c = 2 * Math.sqrt(k) * 0.6 // under-damped: a small overshoot, then it seats
      if (reduce) {
        t.angle = t.target
        t.vel = 0
      } else {
        const steps = 4
        const h2 = dt / steps
        for (let i = 0; i < steps; i++) {
          const acc = k * (t.target - t.angle) - c * t.vel
          t.vel += acc * h2
          t.angle += t.vel * h2
          // reaction torque on the rest of the cube
          st.tilt.vel.setComponent(t.axis, st.tilt.vel.getComponent(t.axis) - acc * h2 * 0.05 * (t.members.length / st.state.length))
        }
      }
      if (Math.abs(t.target - t.angle) < 0.002 && Math.abs(t.vel) < 0.05) {
        t.angle = t.target
        commit(t)
      }
    }

    // draw every cubie: committed pose, plus the live turn for its layer
    const turning = st.turn
    const inTurn = turning ? new Set(turning.members) : null
    if (turning) q.setFromAxisAngle(AXES[turning.axis], turning.angle)
    for (let i = 0; i < st.state.length; i++) {
      const g = groups.current[i]
      if (!g) continue
      const c = st.state[i]
      if (inTurn?.has(i)) {
        p.copy(c.pos).applyQuaternion(q)
        g.position.copy(p)
        g.quaternion.copy(q).multiply(c.quat)
      } else {
        g.position.copy(c.pos)
        g.quaternion.copy(c.quat)
      }
    }

    // the whole cube rocks on a stiff spring and settles back
    const { ang, vel } = st.tilt
    for (let i = 0; i < 3; i++) {
      const a = ang.getComponent(i)
      const v = vel.getComponent(i) + (-140 * a - 16 * vel.getComponent(i)) * dt
      vel.setComponent(i, v)
      ang.setComponent(i, THREE.MathUtils.clamp(a + v * dt, -0.12, 0.12))
    }
    root.current?.rotation.set(ang.x, ang.y, ang.z)
  })

  return (
    <group ref={root}>
      {cubies.map((c, i) => (
        <group key={`${n}-${i}`} ref={(el) => (groups.current[i] = el)} position={c.home} onPointerDown={onDown(i)}>
          <RoundedBox args={[0.97, 0.97, 0.97]} radius={0.09} smoothness={3} material={bodyMat} castShadow />
          {c.stickers.map(([axis, sign]) => {
            const key = `${axis},${sign}`
            const pos = [0, 0, 0]
            pos[axis] = sign * 0.487
            return <mesh key={key} geometry={stickerGeo} material={faceMats[FACE[key]]} position={pos} rotation={STICKER_ROT[key]} />
          })}
        </group>
      ))}
    </group>
  )
})

export default Cube
