import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import Keyboard, { KB_D, KB_W, KEY_H, luminance } from './Keyboard.jsx'
import Screen, { SCREEN_H } from './Screen.jsx'

// Units: 1 unit is about 5 cm (the body is 6 wide, like a 30 cm laptop).
const W = 6.0 // width
const D = 4.0 // depth
const T = 0.2 // base thickness
const LID = 0.12 // lid thickness
const FOOT = 0.04 // rubber feet lift the base this far off the desk
const MAX_OPEN = 2.05 // radians when fully open (about 117 degrees)
const KB_Z = -D / 2 + 0.28 + KB_D / 2

// The hinge. The lid is a slab centred on the hinge axis, so its rounded back
// edge turns inside the barrel and never cuts into the base, whatever the
// angle. Closed, the lid clears the key tops by LID_GAP.
const LID_GAP = 0.055
const HINGE_Y = T + LID_GAP + LID / 2 // hinge axis height above the base's underside
const HINGE_Z = -D / 2 // hinge axis, along the back edge
const HINGE_R = LID / 2 + 0.02 // barrel radius: just wider than the lid

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
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#020203', roughness: 0.3, metalness: 0, envMapIntensity: 0.25 }), [])
  const portMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.9 }), [])
  const hingeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#26262a', metalness: 0.9, roughness: 0.35 }), [])
  const rubberMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.95 }), [])
  useEffect(
    () => () => {
      for (const m of [bodyMat, keyMat, darkMat, portMat, hingeMat, rubberMat]) m.dispose()
    },
    [bodyMat, keyMat, darkMat, portMat, hingeMat, rubberMat],
  )
  useEffect(() => {
    bodyMat.roughness = 0.55 - shine * 0.35
  }, [bodyMat, shine])

  const geo = useMemo(
    () => ({
      // small corner radii keep the side walls flat, so ports sit flush in them
      base: new RoundedBoxGeometry(W, T, D, 4, 0.05),
      lid: new RoundedBoxGeometry(W, LID, D, 4, LID / 2),
      track: outlineGeometry(2.2, 1.35, 0.1, 0.012),
      well: new THREE.ShapeGeometry(roundedRectShape(KB_W + 0.26, KB_D + 0.26, 0.06), 8),
      glass: new THREE.ShapeGeometry(roundedRectShape(W - LID, D - LID, 0.05), 10),
      grille: new THREE.PlaneGeometry(0.2, 1.9),
      port: new THREE.BoxGeometry(0.04, 0.07, 0.24),
      jack: new THREE.CylinderGeometry(0.035, 0.035, 0.04, 16),
      barrel: new THREE.CylinderGeometry(HINGE_R, HINGE_R, W * 0.72, 24),
      mount: new THREE.BoxGeometry(0.5, 0.05, 0.2),
      foot: new THREE.CylinderGeometry(0.11, 0.11, FOOT, 20),
      camera: new THREE.CircleGeometry(0.025, 16),
    }),
    [],
  )
  const grille = useMemo(grilleTexture, [])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      grille.dispose()
    },
    [geo, grille],
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
    // the spring may overshoot below zero; the lid stops on the base
    if (s.theta < 0) {
      s.theta = 0
      s.vel = Math.max(s.vel, 0) * 0.3
    }
    lidRef.current.rotation.x = -s.theta
    lid.current.theta = s.theta
    const e = 1 - Math.exp(-dt * 6)
    bodyMat.color.lerp(tBody.set(w.bodyColor), e)
    keyMat.color.lerp(tKey.set(w.keyColor), e)
  })

  const legend = luminance(keyColor) > 0.5 ? '#1b1b1d' : '#ffffff'

  return (
    <group
      position={[0, FOOT, 0]}
      onClick={(e) => {
        e.stopPropagation()
        setOpen(open > 0.5 ? 0 : 0.9)
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* rubber feet: the base stands on these */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={geo.foot} material={rubberMat} position={[sx * (W / 2 - 0.4), -FOOT / 2, sz * (D / 2 - 0.4)]} />),
      )}
      {/* base */}
      <mesh geometry={geo.base} material={bodyMat} position={[0, T / 2, 0]} castShadow receiveShadow />
      {/* keyboard well and keys */}
      <mesh geometry={geo.well} position={[0, T + 0.001, KB_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#070708" roughness={0.8} />
      </mesh>
      <group position={[0, 0, KB_Z]}>
        <Keyboard y={T} keyMat={<primitive object={keyMat} attach="material" />} legendColor={legend} />
      </group>
      {/* trackpad */}
      <mesh geometry={geo.track} position={[0, T + 0.0015, 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* speaker grilles, between the keyboard well and the rounded side edge */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={geo.grille} position={[sx * 2.77, T + 0.0015, KB_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial map={grille} transparent depthWrite={false} opacity={0.9} />
        </mesh>
      ))}
      {/* ports: flush in the flat part of the side walls */}
      {[0.3, 0.64].map((z) => (
        <mesh key={z} geometry={geo.port} material={portMat} position={[-W / 2 + 0.019, T / 2, z]} />
      ))}
      <mesh geometry={geo.port} material={portMat} position={[W / 2 - 0.019, T / 2, 0.5]} />
      <mesh geometry={geo.jack} material={portMat} position={[W / 2 - 0.019, T / 2, 0.95]} rotation={[0, 0, Math.PI / 2]} />

      {/* hinge: a barrel on the hinge axis, carried on two mounts on the base */}
      <mesh geometry={geo.barrel} material={hingeMat} position={[0, HINGE_Y, HINGE_Z]} rotation={[0, 0, Math.PI / 2]} castShadow />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={geo.mount} material={hingeMat} position={[sx * 2.0, T + 0.025, HINGE_Z + 0.06]} />
      ))}

      {/* lid: a slab centred on the hinge axis, turning about it */}
      <group ref={lidRef} position={[0, HINGE_Y, HINGE_Z]}>
        <mesh geometry={geo.lid} material={bodyMat} position={[0, 0, D / 2]} castShadow />
        {/* black glass over the flat part of the inner face */}
        <mesh geometry={geo.glass} material={darkMat} position={[0, -LID / 2 - 0.001, D / 2]} rotation={[Math.PI / 2, 0, 0]} />
        {/* the display itself, in the glass, with a thin bezel */}
        <group position={[0, -LID / 2 - 0.004, 0.255 + SCREEN_H / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <Screen wallpaper={wallpaper} on={screenOn} lid={lid} />
        </group>
        {/* camera, in the bezel above the screen */}
        <mesh geometry={geo.camera} position={[0, -LID / 2 - 0.005, 0.255 + SCREEN_H + (D - 0.255 - SCREEN_H) / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#15151a" roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
