import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A slim tablet with chamfered aluminium edges, black glass and a live home
// screen. 1 unit = 100 mm; the model is built in portrait and turned for
// landscape.
const W = 1.775
const H = 2.497
const T = 0.053
const R = 0.125 // corner radius
const B = 0.006 // edge chamfer
const BEZEL = 0.085
const SCREEN_W = W - BEZEL * 2
const SCREEN_H = H - BEZEL * 2
const CW = 768 // the screen's canvas (portrait), in pixels
const CH = Math.round((CW * SCREEN_H) / SCREEN_W)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

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

// ---------- the home screen ----------
// Drawn in screen space (up is up, whatever way the tablet is turned): a
// wallpaper, a clock and a grid of icons. `landscape` says which way the
// canvas is turned so that the picture comes out upright.
const ICONS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#ced4da', '#ff8787', '#74c0fc']
function drawScreen(g, landscape, wall, now) {
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, CW, CH)
  // screen-space size and the transform that turns it onto the canvas
  const w = landscape ? CH : CW
  const h = landscape ? CW : CH
  if (landscape) {
    g.translate(CW, 0)
    g.rotate(Math.PI / 2)
  }
  const base = new THREE.Color(wall)
  const dark = base.clone().multiplyScalar(0.28).lerp(new THREE.Color('#1a0a2e'), 0.4)
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.55)
  const grad = g.createLinearGradient(0, 0, w * 0.4, h)
  grad.addColorStop(0, `#${base.getHexString()}`)
  grad.addColorStop(1, `#${dark.getHexString()}`)
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  for (const [x, y, r, a] of [
    [0.2, 0.25, 0.5, 0.45],
    [0.85, 0.7, 0.45, 0.3],
  ]) {
    const rg = g.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * r)
    rg.addColorStop(0, `rgba(${Math.round(light.r * 255)},${Math.round(light.g * 255)},${Math.round(light.b * 255)},${a})`)
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, w, h)
  }
  const unit = Math.min(w, h) / 100
  const pad = (n) => String(n).padStart(2, '0')
  // status bar
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.textBaseline = 'middle'
  g.font = `600 ${unit * 2.6}px system-ui, sans-serif`
  g.textAlign = 'left'
  g.fillText(`${pad(now.getHours())}:${pad(now.getMinutes())}`, unit * 4, unit * 4)
  g.textAlign = 'right'
  g.fillText('100%', w - unit * 4, unit * 4)
  // clock
  g.textAlign = 'left'
  g.font = `300 ${unit * 16}px system-ui, sans-serif`
  g.fillText(`${pad(now.getHours())}:${pad(now.getMinutes())}`, unit * 7, h * (landscape ? 0.22 : 0.17))
  g.font = `500 ${unit * 3}px system-ui, sans-serif`
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.fillText(now.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' }), unit * 7.5, h * (landscape ? 0.22 : 0.17) + unit * 11)
  // icon grid
  const cols = landscape ? 6 : 4
  const rows = landscape ? 2 : 3
  const cell = (w - unit * 14) / cols
  const size = Math.min(cell * 0.62, unit * 12)
  const top = h * (landscape ? 0.46 : 0.33)
  for (let i = 0; i < cols * rows; i++) {
    const cx = unit * 7 + cell * (i % cols) + cell / 2
    const cy = top + Math.floor(i / cols) * (size * 1.9) + size / 2
    g.fillStyle = ICONS[i % ICONS.length]
    g.beginPath()
    g.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.24)
    g.fill()
  }
  // dock
  const dw = unit * (landscape ? 52 : 70)
  g.fillStyle = 'rgba(255,255,255,0.25)'
  g.beginPath()
  g.roundRect((w - dw) / 2, h - unit * 14, dw, unit * 11, unit * 3.4)
  g.fill()
  for (let i = 0; i < 4; i++) {
    g.fillStyle = ICONS[(i * 3 + 1) % ICONS.length]
    g.beginPath()
    g.roundRect((w - dw) / 2 + dw * (0.12 + i * 0.22), h - unit * 12.6, unit * 8.2, unit * 8.2, unit * 2.2)
    g.fill()
  }
  // home indicator
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  g.roundRect(w / 2 - unit * 9, h - unit * 1.8, unit * 18, unit * 0.7, unit * 0.35)
  g.fill()
}

// A prop that can also be changed from inside the scene (clicking the tablet);
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

// bodyColor: the aluminium. wallpaper: the screen's colour. orientation:
// 'landscape' | 'portrait'. flip: 0 front .. 1 back. Click it to flip it over.
export default function Tablet({
  bodyColor = '#e2e3e5',
  wallpaper = '#3a7bff',
  orientation = 'landscape',
  screenOn = true,
  tilt = true,
  shine = 0.5,
  flip: flipProp = 0,
  onChange,
}) {
  const [flip, setFlip] = useTwoWay(flipProp, 'flip', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const geo = useMemo(
    () => ({
      slab: slab(W, H, R, T, B),
      glass: panel(W - B * 2, H - B * 2, R - B),
      bezel: panel(W - BEZEL * 2 + 0.01, H - BEZEL * 2 + 0.01, 0.065),
      screen: panel(SCREEN_W, SCREEN_H, 0.06),
      bump: slab(0.31, 0.31, 0.085, 0.014, 0.004),
      disc: new THREE.CircleGeometry(1, 48),
      barrel: new THREE.CylinderGeometry(1, 1, 1, 48).rotateX(Math.PI / 2),
      box: new THREE.BoxGeometry(1, 1, 1),
    }),
    [],
  )
  const mats = useMemo(() => {
    const metal = (color, roughness) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness })
    return {
      body: metal('#e2e3e5', 0.42),
      plateau: metal('#e2e3e5', 0.3),
      ring: metal('#18181a', 0.25),
      port: new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.6 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#020203', roughness: 0.08, specularIntensity: 0.4, envMapIntensity: 0.6 }),
      bezel: new THREE.MeshPhysicalMaterial({ color: '#000', roughness: 0.1, specularIntensity: 0.25, envMapIntensity: 0.5 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#05060a', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0 }),
      iris: new THREE.MeshPhysicalMaterial({ color: '#0d1638', roughness: 0.1, metalness: 0.6, clearcoat: 1 }),
      flash: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.35, emissive: '#fff3d6', emissiveIntensity: 0.15 }),
    }
  }, [])

  const { canvas, tex, screenMat } = useMemo(() => {
    const canvas = Object.assign(document.createElement('canvas'), { width: CW, height: CH })
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    // toneMapped: false keeps the screen as bright as the picture drawn on it
    const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    return { canvas, tex, screenMat }
  }, [])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
      tex.dispose()
      screenMat.dispose()
    },
    [geo, mats, tex, screenMat],
  )

  const spinRef = useRef()
  const turnRef = useRef()
  const rootRef = useRef()
  const want = useRef({})
  want.current = { bodyColor, wallpaper, orientation, screenOn, tilt, shine, flip }
  const st = useRef({ flip: flipProp, flipVel: 0, ori: orientation === 'landscape' ? 1 : 0, on: 1, rx: 0, ry: 0, vx: 0, vy: 0 })
  const shown = useRef({ key: '' })
  const tmp = useMemo(() => new THREE.Color(), [])
  const tWall = useRef(new THREE.Color(wallpaper))

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = want.current
    const s = st.current

    // flip on a lightly damped spring: it settles with a small bounce
    s.flipVel += ((w.flip - s.flip) * 55 - s.flipVel * 8) * dt
    s.flip += s.flipVel * dt
    spinRef.current.rotation.y = s.flip * Math.PI
    // turn between portrait and landscape
    s.ori += ((w.orientation === 'landscape' ? 1 : 0) - s.ori) * (1 - Math.exp(-dt * 7))
    turnRef.current.rotation.z = s.ori * (Math.PI / 2)
    // lean towards the pointer on a damped spring, and float a little
    const px = w.tilt ? state.pointer.x : 0
    const py = w.tilt ? state.pointer.y : 0
    s.vy += ((px * 0.3 - s.ry) * 60 - s.vy * 8) * dt
    s.vx += ((-py * 0.22 - s.rx) * 60 - s.vx * 8) * dt
    s.ry += s.vy * dt
    s.rx += s.vx * dt
    rootRef.current.rotation.set(s.rx, s.ry, 0)
    rootRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.05

    // colours ease
    const e = 1 - Math.exp(-dt * 7)
    mats.body.color.lerp(tmp.set(w.bodyColor), e)
    mats.plateau.color.copy(mats.body.color).multiplyScalar(0.92)
    mats.body.roughness = 0.62 - w.shine * 0.4
    mats.plateau.roughness = 0.5 - w.shine * 0.32
    tWall.current.lerp(tmp.set(w.wallpaper), e)

    // screen: wakes and sleeps, and is redrawn when the minute, the colour or the way it is turned changes
    s.on += ((w.screenOn ? 1 : 0) - s.on) * (1 - Math.exp(-dt * 8))
    screenMat.color.setScalar(s.on)
    const now = new Date()
    const landscape = s.ori > 0.5
    const key = `${landscape}|${tWall.current.getHexString()}|${now.getMinutes()}`
    if (key !== shown.current.key) {
      shown.current.key = key
      drawScreen(canvas.getContext('2d'), landscape, `#${tWall.current.getHexString()}`, now)
      tex.needsUpdate = true
    }
  })

  const front = T / 2
  const { body, plateau, ring, port, glass, bezel, lens, iris, flash } = mats
  const { box, disc, barrel } = geo

  return (
    <group
      ref={rootRef}
      onClick={(e) => {
        e.stopPropagation()
        setFlip(flip > 0.5 ? 0 : 1)
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <group ref={spinRef}>
        <group ref={turnRef}>
          <mesh geometry={geo.slab} material={body} castShadow />
          <mesh geometry={geo.glass} material={glass} position={[0, 0, front + 0.0006]} />
          <mesh geometry={geo.bezel} material={bezel} position={[0, 0, front + 0.0012]} />
          <mesh geometry={geo.screen} material={screenMat} position={[0, 0, front + 0.0018]} />
          {/* front camera on the long edge's bezel */}
          <mesh geometry={disc} material={ring} position={[W / 2 - BEZEL / 2, 0, front + 0.0014]} rotation={[0, 0, 0]} scale={0.015} />
          <mesh geometry={disc} material={iris} position={[W / 2 - BEZEL / 2, 0, front + 0.002]} scale={0.009} />
          {/* edges: top button, volume, port, speaker grilles */}
          <mesh geometry={box} material={body} position={[W / 2 - 0.15, H / 2, 0]} scale={[0.11, 0.012, 0.022]} />
          {[0.2, 0.31].map((d) => (
            <mesh key={d} geometry={box} material={body} position={[W / 2, H / 2 - d, 0]} scale={[0.012, 0.085, 0.022]} />
          ))}
          <mesh geometry={box} material={port} position={[0, -H / 2, 0]} scale={[0.09, 0.002, 0.026]} />
          {[-1, 1].map((s) =>
            [-H / 2, H / 2].map((y) => [-2, -1, 0, 1, 2].map((i) => <mesh key={`${s}${y}${i}`} geometry={box} material={port} position={[s * 0.4 + i * 0.034, y, 0]} scale={[0.022, 0.002, 0.009]} />)),
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
      </group>
    </group>
  )
}
