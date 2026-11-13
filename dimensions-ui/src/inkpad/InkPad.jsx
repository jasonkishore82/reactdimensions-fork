import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createInkPadAudio } from './audio.js'

// A stamp ink pad in a moulded plastic case. 1 unit = 10 mm: the case is
// 110 x 70 mm and 15 mm tall closed. +y is up, the latch faces +z.
//
// The lid turns on a five-knuckle hinge with steel pins along the back edge.
// At the front a springy tongue on the lid hooks under a ridge on the base:
// opening flexes the tongue off the ridge before the lid can lift, and
// closing rides the hook over the ridge until it drops behind it and clicks.
// Inside, a felt pad sits in a coloured frame; press it and it gives under
// your finger, ink welling up dark and wet where it was pressed, and slowly
// recovers.
const W = 11
const D = 7
const R = 0.55 // corner radius, seen from above
const BASE_H = 0.9
const LID_H = 0.6
const WALL = 0.13
const FLOOR = 0.18
const CAP = 0.12
const BEVEL = 0.04
const SEAM = 0.006
const FOOT = 0.04

// the felt and the frame it sits in
const FRAME_IN = 0.3 // frame width round the felt
const FW = W - WALL * 2 - FRAME_IN * 2
const FD = D - WALL * 2 - FRAME_IN * 2
const FRAME_TOP = BASE_H - 0.1
const FELT_TOP = FRAME_TOP - 0.035
const SEG_X = 120
const SEG_Z = 74
const DENTS = 10
const DENT_SIGMA = 0.42
const WET_SIGMA = 0.62
const PRESS_DEPTH = 0.1

// the hinge: its axis runs along x just behind the back wall, at the seam
const HO = 0.12 // axis distance behind the back wall
const KR = 0.14 // knuckle radius
const K_LEN = 0.6
// knuckle centres on one side; mirrored for the other. Base, lid, base.
const K_BASE = [W / 2 - 0.75, W / 2 - 2.05]
const K_LID = W / 2 - 1.4

// the latch: a ridge on the base, a hooked tongue on the lid
const LATCH_W = 1.8
const RIDGE_Y = BASE_H - 0.32

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
function roundedPath(w, h, r) {
  const p = new THREE.Path()
  p.setFromPoints(roundedRect(w, h, r).getPoints(12))
  return p
}

// Extrude a plan-view outline (x across, y becomes depth) straight up by `h`.
// A bevel grows the outline outward, so it is shrunk by the bevel first; it
// shrinks holes, so they are grown by it first.
function upright(w, d, r, h, bevel = 0, hole = null) {
  const shape = roundedRect(w - bevel * 2, d - bevel * 2, Math.max(0.01, r - bevel))
  if (hole) shape.holes.push(roundedPath(hole[0] + bevel * 2, hole[1] + bevel * 2, hole[2] + bevel))
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 14,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bevel, 0)
  return g
}

// Moulded plastic has a fine spark-eroded texture: a stipple bump map.
function stippleTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 })
  const g = c.getContext('2d')
  const img = g.createImageData(256, 256)
  for (let i = 0; i < 256 * 256; i++) {
    const v = 110 + Math.random() * 60
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.6, 0.6)
  return t
}

// Felt: a mat of short fibres laid every which way, as a bump map.
function feltTexture() {
  const S = 512
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = '#808080'
  g.fillRect(0, 0, S, S)
  g.lineCap = 'round'
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const a = Math.random() * Math.PI * 2
    const l = 3 + Math.random() * 9
    const v = Math.random() < 0.5 ? 60 + Math.random() * 40 : 170 + Math.random() * 60
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`
    g.lineWidth = 0.6 + Math.random() * 0.9
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(4, 4 * (FD / FW))
  t.anisotropy = 8
  return t
}

// A prop that can also be changed from inside the scene (clicking the lid);
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

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// open: the lid. openAngle: how far it swings, in degrees, before its stop.
// caseColor: the plastic. ink: the ink colour. inkLevel: how soaked the felt
// is (0 dry, 1 freshly inked). sound: the clicks and pats.
export default function InkPad({
  open: openProp = false,
  openAngle = 110,
  caseColor = '#2a2b2e',
  ink = '#1f2a7a',
  inkLevel = 0.8,
  sound = false,
  onChange,
}) {
  const [open, setOpen] = useTwoWay(openProp, 'open', onChange)
  const [hover, setHover] = useState(null)
  useCursor(!!hover, hover === 'felt' ? 'crosshair' : 'pointer')
  const controls = useThree((s) => s.controls)

  // ---- geometry ----
  const geo = useMemo(() => {
    const pocket = [W - WALL * 2, D - WALL * 2, R - WALL]
    const felt = new THREE.PlaneGeometry(FW, FD, SEG_X, SEG_Z).rotateX(-Math.PI / 2)
    const n = felt.attributes.position.count
    felt.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3))
    const knuckle = new THREE.CylinderGeometry(KR, KR, K_LEN - 0.03, 24).rotateZ(Math.PI / 2)
    return {
      baseShell: upright(W, D, R, BASE_H, BEVEL, pocket),
      floor: upright(pocket[0] + 0.02, pocket[1] + 0.02, pocket[2], FLOOR),
      frame: upright(pocket[0] - 0.02, pocket[1] - 0.02, pocket[2], FRAME_TOP - FLOOR, 0.02, [FW, FD, 0.12]),
      feltBody: upright(FW, FD, 0.12, FELT_TOP - FLOOR - 0.12),
      felt,
      feltBase: Float32Array.from(felt.attributes.position.array),
      lidWalls: upright(W, D, R, LID_H - CAP + BEVEL, 0, pocket),
      lidCap: upright(W, D, R, CAP, BEVEL),
      panel: upright(W - 1.3, D - 1.3, 0.3, 0.03, 0.012),
      knuckle,
      leaf: new THREE.BoxGeometry(K_LEN - 0.03, 0.2, 0.16),
      pin: new THREE.CylinderGeometry(0.045, 0.045, K_BASE[0] - K_BASE[1] + K_LEN + 0.04, 12).rotateZ(Math.PI / 2),
      pinHead: new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16).rotateZ(Math.PI / 2),
      ridge: new THREE.BoxGeometry(LATCH_W - 0.2, 0.08, 0.07),
      tongue: new THREE.BoxGeometry(LATCH_W, 0.62, 0.07),
      hook: new THREE.BoxGeometry(LATCH_W, 0.07, 0.08),
      thumb: new THREE.BoxGeometry(LATCH_W, 0.05, 0.2),
      foot: new THREE.CylinderGeometry(0.42, 0.42, FOOT, 24),
    }
  }, [])

  const tex = useMemo(() => ({ stipple: stippleTexture(), felt: feltTexture() }), [])
  const mats = useMemo(
    () => ({
      plastic: new THREE.MeshPhysicalMaterial({ roughness: 0.7, bumpMap: tex.stipple, bumpScale: 0.6, specularIntensity: 0.4 }),
      frame: new THREE.MeshPhysicalMaterial({ roughness: 0.42, bumpMap: tex.stipple, bumpScale: 0.3, clearcoat: 0.15, clearcoatRoughness: 0.35 }),
      felt: new THREE.MeshPhysicalMaterial({ vertexColors: true, bumpMap: tex.felt, bumpScale: 1.4, roughnessMap: tex.felt, sheen: 0.35, sheenRoughness: 0.7, clearcoatRoughness: 0.55 }),
      feltBody: new THREE.MeshStandardMaterial({ roughness: 1 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c4c7cc', metalness: 1, roughness: 0.28 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.9 }),
    }),
    [tex],
  )
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose?.())
      Object.values(tex).forEach((t) => t.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, tex, mats],
  )

  // colours and how soaked the felt is
  useEffect(() => {
    const c = new THREE.Color(caseColor)
    const k = new THREE.Color(ink)
    mats.plastic.color.copy(c)
    mats.frame.color.copy(k).lerp(c, 0.35).multiplyScalar(0.85)
    const lvl = THREE.MathUtils.clamp(inkLevel, 0, 1)
    // dry felt is a dusty, pale version of the ink; soaked felt is deep and
    // saturated, with a faint wet sheen on top of the fibres
    const felt = k.clone().lerp(new THREE.Color('#a7a49d'), (1 - lvl) * 0.62)
    felt.multiplyScalar(0.42 + (1 - lvl) * 0.5)
    mats.felt.color.copy(felt)
    mats.felt.roughness = 1 - lvl * 0.32
    mats.felt.clearcoat = lvl * 0.07
    mats.felt.sheenColor.copy(k).lerp(new THREE.Color('#ffffff'), 0.1)
    mats.feltBody.color.copy(felt).multiplyScalar(0.7)
  }, [caseColor, ink, inkLevel, mats])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { open, openAngle, inkLevel, sound }
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, arg) => {
    if (!live.current.sound) return
    if (!audio.current) audio.current = createInkPadAudio()
    audio.current?.[name](arg)
  }

  // ---- state ----
  const lidRef = useRef()
  const tongueRef = useRef()
  const feltRef = useRef()
  const st = useRef({
    a: openProp ? THREE.MathUtils.degToRad(openAngle) : 0,
    v: 0,
    latched: !openProp,
    release: 0,
    flex: 0,
    dents: [],
    press: null,
    dirty: false,
  })

  const toggle = (e) => {
    e.stopPropagation()
    if (e.delta > 4) return // that was an orbit drag
    setOpen(!open)
  }

  // pressing the felt: a dent follows the pointer while held
  const feltLocal = (e) => {
    const p = feltRef.current.worldToLocal(e.point.clone())
    return [THREE.MathUtils.clamp(p.x, -FW / 2, FW / 2), THREE.MathUtils.clamp(p.z, -FD / 2, FD / 2)]
  }
  const endPress = () => {
    const s = st.current
    if (s.press) s.press.held = false
    s.press = null
    if (controls) controls.enabled = true
  }
  useEffect(() => {
    window.addEventListener('pointerup', endPress)
    window.addEventListener('pointercancel', endPress)
    return () => {
      window.removeEventListener('pointerup', endPress)
      window.removeEventListener('pointercancel', endPress)
    }
  })
  const onFeltDown = (e) => {
    const s = st.current
    if (s.a < 0.9) return // the lid is in the way
    e.stopPropagation()
    if (controls) controls.enabled = false
    const [x, z] = feltLocal(e)
    const dent = { x, z, depth: 0, wet: 0, held: true }
    s.dents.push(dent)
    if (s.dents.length > DENTS) s.dents.shift()
    s.press = dent
    play('press', 0.4 + live.current.inkLevel * 0.6)
  }
  const onFeltMove = (e) => {
    const s = st.current
    if (!s.press) return
    e.stopPropagation()
    const [x, z] = feltLocal(e)
    const p = s.press
    // dragging smears: leave a trail of fading dents behind the finger
    if (Math.hypot(x - p.x, z - p.z) > DENT_SIGMA * 0.9) {
      p.held = false
      const next = { x, z, depth: p.depth, wet: p.wet, held: true }
      s.dents.push(next)
      if (s.dents.length > DENTS) s.dents.shift()
      s.press = next
    } else {
      p.x = x
      p.z = z
    }
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const w = live.current
    const OPEN = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(w.openAngle, 60, 178))

    // ---- latch and lid ----
    let flexTarget = 0
    if (s.latched) {
      if (w.open) {
        // thumb pushes the tongue out until the hook clears the ridge
        s.release += dt / 0.16
        flexTarget = Math.min(1, s.release)
        if (s.release >= 1) {
          s.latched = false
          s.release = 0
          s.v = 3.6 // the lid pops up off the seal
          play('release')
        }
      } else s.release = 0
      s.a = 0
      s.v = 0
    } else {
      const target = w.open ? OPEN : 0
      // a hand moving the lid: firm spring, well damped, a little gravity
      // near the top of its swing pulls it shut once it passes upright
      s.v += ((target - s.a) * 34 - s.v * 8.5) * dt
      s.a += s.v * dt
      if (s.a > OPEN) {
        if (s.v > 1.2) play('stop', s.v / 5)
        s.a = OPEN
        s.v = -s.v * 0.18
      }
      if (s.a <= 0) {
        if (s.v < -0.4) play('close', -s.v / 4)
        s.a = 0
        if (!w.open) {
          s.latched = true
          s.v = 0
          play('latch')
        } else s.v = -s.v * 0.2
      }
      // closing: the hook rides out over the ridge in the last few degrees
      // (and on the way open, slides off it)
      flexTarget = smooth(0.1, 0.01, s.a)
    }
    // the tongue is springy: it follows quickly and snaps back home
    s.flex += (flexTarget - s.flex) * (1 - Math.exp(-dt * (flexTarget > s.flex ? 30 : 55)))
    lidRef.current.rotation.x = -s.a
    tongueRef.current.rotation.x = -s.flex * 0.24

    // ---- felt ----
    let active = false
    for (const d of s.dents) {
      if (d.held) {
        d.depth += (PRESS_DEPTH - d.depth) * (1 - Math.exp(-dt * 16))
        d.wet += (1 - d.wet) * (1 - Math.exp(-dt * 5))
      } else {
        d.depth *= Math.exp(-dt * 1.8) // felt springs back slowly
        d.wet *= Math.exp(-dt * 0.45) // ink soaks back in slower still
      }
      if (d.depth > 0.0004 || d.wet > 0.004) active = true
    }
    s.dents = s.dents.filter((d) => d.held || d.depth > 0.0004 || d.wet > 0.004)
    if (active || s.dirty) {
      s.dirty = active
      const pos = geo.felt.attributes.position.array
      const col = geo.felt.attributes.color.array
      const base = geo.feltBase
      const inv2 = 1 / (2 * DENT_SIGMA * DENT_SIGMA)
      const winv2 = 1 / (2 * WET_SIGMA * WET_SIGMA)
      const wetK = 0.3 + w.inkLevel * 0.25
      for (let i = 0, n = pos.length / 3; i < n; i++) {
        const x = base[i * 3]
        const z = base[i * 3 + 2]
        let y = 0
        let wet = 0
        for (const d of s.dents) {
          const r2 = (x - d.x) * (x - d.x) + (z - d.z) * (z - d.z)
          if (r2 > 3) continue
          y -= d.depth * Math.exp(-r2 * inv2)
          wet += d.wet * Math.exp(-r2 * winv2)
        }
        pos[i * 3 + 1] = y
        const c = 1 - Math.min(wet, 1) * wetK
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c
      }
      geo.felt.attributes.position.needsUpdate = true
      geo.felt.attributes.color.needsUpdate = true
      geo.felt.computeVertexNormals()
    }
  })

  const hoverProps = (name) => ({
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(name)
    },
    onPointerOut: () => setHover(null),
  })

  return (
    <group position={[0, FOOT, 0]}>
      {/* ---- the base ---- */}
      <group onClick={toggle} {...hoverProps('case')}>
        <mesh geometry={geo.baseShell} material={mats.plastic} castShadow receiveShadow />
        <mesh geometry={geo.floor} material={mats.plastic} receiveShadow />
        {/* the latch ridge on the front wall */}
        <mesh geometry={geo.ridge} material={mats.plastic} position={[0, RIDGE_Y, D / 2 + 0.035]} castShadow />
        {/* rubber feet */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={geo.foot} material={mats.rubber} position={[sx * (W / 2 - 0.9), -FOOT / 2, sz * (D / 2 - 0.9)]} />),
        )}
      </group>
      <mesh geometry={geo.frame} material={mats.frame} position={[0, FLOOR, 0]} receiveShadow />
      <mesh geometry={geo.feltBody} material={mats.feltBody} position={[0, FLOOR, 0]} />
      <mesh
        ref={feltRef}
        geometry={geo.felt}
        material={mats.felt}
        position={[0, FELT_TOP, 0]}
        receiveShadow
        onPointerDown={onFeltDown}
        onPointerMove={onFeltMove}
        onClick={(e) => e.stopPropagation()}
        {...hoverProps('felt')}
      />

      {/* the base's hinge knuckles (outer pairs) and the pins through them */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[0, BASE_H + SEAM, -D / 2 - HO]}>
          {K_BASE.map((kx) => (
            <group key={kx} position={[sx * kx, 0, 0]}>
              <mesh geometry={geo.knuckle} material={mats.plastic} castShadow />
              <mesh geometry={geo.leaf} material={mats.plastic} position={[0, -0.12, 0.07]} castShadow />
            </group>
          ))}
          <mesh geometry={geo.pin} material={mats.steel} position={[sx * K_LID, 0, 0]} />
          {[K_BASE[0] + K_LEN / 2 + 0.02, K_BASE[1] - K_LEN / 2 - 0.02].map((px) => (
            <mesh key={px} geometry={geo.pinHead} material={mats.steel} position={[sx * px, 0, 0]} />
          ))}
        </group>
      ))}

      {/* ---- the lid, turning about the hinge axis ---- */}
      <group ref={lidRef} position={[0, BASE_H + SEAM, -D / 2 - HO]}>
        <group position={[0, 0, D / 2 + HO]} onClick={toggle} {...hoverProps('case')}>
          <mesh geometry={geo.lidWalls} material={mats.plastic} castShadow receiveShadow />
          <mesh geometry={geo.lidCap} material={mats.plastic} position={[0, LID_H - CAP, 0]} castShadow receiveShadow />
          <mesh geometry={geo.panel} material={mats.plastic} position={[0, LID_H - 0.004, 0]} castShadow receiveShadow />
          {/* the latch tongue, flexing about its root */}
          <group ref={tongueRef} position={[0, 0.12, D / 2]}>
            <mesh geometry={geo.tongue} material={mats.plastic} position={[0, -0.25, 0.11]} castShadow />
            <mesh geometry={geo.hook} material={mats.plastic} position={[0, -0.53, 0.05]} />
            <mesh geometry={geo.thumb} material={mats.plastic} position={[0, -0.535, 0.22]} rotation={[-0.35, 0, 0]} castShadow />
          </group>
        </group>
        {/* the lid's knuckles (the middle one of each set) */}
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * K_LID, 0, 0]}>
            <mesh geometry={geo.knuckle} material={mats.plastic} castShadow />
            <mesh geometry={geo.leaf} material={mats.plastic} position={[0, 0.12, 0.07]} castShadow />
          </group>
        ))}
      </group>
    </group>
  )
}
