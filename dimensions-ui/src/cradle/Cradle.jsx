import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Newton's cradle. Every ball is a pendulum on a V of two strings; neighbouring
// balls collide elastically, so a swing passes through the row and the far ball
// flies out. It hangs still until you drag an end ball to lift it (the balls
// from that end up to the one you grab lift together) and let go. 1 unit is
// roughly an inch.
const MAX_BALLS = 8
export const BALL_R = 0.5
const GRAVITY = 20 // a little brisk, so the swing reads well on screen
const MAX_ANGLE = 1.25 // how far a ball can be lifted
const SUBSTEPS = 16 // physics steps per frame, so collisions are crisp
const SPREAD = 1.0 // strings run to rails this far in front of and behind the balls
const BASE_T = 0.35 // thickness of the base
const RAIL_R = 0.06
const BALL_CLEAR = 0.9 // gap between the base and the lowest point of a ball

// Where everything is for a given row: the frame's half width, the height of
// the rails, and the middle of the whole thing (for framing the camera).
export function layoutOf(n, length) {
  const top = BALL_CLEAR + BALL_R + length
  const frameHalf = (n - 1) * BALL_R + 1.7
  return { top, frameHalf, centerY: (top - BASE_T) / 2, height: top + BASE_T, width: frameHalf * 2 + 0.8 }
}

const Y = new THREE.Vector3(0, 1, 0)

// balls: how many (3 to 8). stringLength: how long the pendulums are.
// damping: how fast the swing dies (0 keeps it going nearly for ever).
export default function Cradle({
  balls = 5,
  stringLength = 3.4,
  ballColor = '#d9dce0',
  frameColor = '#1b1c1f',
  frameFinish = 'polished',
  stringColor = '#9aa0a8',
  damping = 0.15,
  shine = 0.8,
}) {
  const [hover, setHover] = useState(false)
  const [drag, setDrag] = useState(false)
  useCursor(hover || drag, drag ? 'grabbing' : 'grab')
  const { camera, controls } = useThree()

  const n = Math.min(Math.max(Math.round(balls), 3), MAX_BALLS)
  const L = stringLength
  const lay = layoutOf(n, L)

  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(BALL_R, 48, 32),
      string: new THREE.CylinderGeometry(0.011, 0.011, 1, 6),
      rail: new THREE.CylinderGeometry(RAIL_R, RAIL_R, 1, 20),
      cap: new THREE.SphereGeometry(RAIL_R * 1.05, 16, 12),
      eye: new THREE.TorusGeometry(0.045, 0.012, 8, 16),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      ball: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.1, envMapIntensity: 1.5, clearcoat: 0.3, clearcoatRoughness: 0.1 }),
      frame: new THREE.MeshPhysicalMaterial({ metalness: 0.9, envMapIntensity: 1.2 }),
      string: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 }),
    }),
    [],
  )
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, mats],
  )
  // the base: a slab with soft edges, as wide as the frame
  const baseGeo = useMemo(() => new RoundedBoxGeometry(lay.frameHalf * 2 + 0.7, BASE_T, SPREAD * 2 + 0.9, 4, 0.08), [lay.frameHalf])
  useEffect(() => () => baseGeo.dispose(), [baseGeo])

  // finish and colours update the materials in place
  useEffect(() => {
    mats.ball.color.set(ballColor)
    mats.ball.roughness = 0.4 - shine * 0.34
    mats.string.color.set(stringColor)
    const f = mats.frame
    f.color.set(frameColor)
    f.metalness = frameFinish === 'matte' ? 0.2 : 0.9
    f.roughness = frameFinish === 'polished' ? 0.18 : frameFinish === 'satin' ? 0.42 : 0.8
    f.clearcoat = frameFinish === 'polished' ? 0.4 : 0
  }, [mats, ballColor, frameColor, frameFinish, stringColor, shine])

  // ---- physics state: one angle and angular velocity per ball ----
  const th = useRef(new Float64Array(MAX_BALLS))
  const om = useRef(new Float64Array(MAX_BALLS))
  const ballRefs = useRef([])
  const stringRefs = useRef([])
  const live = useRef({})
  live.current = { n, L, damping }
  // drag: the ball grabbed and the side (-1 left, 1 right); group = the balls lifted with it
  const grab = useRef({ on: false, i: -1, side: 0, lo: 0, hi: -1 })
  useEffect(() => {
    th.current.fill(0)
    om.current.fill(0)
    grab.current.on = false
  }, [n])

  useEffect(() => {
    const up = () => {
      const g = grab.current
      if (!g.on) return
      g.on = false
      setDrag(false)
      if (controls) controls.enabled = true
      for (let k = g.lo; k <= g.hi; k++) om.current[k] = 0
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  const onDown = (i) => (e) => {
    e.stopPropagation()
    const { n: count } = live.current
    const side = i < count / 2 ? -1 : 1
    const g = grab.current
    g.on = true
    g.i = i
    g.side = side
    // the balls from that end of the row up to this one lift together
    g.lo = side < 0 ? 0 : i
    g.hi = side < 0 ? i : count - 1
    setDrag(true)
    if (controls) controls.enabled = false
  }

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const A = useMemo(() => new THREE.Vector3(), [])
  const Bp = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const { n: cnt, L: len, damping: damp } = live.current
    const { top } = layoutOf(cnt, len)
    const dt = Math.min(delta, 1 / 30)
    const g = grab.current
    const t = th.current
    const w = om.current
    const px = (i) => (i - (cnt - 1) / 2) * 2 * BALL_R
    const c = damp * 0.25 // air drag per second
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // dragging: the lifted balls follow the pointer, held on their strings
    if (g.on) {
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        let a = Math.atan2(hit.x - px(g.i), top - hit.y)
        a = g.side < 0 ? Math.min(0, Math.max(-MAX_ANGLE, a)) : Math.max(0, Math.min(MAX_ANGLE, a))
        for (let k = g.lo; k <= g.hi; k++) {
          t[k] = a
          w[k] = 0
        }
      }
    }

    // pendulum dynamics with collisions between neighbours, in small steps
    const h = dt / SUBSTEPS
    for (let s = 0; s < SUBSTEPS; s++) {
      for (let k = 0; k < cnt; k++) {
        if (g.on && k >= g.lo && k <= g.hi) continue // held by the hand
        w[k] += (-(GRAVITY / len) * Math.sin(t[k]) - c * w[k]) * h
        t[k] += w[k] * h
      }
      // elastic collisions between equal masses swap their velocities; repeat so a
      // hit passes straight through a whole row of touching balls
      for (let pass = 0; pass < cnt * 2; pass++) {
        let any = false
        for (let k = 0; k < cnt - 1; k++) {
          const heldA = g.on && k >= g.lo && k <= g.hi
          const heldB = g.on && k + 1 >= g.lo && k + 1 <= g.hi
          if (heldA && heldB) continue
          const touching = Math.sin(t[k]) - Math.sin(t[k + 1]) >= -1e-6 // k's right edge has reached k+1's left edge
          if (!touching) continue
          const va = len * w[k] * Math.cos(t[k])
          const vb = len * w[k + 1] * Math.cos(t[k + 1])
          if (va - vb > 1e-6) {
            // equal masses: the velocities swap
            if (!heldA) w[k] = vb / (len * Math.cos(t[k]))
            if (!heldB) w[k + 1] = va / (len * Math.cos(t[k + 1]))
            any = true
          }
          // never let balls stay overlapped: push the free one out
          if (!heldB && Math.sin(t[k + 1]) < Math.sin(t[k])) t[k + 1] = Math.asin(Math.min(1, Math.sin(t[k])))
        }
        if (!any) break
      }
    }
    if (reduced) {
      // no tremble: let very small swings settle
      for (let k = 0; k < cnt; k++) if (Math.abs(w[k]) < 0.01 && Math.abs(t[k]) < 0.004) t[k] = w[k] = 0
    }

    // place the balls and the strings
    for (let k = 0; k < MAX_BALLS; k++) {
      const b = ballRefs.current[k]
      if (!b) continue
      const x = px(k) + len * Math.sin(t[k])
      const y = top - len * Math.cos(t[k])
      b.position.set(x, y, 0)
      // the strings run from the rails to a point on the ball towards the pivot
      Bp.set(x - BALL_R * Math.sin(t[k]), y + BALL_R * Math.cos(t[k]), 0)
      for (let q = 0; q < 2; q++) {
        const sm = stringRefs.current[k * 2 + q]
        if (!sm) continue
        A.set(px(k), top, q ? SPREAD : -SPREAD)
        dir.subVectors(Bp, A)
        const length = dir.length()
        sm.position.copy(A).addScaledVector(dir, 0.5)
        sm.scale.set(1, length, 1)
        sm.quaternion.setFromUnitVectors(Y, dir.normalize())
      }
    }
  })

  const { frameHalf, top } = lay
  const frame = mats.frame

  return (
    <group>
      {/* base */}
      <mesh geometry={baseGeo} material={frame} position={[0, -BASE_T / 2, 0]} castShadow receiveShadow />
      {/* four posts and two rails across the top */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`}>
            <mesh geometry={geo.rail} material={frame} position={[sx * frameHalf, top / 2, sz * SPREAD]} scale={[1, top, 1]} castShadow />
            <mesh geometry={geo.cap} material={frame} position={[sx * frameHalf, top, sz * SPREAD]} />
          </group>
        )),
      )}
      {[-1, 1].map((sz) => (
        <mesh key={sz} geometry={geo.rail} material={frame} position={[0, top, sz * SPREAD]} rotation={[0, 0, Math.PI / 2]} scale={[1, frameHalf * 2, 1]} castShadow />
      ))}

      {/* the balls and their strings */}
      {Array.from({ length: MAX_BALLS }, (_, i) =>
        i < n ? (
          <group key={i}>
            <mesh
              ref={(el) => (ballRefs.current[i] = el)}
              geometry={geo.ball}
              material={mats.ball}
              castShadow
              onPointerDown={onDown(i)}
              onPointerOver={() => setHover(true)}
              onPointerOut={() => setHover(false)}
            />
            {[0, 1].map((q) => (
              <mesh key={q} ref={(el) => (stringRefs.current[i * 2 + q] = el)} geometry={geo.string} material={mats.string} />
            ))}
          </group>
        ) : null,
      )}
    </group>
  )
}
