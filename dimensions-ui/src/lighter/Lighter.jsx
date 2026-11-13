import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createLighterAudio } from './audio.js'

// A flip-top windproof lighter. 1 unit = 10 mm: the case is 38 x 13 mm and the
// whole thing stands 57 mm tall. +y is up, the front face looks along +z.
const W = 3.8
const D = 1.3
const R = 0.32 // corner radius, seen from above
const CASE_H = 3.6
const LID_H = 2.1
const WALL = 0.06
const CAP = 0.08 // thickness of the lid's top
const BEVEL = 0.03

// The hinge runs front to back along the right-hand side, just outside the
// case, at the seam. The lid turns clockwise (seen from the front) about it.
// Everything the lid could hit (the chimney and the wheel) sits up and to the
// left of the hinge, so the lid only ever swings away from them.
const HINGE_X = W / 2 + 0.1
const KNUCKLE_R = 0.1
const OPEN = 2.9 // radians the lid opens to, where it rests on its cam stop

// The insert: a perforated chimney round the wick, and the flint wheel beside
// it between two brackets.
const INSERT_T = 0.06
const CHIM = { x0: -1.65, x1: 0.75, z: 0.42, h: 1.55 }
const WICK = { x: -0.45, top: 0.5, r: 0.07 }
const WHEEL = { x: 1.15, y: 1.2, r: 0.3, len: 0.78 }
const BRACKET_X1 = 1.5
const SPARKS = 28

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

// Extrude a plan-view outline (x across, y becomes depth) straight up by `h`.
function upright(shape, h, bevel = 0, holes = []) {
  shape.holes.push(...holes)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 16,
  })
  g.rotateX(-Math.PI / 2) // extrusion now runs up
  g.translate(0, bevel, 0)
  return g
}

// Fine horizontal brushing, as a roughness map: brighter lines are rougher.
function brushedTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 8, height: 512 })
  const g = c.getContext('2d')
  for (let y = 0; y < 512; y++) {
    const v = 150 + Math.random() * 90
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 8, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 2)
  return t
}

// Round holes in the chimney walls: an alpha map, white where there is metal.
function holesTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 160 })
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 256, 160)
  g.fillStyle = '#000'
  for (const row of [0, 1]) {
    for (let i = 0; i < 4; i++) {
      g.beginPath()
      g.arc(40 + i * 58, 52 + row * 50, 18, 0, Math.PI * 2)
      g.fill()
    }
  }
  return new THREE.CanvasTexture(c)
}

// Knurling on the flint wheel: lines across it, as a bump map.
function knurlTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 16 })
  const g = c.getContext('2d')
  for (let x = 0; x < 256; x++) {
    const v = x % 8 < 4 ? 230 : 40
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(x, 0, 1, 16)
  }
  return new THREE.CanvasTexture(c)
}

// The engraving: white letters on black, used as an alpha map on a darker
// version of the metal, so the letters read as cut into the case.
function engravingTexture(text) {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 352 })
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, 512, 352)
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = 150
  g.font = `600 ${size}px "Instrument Serif", Georgia, serif`
  while (g.measureText(text).width > 470 && size > 30) {
    size -= 6
    g.font = `600 ${size}px "Instrument Serif", Georgia, serif`
  }
  g.fillText(text, 256, 182)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  return t
}

const FINISHES = {
  brushed: { color: '#c9ccd1', roughness: 0.34, metalness: 1, brushed: true },
  polished: { color: '#d6d9de', roughness: 0.06, metalness: 1, brushed: false },
  black: { color: '#1c1c1f', roughness: 0.42, metalness: 0.55, brushed: false },
  brass: { color: '#cfa654', roughness: 0.24, metalness: 1, brushed: true },
  copper: { color: '#c47a52', roughness: 0.26, metalness: 1, brushed: true },
}
export const LIGHTER_FINISHES = Object.keys(FINISHES)

// The flame is a real volume, not a card: a teardrop of revolution (widest a
// third of the way up, like a candle or wick flame) with a smaller bright core
// inside it. Each shell glows by how much flame you look through: strongest
// where its surface faces you, fading to nothing at the silhouette. So it
// reads as a round, soft flame from any side, and as a glowing disc from
// above. Blue at the root where the fuel is still mixing with air, flickering
// and leaning with the wind, and added on top of the scene so it glows.
const FLAME_H = 2.7
const FLAME_R = 0.4
function flameProfile(rScale, hScale) {
  const pts = []
  const N = 40
  for (let i = 0; i <= N; i++) {
    const y = i / N
    const r = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(y, 0.72)), 0), 0.85) * (1 - 0.3 * y)
    pts.push(new THREE.Vector2(r * FLAME_R * rScale, y * FLAME_H * hScale))
  }
  return new THREE.LatheGeometry(pts, 36)
}
const flameVert = `
uniform float wind; uniform float t;
varying float vY; varying float vFace;
void main() {
  float y = uv.y;
  vY = y;
  vec3 p = position;
  // breathing and flicker grow toward the tip, the base stays anchored on the wick
  p.xz *= 1.0 + 0.07 * sin(t * 11.0 + y * 6.0) * y;
  p.x += (wind * 0.55 + sin(t * 9.0 + y * 5.0) * 0.04 + sin(t * 23.0 + y * 9.0) * 0.015) * y * y;
  p.z += (cos(t * 7.3 + y * 4.0) * 0.035 + sin(t * 19.0 + y * 8.0) * 0.012) * y * y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFace = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`
const flameFrag = `
uniform float t; uniform float amount; uniform float inner;
varying float vY; varying float vFace;
void main() {
  float y = vY;
  // how much flame the eye looks through: thick in the middle, none at the edge
  float thick = pow(vFace, 1.6);
  float a = thick * smoothstep(0.0, 0.05, y) * smoothstep(1.0, 0.7, y);
  vec3 outer = mix(vec3(1.0, 0.38, 0.05), vec3(1.0, 0.7, 0.28), thick);
  vec3 core = vec3(1.0, 0.9, 0.62);
  vec3 col = mix(outer, core, inner);
  // the blue root
  col = mix(vec3(0.22, 0.4, 1.0), col, smoothstep(0.03, 0.18 + 0.1 * inner, y));
  float gain = mix(1.25, 1.6, inner);
  gl_FragColor = vec4(col * gain, a * amount * mix(0.85, 0.9, inner));
}`

function flameMaterial(inner) {
  return new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, amount: { value: 0 }, wind: { value: 0 }, inner: { value: inner } },
    vertexShader: flameVert,
    fragmentShader: flameFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

// A prop that can also be changed from inside the scene (clicking the lid or
// the wheel); `onChange` lets the owner stay in sync.
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

// finish: brushed | polished | black | brass | copper. open: the lid. lit: the
// flame (it only burns with the lid open). flameSize, wind: the flame's size
// and lean. engraving: text cut into the front. sound: the clinks and strikes.
export default function Lighter({
  finish = 'brushed',
  open: openProp = false,
  lit: litProp = false,
  flameSize = 1,
  wind = 0,
  engraving = 'RD',
  sound = false,
  onChange,
}) {
  const [open, setOpen] = useTwoWay(openProp, 'open', onChange)
  const [lit, setLit] = useTwoWay(litProp, 'lit', onChange)
  const [hoverBody, setHoverBody] = useState(false)
  const [hoverWheel, setHoverWheel] = useState(false)
  useCursor(hoverBody || hoverWheel, 'pointer')

  // ---- geometry ----
  const geo = useMemo(() => {
    const hinge = (len) => new THREE.CylinderGeometry(KNUCKLE_R, KNUCKLE_R, len, 20).rotateX(Math.PI / 2)
    const wallH = LID_H - CAP + BEVEL
    return {
      case: upright(roundedRect(W - BEVEL * 2, D - BEVEL * 2, R - BEVEL), CASE_H, BEVEL),
      lidWalls: upright(roundedRect(W, D, R), wallH, 0, [roundedRect(W - WALL * 2, D - WALL * 2, R - WALL)]),
      lidCap: upright(roundedRect(W - BEVEL * 2, D - BEVEL * 2, R - BEVEL), CAP, BEVEL),
      insert: upright(roundedRect(W - WALL * 2 - 0.02, D - WALL * 2 - 0.02, R - WALL - 0.01), INSERT_T),
      knuckle: hinge(0.118),
      leaf: new THREE.BoxGeometry(0.12, 0.24, 0.118),
      chimFront: new THREE.PlaneGeometry(CHIM.x1 - CHIM.x0, CHIM.h),
      chimSide: new THREE.PlaneGeometry(CHIM.z * 2, CHIM.h),
      bracket: new THREE.PlaneGeometry(BRACKET_X1 - CHIM.x1, WHEEL.y - INSERT_T),
      bracketCap: new THREE.CircleGeometry(0.36, 24),
      wheel: new THREE.CylinderGeometry(WHEEL.r, WHEEL.r, WHEEL.len, 40).rotateX(Math.PI / 2),
      axle: new THREE.CylinderGeometry(0.05, 0.05, CHIM.z * 2 + 0.08, 12).rotateX(Math.PI / 2),
      wick: new THREE.CylinderGeometry(WICK.r, WICK.r * 1.1, WICK.top - INSERT_T, 10),
      wickTip: new THREE.SphereGeometry(WICK.r * 1.05, 10, 8),
      // tall enough to stand well clear of the chimney, as a real one does
      flame: flameProfile(1, 1),
      flameCore: flameProfile(0.5, 0.7),
      engrave: new THREE.PlaneGeometry(2.6, 1.79),
    }
  }, [])

  const tex = useMemo(() => ({ brushed: brushedTexture(), holes: holesTexture(), knurl: knurlTexture() }), [])
  const mats = useMemo(() => {
    const steel = new THREE.MeshPhysicalMaterial({ color: '#bfc3c8', metalness: 1, roughness: 0.36, envMapIntensity: 1.2 })
    return {
      body: new THREE.MeshPhysicalMaterial({ metalness: 1, envMapIntensity: 1.3, clearcoat: 0.2, clearcoatRoughness: 0.2 }),
      steel,
      chimney: new THREE.MeshPhysicalMaterial({ color: '#bfc3c8', metalness: 1, roughness: 0.38, alphaMap: tex.holes, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.1 }),
      bracket: new THREE.MeshPhysicalMaterial({ color: '#bfc3c8', metalness: 1, roughness: 0.38, side: THREE.DoubleSide }),
      wheel: new THREE.MeshStandardMaterial({ color: '#8c9096', metalness: 1, roughness: 0.45, bumpMap: tex.knurl, bumpScale: 2 }),
      wick: new THREE.MeshStandardMaterial({ color: '#d8cfbd', roughness: 1 }),
      char: new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: 1 }),
      engrave: new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, metalness: 0.7, roughness: 0.6 }),
      flame: flameMaterial(0),
      flameCore: flameMaterial(1),
      spark: new THREE.PointsMaterial({ color: '#ffcf6b', size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    }
  }, [tex])

  const engraveTex = useMemo(() => (engraving ? engravingTexture(engraving) : null), [engraving])
  useEffect(() => () => engraveTex?.dispose(), [engraveTex])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(tex).forEach((t) => t.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, tex, mats],
  )

  // finish and engraving update the materials in place
  useEffect(() => {
    const f = FINISHES[finish] || FINISHES.brushed
    const b = mats.body
    b.color.set(f.color)
    b.roughness = f.roughness
    b.metalness = f.metalness
    b.roughnessMap = f.brushed ? tex.brushed : null
    b.needsUpdate = true
    const e = mats.engrave
    e.color.set(f.color).multiplyScalar(finish === 'black' ? 2.6 : 0.32) // black lacquer engraves to bright brass
    if (finish === 'black') e.color.set('#c9a24f')
    e.alphaMap = engraveTex
    e.needsUpdate = true
  }, [finish, mats, tex, engraveTex])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { open, lit, flameSize, wind, sound }
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, arg) => {
    if (!live.current.sound) return
    if (!audio.current) audio.current = createLighterAudio()
    audio.current?.[name](arg)
  }

  // ---- motion ----
  const lidRef = useRef()
  const wheelRef = useRef()
  const flameRef = useRef()
  const lightRef = useRef()
  const st = useRef({ a: openProp ? OPEN : 0, v: 0, wheel: 0, wheelV: 0, flame: litProp && openProp ? 1 : 0, igniteAt: -1, snuffed: false })
  const sparks = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3).fill(-100), 3))
    return { geo: g, vel: new Float32Array(SPARKS * 3), life: new Float32Array(SPARKS) }
  }, [])
  useEffect(() => () => sparks.geo.dispose(), [sparks])

  const strike = (e) => {
    e.stopPropagation()
    const s = st.current
    if (s.a < OPEN * 0.85) return // the wheel is under the lid
    s.wheelV = -34
    play('strike')
    const p = sparks.geo.attributes.position.array
    for (let i = 0; i < SPARKS; i++) {
      p[i * 3] = WHEEL.x - 0.18
      p[i * 3 + 1] = CASE_H + WHEEL.y - WHEEL.r * 0.9
      p[i * 3 + 2] = (Math.random() - 0.5) * 0.5
      sparks.vel[i * 3] = -1.2 - Math.random() * 2.4
      sparks.vel[i * 3 + 1] = 0.6 + Math.random() * 2.2
      sparks.vel[i * 3 + 2] = (Math.random() - 0.5) * 1.2
      sparks.life[i] = 0.15 + Math.random() * 0.35
    }
    if (!live.current.lit) s.igniteAt = 0.07 // the sparks reach the wick a moment later
  }

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const w = live.current
    const time = state.clock.elapsedTime

    // the lid on a stiff spring (the cam), stopped by the case and by the cam stop
    const target = w.open ? OPEN : 0
    s.v += ((target - s.a) * 140 - s.v * 10) * dt
    s.a += s.v * dt
    if (s.a > OPEN) {
      if (s.v > 2) play('open', s.v / 12)
      s.a = OPEN
      s.v = s.v > 0 ? -s.v * 0.22 : s.v
    }
    if (s.a < 0) {
      if (s.v < -2) play('close', -s.v / 12)
      s.a = 0
      s.v = s.v < 0 ? -s.v * 0.18 : s.v
    }
    lidRef.current.rotation.z = -s.a

    // closing the lid smothers the flame
    if (w.lit && s.a < OPEN * 0.55) {
      if (!s.snuffed) {
        s.snuffed = true
        setLit(false)
      }
    } else s.snuffed = false

    // the wheel spins down after a strike
    s.wheelV *= Math.exp(-dt * 3.5)
    s.wheel += s.wheelV * dt
    wheelRef.current.rotation.z = s.wheel

    // the wick catches a moment after the sparks
    if (s.igniteAt >= 0) {
      s.igniteAt -= dt
      if (s.igniteAt < 0) {
        s.igniteAt = -1
        setLit(true)
        play('ignite')
      }
    }

    // sparks fly and fall
    const p = sparks.geo.attributes.position.array
    let any = false
    for (let i = 0; i < SPARKS; i++) {
      if (sparks.life[i] <= 0) continue
      any = true
      sparks.life[i] -= dt
      sparks.vel[i * 3 + 1] -= 9 * dt
      p[i * 3] += sparks.vel[i * 3] * dt
      p[i * 3 + 1] += sparks.vel[i * 3 + 1] * dt
      p[i * 3 + 2] += sparks.vel[i * 3 + 2] * dt
      if (sparks.life[i] <= 0) p[i * 3 + 1] = -100
    }
    if (any) sparks.geo.attributes.position.needsUpdate = true

    // the flame grows in, flickers, and leans with the wind
    const burning = w.lit && s.a > OPEN * 0.55
    s.flame += ((burning ? 1 : 0) - s.flame) * (1 - Math.exp(-dt * (burning ? 6 : 14)))
    const flick = 1 + Math.sin(time * 17) * 0.04 + Math.sin(time * 29 + 1.3) * 0.03 + Math.sin(time * 7.3) * 0.05
    for (const m of [mats.flame, mats.flameCore]) {
      m.uniforms.t.value = time
      m.uniforms.amount.value = s.flame
      m.uniforms.wind.value = w.wind
    }
    const girth = w.flameSize * (0.9 + 0.1 * s.flame)
    flameRef.current.scale.set(girth, w.flameSize * s.flame * flick, girth)
    flameRef.current.visible = s.flame > 0.01
    lightRef.current.intensity = s.flame * 9 * w.flameSize * flick
  })

  const caseParts = (
    <group
      onClick={(e) => {
        e.stopPropagation()
        setOpen(!open)
      }}
      onPointerOver={() => setHoverBody(true)}
      onPointerOut={() => setHoverBody(false)}
    >
      <mesh geometry={geo.case} material={mats.body} castShadow receiveShadow />
      {engraveTex && <mesh geometry={geo.engrave} material={mats.engrave} position={[0, CASE_H * 0.47, D / 2 + 0.002]} />}
      {/* the case's hinge knuckles (1st, 3rd, 5th) and the leaves that hold them */}
      {[-2, 0, 2].map((k) => (
        <group key={k} position={[HINGE_X, CASE_H, k * 0.12]}>
          <mesh geometry={geo.knuckle} material={mats.body} castShadow />
          <mesh geometry={geo.leaf} material={mats.body} position={[-0.06, -0.12, 0]} />
        </group>
      ))}
    </group>
  )

  return (
    <group position={[-0.7, 0, 0]}>
      {caseParts}

      {/* the insert: plate, chimney, wick, and the flint wheel between its brackets */}
      <group position={[0, CASE_H, 0]}>
        <mesh geometry={geo.insert} material={mats.steel} receiveShadow />
        <group position={[0, INSERT_T + CHIM.h / 2, 0]}>
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.chimFront} material={mats.chimney} position={[(CHIM.x0 + CHIM.x1) / 2, 0, sz * CHIM.z]} castShadow />
          ))}
          {[CHIM.x0, CHIM.x1].map((x) => (
            <mesh key={x} geometry={geo.chimSide} material={mats.chimney} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow />
          ))}
        </group>
        {[-1, 1].map((sz) => (
          <group key={sz} position={[0, 0, sz * CHIM.z]}>
            <mesh geometry={geo.bracket} material={mats.bracket} position={[(CHIM.x1 + BRACKET_X1) / 2, INSERT_T + (WHEEL.y - INSERT_T) / 2, 0]} />
            <mesh geometry={geo.bracketCap} material={mats.bracket} position={[WHEEL.x, WHEEL.y, 0]} />
          </group>
        ))}
        <mesh geometry={geo.axle} material={mats.steel} position={[WHEEL.x, WHEEL.y, 0]} />
        <mesh
          ref={wheelRef}
          geometry={geo.wheel}
          material={mats.wheel}
          position={[WHEEL.x, WHEEL.y, 0]}
          castShadow
          onClick={strike}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHoverWheel(true)
          }}
          onPointerOut={() => setHoverWheel(false)}
        />
        <mesh geometry={geo.wick} material={mats.wick} position={[WICK.x, INSERT_T + (WICK.top - INSERT_T) / 2, 0]} />
        <mesh geometry={geo.wickTip} material={mats.char} position={[WICK.x, WICK.top, 0]} scale={[1, 0.7, 1]} />
        {/* the flame and its light */}
        <group position={[WICK.x, WICK.top - 0.04, 0]}>
          <group ref={flameRef}>
            <mesh geometry={geo.flame} material={mats.flame} renderOrder={5} />
            <mesh geometry={geo.flameCore} material={mats.flameCore} renderOrder={6} />
          </group>
          <pointLight ref={lightRef} position={[0, 1.4, 0.3]} color="#ffb04a" intensity={0} distance={14} decay={2} />
        </group>
        <points geometry={sparks.geo} material={mats.spark} />
      </group>

      {/* the lid, turning about the hinge axis */}
      <group ref={lidRef} position={[HINGE_X, CASE_H, 0]}>
        <group
          position={[-HINGE_X, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          onPointerOver={() => setHoverBody(true)}
          onPointerOut={() => setHoverBody(false)}
        >
          {/* a hair above the case, so the seam reads as a line */}
          <mesh geometry={geo.lidWalls} material={mats.body} position={[0, 0.004, 0]} castShadow />
          <mesh geometry={geo.lidCap} material={mats.body} position={[0, LID_H - CAP, 0]} castShadow />
        </group>
        {/* the lid's hinge knuckles (2nd and 4th) and their leaves */}
        {[-1, 1].map((k) => (
          <group key={k} position={[0, 0, k * 0.12]}>
            <mesh geometry={geo.knuckle} material={mats.body} castShadow />
            <mesh geometry={geo.leaf} material={mats.body} position={[-0.06, 0.12, 0]} />
          </group>
        ))}
      </group>
    </group>
  )
}
