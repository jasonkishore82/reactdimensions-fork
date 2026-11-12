import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { buildLayout, charOf } from './layout.js'
import { createSwitchAudio } from './audio.js'

// A mechanical keyboard. Type on your real keyboard (or click the keycaps)
// and the matching key travels down; held modifiers light up. Keycaps sit on a
// sculpted row profile, so every row has its own height and tilt, and long
// keys ride on wire stabilisers: the space bar rocks a little if you press it
// off-centre, then the wire levels it. 1 unit = one key (about 19 mm).

const PITCH = 0.95 // keycap footprint on a 1u pitch
const CAP_H = 0.42
const SWITCH_H = 0.3 // switch housing height: caps float above the plate
const TRAVEL = 0.2 // 4 mm
// sculpted profile per row (function row, numbers, top, home, shift, bottom)
const ROW_LIFT = [0.1, 0.08, 0.03, 0, 0.02, 0.04]
const ROW_TILT = [0.2, 0.16, 0.08, 0, -0.08, -0.13]
const SWITCH_COLOR = { linear: '#d8343b', tactile: '#8a5a2b', clicky: '#2f6fd6' }

// keycap: a rounded block whose top is pulled in, so the walls slope like a
// real cap, with the same bevel on any width
function capGeometry(w, h) {
  const hw = (w - (1 - PITCH)) / 2, hd = (h - (1 - PITCH)) / 2
  const g = new RoundedBoxGeometry(hw * 2, CAP_H, hd * 2, 3, 0.06)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    // scale towards the centre so the edges come in by a fixed amount
    const t = (p.getY(i) + CAP_H / 2) / CAP_H
    p.setX(i, p.getX(i) * (1 - (t * 0.09) / hw))
    p.setZ(i, p.getZ(i) * (1 - (t * 0.13) / hd))
  }
  g.translate(0, CAP_H / 2, 0)
  g.computeVertexNormals()
  return g
}

// every legend drawn once in white on a texture atlas; materials tint it
function makeAtlas(keys) {
  const CW = 256, CH = 128, COLS = 8
  const ids = [...new Set(keys.map((key) => `${key.label}\u0000${key.shift ?? ''}`))]
  const rows = Math.ceil(ids.length / COLS)
  const canvas = document.createElement('canvas')
  canvas.width = CW * COLS
  canvas.height = CH * rows
  const c = canvas.getContext('2d')
  c.fillStyle = '#fff'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const font = (px, weight = 600) => `${weight} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  const uv = new Map()
  ids.forEach((id, i) => {
    const [label, shift] = id.split('\u0000')
    const cx = (i % COLS) * CW + CW / 2, cy = Math.floor(i / COLS) * CH + CH / 2
    if (shift) {
      c.font = font(50); c.fillText(shift, cx, cy - 28)
      c.font = font(50); c.fillText(label, cx, cy + 28)
    } else if ([...label].length === 1) {
      c.font = font(80); c.fillText(label, cx, cy + 3)
    } else if (label) {
      let px = 46
      do { c.font = font(px, 500); px -= 2 } while (c.measureText(label).width > CW - 24 && px > 16)
      c.fillText(label, cx, cy)
    }
    const u0 = (i % COLS) / COLS, u1 = u0 + 1 / COLS
    const vT = 1 - Math.floor(i / COLS) / rows, vB = vT - 1 / rows
    uv.set(id, [u0, u1, vB, vT])
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { tex, uv, idOf: (key) => `${key.label}\u0000${key.shift ?? ''}` }
}

function legendGeometry(uv) {
  const g = new THREE.PlaneGeometry(0.74, 0.37)
  g.rotateX(-Math.PI / 2)
  const a = g.attributes.uv
  const [u0, u1, vB, vT] = uv
  for (let i = 0; i < a.count; i++) a.setXY(i, u0 + a.getX(i) * (u1 - u0), vB + a.getY(i) * (vT - vB))
  return g
}

// soft round glow used for the per-key RGB underglow
function glowTexture() {
  const s = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const c = canvas.getContext('2d')
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, 'rgba(255,255,255,.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(canvas)
}

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export default function Keyboard({
  layout = 'TKL',
  switchType = 'tactile',
  keycapColor = '#efe9dc',
  modColor = '#b9b2a3',
  accentColor = '#d9643a',
  legendColor = '#2b2b2b',
  caseColor = '#d8d3c8',
  rgb = true,
  rgbEffect = 'wave',
  rgbColor = '#7c5cff',
  sound = false,
  onType,
}) {
  const { controls } = useThree()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const { keys, width, depth } = useMemo(() => buildLayout(layout), [layout])
  const n = keys.length
  const codeIndex = useMemo(() => new Map(keys.map((key, i) => [key.code, i])), [keys])

  // --- geometry and materials, disposed when they change or unmount ---
  const caps = useMemo(() => {
    const m = new Map()
    for (const key of keys) { const id = `${key.w}x${key.h}`; if (!m.has(id)) m.set(id, capGeometry(key.w, key.h)) }
    return m
  }, [keys])
  const atlas = useMemo(() => makeAtlas(keys), [keys])
  const legends = useMemo(() => keys.map((key) => legendGeometry(atlas.uv.get(atlas.idOf(key)))), [keys, atlas])
  const shared = useMemo(() => ({
    housing: new THREE.BoxGeometry(0.62, SWITCH_H - 0.05, 0.62),
    stem: new THREE.BoxGeometry(0.6, 0.05, 0.6),
    glow: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    wire: new THREE.CylinderGeometry(0.022, 0.022, 1, 8).rotateZ(Math.PI / 2),
    stab: new THREE.BoxGeometry(0.22, 0.24, 0.42),
    glowTex: glowTexture(),
  }), [])
  const caseGeo = useMemo(() => new RoundedBoxGeometry(width + 0.9, 0.7, depth + 0.9, 4, 0.2), [width, depth])
  const plateGeo = useMemo(() => new THREE.PlaneGeometry(width + 0.3, depth + 0.3).rotateX(-Math.PI / 2), [width, depth])

  const mats = useMemo(() => ({
    alpha: new THREE.MeshPhysicalMaterial({ roughness: 0.62, clearcoat: 0.08, sheen: 0.3, sheenRoughness: 0.8 }),
    mod: new THREE.MeshPhysicalMaterial({ roughness: 0.62, clearcoat: 0.08, sheen: 0.3, sheenRoughness: 0.8 }),
    accent: new THREE.MeshPhysicalMaterial({ roughness: 0.6, clearcoat: 0.1, sheen: 0.3, sheenRoughness: 0.8 }),
    legend: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    legendAccent: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    lit: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    case: new THREE.MeshPhysicalMaterial({ roughness: 0.45, metalness: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.55, metalness: 0.6 }),
    housing: new THREE.MeshStandardMaterial({ color: '#2a2b2f', roughness: 0.5 }),
    stem: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
    wire: new THREE.MeshStandardMaterial({ color: '#d4d6da', roughness: 0.25, metalness: 1 }),
    glow: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  }), [])
  useEffect(() => { for (const m of [mats.legend, mats.legendAccent, mats.lit]) { m.map = atlas.tex; m.needsUpdate = true } }, [mats, atlas])
  useEffect(() => { mats.glow.map = shared.glowTex; mats.glow.needsUpdate = true }, [mats, shared])
  useEffect(() => {
    mats.alpha.color.set(keycapColor); mats.mod.color.set(modColor); mats.accent.color.set(accentColor)
    mats.legend.color.set(legendColor)
    // accent caps get whichever of near-black or white reads on them
    const a = new THREE.Color(accentColor)
    mats.legendAccent.color.set(0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b > 0.3 ? '#1c1c1c' : '#ffffff'); mats.case.color.set(caseColor); mats.stem.color.set(SWITCH_COLOR[switchType] || SWITCH_COLOR.tactile)
  }, [mats, keycapColor, modColor, accentColor, legendColor, caseColor, switchType])
  useEffect(() => () => caps.forEach((g) => g.dispose()), [caps])
  useEffect(() => () => atlas.tex.dispose(), [atlas])
  useEffect(() => () => legends.forEach((g) => g.dispose()), [legends])
  useEffect(() => () => { caseGeo.dispose(); plateGeo.dispose() }, [caseGeo, plateGeo])
  useEffect(() => () => {
    Object.values(shared).forEach((x) => x.dispose())
    Object.values(mats).forEach((m) => m.dispose())
  }, [shared, mats])

  // --- instanced switches and glow ---
  const housingRef = useRef()
  const stemRef = useRef()
  const glowRef = useRef()
  useEffect(() => {
    const m = new THREE.Matrix4()
    keys.forEach((key, i) => {
      m.makeTranslation(key.x, (SWITCH_H - 0.05) / 2, key.z)
      housingRef.current.setMatrixAt(i, m)
      m.makeTranslation(key.x, SWITCH_H - 0.05, key.z)
      stemRef.current.setMatrixAt(i, m)
      m.compose(new THREE.Vector3(key.x, 0.006, key.z), new THREE.Quaternion(), new THREE.Vector3(key.w + 0.25, 1, key.h + 0.25))
      glowRef.current.setMatrixAt(i, m)
      glowRef.current.setColorAt(i, new THREE.Color('#000'))
    })
    for (const r of [housingRef, stemRef, glowRef]) { r.current.count = n; r.current.instanceMatrix.needsUpdate = true }
    glowRef.current.instanceColor.needsUpdate = true
  }, [keys, n])
  const stabs = keys.filter((key) => key.w >= 2 || key.h >= 2)

  // --- pressing ---
  const state = useRef(null)
  if (!state.current || state.current.n !== n) {
    state.current = { n, src: new Uint8Array(n), depth: new Float32Array(n), heat: new Float32Array(n), roll: 0, rollV: 0, ripples: [], t: 0 }
  }
  const capRefs = useRef([])
  const legendRefs = useRef([])
  const audio = useRef(null)
  const typeRef = useRef({ sound, switchType, onType })
  typeRef.current = { sound, switchType, onType }
  useEffect(() => {
    if (sound) return
    audio.current?.dispose(); audio.current = null
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])

  const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  const press = (i, bit, offset = 0) => {
    const s = state.current
    const was = s.src[i]
    s.src[i] |= bit
    if (was) return
    s.heat[i] = 1
    s.ripples.push({ x: keys[i].x, z: keys[i].z, t0: s.t })
    if (s.ripples.length > 8) s.ripples.shift()
    if (keys[i].code === 'Space') s.rollV += offset * 1.4
    const { sound: on, switchType: type } = typeRef.current
    if (on) {
      if (!audio.current) audio.current = createSwitchAudio()
      audio.current?.play(type, 'down', keys[i].w >= 2)
    }
  }
  const release = (i, bit) => {
    const s = state.current
    if (!s.src[i]) return
    s.src[i] &= ~bit
    if (!s.src[i] && typeRef.current.sound) audio.current?.play(typeRef.current.switchType, 'up', keys[i].w >= 2)
  }

  // real keyboard
  useEffect(() => {
    const down = (e) => {
      if (isTyping(e.target)) return
      const i = codeIndex.get(e.code)
      if (i === undefined) return
      if (!e.repeat) press(i, 1)
      const cb = typeRef.current.onType
      if (cb) { if (e.key === 'Backspace') cb(null); else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) cb(e.key) }
    }
    const up = (e) => { const i = codeIndex.get(e.code); if (i !== undefined) release(i, 1) }
    const clear = () => { for (let i = 0; i < n; i++) release(i, 1) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeIndex, n])

  // pointer: press while held, release anywhere
  const held = useRef(-1)
  useEffect(() => {
    const up = () => {
      if (held.current >= 0) release(held.current, 2)
      held.current = -1
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, n])
  const onDown = (i) => (e) => {
    e.stopPropagation()
    if (controls) controls.enabled = false
    held.current = i
    const key = keys[i]
    press(i, 2, (e.point.x - key.x) / (key.w / 2))
    const ch = charOf(key)
    const cb = typeRef.current.onType
    if (cb) { if (key.code === 'Backspace') cb(null); else if (ch !== null) cb(ch) }
  }

  // --- per frame: key travel, space bar rock, legend lighting, RGB ---
  const color = useMemo(() => new THREE.Color(), [])
  const base = useMemo(() => new THREE.Color(), [])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = state.current
    s.t += dt
    const t = reduced ? 0 : s.t
    // the stabiliser wire pulls the space bar level: a stiff, damped spring
    s.rollV += (-260 * s.roll - 14 * s.rollV) * dt
    s.roll += s.rollV * dt
    if (reduced) { s.roll = 0; s.rollV = 0 }
    for (let i = 0; i < n; i++) {
      const target = s.src[i] ? TRAVEL : 0
      s.depth[i] = reduced ? target : s.depth[i] + (target - s.depth[i]) * Math.min(1, dt * (s.src[i] ? 45 : 22))
      const g = capRefs.current[i]
      if (g) {
        g.position.y = -s.depth[i]
        if (keys[i].code === 'Space') g.rotation.z = THREE.MathUtils.clamp(s.roll, -0.06, 0.06)
      }
      const lg = legendRefs.current[i]
      if (lg) { const want = s.src[i] ? mats.lit : keys[i].kind === 'accent' ? mats.legendAccent : mats.legend; if (lg.material !== want) lg.material = want }
      s.heat[i] *= Math.exp(-dt * 2.2)
    }
    // lit legends follow the RGB colour, or a warm white with RGB off
    mats.lit.color.set(rgb ? rgbColor : '#ffd27a')
    if (!rgb || !glowRef.current) return
    base.set(rgbColor)
    s.ripples = s.ripples.filter((r) => s.t - r.t0 < 2.5)
    for (let i = 0; i < n; i++) {
      const key = keys[i]
      if (rgbEffect === 'wave') {
        color.setHSL((((key.x / width) * 0.8 - t * 0.18) % 1 + 1) % 1, 0.9, 0.55)
      } else if (rgbEffect === 'breathe') {
        color.copy(base).multiplyScalar(0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.8)))
      } else if (rgbEffect === 'reactive') {
        let v = s.heat[i]
        for (const r of s.ripples) {
          const age = s.t - r.t0
          const dist = Math.hypot(key.x - r.x, key.z - r.z)
          v += Math.exp(-Math.abs(dist - age * 9) * 1.6) * Math.exp(-age * 1.8) * 0.8
        }
        color.copy(base).multiplyScalar(0.06 + Math.min(1, v))
      } else {
        color.copy(base)
      }
      if (s.src[i] && rgbEffect !== 'reactive') color.lerp(new THREE.Color('#ffffff'), 0.5)
      glowRef.current.setColorAt(i, color)
    }
    glowRef.current.instanceColor.needsUpdate = true
  })

  return (
    <group rotation-x={0.06}>
      <mesh geometry={caseGeo} material={mats.case} position={[0, -0.36, 0]} castShadow receiveShadow />
      <mesh geometry={plateGeo} material={mats.plate} position={[0, 0.002, 0]} receiveShadow />
      <instancedMesh ref={housingRef} args={[shared.housing, mats.housing, 120]} castShadow />
      <instancedMesh ref={stemRef} args={[shared.stem, mats.stem, 120]} />
      <instancedMesh ref={glowRef} args={[shared.glow, mats.glow, 120]} visible={rgb} renderOrder={1} />
      {stabs.map((key) => {
        const along = key.w >= key.h
        const span = (along ? key.w : key.h) - 0.9
        return (
          <group key={`stab-${key.code}`} position={[key.x, 0, key.z]} rotation-y={along ? 0 : Math.PI / 2}>
            <mesh geometry={shared.wire} material={mats.wire} position={[0, 0.06, 0.24]} scale={[span, 1, 1]} />
            <mesh geometry={shared.stab} material={mats.housing} position={[-span / 2, 0.12, 0]} />
            <mesh geometry={shared.stab} material={mats.housing} position={[span / 2, 0.12, 0]} />
          </group>
        )
      })}
      {keys.map((key, i) => {
        const tall = key.h > 1
        const lift = tall ? (ROW_LIFT[key.row] + ROW_LIFT[key.row + 1]) / 2 : ROW_LIFT[key.row]
        const tilt = tall ? (ROW_TILT[key.row] + ROW_TILT[key.row + 1]) / 2 : ROW_TILT[key.row]
        return (
          <group key={key.code} position={[key.x, SWITCH_H + lift, key.z]} rotation-x={tilt}>
            <group ref={(el) => { capRefs.current[i] = el }}>
              <mesh
                geometry={caps.get(`${key.w}x${key.h}`)}
                material={mats[key.kind]}
                castShadow
                receiveShadow
                onPointerDown={onDown(i)}
                onPointerOver={(e) => { e.stopPropagation(); setHover(true) }}
                onPointerOut={() => setHover(false)}
              />
              {key.label && <mesh ref={(el) => { legendRefs.current[i] = el }} geometry={legends[i]} material={key.kind === 'accent' ? mats.legendAccent : mats.legend} position={[0, CAP_H + 0.003, -0.02]} renderOrder={2} />}
            </group>
          </group>
        )
      })}
    </group>
  )
}
