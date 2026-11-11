import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A slim tablet in landscape, held on a magnetic disc and ball joint at the top
// of a slotted arm, on a weighted round base that rolls on four hidden casters.
// The screen is the face: pill eyes that look toward the pointer, blink and
// smile with the mood, and a mouth that opens while it speaks.
// 1 unit = 100 mm.

const W = 1.775 // tablet, portrait width (it is mounted landscape)
const H = 2.497
const T = 0.053
const R = 0.125 // corner radius
const B = 0.006 // edge chamfer
const BEZEL = 0.085

const DOCK = { y: 0.35, tilt: -0.2 } // the tablet's pose on the stand
const FOOT = new THREE.Vector3(0, -1.5, -0.42) // where the arm meets the base
const BALL = new THREE.Vector3(0, 0, -(T / 2 + 0.135)) // ball joint, in the tilted frame
const BASE = { y: -1.52, z: -0.2, height: 0.05, r: 0.72 }
const WHEEL_R = 0.035
const WHEEL_Y = BASE.y - BASE.height / 2 - 0.005
const WHEELS = [
  [-0.46, -0.36],
  [0.46, -0.36],
  [-0.46, 0.36],
  [0.46, 0.36],
]
export const FLOOR_Y = WHEEL_Y - WHEEL_R // the casters rest here

const FACE_W = 512 // the face is laid out in these units...
const FACE_H = 352 // (close to the screen's 1.45 : 1)
const S = 2 // ...and drawn at twice that, so it stays crisp
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const MOODS = {
  idle: { h: 1, lid: 0, cut: 0, smile: 0 },
  curious: { h: 1.08, lid: 0, cut: 0, smile: 0.2 },
  happy: { h: 0.92, lid: 0, cut: 0.62, smile: 1 },
  surprised: { h: 1.25, lid: 0, cut: 0, smile: 0 },
  sleepy: { h: 0.95, lid: 0.45, cut: 0, smile: 0 },
  asleep: { h: 0.9, lid: 0.95, cut: 0, smile: 0 },
}
export const MOOD_NAMES = Object.keys(MOODS)

// ---------- geometry ----------
function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

// flat rounded panel with UVs normalised to 0..1 so a texture fills it
function panel(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
  return g
}

function slab(w, h, r, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, r - bevel), {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 24,
  })
  g.translate(0, 0, -(depth - bevel * 2) / 2)
  return g
}

// flat stadium-shaped bar with a long slot down the middle (the stand's arm)
function slottedBar(length, halfWidth, slotHalf) {
  const s = new THREE.Shape()
  s.absarc(0, 0, halfWidth, Math.PI, Math.PI * 2, false)
  s.lineTo(halfWidth, length)
  s.absarc(0, length, halfWidth, 0, Math.PI, false)
  s.closePath()
  const slot = new THREE.Path()
  const y0 = 0.22
  const y1 = length - 0.3
  slot.absarc(0, y0, slotHalf, Math.PI * 2, Math.PI, true)
  slot.lineTo(-slotHalf, y1)
  slot.absarc(0, y1, slotHalf, Math.PI, 0, true)
  slot.closePath()
  s.holes.push(slot)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 20 })
  g.translate(0, 0, -0.01)
  return g
}

// ---------- the face, drawn into a canvas ----------
function pill(ctx, x, y, w, h) {
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2)
  ctx.fill()
}

function drawFace(ctx, layer, f, color) {
  const lctx = layer.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const ew = 62
  const eh = 128 * f.h
  const cy = 146 + f.gy
  const lid = clamp(Math.max(f.lid, f.blink), 0, 0.97)
  for (const side of [-1, 1]) {
    const cx = FACE_W / 2 + side * 96 + f.gx
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.clearRect(0, 0, layer.width, layer.height)
    lctx.setTransform(S, 0, 0, S, 0, 0)
    lctx.fillStyle = color
    pill(lctx, cx, cy, ew, eh)
    lctx.globalCompositeOperation = 'destination-out'
    // eyelid: cuts the top of the eye away
    if (lid > 0) lctx.fillRect(cx - ew, cy - eh / 2 - 4, ew * 2, eh * lid + 4)
    // happy: a curved cut turns the eye into a smiling arch
    if (f.cut > 0.01) {
      lctx.beginPath()
      lctx.ellipse(cx, cy + eh / 2 + eh * 0.62 * (1 - f.cut * 0.95), ew * 0.85, eh * 0.62, 0, 0, Math.PI * 2)
      lctx.fill()
    }
    lctx.globalCompositeOperation = 'source-over'
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 26 * S
    ctx.drawImage(layer, 0, 0)
    ctx.restore()
    ctx.drawImage(layer, 0, 0)
  }
  const show = Math.max(f.smile, f.open > 0.02 ? 1 : 0)
  if (show > 0.02) {
    const mw = 54 + f.smile * 22
    const my = 262 + f.gy * 0.6
    const lift = f.smile * 16
    const depth = 10 + f.open * 46
    ctx.save()
    ctx.setTransform(S, 0, 0, S, 0, 0)
    ctx.globalAlpha = clamp(show, 0, 1) * f.glow
    ctx.shadowColor = color
    ctx.shadowBlur = 20 * S
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(FACE_W / 2 - mw + f.gx, my - lift)
    ctx.quadraticCurveTo(FACE_W / 2 + f.gx, my - lift + 6, FACE_W / 2 + mw + f.gx, my - lift)
    ctx.quadraticCurveTo(FACE_W / 2 + f.gx, my - lift + depth * 2, FACE_W / 2 - mw + f.gx, my - lift)
    ctx.fill()
    ctx.restore()
  }
}

// A prop that can also be changed from inside the scene (tapping the screen);
// `onChange` lets the owner stay in sync.
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

// mood: idle | curious | happy | surprised | sleepy | asleep. speaking: the
// mouth moves. eyeColor: the face's glow. bodyColor: the aluminium. Tap the
// screen to put it to sleep or wake it. It turns toward the pointer.
export default function Ipad({ mood: moodProp = 'idle', speaking = false, eyeColor = '#2f7bff', bodyColor = '#e2e3e5', follow = true, onChange }) {
  const [mood, setMood] = useTwoWay(moodProp, 'mood', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const geo = useMemo(
    () => ({
      slab: slab(W, H, R, T, B),
      glass: panel(W - B * 2, H - B * 2, R - B),
      screen: panel(W - BEZEL * 2, H - BEZEL * 2, 0.06),
      face: panel(H - BEZEL * 2, W - BEZEL * 2, 0.06),
      bump: slab(0.31, 0.31, 0.085, 0.014, 0.004),
      arm: null,
      disc: new THREE.CircleGeometry(1, 48),
      barrel: new THREE.CylinderGeometry(1, 1, 1, 48).rotateX(Math.PI / 2),
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(1, 32, 24),
      base: new THREE.CylinderGeometry(BASE.r, BASE.r + 0.02, BASE.height, 96),
    }),
    [],
  )
  // the arm runs from the base up to the ball joint
  const armInfo = useMemo(() => {
    const ballWorld = BALL.clone().applyEuler(new THREE.Euler(DOCK.tilt, 0, 0)).add(new THREE.Vector3(0, DOCK.y, 0))
    const dir = new THREE.Vector3().subVectors(ballWorld, FOOT)
    const length = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    return { length, quat, geo: slottedBar(length, 0.06, 0.02) }
  }, [])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g?.dispose())
      armInfo.geo.dispose()
    },
    [geo, armInfo],
  )

  const mats = useMemo(() => {
    const metal = (color, roughness) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness })
    return {
      body: metal('#e2e3e5', 0.42),
      plateau: metal('#e2e3e5', 0.3),
      stand: metal('#3b3e45', 0.5),
      ring: metal('#18181a', 0.25),
      port: new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.6 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#0e0e0f', roughness: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#020203', roughness: 0.1, specularIntensity: 0.3, envMapIntensity: 0.5 }),
      // low specular keeps the black screen black under the studio light
      screen: new THREE.MeshPhysicalMaterial({ color: '#000', roughness: 0.1, specularIntensity: 0.25, envMapIntensity: 0.5 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#05060a', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0 }),
      iris: new THREE.MeshPhysicalMaterial({ color: '#0d1638', roughness: 0.1, metalness: 0.6, clearcoat: 1 }),
      flash: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.35, emissive: '#fff3d6', emissiveIntensity: 0.15 }),
    }
  }, [])

  const { canvas, layer, tex, faceMat } = useMemo(() => {
    const canvas = Object.assign(document.createElement('canvas'), { width: FACE_W * S, height: FACE_H * S })
    const layer = Object.assign(document.createElement('canvas'), { width: FACE_W * S, height: FACE_H * S })
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    // added over the black screen, so the face glows
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    return { canvas, layer, tex, faceMat }
  }, [])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      tex.dispose()
      faceMat.dispose()
    },
    [mats, tex, faceMat],
  )

  const standRef = useRef()
  const pivotRef = useRef()
  const wheels = useRef([])
  const want = useRef({})
  want.current = { mood, speaking, eyeColor, bodyColor, follow }
  const f = useRef({ h: 1, lid: 0, cut: 0, smile: 0, open: 0, blink: 0, gx: 0, gy: 0, glow: 1, nextBlink: 2, blinkUntil: 0 })
  const turn = useRef({ aim: 0, vel: 0, body: 0, head: 0, pitch: 0, roll: 1.4 })
  const tmp = useMemo(() => new THREE.Color(), [])
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const t = state.clock.elapsedTime
    const w = want.current
    const face = f.current
    const tn = turn.current
    const asleep = w.mood === 'asleep'
    const damp = THREE.MathUtils.damp

    // body colour eases
    tmp.set(w.bodyColor)
    if (!mats.body.color.equals(tmp)) {
      mats.body.color.lerp(tmp, 1 - Math.exp(-dt * 8))
      mats.plateau.color.copy(mats.body.color).multiplyScalar(0.92)
    }

    // roll in from the side on the casters: each wheel turns by distance / radius
    tn.roll = reduced ? 0 : damp(tn.roll, 0, 2.2, dt)
    for (const wh of wheels.current) if (wh) wh.rotation.z = -tn.roll / WHEEL_R

    // where to look: eyes first, then the head, then the whole stand
    const px = w.follow ? state.pointer.x : 0
    const py = w.follow ? state.pointer.y : 0
    let yaw = clamp(px * 1.2, -1.3, 1.3)
    let pitch = -py * 0.12
    const gy = -py * 16
    if (asleep) {
      yaw = 0
      pitch = 0.32 // nods forward
    }
    if (reduced) {
      tn.aim = yaw
      tn.vel = 0
    } else {
      const k = 3.2 // a big turn takes about a second and a half
      tn.vel += (k * k * (yaw - tn.aim) - 2 * k * tn.vel) * dt
      tn.aim += tn.vel * dt
    }
    // the stand swivels a beat behind; the ball joint covers what it has not turned yet
    tn.body = reduced ? tn.aim : damp(tn.body, tn.aim, 2.2, dt)
    tn.head = clamp(tn.aim - tn.body, -0.45, 0.45)
    tn.body = tn.aim - tn.head
    tn.pitch += (pitch - tn.pitch) * (1 - Math.exp(-dt / 0.35))
    // swivel about the base's centre, not the stand's origin
    standRef.current.rotation.y = tn.body
    standRef.current.position.set(tn.roll - BASE.z * Math.sin(tn.body), 0, BASE.z - BASE.z * Math.cos(tn.body))
    const gx = clamp((yaw - tn.aim) * 40, -26, 26)
    const bob = reduced || asleep ? 0 : Math.sin(t * 0.8) * 0.006
    pivotRef.current.rotation.set(tn.pitch, tn.head, tn.head * -0.05)
    pivotRef.current.position.y = BALL.y + bob

    // face
    const m = MOODS[w.mood] || MOODS.idle
    const now = t
    if (!reduced && now > face.nextBlink) {
      face.blinkUntil = now + 0.12
      face.nextBlink = now + 2.4 + Math.random() * 3
    }
    // a made-up speech level: a few overlapping waves, always positive
    const level = w.speaking ? clamp(0.35 + 0.35 * Math.sin(t * 11) * Math.sin(t * 4.3) + 0.2 * Math.sin(t * 17), 0, 1) : 0
    const k = 1 - Math.exp(-dt / 0.12)
    face.h += (m.h - face.h) * k
    face.lid += (m.lid - face.lid) * k
    face.cut += (m.cut - face.cut) * k
    face.smile += ((w.speaking ? Math.max(m.smile, 0.4) : m.smile) - face.smile) * k
    face.open += ((w.speaking ? 0.05 + Math.sqrt(level) * 1.1 : 0) - face.open) * (1 - Math.exp(-dt / 0.05))
    face.blink += ((now < face.blinkUntil ? 1 : 0) - face.blink) * (1 - Math.exp(-dt / 0.04))
    face.gx += (gx - face.gx) * (1 - Math.exp(-dt / 0.08))
    face.gy += (gy - face.gy) * (1 - Math.exp(-dt / 0.08))
    face.glow += ((asleep ? 0.35 : 1) - face.glow) * (1 - Math.exp(-dt / 0.4))
    drawFace(canvas.getContext('2d'), layer, face, w.eyeColor)
    tex.needsUpdate = true
  })

  const front = T / 2
  const { body, plateau, stand, ring, port, rubber, glass, screen, lens, iris, flash } = mats
  const { box, disc, barrel, sphere } = geo

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        setMood(mood === 'asleep' ? 'idle' : 'asleep')
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <group ref={standRef}>
        {/* the tilted dock frame, the ball joint, and the tablet held on it */}
        <group position={[0, DOCK.y, 0]} rotation={[DOCK.tilt, 0, 0]}>
          <group ref={pivotRef} position={BALL}>
            <mesh geometry={sphere} material={stand} scale={0.062} />
            <group position={[-BALL.x, -BALL.y, -BALL.z]}>
              {/* tablet (landscape) */}
              <group rotation={[0, 0, Math.PI / 2]}>
                <mesh geometry={geo.slab} material={body} castShadow />
                <mesh geometry={geo.glass} material={glass} position={[0, 0, front + 0.0006]} />
                <mesh geometry={geo.screen} material={screen} position={[0, 0, front + 0.0014]} />
                {/* front camera on the long edge (the top, in landscape) */}
                <mesh geometry={disc} material={ring} position={[W / 2 - BEZEL / 2, 0, front + 0.0014]} scale={0.015} />
                <mesh geometry={disc} material={iris} position={[W / 2 - BEZEL / 2, 0, front + 0.002]} scale={0.009} />
                {/* edges: top button, volume, port, speaker grilles */}
                <mesh geometry={box} material={body} position={[W / 2 - 0.15, H / 2, 0]} scale={[0.11, 0.012, 0.022]} />
                {[0.2, 0.31].map((d) => (
                  <mesh key={d} geometry={box} material={body} position={[W / 2, H / 2 - d, 0]} scale={[0.012, 0.085, 0.022]} />
                ))}
                <mesh geometry={box} material={port} position={[0, -H / 2, 0]} scale={[0.09, 0.002, 0.026]} />
                {[-1, 1].map((s) =>
                  [-H / 2, H / 2].map((y) =>
                    [-2, -1, 0, 1, 2].map((i) => <mesh key={`${s}${y}${i}`} geometry={box} material={port} position={[s * 0.4 + i * 0.034, y, 0]} scale={[0.022, 0.002, 0.009]} />),
                  ),
                )}
                {/* back: camera plateau with lenses and flash */}
                <group position={[0, 0, -front]} rotation={[0, Math.PI, 0]}>
                  <group position={[-W / 2 + 0.215, H / 2 - 0.215, 0]}>
                    <mesh geometry={geo.bump} material={plateau} position={[0, 0, 0.004]} />
                    <group position={[-0.068, 0.068, 0.011]}>
                      <mesh geometry={barrel} material={ring} position={[0, 0, 0.004]} scale={[0.064, 0.064, 0.012]} />
                      <mesh geometry={disc} material={lens} position={[0, 0, 0.0105]} scale={0.054} />
                      <mesh geometry={disc} material={iris} position={[0, 0, 0.0112]} scale={0.026} />
                      <mesh geometry={disc} material={lens} position={[0, 0, 0.0118]} scale={0.012} />
                    </group>
                    <group position={[-0.068, -0.072, 0.011]}>
                      <mesh geometry={barrel} material={ring} position={[0, 0, 0.001]} scale={[0.054, 0.054, 0.004]} />
                      <mesh geometry={disc} material={lens} position={[0, 0, 0.0036]} scale={0.048} />
                    </group>
                    <group position={[0.078, -0.01, 0.011]}>
                      <mesh geometry={barrel} material={ring} position={[0, 0, 0.001]} scale={[0.03, 0.03, 0.003]} />
                      <mesh geometry={disc} material={flash} position={[0, 0, 0.003]} scale={0.024} />
                    </group>
                    <mesh geometry={disc} material={port} position={[0.01, 0, 0.0116]} scale={0.007} />
                    <mesh geometry={disc} material={lens} position={[0.078, 0.082, 0.0116]} scale={0.014} />
                  </group>
                </group>
              </group>
              {/* the face, on the screen: laid out in the held frame, not rotated with the tablet */}
              <mesh geometry={geo.face} material={faceMat} position={[0, 0, front + 0.0022]} renderOrder={2} />
              {/* magnetic hook on the tablet's back: disc, neck */}
              <mesh geometry={barrel} material={stand} position={[0, 0, -(T / 2 + 0.012)]} scale={[0.42, 0.42, 0.022]} />
              <mesh geometry={barrel} material={stand} position={[0, 0, -(T / 2 + 0.05)]} scale={[0.06, 0.06, 0.06]} />
              <mesh geometry={barrel} material={stand} position={[0, 0, -(T / 2 + 0.085)]} scale={[0.036, 0.036, 0.05]} />
            </group>
          </group>
        </group>

        {/* the arm, from the base up to the ball joint */}
        <group position={FOOT} quaternion={armInfo.quat}>
          <mesh geometry={armInfo.geo} material={stand} castShadow />
          <mesh geometry={barrel} material={stand} position={[0, armInfo.length, 0]} scale={[0.075, 0.075, 0.06]} />
          <mesh geometry={barrel} material={stand} scale={[0.075, 0.075, 0.07]} />
        </group>
        <mesh geometry={box} material={stand} position={[0, FOOT.y - 0.01, FOOT.z]} scale={[0.2, 0.06, 0.12]} />
        <mesh geometry={geo.base} material={stand} position={[0, BASE.y, BASE.z]} castShadow receiveShadow />
        {WHEELS.map(([x, z], i) => (
          <group key={i} ref={(el) => (wheels.current[i] = el)} position={[x, WHEEL_Y, BASE.z + z]}>
            <mesh geometry={barrel} material={rubber} scale={[WHEEL_R, WHEEL_R, 0.03]} />
            <mesh geometry={barrel} material={stand} scale={[WHEEL_R * 0.5, WHEEL_R * 0.5, 0.034]} />
            <mesh geometry={box} material={stand} scale={[WHEEL_R * 1.7, 0.007, 0.034]} />
          </group>
        ))}
      </group>
    </group>
  )
}
