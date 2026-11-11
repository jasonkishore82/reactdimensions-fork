import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BELT,
  FRONT,
  FRONT_AXLE,
  HALF_W,
  REAR,
  REAR_AXLE,
  SILL,
  STATIONS,
  bumperGeometry,
  topline,
  WHEEL_R,
  cabinFaces,
  cabinGeometry,
  flareGeometry,
  insetPanel,
  lowerBodyGeometry,
  polysGeometry,
  tyreGeometry,
} from './geometry.js'
import { readInput, vehicle } from './controls.js'
import { brushedSteel, groundOcclusion, plasticBump, slats, treadBump, wheelCover } from './textures.js'

const WHEEL_Z = HALF_W - 0.12
const WHEELBASE = FRONT_AXLE - REAR_AXLE
const MAX_SPEED = 22 // m/s (~80 km/h)
const MAX_REVERSE = 6
const ARENA = 70

// Wheel: position -> steer (y) -> flip for the left side -> spin (z).
function Wheel({ position, flip, geo, mats, spin, steer }) {
  return (
    <group position={position}>
      <group ref={steer}>
        <group rotation={[0, flip ? Math.PI : 0, 0]}>
          <group ref={spin}>
            <mesh geometry={geo.tyre} material={mats.tyre} castShadow />
            {/* Aero cover sits on the outboard face */}
            <mesh geometry={geo.cover} material={mats.cover} position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]} />
            {/* Dark wheel centre behind the cover */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.31, 0.31, 0.26, 32, 1, true]} />
              <meshStandardMaterial color="#0d0e10" roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

function Box({ from, to, material }) {
  const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const pos = [(to[0] + from[0]) / 2, (to[1] + from[1]) / 2, (to[2] + from[2]) / 2]
  return (
    <mesh position={pos} material={material} castShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

export default function Truck({ lightsOn = true, autoRotate = true, bounce = 0 }) {
  const { gl, camera, size } = useThree()
  const yawRef = useRef()
  const bodyRef = useRef()
  const wheelSpins = [useRef(), useRef(), useRef(), useRef()]
  const frontSteer = [useRef(), useRef()]

  const tex = useMemo(
    () => ({
      steel: brushedSteel(),
      tread: treadBump(),
      cover: wheelCover(),
      slats: slats(),
      plastic: plasticBump(),
      ao: groundOcclusion(),
    }),
    [],
  )

  const mats = useMemo(() => {
    const steel = new THREE.MeshPhysicalMaterial({
      color: '#d4d7da',
      metalness: 1,
      roughness: 0.36,
      roughnessMap: tex.steel,
      anisotropy: 0.55,
      clearcoat: 0.25,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
    })
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#07090c',
      metalness: 0.1,
      roughness: 0.03,
      ior: 1.52,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 1,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
    })
    const tonneau = new THREE.MeshPhysicalMaterial({
      color: '#1d2228',
      metalness: 0.6,
      roughness: 0.35,
      bumpMap: tex.slats,
      bumpScale: 2,
      clearcoat: 0.6,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
    })
    const plastic = new THREE.MeshStandardMaterial({
      color: '#16171a',
      roughness: 0.85,
      metalness: 0,
      bumpMap: tex.plastic,
      bumpScale: 0.6,
    })
    const tyre = new THREE.MeshStandardMaterial({
      color: '#141414',
      roughness: 0.92,
      bumpMap: tex.tread,
      bumpScale: 6,
    })
    const cover = new THREE.MeshPhysicalMaterial({
      map: tex.cover.color,
      bumpMap: tex.cover.bump,
      bumpScale: 3,
      metalness: 0.5,
      roughness: 0.45,
      clearcoat: 0.5,
    })
    const seam = new THREE.MeshStandardMaterial({ color: '#3a3e44', roughness: 0.5, metalness: 0.6 })
    const well = new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.95, side: THREE.DoubleSide })
    const mirror = new THREE.MeshPhysicalMaterial({ color: '#cfd6de', metalness: 1, roughness: 0.02 })
    // toneMapped: false lets the bars go brighter than white so bloom picks them up.
    const lightWhite = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8.4, 9.2), toneMapped: false })
    const lightRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(24, 1.8, 0.8), toneMapped: false })
    return { steel, glass, tonneau, plastic, tyre, cover, seam, well, mirror, lightWhite, lightRed }
  }, [tex])

  const geo = useMemo(() => {
    // Glass and roof panels, inset from the steel faces so a frame shows.
    const seg1 = cabinFaces(STATIONS[1], STATIONS[2])
    const seg2 = cabinFaces(STATIONS[2], STATIONS[3])
    const seg3 = cabinFaces(STATIONS[3], STATIONS[4])
    const glass = polysGeometry([
      insetPanel(seg1.top, 0.07), // windshield
      insetPanel(seg2.top, 0.06), // glass roof
      insetPanel(seg1.left, 0.06),
      insetPanel(seg1.right, 0.06),
      insetPanel(seg2.left, 0.06),
      insetPanel(seg2.right, 0.06),
    ])
    const tonneau = polysGeometry([insetPanel(seg3.top, 0.05)], (p) => [p.z, p.x * 0.6])
    const [lower, wells] = lowerBodyGeometry()
    return {
      lower,
      wells,
      bumperF: bumperGeometry(FRONT_AXLE + 0.7, FRONT + 0.05, SILL - 0.15, SILL + 0.13, HALF_W + 0.01),
      bumperR: bumperGeometry(-(REAR_AXLE - 0.66), -(REAR - 0.06), SILL - 0.15, SILL + 0.1, HALF_W + 0.01),
      cabin: cabinGeometry(),
      glass,
      tonneau,
      flareF: flareGeometry(FRONT_AXLE),
      flareR: flareGeometry(REAR_AXLE),
      tyre: tyreGeometry(),
      cover: new THREE.CylinderGeometry(0.33, 0.33, 0.03, 64),
    }
  }, [])

  // ---- Physics state ----
  const phys = useRef({
    camYaw: 0, // camera orbit angle around the truck
    camYawVel: 0,
    pitch: 0.18, // camera elevation
    pitchVel: 0,
    pitchTarget: 0.18,
    camTarget: new THREE.Vector3(vehicle.x, 0.75, vehicle.z),
    // suspension (body relative to wheels)
    sy: 0,
    syVel: 0,
    roll: 0,
    rollVel: 0,
    tilt: 0,
    tiltVel: 0,
    wheelAngle: 0,
    light: lightsOn ? 1 : 0,
    prevSpeed: 0,
    dragging: false,
    lastInput: 0,
    last: { x: 0, y: 0, t: 0 },
  })

  useEffect(() => {
    const el = gl.domElement
    const p = phys.current
    let lastTap = 0
    const down = (e) => {
      // Two taps/clicks in quick succession bounce the suspension
      // (works for touch, where dblclick is unreliable).
      const now = performance.now()
      if (now - lastTap < 300) dbl()
      lastTap = now
      p.dragging = true
      p.last = { x: e.clientX, y: e.clientY, t: performance.now() }
      p.camYawVel = 0
      el.style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!p.dragging) return
      const now = performance.now()
      const dt = Math.max((now - p.last.t) / 1000, 1 / 240)
      const dx = (e.clientX - p.last.x) * 0.006
      const dy = (e.clientY - p.last.y) * 0.004
      p.camYaw -= dx
      p.camYawVel = THREE.MathUtils.lerp(p.camYawVel, -dx / dt, 0.5)
      p.pitchTarget = THREE.MathUtils.clamp(p.pitchTarget + dy, 0.02, 0.85)
      p.last = { x: e.clientX, y: e.clientY, t: now }
      p.lastInput = now
    }
    const up = () => {
      p.dragging = false
      p.lastInput = performance.now()
      el.style.cursor = 'grab'
    }
    const dbl = () => {
      // Kick the suspension: the body drops then rebounds.
      p.syVel -= 1.2
      p.tiltVel += 0.08
      p.lastInput = performance.now()
    }
    el.style.cursor = 'grab'
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  // External "bounce" button: same kick as a double-tap.
  useEffect(() => {
    if (!bounce) return
    const p = phys.current
    p.syVel -= 1.2
    p.tiltVel += 0.1
    p.lastInput = performance.now()
  }, [bounce])

  const headlight = useRef()
  const headTarget = useRef()
  const tailGlow = useRef()
  const tailTarget = useRef()
  useEffect(() => {
    headlight.current.target = headTarget.current
    tailGlow.current.target = tailTarget.current
  }, [])

  const spring = (x, v, target, k, c, dt) => v + (-k * (x - target) - c * v) * dt

  useFrame((state, delta) => {
    const p = phys.current
    const v = vehicle
    const dt = Math.min(delta, 1 / 30)
    const { throttle, steer, brake } = readInput()
    if (throttle || steer || brake) p.lastInput = performance.now()
    const idle = performance.now() - p.lastInput > 2500

    // ---- Driving physics (bicycle model) ----
    const speed = v.speed
    let accel = 0
    if (throttle > 0) {
      // Forward: strong pull that fades near top speed; brakes if rolling back.
      accel = speed < -0.3 ? 12 : 7.5 * (1 - Math.max(speed, 0) / MAX_SPEED)
    } else if (throttle < 0) {
      // Back: brake first, then reverse gently.
      accel = speed > 0.3 ? -12 : -4.5 * (1 - Math.max(-speed, 0) / MAX_REVERSE)
    }
    // Rolling resistance + aerodynamic drag
    accel -= Math.sign(speed) * (0.35 + 0.012 * speed * speed)
    if (brake) accel -= Math.sign(speed) * 16
    let next = speed + accel * dt
    // Friction and brakes stop the truck; they never push it backwards.
    if (!throttle && Math.sign(next) !== Math.sign(speed)) next = 0
    v.speed = next

    // Steering: less lock at speed, eased like a real steering rack.
    const maxLock = 0.62 / (1 + Math.abs(v.speed) * 0.07)
    v.steer += (steer * maxLock - v.steer) * (1 - Math.exp(-7 * dt))
    const yawRate = (v.speed / WHEELBASE) * Math.tan(v.steer)
    v.heading += yawRate * dt
    v.x += Math.cos(v.heading) * v.speed * dt
    v.z -= Math.sin(v.heading) * v.speed * dt
    // Keep the truck within the studio
    const r = Math.hypot(v.x, v.z)
    if (r > ARENA) {
      v.x *= ARENA / r
      v.z *= ARENA / r
      v.speed *= 0.5
    }

    // ---- Suspension ----
    // Body rolls away from the corner (lateral g) and pitches under
    // acceleration / braking (longitudinal g), each on a damped spring.
    const latG = v.speed * yawRate
    const longG = (v.speed - p.prevSpeed) / Math.max(dt, 1e-3)
    p.prevSpeed = v.speed
    const rollTarget = THREE.MathUtils.clamp(latG * 0.012, -0.08, 0.08)
    const pitchTarget = THREE.MathUtils.clamp(longG * 0.0045, -0.05, 0.05)
    p.rollVel = spring(p.roll, p.rollVel, rollTarget, 70, 7, dt)
    p.roll += p.rollVel * dt
    p.syVel = spring(p.sy, p.syVel, 0, 110, 5.5, dt)
    p.sy += p.syVel * dt
    p.tiltVel = spring(p.tilt, p.tiltVel, pitchTarget, 80, 8, dt)
    p.tilt += p.tiltVel * dt

    const g = yawRef.current
    g.position.set(v.x, 0, v.z)
    g.rotation.y = v.heading
    const b = bodyRef.current
    b.position.y = p.sy
    b.rotation.x = p.roll
    b.rotation.z = p.tilt

    // Wheels roll by distance travelled; front wheels steer.
    p.wheelAngle += (v.speed / WHEEL_R) * dt
    wheelSpins.forEach((w, i) => {
      if (w.current) w.current.rotation.z = i < 2 ? -p.wheelAngle : p.wheelAngle
    })
    frontSteer.forEach((w) => w.current && (w.current.rotation.y = v.steer))

    // Lights fade on/off like real LEDs warming up. Brake lights flare when slowing.
    p.light += ((lightsOn ? 1 : 0) - p.light) * (1 - Math.exp(-6 * dt))
    const L = p.light
    const braking = brake || (throttle < 0 && v.speed > 0.3) || (throttle > 0 && v.speed < -0.3)
    const red = braking ? 2.2 : 1
    mats.lightWhite.color.setRGB(0.3 + 7.7 * L, 0.3 + 8.1 * L, 0.32 + 8.9 * L)
    mats.lightRed.color.setRGB((0.25 + 23.75 * L) * red, (0.03 + 1.77 * L) * red, (0.02 + 0.78 * L) * red)
    headlight.current.intensity = 60 * L
    tailGlow.current.intensity = 6 * L * red

    // ---- Camera ----
    const driving = Math.abs(v.speed) > 0.8
    if (!p.dragging) {
      if (driving) {
        // Chase cam: swing round behind the truck (reversing: stay put).
        if (v.speed > 0) {
          const behind = v.heading - Math.PI / 2 + 0.3
          const diff = Math.atan2(Math.sin(behind - p.camYaw), Math.cos(behind - p.camYaw))
          p.camYaw += diff * (1 - Math.exp(-2 * dt))
        }
        p.camYawVel = 0
      } else {
        // Coasting orbit, easing into a slow turntable when idle.
        const cruise = idle && autoRotate ? 0.18 : 0
        p.camYawVel += (cruise - p.camYawVel) * (1 - Math.exp(-1.1 * dt))
        p.camYaw += p.camYawVel * dt
      }
    }
    p.pitchVel = spring(p.pitch, p.pitchVel, p.pitchTarget, 40, 11, dt)
    p.pitch += p.pitchVel * dt

    // Distance fits the truck to the screen width, pulls back a bit with speed.
    const aspect = size.width / size.height
    const dist = Math.max(10.5, 11 / aspect) + Math.abs(v.speed) * 0.08
    p.camTarget.lerp(new THREE.Vector3(v.x, 0.75, v.z), 1 - Math.exp(-6 * dt))
    const t = p.camTarget
    const h = Math.cos(p.pitch) * dist
    camera.position.set(t.x + Math.sin(p.camYaw) * h, t.y + Math.sin(p.pitch) * dist, t.z + Math.cos(p.camYaw) * h)
    camera.lookAt(t)
    // Keep the fog behind the truck however far back the camera sits.
    if (state.scene.fog) {
      state.scene.fog.near = dist + 5
      state.scene.fog.far = dist + 24
    }
  })

  const zOut = HALF_W + 0.002

  return (
    <group ref={yawRef}>
      {/* Soft contact darkening under the truck */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} renderOrder={-1}>
        <planeGeometry args={[7.4, 3.6]} />
        <meshBasicMaterial map={tex.ao} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Wheels stay on the ground; the body above rides on the suspension. */}
      <Wheel position={[FRONT_AXLE, WHEEL_R, WHEEL_Z]} geo={geo} mats={mats} spin={wheelSpins[0]} steer={frontSteer[0]} />
      <Wheel position={[REAR_AXLE, WHEEL_R, WHEEL_Z]} geo={geo} mats={mats} spin={wheelSpins[1]} />
      <Wheel position={[FRONT_AXLE, WHEEL_R, -WHEEL_Z]} flip geo={geo} mats={mats} spin={wheelSpins[2]} steer={frontSteer[1]} />
      <Wheel position={[REAR_AXLE, WHEEL_R, -WHEEL_Z]} flip geo={geo} mats={mats} spin={wheelSpins[3]} />

      <group ref={bodyRef}>
        <mesh geometry={geo.lower} material={mats.steel} castShadow receiveShadow />
        <mesh geometry={geo.wells} material={mats.well} />
        <mesh geometry={geo.bumperF} material={mats.plastic} castShadow />
        <mesh geometry={geo.bumperR} material={mats.plastic} scale={[-1, 1, 1]} castShadow />
        <mesh geometry={geo.cabin} material={mats.steel} castShadow receiveShadow />
        <mesh geometry={geo.glass} material={mats.glass} />
        <mesh geometry={geo.tonneau} material={mats.tonneau} />

        {/* Fender flares, both sides */}
        {[1, -1].map((side) => (
          <group key={side} scale={[1, 1, side]}>
            <mesh geometry={geo.flareF} material={mats.plastic} position={[0, 0, HALF_W - 0.04]} castShadow />
            <mesh geometry={geo.flareR} material={mats.plastic} position={[0, 0, HALF_W - 0.04]} castShadow />
          </group>
        ))}

        {/* Black sills and bumpers */}
        {[1, -1].map((side) => (
          <Box
            key={side}
            from={[REAR_AXLE + 0.7, SILL - 0.12, side * HALF_W - 0.03]}
            to={[FRONT_AXLE - 0.66, SILL + 0.1, side * HALF_W + 0.03]}
            material={mats.plastic}
          />
        ))}
        <Box from={[REAR_AXLE + 0.6, SILL - 0.16, -HALF_W + 0.1]} to={[FRONT_AXLE - 0.6, SILL, HALF_W - 0.1]} material={mats.plastic} />

        {/* Door seams */}
        {[1.12, -0.24, -1.34].map((x) =>
          [1, -1].map((side) => (
            <Box key={`${x}${side}`} from={[x - 0.004, SILL + 0.1, side * zOut - 0.002]} to={[x + 0.004, BELT - 0.01, side * zOut + 0.002]} material={mats.seam} />
          )),
        )}

        {/* Shoulder crease and tailgate seam */}
        {[1, -1].map((side) => (
          <Box key={`belt${side}`} from={[REAR + 0.02, BELT - 0.016, side * zOut - 0.002]} to={[FRONT - 0.62, BELT - 0.004, side * zOut + 0.003]} material={mats.seam} />
        ))}
        <Box from={[REAR - 0.004, SILL + 0.12, -HALF_W + 0.03]} to={[REAR + 0.002, SILL + 0.126, HALF_W - 0.03]} material={mats.seam} />

        {/* Single long windshield wiper resting at the base of the glass */}
        <mesh position={[1.18, topline(1.18) + 0.025, 0.05]} rotation={[0, 0.06, Math.atan(0.243)]} material={mats.plastic}>
          <boxGeometry args={[0.035, 0.018, 1.55]} />
        </mesh>

        {/* Side mirrors */}
        {[1, -1].map((side) => (
          <group key={`m${side}`} position={[1.15, 1.32, side * (HALF_W + 0.08)]}>
            <mesh material={mats.plastic} castShadow>
              <boxGeometry args={[0.22, 0.12, 0.16]} />
            </mesh>
            <mesh position={[-0.112, 0, 0]} rotation={[0, -Math.PI / 2, 0]} material={mats.mirror}>
              <planeGeometry args={[0.19, 0.09]} />
            </mesh>
            <mesh position={[0.06, -0.02, -side * 0.12]} material={mats.plastic}>
              <boxGeometry args={[0.06, 0.04, 0.18]} />
            </mesh>
          </group>
        ))}

        {/* Headlight beam that actually lights the floor, plus a red glow at the rear */}
        <spotLight
          ref={headlight}
          position={[FRONT + 0.05, 1.03, 0]}
          angle={0.75}
          penumbra={0.9}
          distance={14}
          decay={1.6}
          color="#e8f0ff"
        />
        <object3D ref={headTarget} position={[FRONT + 6, -0.6, 0]} />
        {/* Rear glow aimed at the floor behind, so it doesn't paint the tailgate */}
        <spotLight ref={tailGlow} position={[REAR - 0.08, 0.6, 0]} angle={0.9} penumbra={1} distance={5} decay={1.5} color="#ff2a10" />
        <object3D ref={tailTarget} position={[REAR - 3, 0, 0]} />

        {/* Full-width light bars */}
        <Box from={[FRONT - 0.01, 1.02, -HALF_W + 0.02]} to={[FRONT + 0.012, 1.045, HALF_W - 0.02]} material={mats.lightWhite} />
        <Box from={[REAR - 0.012, BELT - 0.05, -HALF_W + 0.04]} to={[REAR + 0.01, BELT - 0.015, HALF_W - 0.04]} material={mats.lightRed} />
      </group>
    </group>
  )
}
