import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { cartonTexture, corrugatedTexture, plateTexture, yardTexture } from './textures.js'

// An articulated lorry: a cab-over tractor and a box trailer on its fifth
// wheel. Units are metres; the origin is the front of the bumper on the
// ground, the lorry faces +x and +z is its right-hand side.
//
// Steering is real geometry. The front wheels steer about the turning centre
// (Ackermann), which lies on the line of the rear drive axles; the trailer
// pivots on its kingpin and settles at the angle that puts its own axles on a
// circle round the same centre. While driving, the yard moves under the lorry
// round that centre, so the whole rig turns as one.
//
// Clearances were checked for every part that moves: the trailer's front
// corners clear the cab and the exhaust, and its landing legs clear the drive
// wheels and mud flaps, up to the largest articulation (30 degrees); the
// closest approach anywhere in that swing is 3 cm, trailer corner to cab.

const WHEEL_R = 0.56
const WHEEL_Y = 0.55
const TRACK = 1.22 // half the distance between the wheels on an axle
const FRONT_AXLE = -0.95
const DRIVE_AXLES = [-3.7, -4.8]
const REAR_AXLE = (DRIVE_AXLES[0] + DRIVE_AXLES[1]) / 2 // the tractor turns about this line
const WHEELBASE = FRONT_AXLE - REAR_AXLE
const KINGPIN = -4.3 // centre of the fifth wheel
const FIFTH_TOP = 1.05 // the trailer's beams rest on this
const CAB_BOTTOM = 1.225 // clears the front wheels (top 1.11)

// trailer, in its own frame (origin at the kingpin)
const T_FRONT = 1.2
const T_REAR = -7.7
const T_LEN = T_FRONT - T_REAR
const T_MID = (T_FRONT + T_REAR) / 2
const FLOOR_BOTTOM = FIFTH_TOP + 0.16
const FLOOR_TOP = FLOOR_BOTTOM + 0.1
const WALL_H = 3.1
const WALL_Y = FLOOR_BOTTOM + WALL_H / 2
const TRAILER_AXLES = [-4.5, -5.7, -6.9]
const LEGS_X = -2.2 // landing legs: far enough back to clear the drive wheels at full articulation
const TRAILER_AXLE_MID = TRAILER_AXLES[1] // the trailer turns about this line
const HINGE = { x: T_REAR - 0.005, z: 1.36 } // rear doors hinge just outside the corner posts
const DOOR_W = 1.355
const DOOR_OPEN = (3 * Math.PI) / 2 // the leaves fold right round, flat against the sides

const MAX_GAMMA = THREE.MathUtils.degToRad(30) // largest articulation the clearances allow
// the tightest turn that keeps the trailer within that angle
const MIN_RADIUS = Math.abs(TRAILER_AXLE_MID) / Math.sin(MAX_GAMMA)
const MAX_STEER = Math.atan(WHEELBASE / MIN_RADIUS)

// cotton cartons: 8 deep, 3 high, 4 across
const BOX = { x: 1.0, y: 0.7, z: 0.55 }
const CARTONS = []
for (let r = 0; r < 8; r++) for (let l = 0; l < 3; l++) for (let c = 0; c < 4; c++) CARTONS.push([T_REAR + 0.55 + r * 1.04, FLOOR_TOP + BOX.y / 2 + l * BOX.y, (c - 1.5) * (BOX.z + 0.04)])

const BLACK = { color: '#16181b', roughness: 0.75, metalness: 0.2 }
const CHROME = { color: '#c9ced4', roughness: 0.18, metalness: 1 }
const GLASS = { color: '#0c1822', roughness: 0.04, metalness: 0.95, clearcoat: 1 }

// Turning geometry for a steer amount -1..1. Returns the signed radius of the
// rear axle's circle (Infinity when straight), each front wheel's steer angle,
// and the trailer's articulation angle (as rotation.y values).
function turning(steer) {
  const delta = steer * MAX_STEER
  if (Math.abs(delta) < 1e-4) return { R: Infinity, wheels: [0, 0], gamma: 0 }
  const R = WHEELBASE / Math.tan(delta) // centre at (REAR_AXLE, R): +z for a right turn
  const yaw = (z) => {
    // a wheel's heading is square to the line from the centre to the wheel
    const vx = FRONT_AXLE - REAR_AXLE
    const vz = z - R
    let hx = -vz
    let hz = vx
    if (hx < 0) {
      hx = -hx
      hz = -hz
    }
    return Math.atan2(-hz, hx)
  }
  // trailer: its axle sits where the line from the kingpin is tangent to a
  // circle round the centre, so its heading is square to the radius there
  const kx = KINGPIN - REAR_AXLE
  const D = Math.hypot(kx, R)
  const L = Math.abs(TRAILER_AXLE_MID)
  // the trailer's tail swings in towards the centre, so it points a little out of the turn
  const gamma = Math.asin(Math.min(1, L / D)) * Math.sign(R)
  return { R, wheels: [yaw(TRACK), yaw(-TRACK)], gamma }
}

function Wheel({ x, z, spin, steer }) {
  const side = z > 0 ? 1 : -1
  return (
    <group position={[x, WHEEL_Y, z]}>
      <group ref={steer}>
        <group ref={(g) => g && !spin.current.includes(g) && spin.current.push(g)}>
          <mesh castShadow>
            <torusGeometry args={[0.42, 0.14, 14, 32]} />
            <meshStandardMaterial {...BLACK} roughness={0.95} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.26, 32]} />
            <meshStandardMaterial color="#0e0f11" roughness={0.98} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.14]}>
            <cylinderGeometry args={[0.44, 0.44, 0.02, 32]} />
            <meshStandardMaterial color="#141517" roughness={0.9} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.1]}>
            <cylinderGeometry args={[0.3, 0.3, 0.12, 32]} />
            <meshStandardMaterial color="#d6dadf" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.17]}>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 20]} />
            <meshStandardMaterial color="#5c6168" metalness={0.9} roughness={0.35} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.2, Math.sin(a) * 0.2, side * 0.17]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.05, 8]} />
                <meshStandardMaterial color="#2a2d31" metalness={0.8} roughness={0.4} />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}

// A prop that can also be changed from inside the scene; `onChange` lets the
// owner stay in sync.
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

// cabColor, trailerColor: the paint. company: the banner on the trailer.
// plate: the number plates. drive / speed: roll along. steer: -1 left .. 1
// right. doors: rear doors open. lights: headlights and tail lights. cargo:
// cartons in the trailer. Click the cab for the lights, the trailer for the doors.
export default function Lorry({
  cabColor = '#b3261e',
  trailerColor = '#e9e9e4',
  company = 'REACT DIMENSIONS',
  plate = 'RD 01 AB 2026',
  drive = false,
  speed = 0.5,
  steer = 0,
  doors: doorsProp = false,
  lights: lightsProp = true,
  cargo = true,
  onChange,
}) {
  const [doors, setDoors] = useTwoWay(doorsProp, 'doors', onChange)
  const [lights, setLights] = useTwoWay(lightsProp, 'lights', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const tex = useMemo(() => ({ carton: cartonTexture(), yard: yardTexture() }), [])
  const plateTex = useMemo(() => plateTexture(plate || ' '), [plate])
  const sideTex = useMemo(() => corrugatedTexture({ base: trailerColor, banner: company, bannerBg: cabColor }), [trailerColor, company, cabColor])
  const doorTex = useMemo(() => corrugatedTexture({ base: trailerColor, w: 512, h: 512, ribs: 30 }), [trailerColor])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])
  useEffect(() => () => plateTex.dispose(), [plateTex])
  useEffect(() => () => sideTex.dispose(), [sideTex])
  useEffect(() => () => doorTex.dispose(), [doorTex])
  useEffect(() => {
    tex.yard.repeat.set(40, 40) // 160 m of yard, 4 m slabs
  }, [tex])

  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.15 }), [])
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.15 }), [])
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: '#fff3c4' }), [])
  const tailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b00', emissive: '#ff1010' }), [])
  useEffect(() => () => [paint, wallMat, headMat, tailMat].forEach((m) => m.dispose()), [paint, wallMat, headMat, tailMat])
  useEffect(() => {
    paint.color.set(cabColor)
    wallMat.color.set(trailerColor)
  }, [paint, wallMat, cabColor, trailerColor])

  // carton instances
  const boxes = useRef()
  useEffect(() => {
    const o = new THREE.Object3D()
    CARTONS.forEach(([x, y, z], i) => {
      o.position.set(x, y, z)
      o.updateMatrix()
      boxes.current.setMatrixAt(i, o.matrix)
    })
    boxes.current.instanceMatrix.needsUpdate = true
  }, [])

  // ---- motion ----
  const rig = useRef()
  const trailer = useRef()
  const yard = useRef()
  const yardMesh = useRef()
  const doorL = useRef()
  const doorR = useRef()
  const steerL = useRef()
  const steerR = useRef()
  const spin = useRef([])
  const live = useRef({})
  live.current = { drive, speed, steer, doors, lights }
  const st = useRef({ v: 0, steer: 0, gamma: 0, door: doorsProp ? 1 : 0, doorV: 0, light: lightsProp ? 1 : 0 })
  const origin = useMemo(() => new THREE.Vector3(), [])
  const local = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const s = st.current

    // speed eases up and down; steering turns at a steering-wheel pace
    const vTarget = w.drive ? 1.5 + w.speed * 7 : 0
    s.v += (vTarget - s.v) * (1 - Math.exp(-dt * 1.2))
    s.steer += THREE.MathUtils.clamp(w.steer - s.steer, -dt * 0.8, dt * 0.8)
    const g = turning(s.steer)
    steerR.current.rotation.y = g.wheels[0]
    steerL.current.rotation.y = g.wheels[1]
    // the trailer follows: it only swings round as the rig moves along
    const follow = 1 - Math.exp(-dt * (0.3 + s.v * 0.35))
    s.gamma += (g.gamma - s.gamma) * (w.drive || s.v > 0.05 ? follow : 1 - Math.exp(-dt * 3))
    s.gamma = THREE.MathUtils.clamp(s.gamma, -MAX_GAMMA, MAX_GAMMA)
    trailer.current.rotation.y = s.gamma

    // the yard moves under the lorry: straight back, or round the turning centre
    const y = yard.current
    if (Number.isFinite(g.R)) {
      const a = (s.v / g.R) * dt
      const cx = REAR_AXLE
      const cz = g.R
      const px = y.position.x - cx
      const pz = y.position.z - cz
      // rotate the yard's origin about the centre (rotation.y sense), and the yard with it
      y.position.x = cx + px * Math.cos(a) + pz * Math.sin(a)
      y.position.z = cz - px * Math.sin(a) + pz * Math.cos(a)
      y.rotation.y += a
    } else {
      // straight ahead: the yard slides back along the lorry's heading
      y.position.x -= s.v * dt
    }
    // keep the slab pattern under the lorry without the plane ever running out
    origin.set(0, 0, 0)
    y.updateMatrixWorld()
    local.copy(origin)
    y.worldToLocal(local)
    yardMesh.current.position.set(Math.round(local.x / 4) * 4, 0, Math.round(local.z / 4) * 4)

    // wheels roll by the distance travelled
    spin.current.forEach((wh) => (wh.rotation.z -= (s.v * dt) / WHEEL_R))

    // a little body movement on the road
    const t = state.clock.elapsedTime
    const moving = Math.min(1, s.v / 2)
    rig.current.position.y = Math.sin(t * 11) * 0.004 * moving
    rig.current.rotation.z = Math.sin(t * 4) * 0.0015 * moving

    // rear doors on a soft spring; lights fade
    s.doorV += ((w.doors ? 1 : 0) - s.door) * 18 * dt - s.doorV * 5.5 * dt
    s.door = THREE.MathUtils.clamp(s.door + s.doorV * dt, 0, 1)
    doorR.current.rotation.y = s.door * DOOR_OPEN
    doorL.current.rotation.y = -s.door * DOOR_OPEN
    s.light += ((w.lights ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 8))
    headMat.emissiveIntensity = 0.1 + s.light * 1.8
    tailMat.emissiveIntensity = 0.15 + s.light * 1.1
  })

  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }

  return (
    <group>
      {/* the yard, moving under the lorry */}
      <group ref={yard}>
        <mesh ref={yardMesh} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial map={tex.yard} roughness={0.95} />
        </mesh>
      </group>

      <group ref={rig}>
        {/* ================= tractor ================= */}
        <group
          onClick={(e) => {
            e.stopPropagation()
            setLights(!lights)
          }}
          {...hoverProps}
        >
          {/* chassis rails, from the bumper to just behind the drive axles */}
          {[-0.55, 0.55].map((z) => (
            <mesh key={z} position={[-2.8, 0.78, z]} castShadow>
              <boxGeometry args={[5.6, 0.26, 0.16]} />
              <meshStandardMaterial {...BLACK} />
            </mesh>
          ))}
          {[-0.6, -3.4, -5.4].map((x) => (
            <mesh key={x} position={[x, 0.78, 0]}>
              <boxGeometry args={[0.14, 0.2, 1.1]} />
              <meshStandardMaterial {...BLACK} />
            </mesh>
          ))}
          {/* cab mounts: the cab sits on the rails on these */}
          {[-0.7, -2.2].map((x) =>
            [-0.55, 0.55].map((z) => (
              <mesh key={`${x}${z}`} position={[x, 1.07, z]}>
                <boxGeometry args={[0.25, 0.31, 0.16]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
            )),
          )}
          {/* fifth wheel: its plate top carries the trailer */}
          <mesh position={[KINGPIN, (0.91 + FIFTH_TOP) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, FIFTH_TOP - 0.91, 28]} />
            <meshStandardMaterial {...BLACK} metalness={0.6} />
          </mesh>
          {/* fuel tank on the left, below the cab, between the front and drive wheels, with brackets to the rail */}
          <mesh position={[-2.4, 0.45, -1.0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.2, 24]} />
            <meshStandardMaterial {...CHROME} roughness={0.28} />
          </mesh>
          {[-2.0, -2.8].map((x) => (
            <mesh key={x} position={[x, 0.6, -0.665]}>
              <boxGeometry args={[0.1, 0.1, 0.1]} />
              <meshStandardMaterial {...BLACK} />
            </mesh>
          ))}
          {/* exhaust stack, right side behind the cab, braced to it */}
          <mesh position={[-2.7, 2.625, 1.2]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 3.45, 16]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          <mesh position={[-2.7, 4.4, 1.2]}>
            <cylinderGeometry args={[0.11, 0.075, 0.1, 16]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          {[2.4, 3.3].map((y) => (
            <mesh key={y} position={[-2.6, y, 1.2]}>
              <boxGeometry args={[0.1, 0.05, 0.05]} />
              <meshStandardMaterial {...CHROME} />
            </mesh>
          ))}

          {/* cab: raised clear of the front wheels */}
          <RoundedBox args={[2.35, 2.35, 2.5]} radius={0.16} smoothness={4} position={[-1.4, CAB_BOTTOM + 1.175, 0]} material={paint} castShadow />
          <RoundedBox args={[1.5, 0.5, 2.36]} radius={0.12} smoothness={4} position={[-1.15, 3.77, 0]} material={paint} castShadow />
          <RoundedBox args={[0.9, 0.55, 2.2]} radius={0.12} position={[-1.45, 4.1, 0]} rotation={[0, 0, 0.35]} material={paint} castShadow />
          {[-0.7, 0, 0.7].map((z) => (
            <mesh key={z} position={[-0.55, 4.07, z]}>
              <boxGeometry args={[0.1, 0.1, 0.18]} />
              <meshStandardMaterial color="#ff9d00" emissive="#ff9d00" emissiveIntensity={0.9} />
            </mesh>
          ))}
          {/* windscreen, flush with the cab front */}
          <mesh position={[-0.205, 3.0, 0]}>
            <boxGeometry args={[0.05, 1.15, 2.15]} />
            <meshPhysicalMaterial {...GLASS} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[-0.85, 2.95, s * 1.255]}>
                <boxGeometry args={[1.05, 0.95, 0.05]} />
                <meshPhysicalMaterial {...GLASS} />
              </mesh>
              <mesh position={[-1.55, 2.35, s * 1.255]}>
                <boxGeometry args={[0.03, 1.6, 0.02]} />
                <meshStandardMaterial color="#0b0c0e" />
              </mesh>
              <mesh position={[-0.65, 2.2, s * 1.27]}>
                <boxGeometry args={[0.22, 0.05, 0.04]} />
                <meshStandardMaterial {...CHROME} />
              </mesh>
              {/* mirror on its arm */}
              <mesh position={[-0.35, 3.0, s * 1.45]}>
                <boxGeometry args={[0.05, 0.05, 0.4]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
              <RoundedBox args={[0.1, 0.55, 0.22]} radius={0.04} position={[-0.35, 2.85, s * 1.68]}>
                <meshStandardMaterial {...BLACK} />
              </RoundedBox>
              {/* front fender over the wheel, fixed under the cab */}
              <mesh position={[FRONT_AXLE, 1.2, s * 1.24]}>
                <boxGeometry args={[1.2, 0.06, 0.36]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
              {/* steps behind the front wheel, hung from the cab (the left one sits on the fuel tank) */}
              {(s > 0 ? [0.62, 0.95] : [0.95]).map((y) => (
                <mesh key={y} position={[-1.85, y, s * 1.2]}>
                  <boxGeometry args={[0.5, 0.05, 0.28]} />
                  <meshStandardMaterial color="#9ea3a9" metalness={0.7} roughness={0.5} />
                </mesh>
              ))}
              {[-2.1, -1.6].map((x) => {
                const lo = s > 0 ? 0.55 : 0.8
                return (
                  <mesh key={x} position={[x, (lo + CAB_BOTTOM + 0.02) / 2, s * 1.2]}>
                    <boxGeometry args={[0.04, CAB_BOTTOM + 0.02 - lo, 0.28]} />
                    <meshStandardMaterial {...BLACK} />
                  </mesh>
                )
              })}
              {/* mud flap behind the drive wheels, on an arm from the rail */}
              <mesh position={[-5.45, 0.78, s * 1.22]}>
                <boxGeometry args={[0.04, 0.55, 0.42]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
              <mesh position={[-5.45, 1.03, s * 0.83]}>
                <boxGeometry args={[0.05, 0.05, 0.4]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
            </group>
          ))}
          {/* grille with slats and a badge */}
          <mesh position={[-0.2, 1.75, 0]}>
            <boxGeometry args={[0.08, 0.85, 1.7]} />
            <meshStandardMaterial {...BLACK} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-0.14, 1.45 + i * 0.12, 0]}>
              <boxGeometry args={[0.03, 0.04, 1.6]} />
              <meshStandardMaterial {...CHROME} />
            </mesh>
          ))}
          <mesh position={[-0.12, 2.0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.1, 20]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          {/* headlights, fog lamps and indicators, all set into the cab front */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <RoundedBox args={[0.12, 0.3, 0.62]} radius={0.04} position={[-0.17, 2.07, s * 0.98]}>
                <meshStandardMaterial {...BLACK} />
              </RoundedBox>
              <mesh position={[-0.105, 2.07, s * 0.98]} material={headMat}>
                <boxGeometry args={[0.02, 0.22, 0.52]} />
              </mesh>
              <mesh position={[-0.155, 1.5, s * 0.98]} rotation={[0, 0, Math.PI / 2]} material={headMat}>
                <cylinderGeometry args={[0.07, 0.07, 0.14, 16]} />
              </mesh>
              <mesh position={[-0.155, 1.83, s * 1.0]}>
                <boxGeometry args={[0.14, 0.08, 0.1]} />
                <meshStandardMaterial color="#ff9d00" emissive="#ff8a00" emissiveIntensity={0.6} />
              </mesh>
            </group>
          ))}
          {/* front bumper on the rail ends, with the number plate on a bracket */}
          <RoundedBox args={[0.36, 0.42, 2.5]} radius={0.08} position={[0.04, 0.6, 0]} castShadow>
            <meshStandardMaterial {...BLACK} />
          </RoundedBox>
          <mesh position={[0.05, 0.83, 0]}>
            <boxGeometry args={[0.2, 0.04, 2.3]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          <mesh position={[0.28, 0.6, 0]}>
            <boxGeometry args={[0.12, 0.3, 1.0]} />
            <meshStandardMaterial color="#1b1b1b" />
          </mesh>
          <mesh position={[0.342, 0.6, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.9, 0.225]} />
            <meshStandardMaterial map={plateTex} emissiveMap={plateTex} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.4} />
          </mesh>

          {/* wheels: the front pair steer */}
          <Wheel x={FRONT_AXLE} z={TRACK} spin={spin} steer={steerR} />
          <Wheel x={FRONT_AXLE} z={-TRACK} spin={spin} steer={steerL} />
          {DRIVE_AXLES.flatMap((x) => [<Wheel key={`${x}a`} x={x} z={TRACK} spin={spin} />, <Wheel key={`${x}b`} x={x} z={-TRACK} spin={spin} />])}
        </group>

        {/* ================= trailer, pivoting on the kingpin ================= */}
        <group
          ref={trailer}
          position={[KINGPIN, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            setDoors(!doors)
          }}
          {...hoverProps}
        >
          {/* main beams resting on the fifth wheel, and the kingpin */}
          {[-0.45, 0.45].map((z) => (
            <mesh key={z} position={[T_MID, FIFTH_TOP + 0.08, z]}>
              <boxGeometry args={[T_LEN, 0.16, 0.14]} />
              <meshStandardMaterial {...BLACK} />
            </mesh>
          ))}
          <mesh position={[0, FIFTH_TOP + 0.08, 0]}>
            <boxGeometry args={[0.5, 0.16, 0.9]} />
            <meshStandardMaterial {...BLACK} />
          </mesh>
          {/* floor, front wall, side walls, roof, corner posts */}
          <mesh position={[T_MID, (FLOOR_BOTTOM + FLOOR_TOP) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[T_LEN, FLOOR_TOP - FLOOR_BOTTOM, 2.5]} />
            <meshStandardMaterial color="#6b5a45" roughness={0.9} />
          </mesh>
          <mesh position={[T_FRONT - 0.04, WALL_Y, 0]} material={wallMat} castShadow>
            <boxGeometry args={[0.08, WALL_H, 2.5]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[T_MID, WALL_Y, s * 1.215]} material={wallMat} castShadow receiveShadow>
                <boxGeometry args={[T_LEN, WALL_H, 0.07]} />
              </mesh>
              {/* the corrugated skin with the banner, clear of the wall so it never flickers */}
              <mesh position={[T_MID, WALL_Y, s * 1.262]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                <planeGeometry args={[T_LEN - 0.2, WALL_H - 0.1]} />
                <meshStandardMaterial map={sideTex} roughness={0.55} metalness={0.2} />
              </mesh>
            </group>
          ))}
          <mesh position={[T_MID, FLOOR_BOTTOM + WALL_H + 0.03, 0]}>
            <boxGeometry args={[T_LEN + 0.1, 0.06, 2.62]} />
            <meshStandardMaterial color="#c9ccd0" roughness={0.5} metalness={0.4} />
          </mesh>
          {[T_FRONT - 0.05, T_REAR + 0.05].flatMap((x) =>
            [-1, 1].map((s) => (
              <mesh key={`${x}${s}`} position={[x, WALL_Y, s * 1.26]}>
                <boxGeometry args={[0.1, WALL_H, 0.1]} />
                <meshStandardMaterial color="#8d939a" metalness={0.8} roughness={0.35} />
              </mesh>
            )),
          )}
          {/* cotton cartons */}
          <instancedMesh ref={boxes} args={[null, null, CARTONS.length]} castShadow visible={cargo}>
            <boxGeometry args={[BOX.x, BOX.y, BOX.z]} />
            <meshStandardMaterial map={tex.carton} roughness={0.85} />
          </instancedMesh>

          {/* rear doors: hinge brackets and pins on the posts, and the two leaves */}
          {[-1, 1].map((side) => (
            <group key={side}>
              {[-1.16, 0, 1.14].map((dy) => (
                <mesh key={dy} position={[T_REAR + 0.02, WALL_Y + dy, side * 1.34]}>
                  <boxGeometry args={[0.06, 0.12, 0.08]} />
                  <meshStandardMaterial {...CHROME} />
                </mesh>
              ))}
              <mesh position={[HINGE.x, WALL_Y, side * HINGE.z]}>
                <cylinderGeometry args={[0.012, 0.012, 2.5, 6]} />
                <meshStandardMaterial {...CHROME} />
              </mesh>
              <group ref={side > 0 ? doorR : doorL} position={[HINGE.x, WALL_Y, side * HINGE.z]}>
                <mesh position={[-0.025, 0, -side * (DOOR_W / 2)]} castShadow>
                  <boxGeometry args={[0.05, WALL_H - 0.1, DOOR_W]} />
                  <meshStandardMaterial map={doorTex} roughness={0.55} metalness={0.2} />
                </mesh>
                {[-1.0, 0.16].map((dy) => (
                  <mesh key={dy} position={[0, dy, 0]}>
                    <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
                    <meshStandardMaterial {...CHROME} />
                  </mesh>
                ))}
                {/* lock rods on the outside face */}
                {[0.25, 0.95].map((o) => (
                  <mesh key={o} position={[-0.07, 0, -side * o]}>
                    <boxGeometry args={[0.04, WALL_H - 0.2, 0.04]} />
                    <meshStandardMaterial {...CHROME} />
                  </mesh>
                ))}
              </group>
            </group>
          ))}

          {/* landing legs, side guards, rear bumper, plate, lights and mud flaps */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[LEGS_X, (0.05 + FLOOR_BOTTOM) / 2, s * 0.85]} castShadow>
                <boxGeometry args={[0.12, FLOOR_BOTTOM - 0.05, 0.12]} />
                <meshStandardMaterial color="#6a7078" metalness={0.7} roughness={0.5} />
              </mesh>
              <mesh position={[LEGS_X, 0.05, s * 0.85]}>
                <boxGeometry args={[0.3, 0.05, 0.3]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
              {/* side guard between the legs and the first trailer axle, hung from the floor */}
              <mesh position={[-3.15, 0.7, s * 1.2]}>
                <boxGeometry args={[1.3, 0.1, 0.05]} />
                <meshStandardMaterial color="#8d939a" metalness={0.8} roughness={0.35} />
              </mesh>
              {[-2.6, -3.7].map((x) => (
                <mesh key={x} position={[x, (0.7 + FLOOR_BOTTOM) / 2, s * 1.2]}>
                  <boxGeometry args={[0.05, FLOOR_BOTTOM - 0.7, 0.05]} />
                  <meshStandardMaterial color="#8d939a" metalness={0.8} roughness={0.35} />
                </mesh>
              ))}
              <mesh position={[-7.75, (0.72 + FLOOR_BOTTOM) / 2, s * 0.8]}>
                <boxGeometry args={[0.06, FLOOR_BOTTOM - 0.72, 0.06]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
              <mesh position={[-7.865, 0.62, s * 1.0]} material={tailMat}>
                <boxGeometry args={[0.03, 0.14, 0.28]} />
              </mesh>
              <mesh position={[-7.55, (0.5 + FLOOR_BOTTOM) / 2, s * 1.25]}>
                <boxGeometry args={[0.04, FLOOR_BOTTOM - 0.5, 0.45]} />
                <meshStandardMaterial {...BLACK} />
              </mesh>
            </group>
          ))}
          <mesh position={[-7.78, 0.62, 0]}>
            <boxGeometry args={[0.14, 0.2, 2.4]} />
            <meshStandardMaterial {...BLACK} />
          </mesh>
          <mesh position={[-7.855, 0.62, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.9, 0.225]} />
            <meshStandardMaterial map={plateTex} emissiveMap={plateTex} emissive="#ffffff" emissiveIntensity={0.25} />
          </mesh>
          {TRAILER_AXLES.flatMap((x) => [<Wheel key={`${x}a`} x={x} z={TRACK} spin={spin} />, <Wheel key={`${x}b`} x={x} z={-TRACK} spin={spin} />])}
        </group>
      </group>
    </group>
  )
}
