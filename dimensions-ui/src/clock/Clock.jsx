import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createClockAudio } from './audio.js'

// A twin-bell alarm clock. 1 unit is about 1 cm. The drum-shaped case stands on
// two splayed legs; two bells sit on posts above it with a hammer between them
// on its own bracket, and a carry handle arcs over the lot. The dial is in the
// x/y plane facing +z.
//
// Every part is joined to something: the bells are held at their apex by posts
// that rise from the case along each bell's axis; the hammer turns on an axle
// in a bracket on the case top, and the angle at which its ball meets a bell is
// worked out from the shapes, so it touches the bell rather than passing into
// it; the handle's ends run into the case's sides; the feet stand on the table.

const CASE_R = 5.5
const CASE_D = 3.6
const CENTER_Y = 6.1 // the feet rest on the table at this height of the case centre
const DIAL_R = 4.95
const DIAL_Z = 1.36
const LEG_ANGLE = THREE.MathUtils.degToRad(35)
const FOOT_R = 0.45
const BELL = { x: 3.3, y: 7.1, r: 2.1, tilt: THREE.MathUtils.degToRad(15) }
const HAMMER = { y: 5.8, len: 2.07, ball: 0.32 } // long enough that the ball meets each bell's inner rim, not its open mouth
// A wider arch clears the bells (their outer edge sits about 1 unit inside it);
// its centre height is derived so the ends still meet the case sides at y 0.62.
const HANDLE = { r: 7.1, tube: 0.15, endX: 5.4 }
HANDLE.cy = 0.62 + Math.sqrt(HANDLE.r ** 2 - HANDLE.endX ** 2)

// Distance from a point (relative to a bell's centre, in the clock's plane) to
// the bell: a hemisphere shell opening downwards, and its rim below.
function bellDistance(qx, qy, side) {
  const ax = side * Math.sin(BELL.tilt)
  const ay = Math.cos(BELL.tilt)
  const along = qx * ax + qy * ay
  if (along >= 0) return Math.abs(Math.hypot(qx, qy) - BELL.r)
  const perp = Math.abs(qx * ay - qy * ax)
  return Math.hypot(perp - BELL.r, along)
}
// The swing angle at which the hammer's ball first touches the right bell.
const STRIKE_ANGLE = (() => {
  for (let s = 0; s < 1.4; s += 0.001) {
    const bx = HAMMER.len * Math.sin(s)
    const by = HAMMER.y + HAMMER.len * Math.cos(s)
    if (bellDistance(bx - BELL.x, by - BELL.y, 1) <= HAMMER.ball) return s
  }
  return 0.6
})()
// Each bell's post runs from inside the case up its axis to the apex.
function bellPost(side) {
  const ax = side * Math.sin(BELL.tilt)
  const ay = Math.cos(BELL.tilt)
  const apex = [side * BELL.x + ax * BELL.r, BELL.y + ay * BELL.r]
  let t = 0
  while (Math.hypot(apex[0] - ax * t, apex[1] - ay * t) > CASE_R - 0.15 && t < 12) t += 0.01
  return { apex, len: t, mid: [apex[0] - (ax * t) / 2, apex[1] - (ay * t) / 2] }
}

function handGeometry({ length, width, tail = 0.5, kind = 'spade' }) {
  const s = new THREE.Shape()
  const w = width / 2
  s.moveTo(-w * 0.6, -tail)
  s.lineTo(w * 0.6, -tail)
  s.lineTo(w, 0)
  if (kind === 'spade') {
    s.lineTo(w * 0.55, length * 0.62)
    s.lineTo(w * 1.5, length * 0.74)
    s.lineTo(0, length)
    s.lineTo(-w * 1.5, length * 0.74)
    s.lineTo(-w * 0.55, length * 0.62)
  } else if (kind === 'arrow') {
    s.lineTo(w * 0.6, length * 0.82)
    s.lineTo(w * 2.4, length * 0.82)
    s.lineTo(0, length)
    s.lineTo(-w * 2.4, length * 0.82)
    s.lineTo(-w * 0.6, length * 0.82)
  } else {
    s.lineTo(w * 0.5, length)
    s.lineTo(-w * 0.5, length)
  }
  s.lineTo(-w, 0)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false })
}

function caseGeometry() {
  // side profile [radius, z], revolved: a drum with rounded edges and a front lip
  const prof = [
    [0, -CASE_D / 2],
    [4.9, -CASE_D / 2],
    [5.3, -1.65],
    [CASE_R, -1.2],
    [CASE_R, 1.2],
    [5.35, 1.65],
    [5.0, 1.8],
    [DIAL_R, DIAL_Z + 0.02],
  ].map(([r, z]) => new THREE.Vector2(r, z))
  const g = new THREE.LatheGeometry(prof, 96)
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
function dialTexture({ color, style }) {
  const S = 1024
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const ink = new THREE.Color(color).getHSL({}).l > 0.5 ? '#1a1a1a' : '#f4efe4'
  g.fillStyle = color
  g.fillRect(0, 0, S, S)
  // a soft sunken shading towards the edge
  const sh = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2)
  sh.addColorStop(0, 'rgba(0,0,0,0)')
  sh.addColorStop(1, 'rgba(0,0,0,0.18)')
  g.fillStyle = sh
  g.fillRect(0, 0, S, S)
  g.translate(S / 2, S / 2)
  g.fillStyle = ink
  g.strokeStyle = ink
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2
    const major = i % 5 === 0
    g.save()
    g.rotate(a)
    g.fillRect(major ? -5 : -2, -S * 0.47, major ? 10 : 4, major ? 38 : 18)
    g.restore()
  }
  if (style !== 'minimal') {
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = S * 0.355
      const label = style === 'roman' ? ROMAN[i] : String(i === 0 ? 12 : i)
      g.font = style === 'roman' ? `600 ${S * 0.07}px Georgia, serif` : `700 ${S * 0.095}px "Helvetica Neue", Arial, sans-serif`
      g.save()
      g.translate(Math.sin(a) * r, -Math.cos(a) * r)
      if (style === 'roman') g.rotate(a)
      g.fillText(label, 0, 0)
      g.restore()
    }
  }
  g.font = `600 ${S * 0.03}px "Helvetica Neue", Arial, sans-serif`
  g.textAlign = 'center'
  g.fillText('REACT DIMENSIONS', 0, -S * 0.17)
  g.font = `500 ${S * 0.024}px "Helvetica Neue", Arial, sans-serif`
  g.fillText('ALARM · TWIN BELL', 0, S * 0.19)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const FINISH = {
  chrome: { color: '#d9dce1', metalness: 1, roughness: 0.14 },
  brass: { color: '#cfa654', metalness: 1, roughness: 0.22 },
  black: { color: '#222326', metalness: 0.6, roughness: 0.35 },
}

// 'HH:MM' <-> minutes on a 12-hour dial
const toMin12 = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim())
  if (!m) return 7 * 60
  return ((+m[1] % 12) * 60 + (+m[2] % 60)) % 720
}
const fromMin12 = (min) => {
  const m = Math.round(min) % 720
  const h = Math.floor(m / 60)
  return `${String(h === 0 ? 12 : h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a))

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

// caseColor, dialColor, dialStyle (classic | roman | minimal), bellFinish
// (chrome | brass | black). alarm: 'HH:MM'; alarmOn: whether it rings. Drag the
// hands to set the time, the gold hand to set the alarm; click the bells to try
// the alarm, or to stop it ringing.
export default function Clock({
  caseColor = '#c8312a',
  dialColor = '#f3eee2',
  dialStyle = 'classic',
  bellFinish = 'chrome',
  alarm: alarmProp = '07:00',
  alarmOn: alarmOnProp = true,
  sound = false,
  onChange,
}) {
  const [alarm, setAlarm] = useTwoWay(alarmProp, 'alarm', onChange)
  const [alarmOn] = useTwoWay(alarmOnProp, 'alarmOn', onChange)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)
  useCursor(hover || dragging, dragging ? 'grabbing' : 'pointer')
  const { camera, controls } = useThree()

  const geo = useMemo(() => {
    const posts = [-1, 1].map(bellPost)
    const arc = []
    const a0 = Math.atan2(0.62 - HANDLE.cy, HANDLE.endX) // ends just inside the case's sides
    for (let i = 0; i <= 64; i++) {
      const a = a0 + ((Math.PI - 2 * a0) * i) / 64
      arc.push(new THREE.Vector3(Math.cos(a) * HANDLE.r, HANDLE.cy + Math.sin(a) * HANDLE.r, 0))
    }
    return {
      case: caseGeometry(),
      dial: new THREE.CircleGeometry(DIAL_R, 96),
      bezel: new THREE.TorusGeometry(5.18, 0.22, 16, 96),
      crystal: new THREE.SphereGeometry(12, 64, 8, 0, Math.PI * 2, 0, Math.asin(DIAL_R / 12)).rotateX(Math.PI / 2),
      hour: handGeometry({ length: 2.7, width: 0.34 }),
      minute: handGeometry({ length: 3.95, width: 0.24 }),
      second: handGeometry({ length: 4.25, width: 0.07, tail: 1.0, kind: 'line' }),
      alarm: handGeometry({ length: 2.2, width: 0.12, tail: 0.3, kind: 'arrow' }),
      cap: new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24).rotateX(Math.PI / 2),
      bell: new THREE.SphereGeometry(BELL.r, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      bellRim: new THREE.TorusGeometry(BELL.r, 0.06, 8, 48).rotateX(Math.PI / 2),
      post: new THREE.CylinderGeometry(0.1, 0.1, 1, 12),
      nut: new THREE.CylinderGeometry(0.2, 0.2, 0.18, 6),
      posts,
      bracket: new THREE.BoxGeometry(0.5, HAMMER.y - CASE_R + 0.3, 0.6),
      axle: new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12).rotateX(Math.PI / 2),
      arm: new THREE.CylinderGeometry(0.06, 0.06, HAMMER.len, 10).translate(0, HAMMER.len / 2, 0),
      ball: new THREE.SphereGeometry(HAMMER.ball, 20, 14),
      handle: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 96, HANDLE.tube, 12, false),
      leg: new THREE.CylinderGeometry(0.28, 0.36, 1.75, 16),
      foot: new THREE.SphereGeometry(FOOT_R, 20, 14),
      key: new THREE.CylinderGeometry(0.12, 0.12, 0.5, 12).rotateX(Math.PI / 2),
      wing: new THREE.BoxGeometry(1.1, 0.5, 0.08),
    }
  }, [])
  const dialTex = useMemo(() => dialTexture({ color: dialColor, style: dialStyle }), [dialColor, dialStyle])
  const mats = useMemo(
    () => ({
      case: new THREE.MeshPhysicalMaterial({ metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 }),
      metal: new THREE.MeshPhysicalMaterial({ envMapIntensity: 1.4 }),
      chrome: new THREE.MeshPhysicalMaterial({ color: '#d9dce1', metalness: 1, roughness: 0.14, envMapIntensity: 1.4 }),
      hand: new THREE.MeshPhysicalMaterial({ color: '#151515', metalness: 0.5, roughness: 0.35 }),
      second: new THREE.MeshPhysicalMaterial({ color: '#d8361f', metalness: 0.4, roughness: 0.35 }),
      alarm: new THREE.MeshPhysicalMaterial({ color: '#c9973b', metalness: 1, roughness: 0.28 }),
      dial: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      crystal: new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false }),
      black: new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.6, metalness: 0.3 }),
    }),
    [],
  )
  useEffect(() => () => dialTex.dispose(), [dialTex])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g?.dispose?.())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, mats],
  )
  useEffect(() => {
    mats.case.color.set(caseColor)
    mats.dial.map = dialTex
    mats.dial.needsUpdate = true
    const f = FINISH[bellFinish] || FINISH.chrome
    mats.metal.color.set(f.color)
    mats.metal.metalness = f.metalness
    mats.metal.roughness = f.roughness
  }, [mats, caseColor, dialTex, bellFinish])

  // ---- sound ----
  const audio = useRef(null)
  const soundOn = useRef(sound)
  soundOn.current = sound
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, arg) => {
    if (!soundOn.current) return
    if (!audio.current) audio.current = createClockAudio()
    audio.current?.[name](arg)
  }

  // ---- time, alarm and motion ----
  const st = useRef({ offset: 0, sec: -1, secAngle: 0, secV: 0, prevMin: null, ringUntil: 0, hammer: 0, lastSide: 0, alarmMin: toMin12(alarmProp), alarmDrag: null })
  const live = useRef({})
  live.current = { alarm, alarmOn }
  useEffect(() => {
    if (!st.current.alarmDrag) st.current.alarmMin = toMin12(alarm)
  }, [alarm])

  const root = useRef()
  const hands = { hour: useRef(), minute: useRef(), second: useRef(), alarm: useRef() }
  const hammerRef = useRef()
  const drag = useRef(null) // 'hour' | 'minute' | 'alarm'
  const plane = useMemo(() => new THREE.Plane(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const nrm = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const up = () => {
      const s = st.current
      if (drag.current === 'alarm' && s.alarmDrag != null) {
        setAlarm(fromMin12(s.alarmDrag))
        s.alarmMin = s.alarmDrag
        s.alarmDrag = null
      }
      drag.current = null
      setDragging(false)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls])

  const grab = (which) => (e) => {
    e.stopPropagation()
    drag.current = which
    setDragging(true)
    if (controls) controls.enabled = false
  }
  const ring = (e) => {
    e.stopPropagation()
    const s = st.current
    const now = performance.now()
    s.ringUntil = s.ringUntil > now ? 0 : now + 2500 // try it, or stop it
  }

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const w = live.current
    const t = state.clock.elapsedTime
    const nowMs = Date.now() + s.offset
    const d = new Date(nowMs)
    const secs = d.getSeconds()
    const min12 = (d.getHours() % 12) * 60 + d.getMinutes() + secs / 60
    const TAU = Math.PI * 2

    // dragging a hand: the pointer's angle round the dial, clockwise from 12
    if (drag.current) {
      const g = root.current
      g.updateMatrixWorld()
      nrm.set(0, 0, 1).transformDirection(g.matrixWorld)
      hit.set(0, CENTER_Y, DIAL_Z).applyMatrix4(g.matrixWorld)
      plane.setFromNormalAndCoplanarPoint(nrm, hit)
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        g.worldToLocal(hit)
        const a = Math.atan2(hit.x, hit.y - CENTER_Y)
        if (drag.current === 'alarm') {
          s.alarmDrag = ((((a / TAU) * 720) % 720) + 720) % 720
        } else {
          // turn the time by however far the hand has been pulled round
          const per = drag.current === 'minute' ? 60 : 720
          const cur = ((min12 % per) / per) * TAU
          s.offset += (wrapPi(a - cur) / TAU) * per * 60000
        }
      }
    }

    // the alarm goes off when the time passes it
    const alarmMin = s.alarmDrag ?? s.alarmMin
    if (s.prevMin != null && w.alarmOn) {
      const crossed = s.prevMin <= min12 ? alarmMin > s.prevMin && alarmMin <= min12 : alarmMin > s.prevMin || alarmMin <= min12
      if (crossed && Math.abs(min12 - s.prevMin) < 30) s.ringUntil = performance.now() + 20000
    }
    s.prevMin = min12

    // hands: hour and minute glide; the second hand ticks with a little recoil
    hands.hour.current.rotation.z = -((min12 / 720) * TAU)
    hands.minute.current.rotation.z = -(((min12 % 60) / 60) * TAU)
    hands.alarm.current.rotation.z = -((alarmMin / 720) * TAU)
    if (secs !== s.sec) {
      if (s.sec >= 0) play('tick', secs % 2)
      s.sec = secs
    }
    const target = (secs / 60) * TAU
    s.secV += (wrapPi(target - s.secAngle) * 900 - s.secV * 30) * dt
    s.secAngle += s.secV * dt
    hands.second.current.rotation.z = -s.secAngle

    // ringing: the hammer beats between the bells and the clock dances on its feet
    const ringing = performance.now() < s.ringUntil
    const r = root.current
    if (ringing) {
      const beat = Math.sin(t * 2 * Math.PI * 11)
      const swing = THREE.MathUtils.clamp(beat * 1.35, -1, 1) * STRIKE_ANGLE
      const side = swing >= STRIKE_ANGLE * 0.999 ? 1 : swing <= -STRIKE_ANGLE * 0.999 ? -1 : 0
      if (side && side !== s.lastSide) play('bell', side > 0)
      s.lastSide = side || (Math.abs(swing) < STRIKE_ANGLE * 0.5 ? 0 : s.lastSide)
      s.hammer = swing
      r.position.x = Math.sin(t * 53) * 0.05
      r.position.z = Math.sin(t * 41 + 1) * 0.04
      r.rotation.z = Math.sin(t * 47) * 0.012
    } else {
      s.hammer += (0 - s.hammer) * (1 - Math.exp(-dt * 12))
      s.lastSide = 0
      r.position.x += (0 - r.position.x) * (1 - Math.exp(-dt * 10))
      r.position.z += (0 - r.position.z) * (1 - Math.exp(-dt * 10))
      r.rotation.z += (0 - r.rotation.z) * (1 - Math.exp(-dt * 10))
    }
    hammerRef.current.rotation.z = -s.hammer
  })

  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }
  const posts = geo.posts

  return (
    <group ref={root}>
      <group position={[0, CENTER_Y, 0]}>
        {/* case, dial, bezel and crystal */}
        <mesh geometry={geo.case} material={mats.case} castShadow receiveShadow />
        <mesh geometry={geo.dial} material={mats.dial} position={[0, 0, DIAL_Z]} />
        <mesh geometry={geo.bezel} material={mats.chrome} position={[0, 0, 1.72]} castShadow />
        <mesh geometry={geo.crystal} material={mats.crystal} position={[0, 0, 1.6 - 12 * Math.cos(Math.asin(DIAL_R / 12))]} renderOrder={3} />

        {/* hands, stacked on the centre arbor; drag them to set the time and the alarm */}
        <group position={[0, 0, DIAL_Z + 0.03]}>
          <mesh ref={hands.alarm} geometry={geo.alarm} material={mats.alarm} onPointerDown={grab('alarm')} {...hoverProps} />
          <mesh ref={hands.hour} geometry={geo.hour} material={mats.hand} position-z={0.05} castShadow onPointerDown={grab('hour')} {...hoverProps} />
          <mesh ref={hands.minute} geometry={geo.minute} material={mats.hand} position-z={0.1} castShadow onPointerDown={grab('minute')} {...hoverProps} />
          <mesh ref={hands.second} geometry={geo.second} material={mats.second} position-z={0.15} />
          <mesh geometry={geo.cap} material={mats.chrome} position-z={0.2} />
        </group>

        {/* legs and ball feet */}
        {[-1, 1].map((s) => {
          const dx = s * Math.sin(LEG_ANGLE)
          const dy = -Math.cos(LEG_ANGLE)
          return (
            <group key={s}>
              <mesh geometry={geo.leg} material={mats.metal} position={[dx * 6.05, dy * 6.05, 0]} rotation={[0, 0, s * LEG_ANGLE]} castShadow />
              <mesh geometry={geo.foot} material={mats.metal} position={[dx * 6.9, dy * 6.9, 0]} castShadow />
            </group>
          )
        })}

        {/* the bells on their posts, the hammer and the handle: click them to ring */}
        <group onClick={ring} {...hoverProps}>
          {[-1, 1].map((s, i) => (
            <group key={s}>
              <group position={[s * BELL.x, BELL.y, 0]} rotation={[0, 0, -s * BELL.tilt]}>
                {/* a thin shell: seen from inside as well as out */}
                <mesh geometry={geo.bell} castShadow>
                  <meshPhysicalMaterial {...(FINISH[bellFinish] || FINISH.chrome)} side={THREE.DoubleSide} envMapIntensity={1.4} />
                </mesh>
                <mesh geometry={geo.bellRim} material={mats.metal} />
              </group>
              <mesh geometry={geo.post} material={mats.chrome} position={[posts[i].mid[0], posts[i].mid[1], 0]} rotation={[0, 0, -s * BELL.tilt]} scale={[1, posts[i].len, 1]} />
              <mesh geometry={geo.nut} material={mats.chrome} position={[posts[i].apex[0] + s * Math.sin(BELL.tilt) * 0.08, posts[i].apex[1] + Math.cos(BELL.tilt) * 0.08, 0]} rotation={[0, 0, -s * BELL.tilt]} />
            </group>
          ))}
          <mesh geometry={geo.bracket} material={mats.black} position={[0, (CASE_R - 0.3 + HAMMER.y) / 2 + 0.15, 0]} />
          <mesh geometry={geo.axle} material={mats.chrome} position={[0, HAMMER.y, 0]} />
          <group ref={hammerRef} position={[0, HAMMER.y, 0]}>
            <mesh geometry={geo.arm} material={mats.chrome} />
            <mesh geometry={geo.ball} material={mats.metal} position={[0, HAMMER.len, 0]} castShadow />
          </group>
          <mesh geometry={geo.handle} material={mats.metal} castShadow />
        </group>

        {/* winding keys on the back */}
        {[-1.8, 1.8].map((x) => (
          <group key={x} position={[x, -1.2, -CASE_D / 2 - 0.2]}>
            <mesh geometry={geo.key} material={mats.chrome} />
            <mesh geometry={geo.wing} material={mats.chrome} position-z={-0.25} />
          </group>
        ))}
      </group>
    </group>
  )
}
