import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import {
  ARM_PATH,
  CENTER,
  GROOVE_IN,
  GROOVE_OUT,
  HEADSHELL_YAW,
  KNOB,
  PARK_R,
  PIVOT,
  PLINTH,
  POWER,
  PUCK,
  REC_R,
  needleRadius,
  thetaForRadius,
  thetaTowards,
} from './arm.js'
import { sheenTexture, vinylTextures, woodTexture } from './textures.js'
import { createVinylAudio } from './audio.js'

const ARM_Y = 0.56 // height of the tonearm above the plinth
const REC_Y = 0.21 // top surface of the record
const PLATTER_TOP = 0.16 // top of the aluminium platter (the mat sits on it)
const LIFT_PITCH = 0.075 // how far the arm pitches up (radians) when lifted
const REST_Z = 1.15 // where along the arm tube the rest holds it
const RPM33 = (33.33 * Math.PI * 2) / 60
const RPM45 = (45 * Math.PI * 2) / 60
const KNOB_ANGLE = { 33: -1.1, 45: -2.0 }
const FLOOR_Y = -0.62 // the deck stands on small feet; a removed record lies under/beside it
const CARRY_Y = 1.15 // height of a record held in the hand
const SNAP = 1.9 // dropped this close to the spindle, it goes back on the platter

// Read by the camera rig: pulls back when the record is off the deck so it fits in view.
export const view = { zoom: 1 }

const clamp = (v, a, b) => Math.min(Math.max(v, a), b)

// Where a dropped record comes to rest: outside the deck's footprint, in the
// nearest free spot (the back counts as farther, since it's out of sight).
function restSpot(x, z) {
  const hw = PLINTH.w / 2 + 1
  const hd = PLINTH.d / 2 + 1
  if (Math.abs(x) >= hw || z >= hd || z <= -hd) return [x, z]
  const opts = [
    [hw - x, [hw, z]],
    [x + hw, [-hw, z]],
    [hd - z + 1.5, [x, hd]], // the front is cropped by the frame, so prefer the sides
    [z + hd + 4, [x, -hd]],
  ]
  opts.sort((a, b) => a[0] - b[0])
  return opts[0][1]
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// Colour pickers fire on every drag step; texture drawing is heavy, so wait
// until the value settles.
function useSettled(value, ms = 180) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// Prop that can also be changed from inside the scene (clicking the power
// button, say). `onChange` lets the owner stay in sync.
function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  const set = (next) => {
    setV(next)
    onChange?.({ [key]: next })
  }
  return [v, set]
}

function plinthGeometry() {
  const { w, d, t, r } = PLINTH
  const bevel = 0.045
  const hw = w / 2 - bevel
  const hd = d / 2 - bevel
  const rr = r - bevel
  const s = new THREE.Shape()
  s.moveTo(-hw + rr, -hd)
  s.lineTo(hw - rr, -hd)
  s.absarc(hw - rr, -hd + rr, rr, -Math.PI / 2, 0, false)
  s.lineTo(hw, hd - rr)
  s.absarc(hw - rr, hd - rr, rr, 0, Math.PI / 2, false)
  s.lineTo(-hw + rr, hd)
  s.absarc(-hw + rr, hd - rr, rr, Math.PI / 2, Math.PI, false)
  s.lineTo(-hw, -hd + rr)
  s.absarc(-hw + rr, -hd + rr, rr, Math.PI, Math.PI * 1.5, false)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: t,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 20,
  })
  g.rotateX(-Math.PI / 2) // shape y -> -z, extrusion -> up
  g.translate(0, -(t + bevel), 0) // top surface at y = 0
  return g
}

function armGeometry(radius = 0.052) {
  const pts = ARM_PATH.map(([x, z]) => new THREE.Vector3(x, 0, z))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), 80, radius, 12)
}

// Where the arm rest goes: under the tube when the arm is parked and lifted.
function restPlacement() {
  const theta = thetaForRadius(PARK_R)
  // arm-frame x of the tube at REST_Z (the path is near enough straight there)
  let xA = 0
  for (let i = 1; i < ARM_PATH.length; i++) {
    const [x0, z0] = ARM_PATH[i - 1]
    const [x1, z1] = ARM_PATH[i]
    if (REST_Z >= z0 && REST_Z <= z1) {
      xA = x0 + ((REST_Z - z0) / (z1 - z0)) * (x1 - x0)
      break
    }
  }
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return {
    x: PIVOT.x + xA * c + REST_Z * s,
    z: PIVOT.z - xA * s + REST_Z * c,
    y: ARM_Y + Math.sin(LIFT_PITCH) * REST_Z, // the lifted arm rises towards its tip
    theta,
  }
}

export default function Turntable({
  playing: playingProp = true,
  speed: speedProp = '33',
  sound = false,
  volume = 0.7,
  wood = '#7a4524',
  grain = 0.65,
  gloss = 0.45,
  vinyl = '#0b0b0d',
  accent = '#ffffff',
  finish = 'solid',
  label = '#e3302b',
  labelText = 'SIDE A',
  onChange,
  onHint,
  controlsRef,
}) {
  const { camera, raycaster, pointer, gl } = useThree()
  const [playing, setPlaying] = useTwoWay(playingProp, 'playing', onChange)
  const [speed, setSpeed] = useTwoWay(speedProp, 'speed', onChange)

  // --- looks ---
  const woodKey = useSettled(`${wood}|${grain}`)
  const woodTex = useMemo(() => {
    const [c, gr] = woodKey.split('|')
    return woodTexture({ color: c, grain: +gr })
  }, [woodKey])
  useEffect(() => () => woodTex.dispose(), [woodTex])
  const discKey = useSettled(`${vinyl}|${accent}|${finish}|${label}|${labelText}`)
  const disc = useMemo(() => {
    const [v, a, f, l, t] = discKey.split('|')
    return vinylTextures({ vinyl: v, accent: a, finish: f, label: l, labelText: t })
  }, [discKey])
  useEffect(() => () => disc.dispose(), [disc])
  const sheen = useMemo(() => sheenTexture(), [])
  const plinth = useMemo(plinthGeometry, [])
  const arm = useMemo(() => armGeometry(), [])
  const armHit = useMemo(() => armGeometry(0.2), [])
  const rest = useMemo(restPlacement, [])
  useEffect(
    () => () => {
      sheen.dispose()
      plinth.dispose()
      arm.dispose()
      armHit.dispose()
    },
    [sheen, plinth, arm, armHit],
  )

  // --- parts to animate ---
  const recRef = useRef()
  const spinRef = useRef()
  const armYaw = useRef()
  const armPitch = useRef()
  const knobRef = useRef()
  const sheenRef = useRef()
  const ledMat = useRef()

  const s = useRef({
    omega: 0, // platter speed
    rec: 'loaded', // 'loaded' on the platter | 'carried' in the hand | 'resting' off the deck
    recX: CENTER.x,
    recZ: CENTER.z,
    recY: REC_Y - 0.015,
    recAngle: 0,
    recOmega: 0,
    restX: 0,
    restZ: 0,
    offX: 0,
    offZ: 0,
    tiltX: 0,
    tiltZ: 0,
    hint: '',
    theta: thetaForRadius(PARK_R),
    thetaVel: 0,
    lift: 1,
    liftVel: 0,
    r: GROOVE_OUT,
    engaged: false, // the needle is working along the groove
    userPlaced: false, // the arm was put on the record by hand
    dragging: false,
    scratching: false,
    lastA: 0,
    knob: KNOB_ANGLE[speedProp] ?? KNOB_ANGLE[33],
    knobVel: 0,
    led: 0,
    prevPlaying: playingProp,
    audioT: 0,
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -REC_Y),
    hit: new THREE.Vector3(),
  })
  const live = useRef({})
  live.current = { playing, speed }

  // --- sound ---
  const audio = useRef(null)
  useEffect(() => {
    if (!sound) return
    const a = createVinylAudio()
    if (!a) return
    a.start()
    a.setVolume(volume)
    audio.current = a
    return () => {
      a.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => audio.current?.setVolume(volume), [volume])

  // --- pointer interaction ---
  const [hoverArm, setHoverArm] = useState(false)
  const [hoverBtn, setHoverBtn] = useState(false)
  const [hoverDisc, setHoverDisc] = useState(false)
  useCursor(hoverArm || hoverDisc, 'grab')
  useCursor(hoverBtn, 'pointer')

  useEffect(() => {
    const up = () => {
      const st = s.current
      if (controlsRef?.current) controlsRef.current.enabled = true
      if (st.dragging) {
        st.dragging = false
        const r = needleRadius(st.theta)
        if (r < REC_R - 0.05) {
          // Dropped onto the record: stay there and play from this spot.
          st.userPlaced = true
          st.r = Math.min(Math.max(r, GROOVE_IN), GROOVE_OUT)
          st.engaged = true
        } else {
          st.userPlaced = false
          st.engaged = false
        }
      }
      st.scratching = false
      if (st.rec === 'carried') {
        const d = Math.hypot(st.recX - CENTER.x, st.recZ - CENTER.z)
        if (d < SNAP) st.rec = 'loaded'
        else {
          st.rec = 'resting'
          ;[st.restX, st.restZ] = restSpot(st.recX, st.recZ)
        }
      }
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controlsRef])

  const grab = (e, what) => {
    e.stopPropagation()
    const st = s.current
    if (controlsRef?.current) controlsRef.current.enabled = false
    if (what === 'arm') {
      st.dragging = true
      st.engaged = false
    } else if (st.rec === 'resting') {
      // Pick the record up off the floor.
      st.rec = 'carried'
      raycaster.setFromCamera(pointer, camera)
      st.plane.constant = -CARRY_Y
      if (raycaster.ray.intersectPlane(st.plane, st.hit)) {
        st.offX = st.recX - st.hit.x
        st.offZ = st.recZ - st.hit.z
      } else st.offX = st.offZ = 0
      st.plane.constant = -REC_Y
    } else {
      // On the platter: spin it by hand, or pull it past the edge to lift it off.
      st.scratching = true
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(st.plane, st.hit)) st.lastA = Math.atan2(st.hit.x - CENTER.x, st.hit.z - CENTER.z)
    }
  }

  const thetaOuter = useMemo(() => thetaForRadius(GROOVE_OUT), [])
  const thetaPark = useMemo(() => thetaForRadius(PARK_R), [])
  const thetaMax = useMemo(() => thetaForRadius(GROOVE_IN), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const st = s.current
    const { playing: on, speed: sp } = live.current
    const target = on ? (sp === '45' ? RPM45 : RPM33) : 0
    const hasRecord = st.rec === 'loaded'
    const hitAt = (y) => {
      raycaster.setFromCamera(pointer, camera)
      st.plane.constant = -y
      const ok = raycaster.ray.intersectPlane(st.plane, st.hit)
      st.plane.constant = -REC_Y
      return ok
    }

    // Stopping the deck, or taking the record off, parks the arm.
    if ((st.prevPlaying && !on) || !hasRecord) {
      st.userPlaced = false
      st.engaged = false
    }
    if (!st.prevPlaying && on && st.userPlaced && needleRadius(st.theta) < REC_R) {
      st.engaged = true
      st.r = needleRadius(st.theta)
    }
    st.prevPlaying = on

    // ---- Platter motor and record ----
    if (st.scratching && hasRecord) {
      if (hitAt(REC_Y)) {
        const dx = st.hit.x - CENTER.x
        const dz = st.hit.z - CENTER.z
        if (Math.hypot(dx, dz) > REC_R + 0.12) {
          // Pulled past the edge: the record comes off the platter.
          st.rec = 'carried'
          st.scratching = false
          if (hitAt(CARRY_Y)) {
            st.offX = st.recX - st.hit.x
            st.offZ = st.recZ - st.hit.z
          } else st.offX = st.offZ = 0
        } else {
          const a = Math.atan2(dx, dz)
          const da = wrap(a - st.lastA)
          st.lastA = a
          st.recAngle += da
          st.recOmega += (da / Math.max(dt, 1e-3) - st.recOmega) * 0.35
          st.omega = st.recOmega
        }
      }
    } else {
      const needleOn = hasRecord && st.lift < 0.2 && needleRadius(st.theta) < REC_R
      const tau = on ? 0.9 : needleOn ? 2.4 : 4.2 // motor torque vs. platter inertia
      st.omega += (target - st.omega) * (1 - Math.exp(-dt / tau))
      // Friction ties the record to the platter; off the platter it just slows.
      if (hasRecord) st.recOmega += (st.omega - st.recOmega) * (1 - Math.exp(-dt / 0.12))
      else st.recOmega *= Math.exp(-dt * 2.5)
      st.recAngle += st.recOmega * dt
    }

    // Where the record is: on the platter, in the hand, or lying beside the deck.
    let tx = CENTER.x
    let tz = CENTER.z
    let ty = REC_Y - 0.015
    let k = 16
    if (st.rec === 'carried') {
      ty = CARRY_Y
      if (hitAt(CARRY_Y)) {
        tx = st.hit.x + st.offX
        tz = st.hit.z + st.offZ
      } else {
        tx = st.recX
        tz = st.recZ
      }
      tx = clamp(tx, -9, 9)
      tz = clamp(tz, -6.5, 7)
      k = 20
    } else if (st.rec === 'resting') {
      tx = st.restX
      tz = st.restZ
      ty = FLOOR_Y + 0.016
      k = 10
    }
    const px = st.recX
    const pz = st.recZ
    st.recX += (tx - st.recX) * (1 - Math.exp(-dt * k))
    st.recZ += (tz - st.recZ) * (1 - Math.exp(-dt * k))
    st.recY += (ty - st.recY) * (1 - Math.exp(-dt * 12))
    const carried = st.rec === 'carried'
    const vx = (st.recX - px) / Math.max(dt, 1e-3)
    const vz = (st.recZ - pz) / Math.max(dt, 1e-3)
    const ease = 1 - Math.exp(-dt * 10)
    st.tiltZ += ((carried ? -clamp(vx * 0.025, -0.3, 0.3) : 0) - st.tiltZ) * ease
    st.tiltX += ((carried ? clamp(vz * 0.025, -0.3, 0.3) : 0) - st.tiltX) * ease
    recRef.current.position.set(st.recX, st.recY, st.recZ)
    recRef.current.rotation.set(st.tiltX, 0, st.tiltZ)
    spinRef.current.rotation.y = st.recAngle
    view.zoom = hasRecord ? 1 : 1.42
    const hint = hasRecord ? 'Pull the record past its edge to lift it off' : 'Drag the record back onto the platter'
    if (hint !== st.hint) {
      st.hint = hint
      onHint?.(hint)
    }

    // ---- Tonearm ----
    let thetaT = st.theta
    let liftT = st.lift
    if (st.dragging) {
      raycaster.setFromCamera(pointer, camera)
      st.plane.constant = -ARM_Y
      if (raycaster.ray.intersectPlane(st.plane, st.hit)) {
        // the rest's clip stops the arm swinging out past its parked position
        thetaT = Math.min(Math.max(thetaTowards(st.hit.x, st.hit.z), thetaPark - 0.02), thetaMax)
        // Follow the hand directly, and lift while carrying it.
        st.theta += (thetaT - st.theta) * Math.min(1, dt * 18)
        st.thetaVel = 0
      }
      st.plane.constant = -REC_Y
      liftT = 1
    } else if (on && hasRecord) {
      if (!st.engaged) {
        // Cue: swing out to the first groove, then lower.
        thetaT = thetaOuter
        liftT = 1
        if (Math.abs(st.theta - thetaOuter) < 0.012) {
          st.engaged = true
          st.r = GROOVE_OUT
        }
      } else {
        // Play: lowered, creeping inwards as the groove spirals.
        liftT = 0
        st.r = Math.max(GROOVE_IN, st.r - 0.013 * dt)
        thetaT = thetaForRadius(st.r)
      }
    } else if (st.userPlaced) {
      thetaT = st.theta
      liftT = needleRadius(st.theta) < REC_R ? 0 : 1
    } else {
      thetaT = thetaPark
      liftT = 1
    }
    if (!st.dragging) {
      st.thetaVel += ((thetaT - st.theta) * 36 - st.thetaVel * 9) * dt
      st.theta += st.thetaVel * dt
    }
    st.liftVel += ((liftT - st.lift) * 70 - st.liftVel * 11) * dt
    st.lift += st.liftVel * dt
    armYaw.current.rotation.y = st.theta
    armPitch.current.rotation.x = -Math.min(Math.max(st.lift, 0), 1.15) * LIFT_PITCH

    // ---- Knob and light ----
    const knobT = KNOB_ANGLE[sp] ?? KNOB_ANGLE[33]
    st.knobVel += ((knobT - st.knob) * 120 - st.knobVel * 13) * dt
    st.knob += st.knobVel * dt
    knobRef.current.rotation.y = st.knob
    st.led += ((on ? 1 : 0) - st.led) * (1 - Math.exp(-dt * 8))
    if (ledMat.current) ledMat.current.emissiveIntensity = st.led * 3

    // ---- Light sheen: shifts as the view orbits ----
    sheenRef.current.rotation.z = Math.atan2(camera.position.x - CENTER.x, camera.position.z - CENTER.z) * 1 + 0.6

    // ---- Sound ----
    st.audioT += dt
    if (audio.current && st.audioT > 0.04) {
      st.audioT = 0
      const needleOn = hasRecord && st.lift < 0.25 && needleRadius(st.theta) < REC_R - 0.02
      const speedFactor = Math.abs(st.recOmega) / RPM33
      audio.current.set(speedFactor, needleOn ? Math.min(1, Math.abs(st.recOmega) / 1.2) : 0)
    }
  })

  const woodMat = (
    <meshPhysicalMaterial map={woodTex} roughness={0.62 - gloss * 0.35} metalness={0} clearcoat={gloss} clearcoatRoughness={0.25} />
  )
  const chrome = <meshPhysicalMaterial color="#d8dade" metalness={1} roughness={0.14} envMapIntensity={1.3} />
  const black = <meshPhysicalMaterial color="#141416" roughness={0.55} metalness={0.1} clearcoat={0.3} />

  return (
    <group>
      {/* Plinth */}
      <mesh geometry={plinth} castShadow receiveShadow>
        {woodMat}
      </mesh>

      {/* Feet: the deck stands clear of the floor, so a removed record can slide under it */}
      {[[-3.7, -2.3], [3.7, -2.3], [-3.7, 2.3], [3.7, 2.3]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (FLOOR_Y - 0.445) / 2, z]} castShadow>
          <cylinderGeometry args={[0.22, 0.26, -0.445 - FLOOR_Y, 24]} />
          <meshStandardMaterial color="#17171a" roughness={0.85} />
        </mesh>
      ))}

      {/* Platter: bare aluminium with a felt mat when the record is off */}
      <group position={[CENTER.x, 0, CENTER.z]}>
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[REC_R + 0.1, REC_R + 0.1, 0.16, 96]} />
          <meshPhysicalMaterial color="#c9ccd1" metalness={1} roughness={0.28} envMapIntensity={1.2} />
        </mesh>
        <mesh position={[0, 0.17, 0]} receiveShadow>
          <cylinderGeometry args={[REC_R - 0.02, REC_R - 0.02, 0.02, 96]} />
          <meshStandardMaterial color="#26262a" roughness={0.95} />
        </mesh>
        {/* Spindle: from the platter top up through the record */}
        <mesh position={[0, (PLATTER_TOP + REC_Y + 0.15) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, REC_Y + 0.15 - PLATTER_TOP, 20]} />
          {chrome}
        </mesh>
        <mesh position={[0, REC_Y + 0.15, 0]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          {chrome}
        </mesh>
      </group>

      {/* The record: sits on the platter, or is carried / left beside the deck */}
      <group ref={recRef} position={[CENTER.x, REC_Y - 0.015, CENTER.z]}>
        <group ref={spinRef}>
          <mesh
            castShadow
            receiveShadow
            onPointerDown={(e) => grab(e, 'disc')}
            onPointerOver={() => setHoverDisc(true)}
            onPointerOut={() => setHoverDisc(false)}
          >
            <cylinderGeometry args={[REC_R, REC_R, 0.03, 128]} />
            <meshPhysicalMaterial attach="material-0" color="#0b0b0d" roughness={0.3} />
            <meshPhysicalMaterial
              attach="material-1"
              map={disc.map}
              bumpMap={disc.bump}
              bumpScale={1.4}
              roughness={0.5}
              metalness={0.05}
              clearcoat={0.12}
              clearcoatRoughness={0.35}
              envMapIntensity={0.28}
            />
            <meshPhysicalMaterial attach="material-2" color="#0b0b0d" roughness={0.4} />
          </mesh>
        </group>
        {/* Moving light bands (stay still while the record spins) */}
        <mesh ref={sheenRef} position={[0, 0.019, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <circleGeometry args={[REC_R - 0.01, 96]} />
          <meshBasicMaterial map={sheen} blending={THREE.AdditiveBlending} transparent depthWrite={false} opacity={0.7} toneMapped={false} />
        </mesh>
      </group>

      {/* Clamp / adapter holder, top left */}
      <group position={[PUCK.x, 0, PUCK.z]}>
        <mesh position={[0, 0.07, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.62, 0.14, 48]} />
          {black}
        </mesh>
        <mesh position={[0, 0.17, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.45, 0.07, 48]} />
          {black}
        </mesh>
        <mesh position={[0, 0.215, 0]} scale={[1, 0.65, 1]} castShadow>
          <sphereGeometry args={[0.1, 20, 14]} />
          {chrome}
        </mesh>
      </group>

      {/* Tonearm base and rest */}
      <group position={[PIVOT.x, 0, PIVOT.z]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.88, 0.9, 0.1, 64]} />
          {black}
        </mesh>
        <mesh position={[0, 0.13, 0]} castShadow>
          <cylinderGeometry args={[0.58, 0.62, 0.07, 48]} />
          <meshPhysicalMaterial color="#1b1b1e" roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.27, 0.3, 0.3, 32]} />
          {chrome}
        </mesh>
      </group>
      {/* Arm rest: a post under the parked arm with a clip the tube sits in */}
      <group position={[rest.x, 0, rest.z]} rotation={[0, rest.theta, 0]}>
        <mesh position={[0, (rest.y - 0.08) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, rest.y - 0.08, 16]} />
          {black}
        </mesh>
        <mesh position={[0, rest.y - 0.075, 0]} castShadow>
          <boxGeometry args={[0.22, 0.03, 0.12]} />
          {black}
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * 0.095, rest.y, 0]} castShadow>
            <boxGeometry args={[0.03, 0.15, 0.12]} />
            {black}
          </mesh>
        ))}
      </group>
      {/* Lift lever, beside the rest */}
      <group position={[rest.x + 0.32, 0.1, rest.z - 0.1]} rotation={[0, 0, -0.35]}>
        <mesh position={[0, 0.24, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.5, 8]} />
          {black}
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.065, 14, 10]} />
          {black}
        </mesh>
      </group>

      {/* Tonearm */}
      <group position={[PIVOT.x, ARM_Y, PIVOT.z]}>
        <group ref={armYaw}>
          <group ref={armPitch}>
            <mesh geometry={arm} castShadow>
              {chrome}
            </mesh>
            {/* A fatter invisible tube makes the arm easy to grab */}
            <mesh
              geometry={armHit}
              onPointerDown={(e) => grab(e, 'arm')}
              onPointerOver={() => setHoverArm(true)}
              onPointerOut={() => setHoverArm(false)}
            >
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Bearing housing */}
            <mesh position={[0, -0.04, 0.34]} castShadow>
              <boxGeometry args={[0.46, 0.4, 0.8]} />
              {black}
            </mesh>
            <mesh position={[0, 0.17, 0.34]} castShadow>
              <boxGeometry args={[0.46, 0.04, 0.8]} />
              <meshPhysicalMaterial color="#2a2a2e" roughness={0.4} metalness={0.3} />
            </mesh>
            {/* Counterweight, on a stub that runs back out of the bearing housing */}
            <mesh position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.07, 0.8, 14]} />
              {chrome}
            </mesh>
            <mesh position={[0, 0, -0.85]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.2, 0.5, 32]} />
              {chrome}
            </mesh>
            <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.21, 0.21, 0.12, 32]} />
              {black}
            </mesh>
            {/* Headshell and cartridge */}
            <group position={[ARM_PATH[ARM_PATH.length - 1][0], 0, ARM_PATH[ARM_PATH.length - 1][1]]} rotation={[0, HEADSHELL_YAW, 0]}>
              <mesh position={[0, -0.02, 0.1]} castShadow>
                <boxGeometry args={[0.2, 0.05, 0.3]} />
                {black}
              </mesh>
              <mesh position={[0, -0.14, 0.27]} castShadow>
                <boxGeometry args={[0.27, 0.2, 0.36]} />
                {black}
              </mesh>
              {/* stylus: the cantilever block, and a tip that just touches the record */}
              <mesh position={[0, -0.29, 0.37]} castShadow>
                <boxGeometry args={[0.1, 0.06, 0.14]} />
                <meshPhysicalMaterial color="#c4161c" roughness={0.35} />
              </mesh>
              <mesh position={[0, -(ARM_Y - REC_Y) + 0.017, 0.4]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.012, 0.03, 8]} />
                {chrome}
              </mesh>
              <mesh position={[-0.07, -0.035, 0.18]}>
                <sphereGeometry args={[0.022, 10, 8]} />
                {chrome}
              </mesh>
              <mesh position={[0.07, -0.035, 0.18]}>
                <sphereGeometry args={[0.022, 10, 8]} />
                {chrome}
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* Speed knob */}
      <group
        position={[KNOB.x, 0, KNOB.z]}
        onClick={(e) => {
          e.stopPropagation()
          setSpeed(speed === '33' ? '45' : '33')
        }}
        onPointerOver={() => setHoverBtn(true)}
        onPointerOut={() => setHoverBtn(false)}
      >
        <group ref={knobRef}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.33, 0.36, 0.24, 48]} />
            <meshPhysicalMaterial color="#121214" roughness={0.4} metalness={0.1} clearcoat={0.5} />
          </mesh>
          <mesh position={[0, 0.245, -0.17]}>
            <boxGeometry args={[0.04, 0.012, 0.2]} />
            <meshStandardMaterial color="#f4efe6" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Power button */}
      <group
        position={[POWER.x, 0, POWER.z]}
        onClick={(e) => {
          e.stopPropagation()
          setPlaying(!playing)
        }}
        onPointerOver={() => setHoverBtn(true)}
        onPointerOut={() => setHoverBtn(false)}
      >
        <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.26, 0.04, 16, 48]} />
          {chrome}
        </mesh>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.215, 0.215, 0.1, 40]} />
          <meshPhysicalMaterial color="#101012" roughness={0.35} clearcoat={0.6} />
        </mesh>
        <mesh position={[0, 0.102, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.014, 8, 40]} />
          <meshStandardMaterial ref={ledMat} color="#3a2a1c" emissive="#ff8a2a" emissiveIntensity={0} />
        </mesh>
      </group>
    </group>
  )
}
