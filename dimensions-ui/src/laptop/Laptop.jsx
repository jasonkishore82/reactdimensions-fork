import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import Keyboard, { KB_D, KB_W, luminance } from './Keyboard.jsx'
import Screen, { SCREEN_H } from './Screen.jsx'

const W = 6.0 // width
const D = 4.0 // depth
const T = 0.2 // base thickness
const LID = 0.12 // lid thickness
const MAX_OPEN = 2.05 // radians when fully open (about 117 degrees)
const KB_Z = -D / 2 + 0.28 + KB_D / 2

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

// A rounded outline (a thin ring), used for the trackpad edge.
function outlineGeometry(w, h, r, line) {
  const s = roundedRectShape(w, h, r)
  const hole = roundedRectShape(w - line * 2, h - line * 2, Math.max(r - line, 0.01))
  s.holes.push(hole)
  return new THREE.ShapeGeometry(s, 12)
}

// Speaker grille: a field of tiny holes on a transparent sheet.
function grilleTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(0,0,0,0.7)'
  for (let y = 6; y < 512; y += 11) {
    for (let x = (y / 11) % 2 ? 6 : 11; x < 64; x += 11) {
      g.beginPath()
      g.arc(x, y, 2.6, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
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

// bodyColor: the aluminium. keyColor: the keycaps. wallpaper: the screen
// colour. open: 0 closed .. 1 fully open. Colours ease to new values, so
// swapping them is a smooth change rather than a jump.
export default function Laptop({
  bodyColor = '#ff6a13',
  keyColor = '#1a1412',
  wallpaper = '#ff7a1a',
  open: openProp = 0.9,
  screenOn = true,
  shine = 0.5,
  onChange,
}) {
  const [open, setOpen] = useTwoWay(openProp, 'open', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: bodyColor, metalness: 0.62, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 1.1 }), [])
  const keyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: keyColor, roughness: 0.55, metalness: 0.1, clearcoat: 0.15 }), [])
  useEffect(
    () => () => {
      bodyMat.dispose()
      keyMat.dispose()
    },
    [bodyMat, keyMat],
  )
  useEffect(() => {
    bodyMat.roughness = 0.55 - shine * 0.35
  }, [bodyMat, shine])

  const baseGeo = useMemo(() => new RoundedBoxGeometry(W, T, D, 5, 0.09), [])
  const lidGeo = useMemo(() => new RoundedBoxGeometry(W, LID, D, 5, 0.06), [])
  const trackGeo = useMemo(() => outlineGeometry(2.2, 1.35, 0.1, 0.012), [])
  const grille = useMemo(grilleTexture, [])
  useEffect(
    () => () => {
      baseGeo.dispose()
      lidGeo.dispose()
      trackGeo.dispose()
      grille.dispose()
    },
    [baseGeo, lidGeo, trackGeo, grille],
  )

  const lidRef = useRef()
  const st = useRef({ theta: openProp * MAX_OPEN, vel: 0 })
  const lid = useRef({ theta: openProp * MAX_OPEN }) // read by the screen, so it sleeps when closed
  const want = useRef({})
  want.current = { open, bodyColor, keyColor }
  const tBody = useMemo(() => new THREE.Color(), [])
  const tKey = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = want.current
    const s = st.current
    // lid on a lightly damped spring: it settles with a small bounce
    s.vel += ((w.open * MAX_OPEN - s.theta) * 70 - s.vel * 9) * dt
    s.theta += s.vel * dt
    lidRef.current.rotation.x = -Math.max(s.theta, 0)
    lid.current.theta = s.theta
    const e = 1 - Math.exp(-dt * 6)
    bodyMat.color.lerp(tBody.set(w.bodyColor), e)
    keyMat.color.lerp(tKey.set(w.keyColor), e)
  })

  const legend = luminance(keyColor) > 0.5 ? '#1b1b1d' : '#ffffff'
  const dark = <meshStandardMaterial color="#020203" roughness={0.3} metalness={0} envMapIntensity={0.25} />
  const port = <meshStandardMaterial color="#050505" roughness={0.9} />

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        setOpen(open > 0.5 ? 0 : 0.9)
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* base */}
      <mesh geometry={baseGeo} material={bodyMat} position={[0, T / 2, 0]} castShadow receiveShadow />
      {/* keyboard well and keys */}
      <mesh position={[0, T + 0.001, KB_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[roundedRectShape(KB_W + 0.26, KB_D + 0.26, 0.06), 8]} />
        <meshStandardMaterial color="#070708" roughness={0.8} />
      </mesh>
      <group position={[0, 0, KB_Z]}>
        <Keyboard y={T} keyMat={<primitive object={keyMat} attach="material" />} legendColor={legend} />
      </group>
      {/* trackpad */}
      <mesh geometry={trackGeo} position={[0, T + 0.0015, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* speaker grilles */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 2.84, T + 0.0015, KB_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.26, 1.9]} />
          <meshBasicMaterial map={grille} transparent depthWrite={false} opacity={0.9} />
        </mesh>
      ))}
      {/* ports */}
      {[0.3, 0.64].map((z) => (
        <mesh key={z} position={[-W / 2 + 0.004, T / 2, z]}>
          <boxGeometry args={[0.04, 0.07, 0.24]} />
          {port}
        </mesh>
      ))}
      <mesh position={[W / 2 - 0.004, T / 2, 0.5]}>
        <boxGeometry args={[0.04, 0.07, 0.24]} />
        {port}
      </mesh>
      <mesh position={[W / 2 - 0.004, T / 2, 0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 16]} />
        {port}
      </mesh>
      {/* hinge */}
      <mesh position={[0, T + 0.095, -D / 2 + 0.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, W * 0.72, 24]} />
        <meshPhysicalMaterial color="#26262a" metalness={0.9} roughness={0.35} />
      </mesh>

      {/* lid: pivots on the hinge line along the back edge */}
      <group ref={lidRef} position={[0, T + 0.075, -D / 2]}>
        <mesh geometry={lidGeo} material={bodyMat} position={[0, LID / 2, D / 2]} castShadow />
        {/* black glass over the whole inner face */}
        <mesh position={[0, -0.002, D / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[roundedRectShape(W - 0.06, D - 0.06, 0.07), 10]} />
          {dark}
        </mesh>
        {/* the display itself, in the glass, with a thin bezel */}
        <group position={[0, -0.006, 0.255 + SCREEN_H / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <Screen wallpaper={wallpaper} on={screenOn} lid={lid} />
        </group>
        {/* camera */}
        <mesh position={[0, -0.007, D - 0.065]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.025, 16]} />
          <meshStandardMaterial color="#15151a" roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
