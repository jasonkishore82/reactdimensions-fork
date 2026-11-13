import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createDartAudio } from './audio.js'

// A regulation bristle dartboard and three steel-tip darts.
//
// The board is to the official dimensions: 451 mm across, the bull 12.7 mm,
// the outer bull 31.8 mm, the treble ring 99-107 mm and the double ring
// 162-170 mm out, numbers in the standard order with 20 at the top, hung
// with the bull 1.73 m off the floor. The sisal face has a fibre texture,
// the spider is raised round wire you can see the shadow of, and the back
// is pressed board with a keyhole bracket and rubber feet.
//
// Darts are thrown from the oche, 2.37 m away. Click where you want to aim:
// the throw is solved as a real projectile (speed set by the control, the
// angle worked out so gravity drops it onto the aim point), plus a random
// error from your "accuracy". In the air the flights keep it pointing along
// its path, so it lands nose-up, tilted by the drop, just as real darts do.
// It sticks in the sisal with a little wobble; land squarely on a wire and
// it may bounce out and fall. Each dart is scored.

export const BULL_Y = 1.73
export const OCHE = 2.37
const R_BOARD = 0.2255
const RINGS = { bull: 0.00635, outer: 0.0159, t0: 0.099, t1: 0.107, d0: 0.162, d1: 0.17 }
const NUMS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
const DEPTH = 0.038
const WIRE = 0.0006 // wire radius

export function scoreAt(dx, dy) {
  const r = Math.hypot(dx, dy)
  if (r <= RINGS.bull) return { label: 'BULL', points: 50 }
  if (r <= RINGS.outer) return { label: '25', points: 25 }
  if (r > RINGS.d1) return { label: 'MISS', points: 0 }
  // clockwise from straight up
  const a = (Math.atan2(dx, dy) * 180) / Math.PI
  const n = NUMS[((Math.round(a / 18) % 20) + 20) % 20]
  if (r >= RINGS.t0 && r <= RINGS.t1) return { label: `T${n}`, points: n * 3 }
  if (r >= RINGS.d0) return { label: `D${n}`, points: n * 2 }
  return { label: `${n}`, points: n }
}

// is this point on the wire? (rings and the radial wires)
function onWire(dx, dy) {
  const r = Math.hypot(dx, dy)
  for (const k of ['outer', 't0', 't1', 'd0', 'd1']) if (Math.abs(r - RINGS[k]) < WIRE * 1.6) return true
  if (r > RINGS.outer && r < RINGS.d1) {
    const a = (Math.atan2(dx, dy) * 180) / Math.PI + 9
    const off = (((a % 18) + 18) % 18) - 9
    if (Math.abs(9 - Math.abs(off)) * (Math.PI / 180) * r < WIRE * 1.6) return true
  }
  return false
}

function faceTexture({ black, cream, red, green }) {
  const S = 2048
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const k = S / 2 / R_BOARD // px per metre
  const cx = S / 2
  g.fillStyle = '#121212'
  g.fillRect(0, 0, S, S)
  const wedge = (r0, r1, a0, a1, col) => {
    g.beginPath()
    g.arc(cx, cx, r1 * k, a0, a1)
    g.arc(cx, cx, r0 * k, a1, a0, true)
    g.closePath()
    g.fillStyle = col
    g.fill()
  }
  for (let i = 0; i < 20; i++) {
    const mid = -Math.PI / 2 + (i * Math.PI) / 10
    const a0 = mid - Math.PI / 20
    const a1 = mid + Math.PI / 20
    const dark = i % 2 === 0
    const base = dark ? black : cream
    const ring = dark ? red : green
    wedge(RINGS.outer, RINGS.t0, a0, a1, base)
    wedge(RINGS.t0, RINGS.t1, a0, a1, ring)
    wedge(RINGS.t1, RINGS.d0, a0, a1, base)
    wedge(RINGS.d0, RINGS.d1, a0, a1, ring)
  }
  g.beginPath()
  g.arc(cx, cx, RINGS.outer * k, 0, Math.PI * 2)
  g.fillStyle = green
  g.fill()
  g.beginPath()
  g.arc(cx, cx, RINGS.bull * k, 0, Math.PI * 2)
  g.fillStyle = red
  g.fill()
  // sisal: tightly packed fibre ends seen end-on, a fine speckle
  const id = g.getImageData(0, 0, S, S)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 38
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n * 0.9
  }
  g.putImageData(id, 0, 0)
  for (let q = 0; q < 9000; q++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * RINGS.d1 * k
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,235' : '0,0,0'},${Math.random() * 0.12})`
    g.fillRect(cx + Math.cos(a) * r, cx + Math.sin(a) * r, 1.5, 1.5)
  }
  // numbers on the black outer ring
  g.fillStyle = '#f2f0ea'
  g.font = `600 ${0.024 * k}px 'Helvetica Neue', Arial, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  NUMS.forEach((n, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 10
    const r = 0.196 * k
    g.save()
    g.translate(cx + Math.cos(a) * r, cx + Math.sin(a) * r)
    g.rotate(a + Math.PI / 2)
    g.fillText(String(n), 0, 0)
    g.restore()
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function backTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#2a2826'
  g.fillRect(0, 0, 512, 512)
  for (let q = 0; q < 26000; q++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,85,78' : '10,10,10'},${Math.random() * 0.5})`
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// the spider: wire rings and the twenty radial wires, raised off the face
function Spider() {
  const geo = useMemo(() => {
    const parts = []
    for (const r of [RINGS.outer, RINGS.t0, RINGS.t1, RINGS.d0, RINGS.d1]) {
      const t = new THREE.TorusGeometry(r, WIRE, 6, 160)
      parts.push(t)
    }
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20
      const len = RINGS.d1 - RINGS.outer
      const cyl = new THREE.CylinderGeometry(WIRE, WIRE, len, 6)
      cyl.rotateZ(Math.PI / 2)
      cyl.translate(RINGS.outer + len / 2, 0, 0)
      cyl.rotateZ(-a)
      parts.push(cyl)
    }
    // merge into one geometry
    const merged = new THREE.BufferGeometry()
    const pos = []
    const nor = []
    for (const p of parts) {
      const q = p.index ? p.toNonIndexed() : p
      pos.push(...q.attributes.position.array)
      nor.push(...q.attributes.normal.array)
    }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    return merged
  }, [])
  return (
    <mesh geometry={geo} position={[0, 0, WIRE]} castShadow>
      <meshStandardMaterial color="#d9dbe0" metalness={0.9} roughness={0.3} />
    </mesh>
  )
}

// one steel-tip dart, built along +z with the tip at the origin
function DartModel({ flight, barrel }) {
  const parts = useMemo(() => {
    // the point: a tapered steel needle
    const point = new THREE.LatheGeometry([new THREE.Vector2(0.0001, 0), new THREE.Vector2(0.0006, -0.002), new THREE.Vector2(0.0011, -0.012), new THREE.Vector2(0.0012, -0.032)], 12)
    // the barrel: knurled rings (a sine of grooves along its length)
    const bp = [new THREE.Vector2(0.0012, -0.032), new THREE.Vector2(0.0028, -0.034)]
    for (let k = 0; k <= 48; k++) {
      const z = -0.035 - (k / 48) * 0.046
      const knurl = k > 8 && k < 40 ? (k % 2 ? -0.00035 : 0) : 0
      const swell = 0.0034 + 0.0004 * Math.sin((k / 48) * Math.PI)
      bp.push(new THREE.Vector2(swell + knurl, z))
    }
    bp.push(new THREE.Vector2(0.0022, -0.083))
    const barrelGeo = new THREE.LatheGeometry(bp, 20)
    const shaft = new THREE.LatheGeometry([new THREE.Vector2(0.0022, -0.083), new THREE.Vector2(0.0021, -0.115), new THREE.Vector2(0.0024, -0.119), new THREE.Vector2(0.0001, -0.12)], 12)
    // flights: a standard shape, two crossed sheets
    const sh = new THREE.Shape()
    sh.moveTo(0, -0.098)
    sh.lineTo(0.016, -0.112)
    sh.lineTo(0.016, -0.135)
    sh.lineTo(0, -0.128)
    sh.lineTo(-0.016, -0.135)
    sh.lineTo(-0.016, -0.112)
    sh.closePath()
    const fl = new THREE.ShapeGeometry(sh)
    // the shape is in x/y; lay it along z
    fl.rotateX(Math.PI / 2)
    const fl2 = fl.clone().rotateZ(Math.PI / 2)
    return { point, barrelGeo, shaft, fl, fl2 }
  }, [])
  // lathes run along y; turn them so the dart runs along z
  const toZ = [Math.PI / 2, 0, 0]
  return (
    <group>
      <mesh geometry={parts.point} rotation={toZ} castShadow>
        <meshStandardMaterial color="#c9ccd2" metalness={1} roughness={0.25} />
      </mesh>
      <mesh geometry={parts.barrelGeo} rotation={toZ} castShadow>
        <meshStandardMaterial color={barrel === 'tungsten' ? '#8d9096' : '#c9a24a'} metalness={1} roughness={0.32} />
      </mesh>
      <mesh geometry={parts.shaft} rotation={toZ} castShadow>
        <meshStandardMaterial color="#141416" roughness={0.4} />
      </mesh>
      <mesh geometry={parts.fl} castShadow>
        <meshStandardMaterial color={flight} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.fl2} castShadow>
        <meshStandardMaterial color={flight} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const FWD = new THREE.Vector3(0, 0, 1)

export default function Dartboard({ black = '#141414', cream = '#e9dfc3', red = '#c4161c', green = '#1b8a3c', flight = '#c8141e', barrel = 'brass', speed = 14, accuracy = 18, sound = false, collectKey = 0, onScore }) {
  const face = useMemo(() => faceTexture({ black, cream, red, green }), [black, cream, red, green])
  const back = useMemo(() => backTexture(), [])
  const darts = useMemo(() => [0, 1, 2].map(() => ({ state: 'ready', p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), wob: 0, wobV: 0, axis: new THREE.Vector3(1, 0, 0), spin: 0 })), [])
  const refs = useRef([])
  const audio = useRef(null)
  const scores = useRef([])
  useEffect(() => () => audio.current?.dispose(), [])
  const sfx = () => {
    if (!sound) return null
    if (!audio.current) audio.current = createDartAudio()
    return audio.current
  }

  useEffect(() => {
    for (const d of darts) d.state = 'ready'
    scores.current = []
    onScore?.([])
  }, [collectKey])

  // throw the next dart at a point on the board face (board-local x, y)
  const throwAt = (ax, ay) => {
    const d = darts.find((x) => x.state === 'ready')
    if (!d) return
    // the hand: a little right of centre, at eye height, on the oche
    const start = new THREE.Vector3(0.12, BULL_Y - 0.05, OCHE - 0.35)
    // human error: a gaussian scatter on the aim point
    const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random())
    const sigma = accuracy / 1000
    const target = new THREE.Vector3(ax + gauss() * sigma, BULL_Y + ay + gauss() * sigma, 0)
    // projectile: horizontal speed covers the distance, the vertical speed is
    // chosen so that gravity brings it onto the target
    const dz = target.z - start.z
    const dist = Math.hypot(target.x - start.x, dz)
    const t = dist / speed
    d.v.set((target.x - start.x) / t, (target.y - start.y + 0.5 * 9.81 * t * t) / t, dz / t)
    d.p.copy(start)
    d.state = 'flying'
    d.spin = (Math.random() - 0.5) * 30
    sfx()?.whoosh()
  }

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const STEPS = 8
    const h = dt / STEPS
    darts.forEach((d, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = d.state !== 'ready'
      if (d.state === 'flying' || d.state === 'falling') {
        for (let s = 0; s < STEPS && (d.state === 'flying' || d.state === 'falling'); s++) {
          const prevZ = d.p.z
          d.v.y -= 9.81 * h
          // light air drag
          d.v.multiplyScalar(1 - 0.012 * d.v.length() * h)
          d.p.addScaledVector(d.v, h)
          if (d.state === 'flying' && prevZ > 0 && d.p.z <= 0) {
            // crossed the face plane: where did it land?
            const over = d.p.z / d.v.z
            const hx = d.p.x - d.v.x * over
            const hy = d.p.y - d.v.y * over
            const dx = hx
            const dy = hy - BULL_Y
            const r = Math.hypot(dx, dy)
            if (r <= R_BOARD && !(onWire(dx, dy) && Math.random() < 0.55)) {
              // sticks: the point sinks about 8 mm into the sisal
              const dir = d.v.clone().normalize()
              d.p.set(hx, hy, 0).addScaledVector(dir, 0.008)
              d.q.setFromUnitVectors(FWD, dir)
              d.state = 'stuck'
              d.wob = 0
              d.wobV = d.v.length() * 0.06 // the barrel's momentum rocks it about the point
              d.axis.set(-dir.y, dir.x, 0).normalize()
              const sc = r <= R_BOARD ? scoreAt(dx, dy) : { label: 'MISS', points: 0 }
              scores.current = [...scores.current, sc]
              onScore?.(scores.current)
              sfx()?.thunk(r <= RINGS.d1 ? 1 : 0.7)
              break
            }
            // bounced off the wire (or missed the board): it kicks back and drops
            d.p.set(hx, hy, 0.002)
            d.v.set((Math.random() - 0.5) * 1.5, Math.random() * 0.6, Math.abs(d.v.z) * 0.12)
            d.state = 'falling'
            d.spin = (Math.random() - 0.5) * 40
            scores.current = [...scores.current, { label: r <= R_BOARD ? 'BOUNCE' : 'MISS', points: 0 }]
            onScore?.(scores.current)
            sfx()?.tick()
          }
          if (d.state === 'falling' && d.p.y < 0.01) {
            d.p.y = 0.01
            d.state = 'floor'
            d.q.setFromEuler(new THREE.Euler(Math.PI / 2 - 0.15, 0, Math.random() * 6))
            sfx()?.clatter()
          }
        }
        if (d.state === 'flying') {
          // the flights keep it pointing along its path
          d.q.setFromUnitVectors(FWD, d.v.clone().normalize())
          d.q.multiply(new THREE.Quaternion().setFromAxisAngle(FWD, (d.spin * performance.now()) / 1000))
        } else if (d.state === 'falling') {
          d.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), d.spin * dt))
        }
      }
      if (d.state === 'stuck') {
        // the shaft wobbles about the point and settles
        d.wobV += (-d.wob * 900 - d.wobV * 14) * dt
        d.wob += d.wobV * dt
      }
      g.position.copy(d.p)
      g.quaternion.copy(d.q)
      if (d.state === 'stuck' && Math.abs(d.wob) > 1e-5) g.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(d.axis, d.wob))
    })
  })

  return (
    <group>
      {/* the board, hung on the wall with its face at z = 0 */}
      <group position={[0, BULL_Y, 0]}>
        <group
          onClick={(e) => {
            if (e.delta > 4) return
            e.stopPropagation()
            throwAt(e.point.x, e.point.y - BULL_Y)
          }}
        >
          {/* the body: black band round the edge, pressed board at the back */}
          <mesh position={[0, 0, -DEPTH / 2]} rotation-x={Math.PI / 2} castShadow receiveShadow>
            <cylinderGeometry args={[R_BOARD, R_BOARD, DEPTH, 128]} />
            <meshStandardMaterial attach="material-0" color="#0d0d0d" roughness={0.75} />
            <meshStandardMaterial attach="material-1" color="#0d0d0d" roughness={0.9} />
            <meshStandardMaterial attach="material-2" map={back} roughness={0.95} />
          </mesh>
          {/* the printed sisal face */}
          <mesh position={[0, 0, 0.0002]} receiveShadow>
            <circleGeometry args={[R_BOARD, 160]} />
            <meshStandardMaterial map={face} roughness={0.92} />
          </mesh>
        </group>
        <Spider />
        {/* the keyhole bracket and rubber feet on the back */}
        <mesh position={[0, 0.05, -DEPTH - 0.002]}>
          <boxGeometry args={[0.05, 0.06, 0.003]} />
          <meshStandardMaterial color="#b9bcc2" metalness={0.85} roughness={0.35} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh key={k} position={[Math.cos((k / 6) * Math.PI * 2) * 0.19, Math.sin((k / 6) * Math.PI * 2) * 0.19, -DEPTH - 0.003]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.009, 0.009, 0.006, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
        ))}
      </group>
      {darts.map((_, i) => (
        <group key={i} ref={(n) => (refs.current[i] = n)} visible={false}>
          <DartModel flight={flight} barrel={barrel} />
        </group>
      ))}
    </group>
  )
}
