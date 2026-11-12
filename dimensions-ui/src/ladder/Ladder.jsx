import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createLadder, leaning, step, criticalLean, comFraction, WALL_X, G } from './physics.js'
import { createLadderAudio } from './audio.js'

// A wooden ladder against a wall, on real physics (see physics.js).
//
// Two rectangular stiles carry eight round rungs, each passing right through
// both stiles so its square tenon shows on the outside face. The ladder moves
// in the plane at right angles to the wall; friction at the floor and at the
// wall decides whether it holds or slips, and a paint can hooked on a rung
// shifts the centre of mass, which changes the angle at which it slips.
//
// Drag the lower part to slide the foot along the floor (changing the lean);
// drag the upper part to swing the top off the wall about the foot; let go and
// physics takes over. Click a rung to hang the can on it.

export const LENGTH = 6 // 3 m (1 unit = 0.5 m)
const DEPTH = 0.12 // stile depth, in the plane of motion
const THICK = 0.1 // stile thickness, across the ladder
const HALF_W = 0.62 // stile centres either side of the middle
const RUNG_R = 0.05
export const RUNGS = Array.from({ length: 8 }, (_, i) => 0.95 + i * 0.66) // distance from the foot
const MAX_CAN_RUNG = 6 // the top rung is too close to the wall for the can to hang free
// the can hangs from a hook arched over the rung, on a short wire to its bail;
// sized so it clears the rung below at any lean
const CAN = { r: 0.15, h: 0.26, hook: 0.075, wire: 0.1 }
const BAIL = CAN.r * 0.9 // the bail's arch rises this far above the lid
const CAN_DROP = CAN.wire + CAN.h / 2 + BAIL // rung height to the can's centre
const DEFAULT_FOOT = LENGTH * Math.sin((20 * Math.PI) / 180)

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

function woodTexture(color) {
  const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 128 })
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, 1024, 128)
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 128
    const dark = Math.random() < 0.65
    g.strokeStyle = dark ? `rgba(90,50,15,${0.06 + Math.random() * 0.12})` : `rgba(255,225,170,${0.05 + Math.random() * 0.1})`
    g.lineWidth = 0.6 + Math.random() * 2.2
    g.beginPath()
    for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y + Math.sin(x / (90 + i * 3) + i) * 2.5)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

// woodColor, canColor: the colours. floorFriction, wallFriction: the grip.
// load: the paint can's mass, relative to the ladder (0 = no can). rung: which
// rung it hangs on. resetKey: change it to stand the ladder back up.
// onStatus({ fromFloor, lean, critical, state }) reports the readout.
export default function Ladder({
  woodColor = '#c88a43',
  canColor = '#2f6db5',
  floorFriction = 0.4,
  wallFriction = 0.25,
  load = 0.6,
  rung: rungProp = 5,
  sound = false,
  resetKey = 0,
  onChange,
  onStatus,
}) {
  const [rung, setRung] = useTwoWay(Math.min(rungProp, MAX_CAN_RUNG), 'rung', onChange)
  const { camera, controls, raycaster, pointer } = useThree()
  const L = useMemo(() => createLadder({ length: LENGTH, depth: DEPTH }), [])
  const sim = useRef(null)
  if (!sim.current) sim.current = { s: leaning(L, DEFAULT_FOOT), mode: 'sim', can: null, lastStatus: 0, prev: null }
  const ladderRef = useRef()
  const canRef = useRef()
  const wireRef = useRef()
  const hookRef = useRef()
  const audio = useRef(null)
  const live = useRef({})
  live.current = { floorFriction, wallFriction, load, rung, sound, onStatus }
  useEffect(() => () => audio.current?.dispose(), [])

  // stand it back up (and re-hang the can)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    sim.current.s = leaning(L, DEFAULT_FOOT)
    sim.current.mode = 'sim'
    sim.current.can = null
  }, [resetKey, L])
  // clicking a rung while the can lies on the floor hangs it back up
  useEffect(() => {
    sim.current.can = null
  }, [rung])

  const tex = useMemo(() => woodTexture(woodColor), [woodColor])
  useEffect(() => () => tex.dispose(), [tex])
  const mats = useMemo(() => {
    const side = tex.clone()
    side.repeat.set(1, 1)
    side.needsUpdate = true
    const rungTex = tex.clone()
    rungTex.repeat.set(0.25, 1)
    rungTex.needsUpdate = true
    return {
      stile: new THREE.MeshStandardMaterial({ map: side, roughness: 0.62 }),
      rung: new THREE.MeshStandardMaterial({ map: rungTex, roughness: 0.55 }),
      endGrain: new THREE.MeshStandardMaterial({ color: new THREE.Color(woodColor).multiplyScalar(0.72), roughness: 0.8 }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      can: new THREE.MeshStandardMaterial({ color: canColor, metalness: 0.35, roughness: 0.4 }),
      tin: new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: 0.9, roughness: 0.3 }),
      label: new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.6 }),
    }
  }, [tex, woodColor, canColor])
  useEffect(() => () => Object.values(mats).forEach((m) => (m.map?.dispose(), m.dispose())), [mats])

  // ---- dragging ----
  const drag = useRef(null) // { zone, foot: [x, y], x0, y0, moved }
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []) // the ladder's own plane
  const floor = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const down = (e) => {
    e.stopPropagation()
    const local = ladderRef.current.worldToLocal(e.point.clone())
    const s = sim.current.s
    const ux = Math.cos(s.a)
    const uy = Math.sin(s.a)
    drag.current = {
      zone: local.x > -LENGTH * 0.1 ? 'top' : 'foot',
      foot: [s.x - ux * (LENGTH / 2), s.y - uy * (LENGTH / 2)],
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      localX: local.x,
    }
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }
  useEffect(() => {
    const move = (e) => {
      const d = drag.current
      if (d && !d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 5) {
        d.moved = true
        sim.current.mode = d.zone
        sim.current.prev = null
      }
    }
    const up = () => {
      const d = drag.current
      if (!d) return
      if (!d.moved) {
        // a click: hang the can on the nearest rung
        const along = d.localX + LENGTH / 2
        let best = 0
        RUNGS.forEach((r, i) => Math.abs(r - along) < Math.abs(RUNGS[best] - along) && (best = i))
        setRung(Math.min(best, MAX_CAN_RUNG))
        sim.current.can = null
      }
      // let go: physics takes over, keeping the speed it was moved with
      sim.current.mode = 'sim'
      const s = sim.current.s
      const v = Math.hypot(s.vx, s.vy)
      if (v > 8) {
        s.vx *= 8 / v
        s.vy *= 8 / v
      }
      s.w = THREE.MathUtils.clamp(s.w, -4, 4)
      drag.current = null
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const st = sim.current
    const s = st.s
    // the can's mass hangs on its rung (unless it has fallen off)
    L.load = st.can ? 0 : w.load
    L.loadAt = -LENGTH / 2 + RUNGS[w.rung]

    if (st.mode !== 'sim' && drag.current) {
      raycaster.setFromCamera(pointer, camera)
      // the foot follows the pointer across the floor; the top, across the ladder's plane
      if (raycaster.ray.intersectPlane(st.mode === 'foot' ? floor : plane, hit)) {
        let next
        if (st.mode === 'foot') {
          // slide the foot along the floor; the top stays on the wall
          next = leaning(L, THREE.MathUtils.clamp(hit.x, 0.35, LENGTH * 0.97))
        } else {
          // swing about the foot, never through the wall or the floor
          const [fx, fy] = drag.current.foot
          let a = Math.atan2(hit.y - fy, hit.x - fx)
          const lim = (WALL_X + 0.08 - fx) / LENGTH
          const aWall = lim >= -1 && lim <= 1 ? Math.acos(lim) : Math.PI - 0.05
          a = THREE.MathUtils.clamp(a, 0.2, aWall)
          next = { x: fx + Math.cos(a) * (LENGTH / 2), y: fy + Math.sin(a) * (LENGTH / 2), a }
        }
        // carry the hand's speed, so letting go throws it
        const k = 1 / Math.max(dt, 1e-3)
        s.vx = THREE.MathUtils.lerp(s.vx, (next.x - s.x) * k, 0.5)
        s.vy = THREE.MathUtils.lerp(s.vy, (next.y - s.y) * k, 0.5)
        s.w = THREE.MathUtils.lerp(s.w, (next.a - s.a) * k, 0.5)
        s.x = next.x
        s.y = next.y
        s.a = next.a
      }
    } else {
      const hard = step(L, s, dt, w.floorFriction, w.wallFriction)
      if (w.sound && hard > 1.5) {
        audio.current ??= createLadderAudio()
        audio.current?.knock(hard / 8)
      }
    }

    const g = ladderRef.current
    if (g) {
      g.position.set(s.x, s.y, 0)
      g.rotation.z = s.a
    }

    // the can: hanging straight down from its rung, or fallen to the floor
    const ux = Math.cos(s.a)
    const uy = Math.sin(s.a)
    const along = -LENGTH / 2 + RUNGS[w.rung]
    const rx = s.x + ux * along
    const ry = s.y + uy * along
    if (canRef.current) {
      canRef.current.visible = w.load > 0
      const hx = rx + CAN.hook // the hook's shank, on the side of the rung away from the wall
      if (hookRef.current) {
        hookRef.current.position.set(rx, ry, 0)
        hookRef.current.visible = w.load > 0 && !st.can
      }
      if (!st.can) {
        const bottom = ry - CAN_DROP - CAN.h / 2
        if (bottom < 0.02 && w.load > 0) {
          // the ladder is down too far for it to hang: it drops off
          st.can = { x: Math.max(hx, WALL_X + CAN.r + 0.02), y: ry - CAN_DROP, vy: 0 }
        } else {
          // hang below the hook, kept off the wall
          const cx = Math.max(hx, WALL_X + CAN.r + 0.02)
          canRef.current.position.set(cx, ry - CAN_DROP, 0)
          canRef.current.rotation.set(0, 0, 0)
          if (wireRef.current) {
            const top = new THREE.Vector3(hx, ry, 0)
            const bot = new THREE.Vector3(cx, ry - CAN.wire, 0)
            wireRef.current.position.copy(top).add(bot).multiplyScalar(0.5)
            wireRef.current.scale.y = top.distanceTo(bot)
            wireRef.current.rotation.z = Math.atan2(-(bot.x - top.x), top.y - bot.y)
            wireRef.current.visible = w.load > 0
          }
        }
      }
      if (st.can) {
        const c = st.can
        if (c.y > CAN.h / 2) {
          c.vy -= G * dt
          c.y += c.vy * dt
          if (c.y <= CAN.h / 2) {
            c.y = CAN.h / 2
            if (w.sound && c.vy < -1) {
              audio.current ??= createLadderAudio()
              audio.current?.clank()
            }
            c.vy = 0
          }
        }
        canRef.current.position.set(c.x + 0.25, c.y, 0.35)
        if (wireRef.current) wireRef.current.visible = false
      }
    }

    // readout, a few times a second
    const now = state.clock.elapsedTime
    if (w.onStatus && now - st.lastStatus > 0.12) {
      st.lastStatus = now
      const fromFloor = s.a > Math.PI / 2 ? Math.PI - s.a : s.a
      const crit = criticalLean(w.floorFriction, w.wallFriction, comFraction(L))
      const speed = Math.hypot(s.vx, s.vy) + Math.abs(s.w) * 3
      const onWall = s.a > Math.PI / 2 && s.x - Math.abs(Math.cos(s.a)) * (LENGTH / 2) < WALL_X + 0.2
      const label = st.mode !== 'sim' ? 'Held' : speed > 0.08 ? (onWall ? 'Slipping' : 'Falling') : onWall ? 'Holding' : fromFloor < 0.3 ? 'On the floor' : 'Standing'
      w.onStatus({ fromFloor: (fromFloor * 180) / Math.PI, critical: 90 - (crit * 180) / Math.PI, state: label })
    }
  })

  const rungLen = 2 * HALF_W + THICK
  return (
    <group>
      <group ref={ladderRef}>
        {/* stiles */}
        {[-1, 1].map((sd) => (
          <mesh key={sd} material={mats.stile} position-z={sd * HALF_W} castShadow receiveShadow>
            <boxGeometry args={[LENGTH, DEPTH, THICK]} />
          </mesh>
        ))}
        {/* rungs, right through both stiles, with their square tenons showing outside */}
        {RUNGS.map((d) => (
          <group key={d} position-x={-LENGTH / 2 + d}>
            <mesh material={mats.rung} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[RUNG_R, RUNG_R, rungLen - 0.004, 20]} />
            </mesh>
            {[-1, 1].map((sd) => (
              <mesh key={sd} material={mats.endGrain} position-z={sd * (HALF_W + THICK / 2 + 0.0015)}>
                <boxGeometry args={[0.075, 0.075, 0.003]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* an invisible, roomier body to take hold of */}
        <mesh material={mats.hit} onPointerDown={down} onPointerOver={() => (document.body.style.cursor = 'grab')} onPointerOut={() => !drag.current && (document.body.style.cursor = '')}>
          <boxGeometry args={[LENGTH, 0.6, rungLen + 0.3]} />
        </mesh>
      </group>

      {/* the hook, arched over the rung */}
      <group ref={hookRef}>
        <mesh material={mats.tin}>
          <torusGeometry args={[CAN.hook, 0.009, 6, 20, Math.PI]} />
        </mesh>
      </group>
      {/* the wire from the hook down to the can's bail */}
      <mesh ref={wireRef} material={mats.tin}>
        <cylinderGeometry args={[0.008, 0.008, 1, 6]} />
      </mesh>
      {/* the paint can: hooked over its rung, hanging straight down */}
      <group ref={canRef}>
        <mesh material={mats.can} castShadow>
          <cylinderGeometry args={[CAN.r, CAN.r, CAN.h, 28]} />
        </mesh>
        <mesh material={mats.label}>
          <cylinderGeometry args={[CAN.r + 0.002, CAN.r + 0.002, CAN.h * 0.45, 28, 1, true]} />
        </mesh>
        <mesh material={mats.tin} position-y={CAN.h / 2 + 0.005}>
          <cylinderGeometry args={[CAN.r * 0.98, CAN.r * 0.98, 0.012, 28]} />
        </mesh>
        <mesh material={mats.tin} position-y={CAN.h / 2}>
          <torusGeometry args={[BAIL, 0.007, 6, 28, Math.PI]} />
        </mesh>
      </group>
    </group>
  )
}

export { MAX_CAN_RUNG }
