import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { chime, tick } from './audio.js'

// A metal band ring standing on its edge. Units: 1 = 1 cm.
//
// The band is a lathe of its cross-section, a superellipse whose outer and
// inner halves can be rounder or flatter, which is what the classic profiles
// are: comfort (domed both sides), court, D-shape (domed out, flat in), flat.
//
// Spin it and it behaves like a coin spun on a table (or Euler's disk): it
// spins upright while friction bleeds off speed, then tips over, and as it
// leans lower it rolls round its rim faster and faster (the lean shrinks as
// the cube root of the time left), until it drops flat with a rattle.

export const PROFILES = { comfort: [2.5, 3], court: [2.2, 2.2], 'd-shape': [2.3, 8], flat: [7, 7] }

const K = 36 // sets how fast it rolls round at a given lean: rate = sqrt(K / sin(lean))
const UPRIGHT_RATE = Math.sqrt(K)
const FALL_TIME = 4.2 // seconds from starting to tip to lying flat

function bandGeometry(inner, width, thick, profile) {
  const [eo, ei] = PROFILES[profile] ?? PROFILES.comfort
  const a = thick / 2
  const b = width / 2
  const cx = inner + a
  const f = (c, n) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n)
  const N = 160
  const pts = []
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * Math.PI * 2
    const c = Math.cos(s)
    const n = c >= 0 ? eo : ei
    pts.push(new THREE.Vector2(cx + a * f(c, n), b * f(Math.sin(s), n)))
  }
  const SEG = 200
  const g = new THREE.LatheGeometry(pts, SEG)
  // the profile is a closed loop: its first and last points are the same, so
  // share their normal or the seam shows as a line in the reflections
  const nrm = g.attributes.normal
  const v = new THREE.Vector3()
  for (let i = 0; i <= SEG; i++) {
    const first = i * (N + 1)
    const last = first + N
    v.set(nrm.getX(first) + nrm.getX(last), nrm.getY(first) + nrm.getY(last), nrm.getZ(first) + nrm.getZ(last)).normalize()
    nrm.setXYZ(first, v.x, v.y, v.z)
    nrm.setXYZ(last, v.x, v.y, v.z)
  }
  g.rotateX(Math.PI / 2) // ring axis along z: it stands on its edge
  return g
}

const Ring = forwardRef(function Ring(
  { innerDiameter = 17.3, width = 6, thickness = 1.8, profile = 'comfort', metalColor = '#e6e7ea', roughness = 0.14, sound = true, onMode },
  ref,
) {
  const inner = innerDiameter / 20 // mm diameter to cm radius
  const w = width / 10
  const t = thickness / 10
  const outer = inner + t
  const { controls } = useThree()
  const geo = useMemo(() => bandGeometry(inner, w, t, profile), [inner, w, t, profile])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 1, envMapIntensity: 1.15 }), [])
  useEffect(() => {
    mat.color.set(metalColor)
    mat.roughness = roughness
  }, [mat, metalColor, roughness])
  useEffect(() => () => mat.dispose(), [mat])

  const pose = useRef()
  // mode: upright | spin (spinning on edge) | fall (tipping, rolling round) | flat | rise (standing back up)
  const s = useRef({ mode: 'upright', phi: 0.5, v: 0, w: 0, dir: 1, alpha: Math.PI / 2, t: 0, drag: null, lastHalf: 0 })
  const live = useRef({})
  live.current = { sound, onMode, outer, w }

  const setMode = (m) => {
    s.current.mode = m
    s.current.t = 0
    live.current.onMode?.(m)
  }
  const spin = (speed = 16, dir = 1) => {
    const st = s.current
    if (st.mode !== 'upright') return
    st.w = THREE.MathUtils.clamp(speed, UPRIGHT_RATE + 2, 28)
    st.dir = dir
    st.lastHalf = Math.floor(st.phi / Math.PI)
    setMode('spin')
    if (live.current.sound) chime(0.5)
  }
  const rise = () => {
    if (s.current.mode === 'flat') setMode('rise')
  }
  const act = () => {
    const m = s.current.mode
    if (m === 'upright') spin()
    else if (m === 'flat') rise()
  }
  useImperativeHandle(ref, () => ({ act, spin, rise }))

  // drag the ring to turn it; flick it to spin it
  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const st = s.current
    st.drag = { x: e.nativeEvent.clientX, phi: st.phi, moved: false, lastX: e.nativeEvent.clientX, lastT: performance.now(), vel: 0 }
    if (controls) controls.enabled = false
  }
  useEffect(() => {
    const move = (ev) => {
      const st = s.current
      const d = st.drag
      if (!d) return
      if (Math.abs(ev.clientX - d.x) > 5) d.moved = true
      if (st.mode !== 'upright' && st.mode !== 'flat') return
      const now = performance.now()
      const dt = Math.max(1, now - d.lastT) / 1000
      d.vel = d.vel * 0.5 + (((ev.clientX - d.lastX) * 0.012) / dt) * 0.5
      d.lastX = ev.clientX
      d.lastT = now
      st.phi = d.phi + (ev.clientX - d.x) * 0.012
      st.v = 0
    }
    const up = () => {
      const st = s.current
      const d = st.drag
      if (!d) return
      st.drag = null
      if (controls) controls.enabled = true
      if (!d.moved) return act()
      const vel = performance.now() - d.lastT > 90 ? 0 : d.vel
      // a hard flick on a standing ring sets it spinning; otherwise it coasts
      if (st.mode === 'upright' && Math.abs(vel) > 7) spin(Math.abs(vel), Math.sign(vel))
      else st.v = vel
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

  const q = useMemo(() => new THREE.Quaternion(), [])
  const qx = useMemo(() => new THREE.Quaternion(), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const X = useMemo(() => new THREE.Vector3(1, 0, 0), [])

  useFrame((_, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    st.t += dt
    let rate = 0
    switch (st.mode) {
      case 'upright':
        if (!st.drag) {
          st.phi += st.v * dt
          st.v *= Math.exp(-2.5 * dt)
        }
        st.alpha = Math.PI / 2
        break
      case 'spin':
        // spinning on its edge about the vertical; friction takes the speed
        st.w -= 2.4 * dt
        rate = st.w
        st.phi += st.dir * rate * dt
        st.alpha = Math.PI / 2 - 0.02 * Math.sin(st.t * 9) * Math.min(1, st.t)
        if (st.w <= UPRIGHT_RATE) setMode('fall')
        break
      case 'fall': {
        const left = 1 - st.t / FALL_TIME
        st.alpha = left > 0 ? (Math.PI / 2 - 0.02) * Math.cbrt(left) : 0
        rate = Math.sqrt(K / Math.max(Math.sin(st.alpha), 0.004))
        st.phi += st.dir * rate * dt
        if (st.alpha < 0.005) {
          setMode('flat')
          st.v = st.dir * 3
          if (live.current.sound) chime(0.9)
        }
        break
      }
      case 'flat':
        // a short rattle as it lands, then still
        st.alpha = st.t < 0.45 ? 0.03 * Math.exp(-st.t * 8) * Math.abs(Math.sin(st.t * 60)) : 0
        if (!st.drag) {
          st.phi += st.v * dt
          st.v *= Math.exp(-2.2 * dt)
        }
        break
      case 'rise': {
        const k = Math.min(1, st.t / 0.8)
        const e = 1 - Math.pow(1 - k, 3)
        st.alpha = (Math.PI / 2) * e
        if (k >= 1) {
          st.v = 0
          setMode('upright')
        }
        break
      }
    }

    // ticks as the rim rolls round, faster and louder as it lies lower
    if (rate && live.current.sound) {
      const half = Math.floor(st.phi / Math.PI)
      if (half !== st.lastHalf) {
        st.lastHalf = half
        if (st.mode === 'fall') tick(rate, 0.25 + (1 - st.alpha / (Math.PI / 2)) * 0.75)
      }
    }

    // lean (about x), then heading (about the vertical)
    qx.setFromAxisAngle(X, Math.PI / 2 - st.alpha)
    q.setFromAxisAngle(Y, st.phi).multiply(qx)
    const g = pose.current
    if (!g) return
    g.quaternion.copy(q)
    // rest the lowest point of the band on the table
    m4.makeRotationFromQuaternion(q)
    const e = m4.elements
    const { outer: ro, w: wd } = live.current
    g.position.set(0, ro * Math.hypot(e[1], e[5]) + (wd / 2) * Math.abs(e[9]), 0)
  })

  return (
    <group ref={pose}>
      <mesh geometry={geo} material={mat} castShadow onPointerDown={onDown} />
    </group>
  )
})

export default Ring
