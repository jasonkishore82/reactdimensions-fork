import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createTapeAudio } from './audio.js'

// A retractable tape measure, held up in the air as in a product shot, with
// the floor below. 1 unit = 1 cm. The case faces +x; the blade comes out of
// the mouth at the front of its base and runs along +x.
//
// The blade is a steel ribbon with a curved (cupped) cross-section, rebuilt
// every frame from its centre line. It always runs out straight from the mouth,
// up to its full length. Markings are measured from the hook, so they travel out
// of the case as the blade is drawn.

const CASE = { w: 7.2, h: 7.2, d: 3.8, y: 12 } // case size and centre height
const MOUTH_X = CASE.w / 2 // the blade leaves the case here
const MOUTH_Y = CASE.y - CASE.h / 2 + 0.85
const MAX_LEN = 45 // how much blade there is
const BLADE_W = 2.5
const CUP = 0.18 // depth of the curve across the blade
const HOOK_H = 0.95
const DS = 0.2 // spacing of the blade's points
const ACROSS = 7 // points across the blade
const MAX_PTS = Math.ceil((MAX_LEN + 3) / DS) + 40

export const tapeView = { maxX: MOUTH_X + 16, minY: 0 } // read by the camera rig


// Centre line for e units drawn out: points [x, y, s], s = distance along the
// blade from the mouth (negative inside the case). The blade always runs out
// straight and level from the mouth, at any length.
function centreLine(e, out) {
  out.length = 0
  for (let s = -0.6; s < 0; s += DS) out.push([MOUTH_X + s, MOUTH_Y, s])
  const n = Math.max(1, Math.ceil(e / DS))
  for (let i = 0; i <= n; i++) {
    const s = (e * i) / n
    out.push([MOUTH_X + s, MOUTH_Y, s])
  }
  return null
}

function bladeTexture(units, color) {
  const W = 8192
  const H = 160
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, W, H)
  const px = W / MAX_LEN // pixels per cm
  g.fillStyle = '#141414'
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  if (units === 'imperial') {
    const inch = 2.54 * px
    for (let i = 0; i * inch / 8 < W; i++) {
      const x = (i * inch) / 8
      const h = i % 8 === 0 ? 0.42 : i % 4 === 0 ? 0.3 : i % 2 === 0 ? 0.22 : 0.14
      g.fillRect(x - 1.5, 0, 3, H * h)
      if (i % 8 === 0 && i > 0) {
        g.font = `700 ${H * 0.34}px Arial, sans-serif`
        g.fillStyle = (i / 8) % 12 === 0 ? '#c41d1d' : '#141414'
        g.fillText(String(i / 8), x, H * 0.66)
        g.fillStyle = '#141414'
      }
    }
  } else {
    for (let i = 0; i * px / 10 < W; i++) {
      const x = (i * px) / 10
      const h = i % 10 === 0 ? 0.42 : i % 5 === 0 ? 0.28 : 0.16
      g.fillRect(x - 1.2, 0, 2.4, H * h)
      if (i % 10 === 0 && i > 0) {
        const cm = i / 10
        g.font = `700 ${H * 0.34}px Arial, sans-serif`
        g.fillStyle = cm % 10 === 0 ? '#c41d1d' : '#141414'
        g.fillText(String(cm), x, H * 0.66)
        g.fillStyle = '#141414'
      }
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function labelTexture(color) {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
  const g = c.getContext('2d')
  g.fillStyle = '#18191b'
  g.beginPath()
  g.arc(256, 256, 256, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 64px Arial, sans-serif'
  g.fillText('REACT', 256, 214)
  g.fillText('DIMENSIONS', 256, 286)
  g.font = '600 34px Arial, sans-serif'
  g.fillStyle = '#d9d9d9'
  g.fillText('45 cm · 18 in', 256, 360)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
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

// caseColor, bladeColor, units (metric | imperial), locked. Drag the hook to
// draw the blade out; let go and it reels back in unless it is locked.
export default function Tape({ caseColor = '#f5b800', bladeColor = '#f2d33a', units = 'metric', locked: lockedProp = true, sound = false, onChange }) {
  const [locked, setLocked] = useTwoWay(lockedProp, 'locked', onChange)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)
  useCursor(hover || dragging, dragging ? 'grabbing' : 'pointer')
  const { camera, controls } = useThree()

  // the blade: a strip of points along its length and across its width
  const blade = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PTS * ACROSS * 3), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(MAX_PTS * ACROSS * 2), 2))
    const idx = []
    for (let i = 0; i < MAX_PTS - 1; i++)
      for (let j = 0; j < ACROSS - 1; j++) {
        const a = i * ACROSS + j
        idx.push(a, a + ACROSS, a + 1, a + 1, a + ACROSS, a + ACROSS + 1)
      }
    g.setIndex(idx)
    return g
  }, [])
  const tex = useMemo(() => bladeTexture(units, bladeColor), [units, bladeColor])
  const label = useMemo(() => labelTexture(caseColor), [caseColor])
  const mats = useMemo(
    () => ({
      case: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.85 }),
      blade: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide }),
      brass: new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 1, roughness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.2 }),
      slot: new THREE.MeshStandardMaterial({ color: '#070707', roughness: 1 }),
      label: new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true }),
      grip: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  )
  useEffect(() => () => tex.dispose(), [tex])
  useEffect(() => () => label.dispose(), [label])
  useEffect(
    () => () => {
      blade.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [blade, mats],
  )
  useEffect(() => {
    mats.case.color.set(caseColor)
    mats.blade.map = tex
    mats.blade.needsUpdate = true
    mats.label.map = label
    mats.label.needsUpdate = true
  }, [mats, caseColor, tex, label])

  // ---- sound ----
  const audio = useRef(null)
  const soundOn = useRef(sound)
  soundOn.current = sound
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, arg) => {
    if (!soundOn.current) return
    if (!audio.current) audio.current = createTapeAudio()
    audio.current?.[name](arg)
  }

  // ---- motion ----
  const st = useRef({ e: 16, v: 0, ratchet: 0, lock: lockedProp ? 1 : 0 })
  const live = useRef({})
  live.current = { locked }
  const drag = useRef(false)
  const pts = useMemo(() => [], [])
  const hookRef = useRef()
  const lockRef = useRef()
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const up = () => {
      if (!drag.current) return
      drag.current = false
      st.current.v = 0
      setDragging(false)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const w = live.current

    if (drag.current) {
      // the hook follows the pointer, as far as there is blade
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        const want = THREE.MathUtils.clamp(hit.x - MOUTH_X, 0, MAX_LEN)
        s.e += (want - s.e) * Math.min(1, dt * 20)
      }
    } else if (!w.locked && s.e > 0) {
      // the spring reels it in, faster as it goes, against a little friction
      s.v -= (30 + s.e * 1.2) * dt
      s.v *= Math.exp(-dt * 0.8)
      const before = s.e
      s.e = Math.max(0, s.e + s.v * dt)
      s.ratchet += before - s.e
      while (s.ratchet > 0.6) {
        s.ratchet -= 0.6
        play('ratchet')
      }
      if (s.e === 0) {
        play('thunk', -s.v / 30)
        s.v = 0
      }
    } else s.v = 0

    // rebuild the blade along its centre line
    centreLine(s.e, pts)
    const pos = blade.attributes.position.array
    const uv = blade.attributes.uv.array
    const n = Math.min(pts.length, MAX_PTS)
    for (let i = 0; i < n; i++) {
      const p = pts[i]
      const q = pts[Math.min(i + 1, n - 1)]
      const o = pts[Math.max(i - 1, 0)]
      let tx = q[0] - o[0]
      let ty = q[1] - o[1]
      const l = Math.hypot(tx, ty) || 1
      tx /= l
      ty /= l
      const flat = 1 // the cupped section, the whole length
      for (let j = 0; j < ACROSS; j++) {
        const a = j / (ACROSS - 1)
        const z = (a - 0.5) * BLADE_W
        const lift = CUP * flat * (1 - (2 * z / BLADE_W) ** 2) - CUP * flat * 0.5
        const k = (i * ACROSS + j) * 3
        pos[k] = p[0] - ty * lift
        pos[k + 1] = p[1] + tx * lift
        pos[k + 2] = z
        const u = (i * ACROSS + j) * 2
        uv[u] = Math.max(0, s.e - p[2]) / MAX_LEN // measured from the hook
        uv[u + 1] = a
      }
    }
    // collapse the unused points onto the tip
    for (let i = n; i < MAX_PTS; i++) for (let j = 0; j < ACROSS; j++) pos.copyWithin((i * ACROSS + j) * 3, ((n - 1) * ACROSS + j) * 3, ((n - 1) * ACROSS + j) * 3 + 3)
    blade.attributes.position.needsUpdate = true
    blade.attributes.uv.needsUpdate = true
    blade.computeVertexNormals()
    blade.computeBoundingSphere()

    // the hook sits square on the end of the blade
    const tip = pts[n - 1]
    const prev = pts[n - 2]
    hookRef.current.position.set(tip[0], tip[1], 0)
    hookRef.current.rotation.z = Math.atan2(tip[1] - prev[1], tip[0] - prev[0])
    tapeView.maxX = Math.max(MOUTH_X + 8, ...pts.map((p) => p[0]))
    tapeView.minY = Math.min(...pts.map((p) => p[1]))

    // the lock button slides forward when locked
    s.lock += ((w.locked ? 1 : 0) - s.lock) * (1 - Math.exp(-dt * 16))
    lockRef.current.position.x = 1.2 + s.lock * 0.7
  })

  const toggleLock = (e) => {
    e.stopPropagation()
    play('lock')
    setLocked(!locked)
  }
  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }

  return (
    <group>
      {/* the case: body, rubber side grips with the label, the mouth, the lock and the belt clip */}
      <RoundedBox args={[CASE.w, CASE.h, CASE.d]} radius={0.9} smoothness={5} position={[0, CASE.y, 0]} material={mats.case} castShadow receiveShadow />
      {[-1, 1].map((sz) => (
        <group key={sz} position={[0, CASE.y + 0.3, sz * (CASE.d / 2 + 0.005)]} rotation={[sz > 0 ? 0 : Math.PI, 0, 0]}>
          <mesh material={mats.rubber}>
            <circleGeometry args={[2.9, 48]} />
          </mesh>
          {sz > 0 && (
            <mesh material={mats.label} position-z={0.01}>
              <circleGeometry args={[2.1, 48]} />
            </mesh>
          )}
        </group>
      ))}
      <mesh material={mats.slot} position={[MOUTH_X + 0.005, MOUTH_Y, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[BLADE_W + 0.3, 0.45]} />
      </mesh>
      <mesh ref={lockRef} material={mats.rubber} position={[1.9, CASE.y + CASE.h / 2 + 0.12, 0]} onClick={toggleLock} {...hoverProps} castShadow>
        <boxGeometry args={[1.1, 0.3, 1.0]} />
      </mesh>
      <mesh material={mats.slot} position={[1.55, CASE.y + CASE.h / 2 + 0.005, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.9, 1.1]} />
      </mesh>
      <mesh material={mats.chrome} position={[-0.4, CASE.y + 0.4, -CASE.d / 2 - 0.12]} castShadow>
        <boxGeometry args={[1.6, 5.2, 0.08]} />
      </mesh>
      <mesh material={mats.chrome} position={[-0.4, CASE.y + 2.95, -CASE.d / 2 - 0.06]}>
        <boxGeometry args={[1.6, 0.12, 0.2]} />
      </mesh>

      {/* the blade */}
      <mesh geometry={blade} material={mats.blade} castShadow receiveShadow frustumCulled={false} />

      {/* the hook: a brass tab bent down at the end, riveted on; drag it to draw the blade out */}
      <group
        ref={hookRef}
        onPointerDown={(e) => {
          e.stopPropagation()
          drag.current = true
          setDragging(true)
          if (controls) controls.enabled = false
        }}
        {...hoverProps}
      >
        <mesh material={mats.brass} position={[0.04, -HOOK_H / 2 + CUP * 0.5, 0]} castShadow>
          <boxGeometry args={[0.08, HOOK_H, BLADE_W + 0.25]} />
        </mesh>
        <mesh material={mats.brass} position={[-0.45, CUP * 0.55, 0]}>
          <boxGeometry args={[0.9, 0.05, BLADE_W * 0.7]} />
        </mesh>
        {[-0.6, 0.6].map((z) => (
          <mesh key={z} material={mats.chrome} position={[-0.45, CUP * 0.55 + 0.04, z]}>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 12]} />
          </mesh>
        ))}
        {/* a generous invisible grip, so the hook is easy to take hold of */}
        <mesh material={mats.grip} position={[-0.6, -0.2, 0]}>
          <boxGeometry args={[2.4, 2.2, BLADE_W + 1.2]} />
        </mesh>
      </group>
    </group>
  )
}
