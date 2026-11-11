import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// Units are centimetres. The head sits at the origin, +y is up, +z is forward.
const A = 10.4 // half-width of the headband at its ends
const END_Y = 4.2 // height where the headband ends and the slider housing starts
const TOP = 18 // top of the arch
const BAND_A = 1.3 // half depth of the band (front to back)
const BAND_B = 0.92 // half thickness of the band

// The slider: a pin that runs from inside the band's end housing down into
// the cup. It moves with the cup, so the housing is long enough to keep the
// pin's top inside it at full extension.
const ADJUST_MAX = 2.2 // how far the cup slides down
const PIN_W = 0.9 // the slider is a flat bar, wide across x
const PIN_D = 0.36 // and slim front to back
const PIN_TOP = 0.6 // relative to END_Y
const HOUSING_Y = -0.4 // centre of the housing, relative to END_Y
const HOUSING_H = 1.6 // half height: bottom at -2.0, below the pin's top at full extension (-1.6)

// The cup: a shallow drum (its axis along x, pointing out from the head) with a
// dome on the outside and the cushion seated on the inside face. Its top sits
// just under the pin, which goes 0.3 into it.
const CUP_Y = -7.85 // cup centre, relative to the slider pin's origin
const CUP_RY = 5.3 // half height of the drum
const CUP_RZ = 4.1 // half depth of the drum
const DRUM_HW = 0.9 // half width of the drum (along x)
const PIN_BOTTOM = CUP_Y + CUP_RY - 0.3
export const LOWEST = END_Y + CUP_Y - 5.55 - ADJUST_MAX // bottom of the cushion at full extension

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Fine pebbled grain for soft leather: used as a bump map.
function grainTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  g.fillStyle = '#808080'
  g.fillRect(0, 0, S, S)
  const r = rng(5)
  for (let i = 0; i < 2600; i++) {
    const x = r() * S
    const y = r() * S
    const s = 2 + r() * 4
    const v = r() > 0.5
    g.fillStyle = v ? `rgba(255,255,255,${0.1 + r() * 0.12})` : `rgba(0,0,0,${0.12 + r() * 0.14})`
    for (const ox of [0, x < s ? S : x > S - s ? -S : 0]) {
      g.beginPath()
      g.arc(x + ox, y, s, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(5, 5)
  t.anisotropy = 8
  return t
}

// The speaker fabric behind the ear pad: dark mesh with a loose dot pattern.
function fabricTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  g.fillStyle = '#121419'
  g.fillRect(0, 0, S, S)
  for (let y = 0; y < S; y += 3) {
    g.fillStyle = y % 6 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.25)'
    g.fillRect(0, y, S, 1.5)
  }
  const r = rng(9)
  g.fillStyle = 'rgba(52,56,66,0.9)'
  for (let i = 0; i < 70; i++) {
    const x = (Math.floor(r() * 14) / 14) * S + 8
    const y = (Math.floor(r() * 14) / 14) * S + 8
    g.beginPath()
    g.arc(x, y, 6 + r() * 6, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// A band with an oval cross-section swept along a curve in the x/y plane.
// `a` is half its depth (front to back), `b` half its thickness.
function sweepBand(curve, a, b, N = 260, M = 32) {
  const pos = []
  const idx = []
  const z = new THREE.Vector3(0, 0, 1)
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N)
    const t = curve.getTangentAt(i / N)
    const n = new THREE.Vector3(-t.y, t.x, 0).normalize()
    for (let j = 0; j <= M; j++) {
      const ang = (j / M) * Math.PI * 2
      const v = p.clone().addScaledVector(n, b * Math.cos(ang)).addScaledVector(z, a * Math.sin(ang))
      pos.push(v.x, v.y, v.z)
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const p0 = i * (M + 1) + j
      const p1 = p0 + 1
      const p2 = p0 + M + 1
      const p3 = p2 + 1
      idx.push(p0, p2, p1, p1, p2, p3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // smooth the seam where the profile closes
  const nrm = g.attributes.normal
  for (let i = 0; i <= N; i++) {
    const f = i * (M + 1)
    const l = f + M
    const nx = (nrm.getX(f) + nrm.getX(l)) / 2
    const ny = (nrm.getY(f) + nrm.getY(l)) / 2
    const nz = (nrm.getZ(f) + nrm.getZ(l)) / 2
    nrm.setXYZ(f, nx, ny, nz)
    nrm.setXYZ(l, nx, ny, nz)
  }
  const uv = []
  for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) uv.push(j / M, (i / N) * 6)
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

// A stitch line along the band's outer face, `z` off the centre line. It sits
// on the oval surface, so it reads as a seam rather than disappearing inside.
function seamGeometry(curve, z) {
  const lift = BAND_B * Math.sqrt(1 - (z / BAND_A) ** 2) - 0.008
  const pts = curve.getPoints(160).map((p, i, arr) => {
    const t = curve.getTangentAt(i / (arr.length - 1))
    const n = new THREE.Vector3(-t.y, t.x, 0).normalize()
    return p.addScaledVector(n, lift).add(new THREE.Vector3(0, 0, z))
  })
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.025, 6, false)
}

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

// bandColor: the padded headband. padColor: the ear cushions. cupColor: the
// outer shells. accentColor: the metal sliders. finish: 'leather' | 'matte' |
// 'gloss'. fold: 0 worn .. 1 folded flat. adjust: how far the cups slide down.
export default function Headphones({
  bandColor = '#262c3d',
  padColor = '#262c3d',
  cupColor = '#16181e',
  accentColor = '#3b3f4b',
  finish = 'leather',
  fold: foldProp = 0,
  adjust = 0.3,
  onChange,
}) {
  const [fold, setFold] = useTwoWay(foldProp, 'fold', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const geo = useMemo(() => {
    // [x, how far up from the yoke to the top of the arch: 0 .. 1]
    const half = [
      [0, 1],
      [2.8, 0.988],
      [5.4, 0.917],
      [7.5, 0.75],
      [8.9, 0.512],
      [9.9, 0.25],
      [10.3, 0.036],
      [A, 0],
    ].map(([x, f]) => [x, END_Y + (TOP - END_Y) * f])
    const pts = [...half.slice(1).reverse().map(([x, y]) => new THREE.Vector3(-x, y, 0)), ...half.map(([x, y]) => new THREE.Vector3(x, y, 0))]
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const drum = new THREE.CylinderGeometry(1, 1, DRUM_HW * 2, 64, 1)
    drum.rotateZ(Math.PI / 2) // axis along x
    return {
      band: sweepBand(curve, BAND_A, BAND_B),
      seams: [seamGeometry(curve, 0.95), seamGeometry(curve, -0.95)],
      sphere: new THREE.SphereGeometry(1, 48, 32),
      drum,
      pin: new THREE.BoxGeometry(PIN_W, PIN_TOP - PIN_BOTTOM, PIN_D),
      boss: new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      pad: new THREE.TorusGeometry(3.8, 1.25, 28, 72),
      fabric: new THREE.CircleGeometry(1, 48),
    }
  }, [])
  useEffect(
    () => () => {
      Object.values(geo)
        .flat()
        .forEach((g) => g.dispose())
    },
    [geo],
  )

  const grain = useMemo(grainTexture, [])
  const fabric = useMemo(fabricTexture, [])
  useEffect(
    () => () => {
      grain.dispose()
      fabric.dispose()
    },
    [grain, fabric],
  )

  const mk = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, bumpMap: grain, bumpScale: 0.8, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#8a90a6'), envMapIntensity: 0.9 })
  const bandMat = useMemo(() => mk(bandColor), [grain])
  const padMat = useMemo(() => mk(padColor), [grain])
  const cupMat = useMemo(() => {
    const m = mk(cupColor)
    m.bumpScale = 0.25
    return m
  }, [grain])
  const pinMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: accentColor, metalness: 1, roughness: 0.22, clearcoat: 0.5, envMapIntensity: 1.4 }), [])
  const seamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000000', roughness: 1, transparent: true, opacity: 0.35 }), [])
  const fabricMat = useMemo(() => new THREE.MeshStandardMaterial({ map: fabric, roughness: 0.95 }), [fabric])
  useEffect(
    () => () => {
      for (const m of [bandMat, padMat, cupMat, pinMat, seamMat, fabricMat]) m.dispose()
    },
    [bandMat, padMat, cupMat, pinMat, seamMat, fabricMat],
  )

  const want = useRef({})
  want.current = { bandColor, padColor, cupColor, accentColor, finish, fold, adjust }
  const tc = useMemo(() => [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()], [])
  const cups = useRef([])
  const root = useRef()
  const st = useRef({ f: foldProp, v: 0, adj: adjust })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = want.current
    const s = st.current
    s.v += ((w.fold - s.f) * 60 - s.v * 8) * dt
    s.f += s.v * dt
    s.adj += (w.adjust - s.adj) * (1 - Math.exp(-dt * 8))
    cups.current.forEach((c) => {
      if (!c) return
      // swivel about the slider pin; slide down it
      c.rotation.y = s.f * (Math.PI / 2)
      c.position.y = END_Y - s.adj * ADJUST_MAX
    })
    root.current.position.y = -6 + Math.sin(state.clock.elapsedTime * 0.9) * 0.12

    const e = 1 - Math.exp(-dt * 6)
    bandMat.color.lerp(tc[0].set(w.bandColor), e)
    padMat.color.lerp(tc[1].set(w.padColor), e)
    cupMat.color.lerp(tc[2].set(w.cupColor), e)
    pinMat.color.lerp(tc[3].set(w.accentColor), e)
    // leather has grain; matte is plain and dry; gloss is smooth and shiny
    const f = w.finish
    for (const m of [bandMat, padMat, cupMat]) {
      const base = m === cupMat ? 0.25 : 0.8
      m.bumpScale += ((f === 'leather' ? base : 0) - m.bumpScale) * e
      m.roughness += ((f === 'gloss' ? 0.2 : f === 'matte' ? 0.8 : 0.55) - m.roughness) * e
      m.clearcoat += ((f === 'gloss' ? 1 : 0) - m.clearcoat) * e
      m.sheen += ((f === 'gloss' ? 0 : 0.6) - m.sheen) * e
    }
  })

  // One ear cup, built on the right; the left is a mirror image. The group's
  // origin is the slider pin's axis at the band end, so the cup swivels about
  // the pin and slides along it.
  const cup = (i) => (
    <group ref={(el) => (cups.current[i] = el)} position={[A, END_Y, 0]}>
      {/* slider arm: a flat bar from inside the housing down into the cup */}
      <mesh geometry={geo.pin} material={pinMat} position={[0, (PIN_TOP + PIN_BOTTOM) / 2, 0]} castShadow />
      {/* swivel boss: a low dome on top of the cup that the arm plugs into */}
      <mesh geometry={geo.boss} material={pinMat} position={[0, CUP_Y + CUP_RY - 0.12, 0]} scale={[1.3, 0.55, 1.1]} castShadow />
      {/* drum with a dome on the outside */}
      <mesh geometry={geo.drum} material={cupMat} position={[0, CUP_Y, 0]} scale={[1, CUP_RY, CUP_RZ]} castShadow />
      <mesh geometry={geo.sphere} material={cupMat} position={[DRUM_HW, CUP_Y, 0]} scale={[1.5, CUP_RY, CUP_RZ]} castShadow />
      {/* ear cushion: a thick oval ring seated on the drum's inner face */}
      <mesh geometry={geo.pad} material={padMat} position={[-1.6, CUP_Y, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.85, 1.1, 0.9]} castShadow />
      {/* speaker fabric inside the cushion, just proud of the drum face */}
      <mesh geometry={geo.fabric} material={fabricMat} position={[-1.0, CUP_Y, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[2.0, 2.6, 1]} />
    </group>
  )

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        setFold(fold > 0.5 ? 0 : 1)
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <group ref={root} position={[0, -6, 0]}>
        <mesh geometry={geo.band} material={bandMat} castShadow />
        {geo.seams.map((g, i) => (
          <mesh key={i} geometry={g} material={seamMat} />
        ))}
        {/* slider housings at the band ends: the pins run up inside them */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.sphere} material={bandMat} position={[s * A, END_Y + HOUSING_Y, 0]} scale={[0.98, HOUSING_H, 1.33]} castShadow />
        ))}
        {cup(0)}
        <group scale={[-1, 1, 1]}>{cup(1)}</group>
      </group>
    </group>
  )
}
