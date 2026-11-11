import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EYE_D, EYE_PHI, NOSTRIL_D, NOSTRIL_PHI, createSnakeBody } from './body.js'
import { SEG, SEGMENTS, groundY } from './profile.js'
import { rearTargets } from './pose.js'
import { makeSnakeTextures } from './textures.js'

const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t

// Colour pickers fire on every drag step; regenerating the scale texture is
// heavy, so wait until the value settles.
function useSettled(value, ms = 160) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

const EYE_R = 0.04

// A shallow spherical cap that sits on the eyeball and carries the iris image.
function makeIrisGeometry() {
  const g = new THREE.SphereGeometry(EYE_R * 1.004, 28, 12, 0, Math.PI * 2, 0, 0.95)
  g.rotateX(Math.PI / 2) // pole towards +z, the way the eye looks
  const pos = g.attributes.position
  const uv = g.attributes.uv
  const rmax = EYE_R * Math.sin(0.95)
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * rmax), 0.5 + pos.getY(i) / (2 * rmax))
  return g
}

function irisTexture(color) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const base = new THREE.Color(color)
  const lighter = base.clone().lerp(new THREE.Color('#ffffff'), 0.35)
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, '#000')
  grad.addColorStop(0.3, '#000')
  grad.addColorStop(0.36, `#${base.getHexString()}`)
  grad.addColorStop(0.78, `#${lighter.getHexString()}`)
  grad.addColorStop(0.95, '#0a0604')
  grad.addColorStop(1, '#0a0604')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// mode: 'rear' (head raised, coiled) or 'slither' (crawls after the pointer).
// followPointer: pointer drives the snake; off = it moves by itself.
export default function Snake({
  mode = 'rear',
  followPointer = true,
  tongue = true,
  back = '#171b2b',
  belly = '#d9c9a6',
  pattern = '#8a93ad',
  eye = '#6b3d18',
  tongueColor = '#e0627a',
  patternAmount = 0.65,
  scales = 18,
  gloss = 0.7,
  coilSide = 1,
}) {
  const { camera, raycaster } = useThree()

  const body = useMemo(() => createSnakeBody(), [])
  const skinKey = useSettled(`${back}|${belly}|${pattern}|${patternAmount}|${scales}`)
  const skin = useMemo(() => {
    const [b, bl, p, a, s] = skinKey.split('|')
    return makeSnakeTextures({ back: b, belly: bl, pattern: p, patternAmount: +a, scales: +s })
  }, [skinKey])
  useEffect(() => () => skin.dispose(), [skin])
  const eyeKey = useSettled(eye)
  const iris = useMemo(() => irisTexture(eyeKey), [eyeKey])
  const irisGeo = useMemo(makeIrisGeometry, [])

  const sim = useMemo(() => {
    const mk = () => Array.from({ length: SEGMENTS }, () => new THREE.Vector3())
    return {
      P: mk(), // physical spine
      V: mk(), // spring velocities
      T: mk(), // targets (rear pose)
      D: mk(), // displayed spine
      ready: false,
      mode: 'rear',
      face: 1.06,
      bodyYaw: 1.06,
      head: new THREE.Vector3(0.45, 1.95, 0.3),
      // slither state
      ang: 0,
      speed: 0,
      wave: 0,
      waveAmt: 0,
      prevDir: new THREE.Vector2(1, 0),
      flick: { t: -1, next: 1.2 },
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit: new THREE.Vector3(),
      frame: { pos: new THREE.Vector3(), nrm: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), side: new THREE.Vector3() },
      m: new THREE.Matrix4(),
      tmp: new THREE.Vector3(),
    }
  }, [])

  const eyeR = useRef()
  const eyeL = useRef()
  const nosR = useRef()
  const nosL = useRef()
  const tongueRoot = useRef()
  const tongueLen = useRef()
  const prongA = useRef()
  const prongB = useRef()
  const bodyMat = useRef()

  useEffect(() => {
    if (bodyMat.current) bodyMat.current.roughness = 0.78 - gloss * 0.6
  }, [gloss])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const time = state.clock.elapsedTime
    const { P, V, T, D } = sim

    // Pointer, or a slow wander when it isn't being followed.
    const px = followPointer ? state.pointer.x : Math.sin(time * 0.45) * 0.7
    const py = followPointer ? state.pointer.y : Math.sin(time * 0.7 + 1) * 0.4

    if (!sim.ready) {
      rearTargets(T, sim.head, sim.face, sim.bodyYaw, time, coilSide)
      for (let i = 0; i < SEGMENTS; i++) P[i].copy(T[i])
      sim.ready = true
    }

    if (sim.mode !== mode) {
      sim.mode = mode
      sim.speed = 0
      sim.ang = -sim.face // keep heading the way the head faces
    }

    if (mode === 'rear') {
      sim.waveAmt += (0 - sim.waveAmt) * (1 - Math.exp(-4 * dt))
      const desired = Math.atan2(0.5, px * 0.9 + 0.28)
      sim.face = lerpAngle(sim.face, desired, 1 - Math.exp(-5 * dt))
      sim.bodyYaw = lerpAngle(sim.bodyYaw, 1.06 + (desired - 1.06) * 0.35, 1 - Math.exp(-0.7 * dt))
      const tx = 0.45 + px * 1.5
      const ty = 1.95 + py * 0.5 + Math.sin(time * 1.3) * 0.04
      const tz = 0.3 + py * 0.25
      sim.head.x += (tx - sim.head.x) * (1 - Math.exp(-6 * dt))
      sim.head.y += (ty - sim.head.y) * (1 - Math.exp(-6 * dt))
      sim.head.z += (tz - sim.head.z) * (1 - Math.exp(-6 * dt))
      rearTargets(T, sim.head, sim.face, sim.bodyYaw, time, coilSide)
      // Each point chases its target on a damped spring; the tail is looser,
      // so it trails and sways behind the head.
      for (let i = 0; i < SEGMENTS; i++) {
        const f = i / (SEGMENTS - 1)
        const k = 150 * (1 - 0.65 * Math.pow(f, 1.2))
        const c = 2 * Math.sqrt(k) * 0.6
        const p = P[i]
        const v = V[i]
        const t = T[i]
        v.x += ((t.x - p.x) * k - v.x * c) * dt
        v.y += ((t.y - p.y) * k - v.y * c) * dt
        v.z += ((t.z - p.z) * k - v.z * c) * dt
        p.addScaledVector(v, dt)
        const gy = groundY(i * SEG)
        if (p.y < gy) {
          p.y = gy
          if (v.y < 0) v.y = 0
        }
      }
    } else {
      // --- Slither: the head chases a spot on the floor, the body follows. ---
      let tx
      let tz
      if (followPointer) {
        raycaster.setFromCamera(state.pointer, camera)
        if (raycaster.ray.intersectPlane(sim.plane, sim.hit)) {
          tx = sim.hit.x
          tz = sim.hit.z
        } else {
          tx = P[0].x
          tz = P[0].z
        }
      } else {
        tx = Math.sin(time * 0.35) * 3.4
        tz = Math.sin(time * 0.52 + 1) * 1.8 + 0.4
      }
      tx = THREE.MathUtils.clamp(tx, -4.6, 4.6)
      tz = THREE.MathUtils.clamp(tz, -3, 3.2)
      const dx = tx - P[0].x
      const dz = tz - P[0].z
      const dist = Math.hypot(dx, dz)
      if (dist > 0.3) {
        const want = Math.atan2(-dz, dx) // angle in the xz plane, matching +x = 0, -z = +angle
        sim.ang = lerpAngle(sim.ang, want, Math.min(1, dt * 3.2))
      }
      const targetSpeed = dist > 0.35 ? Math.min(dist * 1.3, 2.3) : 0
      sim.speed += (targetSpeed - sim.speed) * Math.min(1, dt * 2.8)
      P[0].x += Math.cos(sim.ang) * sim.speed * dt
      P[0].z -= Math.sin(sim.ang) * sim.speed * dt

      const sf = Math.min(1, sim.speed / 1.2)
      sim.waveAmt += (1 - sim.waveAmt) * (1 - Math.exp(-3 * dt))
      const lift = 0.5 - 0.15 * sf
      const yTarget = (i) => groundY(i * SEG) + lift * Math.exp(-i / 6.5)
      P[0].y += (yTarget(0) - P[0].y) * Math.min(1, dt * 8)
      for (let i = 1; i < SEGMENTS; i++) {
        const prev = P[i - 1]
        const cur = P[i]
        cur.y += (yTarget(i) - cur.y) * Math.min(1, dt * 8)
        const dy = cur.y - prev.y
        const dh = Math.sqrt(Math.max(SEG * SEG - dy * dy, 0.0016 * SEG * SEG))
        let ex = cur.x - prev.x
        let ez = cur.z - prev.z
        let len = Math.hypot(ex, ez)
        if (len < 1e-5) {
          ex = sim.prevDir.x
          ez = sim.prevDir.y
          len = 1
        }
        cur.x = prev.x + (ex / len) * dh
        cur.z = prev.z + (ez / len) * dh
      }
      for (let i = 0; i < SEGMENTS; i++) V[i].set(0, 0, 0)
      sim.wave += dt * (3.2 + sim.speed * 2.6)
    }

    // Displayed spine: the physical one, plus a travelling side-to-side wave
    // while slithering.
    for (let i = 0; i < SEGMENTS; i++) {
      D[i].copy(P[i])
      if (sim.waveAmt > 0.001) {
        const a = Math.min(P.length - 1, i + 1)
        const b = Math.max(0, i - 1)
        let tx = P[b].x - P[a].x
        let tz = P[b].z - P[a].z
        const l = Math.hypot(tx, tz) || 1
        tx /= l
        tz /= l
        const sf = Math.min(1, sim.speed / 1.2)
        const amp = (0.05 + 0.2 * sf) * sim.waveAmt * Math.min(1, i / 9) * Math.min(1, (SEGMENTS - i) / 6 + 0.35)
        const w = Math.sin(sim.wave - i * 0.5) * amp
        D[i].x += -tz * w
        D[i].z += tx * w
      }
    }

    body.update(D, Math.sin(time * 1.5) * 0.02)

    // --- Head details ---
    const f = sim.frame
    for (const [ref, sgn] of [[eyeR, 1], [eyeL, -1]]) {
      const o = ref.current
      if (!o) continue
      body.surfacePoint(D, EYE_D, EYE_PHI, sgn, -0.012, f)
      o.position.copy(f.pos)
      o.lookAt(sim.tmp.copy(f.pos).add(f.nrm))
    }
    for (const [ref, sgn] of [[nosR, 1], [nosL, -1]]) {
      const o = ref.current
      if (!o) continue
      body.surfacePoint(D, NOSTRIL_D, NOSTRIL_PHI, sgn, 0.0, f)
      o.position.copy(f.pos)
      o.lookAt(sim.tmp.copy(f.pos).add(f.nrm))
    }

    // Tongue: rooted at the snout tip, pointing along the head.
    const root = tongueRoot.current
    if (root) {
      body.surfacePoint(D, 0.02, Math.PI * 0.92, 1, 0.0, f)
      sim.m.makeBasis(f.side, f.up, f.fwd)
      sim.m.setPosition(f.pos)
      root.matrix.copy(sim.m)
      root.matrixWorldNeedsUpdate = true
      const fl = sim.flick
      let e = 0
      if (fl.t < 0) {
        fl.next -= dt
        if (fl.next <= 0 && tongue) fl.t = 0
      } else {
        fl.t += dt
        const u = fl.t / 0.95
        if (u >= 1) {
          fl.t = -1
          fl.next = 1.8 + Math.random() * 2.4
        } else e = Math.pow(Math.sin(Math.PI * u), 0.55)
      }
      root.visible = tongue && e > 0.01
      if (tongueLen.current) tongueLen.current.scale.z = Math.max(e, 0.001)
      const spread = 0.2 + 0.28 * Math.sin(fl.t * 36) * e
      if (prongA.current) prongA.current.rotation.y = spread
      if (prongB.current) prongB.current.rotation.y = -spread
    }
  })

  return (
    <group>
      <mesh geometry={body.geometry} castShadow frustumCulled={false}>
        <meshPhysicalMaterial
          ref={bodyMat}
          map={skin.map}
          bumpMap={skin.bumpMap}
          bumpScale={2.4}
          roughness={0.78 - gloss * 0.6}
          metalness={0.04}
          clearcoat={0.55}
          clearcoatRoughness={0.28}
          iridescence={0.3}
          iridescenceIOR={1.3}
          iridescenceThicknessRange={[120, 420]}
          envMapIntensity={1.15}
        />
      </mesh>

      {[eyeR, eyeL].map((r, i) => (
        <group key={i} ref={r}>
          <mesh>
            <sphereGeometry args={[EYE_R, 24, 16]} />
            <meshPhysicalMaterial color="#0b0605" roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} />
          </mesh>
          <mesh geometry={irisGeo}>
            <meshPhysicalMaterial map={iris} roughness={0.08} clearcoat={1} clearcoatRoughness={0.02} />
          </mesh>
        </group>
      ))}

      {[nosR, nosL].map((r, i) => (
        <mesh key={i} ref={r} scale={[1.6, 0.7, 0.5]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color="#050403" roughness={0.6} />
        </mesh>
      ))}

      <group ref={tongueRoot} matrixAutoUpdate={false} visible={false}>
        <group ref={tongueLen}>
          <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0095, 0.2, 8]} />
            <meshStandardMaterial color={tongueColor} roughness={0.35} />
          </mesh>
          <group position={[0, 0, 0.2]} rotation={[0.55, 0, 0]}>
            <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0055, 0.0075, 0.12, 8]} />
              <meshStandardMaterial color={tongueColor} roughness={0.35} />
            </mesh>
            {[prongA, prongB].map((r, i) => (
              <group key={i} ref={r} position={[0, 0, 0.12]}>
                <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.0008, 0.005, 0.14, 6]} />
                  <meshStandardMaterial color={tongueColor} roughness={0.35} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}
