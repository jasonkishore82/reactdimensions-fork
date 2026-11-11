import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { outline, shapeOf } from './outline.js'
import Screen from './Screen.jsx'

// Millimetres. A modern slab phone: 71.6 x 147.6 x 7.8.
const W = 71.6
const H = 147.6
const T = 7.8
const R = 11.2 // corner radius
const BEVEL = 0.5
const GLASS_FACE = T / 2 - 0.12 // z of the front / back glass faces
const PLATE = 38 // camera plate size
const PLATE_TOP = 1.7 // height of the plate above the back glass
const LENS_TOP = 1.9 // height of a lens bezel above the plate
export const PHONE_H = H

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

// view: 'front' | 'back'. Click the phone to flip it over.
// frameColor: the metal sides. backColor: the glass back. cameraColor: lens
// rings and trim. wallpaper: the screen colour. finish: 'matte' or 'gloss' back.
export default function Phone({
  view: viewProp = 'front',
  content = 'lock',
  frameColor = '#8d8a85',
  backColor = '#a6a29b',
  cameraColor = '#2b2b2f',
  wallpaper = '#4f7cff',
  finish = 'matte',
  shine = 0.5,
  onChange,
}) {
  const [view, setView] = useTwoWay(viewProp, 'view', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  // --- geometry (built once) ---
  const geo = useMemo(() => {
    const frameOuter = outline(W - BEVEL * 2, H - BEVEL * 2, R - BEVEL)
    const frameHole = outline(W - 3.2, H - 3.2, R - 1.6)
    const frame = new THREE.ExtrudeGeometry(shapeOf(frameOuter, [frameHole]), {
      depth: T - BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 5,
      curveSegments: 1,
    })
    frame.translate(0, 0, -(T - BEVEL * 2) / 2)
    const glass = (inset) => {
      const g = new THREE.ExtrudeGeometry(shapeOf(outline(W - inset, H - inset, R - inset / 2)), {
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.15,
        bevelSize: 0.15,
        bevelSegments: 3,
        curveSegments: 1,
      })
      g.translate(0, 0, -0.15)
      return g
    }
    // Camera plate: a raised squircle with a soft rounded edge, like one piece of glass.
    const plate = new THREE.ExtrudeGeometry(shapeOf(outline(PLATE - 1.2, PLATE - 1.2, 8.4, 3.0, 12)), {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.6,
      bevelSegments: 6,
      curveSegments: 1,
    })
    plate.translate(0, 0, 0.6)
    // Lens bezel, turned on a lathe: straight sides, then a chamfer down onto the glass.
    const bezel = new THREE.LatheGeometry(
      // listed from the base upwards so the faces point outwards
      [
        [6.95, 0],
        [6.95, LENS_TOP - 0.9],
        [6.85, LENS_TOP - 0.45],
        [6.35, LENS_TOP],
        [5.35, LENS_TOP],
        [5.15, LENS_TOP - 0.18],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      56,
    )
    bezel.rotateX(Math.PI / 2)
    return {
      frame,
      front: glass(1.6),
      back: glass(1.6),
      plate,
      bezel,
      btn: (len) => new RoundedBoxGeometry(1.1, len, 1.7, 3, 0.4),
    }
  }, [])
  useEffect(
    () => () => {
      geo.frame.dispose()
      geo.front.dispose()
      geo.back.dispose()
      geo.plate.dispose()
      geo.bezel.dispose()
    },
    [geo],
  )
  const buttons = useMemo(() => ({ action: geo.btn(7), up: geo.btn(12), down: geo.btn(12), power: geo.btn(20) }), [geo])
  const islandGeo = useMemo(() => new THREE.ShapeGeometry(shapeOf(outline(25, 7.6, 3.8, 2, 10)), 1), [])
  useEffect(() => () => islandGeo.dispose(), [islandGeo])

  // --- materials: colours ease, so swapping looks like a cross-fade ---
  const frameMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: frameColor, metalness: 1, roughness: 0.2, anisotropy: 0.5, envMapIntensity: 1.35 }), [])
  // Frosted glass back with a faint grain, so light spreads across it instead of sitting flat.
  const frost = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')
    const img = g.createImageData(256, 256)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 150 + Math.random() * 60
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    g.putImageData(img, 0, 0)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(6, 12)
    return t
  }, [])
  const backMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: backColor, metalness: 0.1, roughness: 0.55, roughnessMap: frost, clearcoat: 0.12, clearcoatRoughness: 0.5, sheen: 0.4, sheenRoughness: 0.6, sheenColor: '#ffffff', envMapIntensity: 1 }), [frost])
  // The plate is the opposite finish to the back: glossy on a frosted phone.
  const plateMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: backColor, metalness: 0.15, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 }), [])
  const trimMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cameraColor, metalness: 1, roughness: 0.16, envMapIntensity: 1.5 }), [])
  useEffect(
    () => () => {
      frameMat.dispose()
      backMat.dispose()
      plateMat.dispose()
      trimMat.dispose()
      frost.dispose()
    },
    [frameMat, backMat, plateMat, trimMat, frost],
  )
  const tc = useMemo(() => [new THREE.Color(), new THREE.Color(), new THREE.Color()], [])
  const want = useRef({})
  want.current = { view, frameColor, backColor, cameraColor, finish, shine }

  const root = useRef()
  const flip = useRef({ a: viewProp === 'back' ? Math.PI : 0, v: 0 })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = want.current
    // flips on a lightly damped spring, so it settles with a small wobble
    const f = flip.current
    f.v += (((w.view === 'back' ? Math.PI : 0) - f.a) * 55 - f.v * 8) * dt
    f.a += f.v * dt
    root.current.rotation.y = f.a
    root.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.8
    const e = 1 - Math.exp(-dt * 6)
    frameMat.color.lerp(tc[0].set(w.frameColor), e)
    backMat.color.lerp(tc[1].set(w.backColor), e)
    plateMat.color.lerp(tc[1].set(w.backColor), e)
    trimMat.color.lerp(tc[2].set(w.cameraColor), e)
    // matte is frosted; gloss is a mirror-like glass
    const gloss = w.finish === 'gloss'
    backMat.roughness += ((gloss ? 0.06 : 0.55) - backMat.roughness) * e
    backMat.clearcoat += ((gloss ? 1 : 0.12) - backMat.clearcoat) * e
    backMat.sheen += ((gloss ? 0 : 0.4) - backMat.sheen) * e
    // the plate takes the opposite finish to the back
    plateMat.roughness += ((gloss ? 0.42 : 0.1) - plateMat.roughness) * e
    plateMat.clearcoat += ((gloss ? 0.1 : 1) - plateMat.clearcoat) * e
    frameMat.roughness = 0.4 - w.shine * 0.32
  })

  const black = <meshPhysicalMaterial color="#050506" roughness={0.18} clearcoat={1} clearcoatRoughness={0.06} />
  const dark = <meshStandardMaterial color="#060607" roughness={0.9} />

  // Lens: a turned metal bezel with a chamfered lip, then, sunk inside it, the
  // stack of a real camera: a black baffle, rings of the barrel, and a coated
  // front element that picks up coloured reflections.
  const glassTop = LENS_TOP - 0.2
  const lens = (x, y) => (
    <group key={`${x}${y}`} position={[x, y, PLATE_TOP]}>
      <mesh geometry={geo.bezel} material={trimMat} castShadow />
      <mesh position={[0, 0, glassTop - 0.5]}>
        <circleGeometry args={[5.2, 48]} />
        <meshStandardMaterial color="#030304" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, glassTop - 0.45]}>
        <ringGeometry args={[3.55, 4.25, 48]} />
        <meshStandardMaterial color="#1b1d22" roughness={0.35} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0, glassTop - 0.4]}>
        <ringGeometry args={[2.55, 2.95, 40]} />
        <meshStandardMaterial color="#2a2d35" roughness={0.25} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0, glassTop - 0.35]}>
        <circleGeometry args={[2.5, 40]} />
        <meshPhysicalMaterial color="#04050a" roughness={0.06} metalness={0} iridescence={0.8} iridescenceIOR={1.7} iridescenceThicknessRange={[300, 600]} envMapIntensity={0.45} />
      </mesh>
    </group>
  )

  const side = (x, y, g, mat = frameMat) => <mesh geometry={g} material={mat} position={[x, y, 0]} castShadow />

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        setView(view === 'front' ? 'back' : 'front')
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <group ref={root}>
        {/* metal frame */}
        <mesh geometry={geo.frame} material={frameMat} castShadow />

        {/* antenna breaks on the sides */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sy) => (
            <mesh key={`${sx}${sy}`} position={[sx * (W / 2 + 0.02), sy * (H / 2 - 19), 0]}>
              <boxGeometry args={[0.3, 0.9, T - 1.1]} />
              <meshStandardMaterial color="#17171a" roughness={0.7} />
            </mesh>
          )),
        )}

        {/* buttons */}
        {side(-W / 2 - 0.1, H / 2 - 29.5, buttons.action)}
        {side(-W / 2 - 0.1, H / 2 - 44, buttons.up)}
        {side(-W / 2 - 0.1, H / 2 - 60, buttons.down)}
        {side(W / 2 + 0.1, H / 2 - 48, buttons.power)}

        {/* bottom edge: USB-C port and speaker holes */}
        <mesh position={[0, -H / 2 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9, 2.8]} />
          {dark}
        </mesh>
        {[-1, 1].map((s) =>
          [0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={`${s}${i}`} position={[s * (9 + i * 1.5), -H / 2 - 0.01, i % 2 ? 0.7 : -0.7]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.38, 10]} />
              {dark}
            </mesh>
          )),
        )}

        {/* FRONT: glass, screen, pill cut-out and speaker slit */}
        <mesh geometry={geo.front} position={[0, 0, GLASS_FACE - 0.15]}>
          {black}
        </mesh>
        {/* the front glass is 0.15 above GLASS_FACE, so the screen sits just in front of it */}
        <group position={[0, 0, GLASS_FACE + 0.17]}>
          <Screen width={W - 3.6} height={H - 3.6} radius={R - 1.8} wallpaper={wallpaper} mode={content} />
          <mesh geometry={islandGeo} position={[0, H / 2 - 1.8 - 7.2, 0.02]}>
            {black}
          </mesh>
          <mesh position={[5.6, H / 2 - 1.8 - 7.2, 0.04]}>
            <circleGeometry args={[1.0, 14]} />
            <meshPhysicalMaterial color="#0a0e1e" roughness={0.05} clearcoat={1} />
          </mesh>
        </group>

        {/* BACK: glass and camera bump. The group faces backwards, so x reads as
            you'd see it holding the phone from behind. */}
        <group rotation={[0, Math.PI, 0]}>
          <mesh geometry={geo.back} material={backMat} position={[0, 0, GLASS_FACE - 0.15]} />
          <group position={[0, 0, GLASS_FACE]}>
            {/* camera plate, top left */}
            <group position={[-(W / 2 - 3.4 - PLATE / 2), H / 2 - 3.4 - PLATE / 2, 0]}>
              <mesh geometry={geo.plate} material={plateMat} castShadow />
              {lens(-8.1, 8.3)}
              {lens(-8.1, -8.3)}
              {lens(7.6, 0)}
              {/* flash: a frosted lens with a warm tint, in a thin metal ring */}
              <group position={[9.4, 12.6, PLATE_TOP + 0.02]}>
                <mesh>
                  <ringGeometry args={[2.0, 2.45, 32]} />
                  <meshStandardMaterial color="#c9c9cc" roughness={0.25} metalness={1} />
                </mesh>
                <mesh position={[0, 0, 0.01]}>
                  <circleGeometry args={[2.0, 32]} />
                  <meshPhysicalMaterial color="#f3ead2" roughness={0.55} transmission={0} sheen={0.6} sheenColor="#fff4d6" envMapIntensity={0.8} />
                </mesh>
              </group>
              {/* depth sensor: a small dark glass dot */}
              <mesh position={[9.4, -12.6, PLATE_TOP + 0.02]}>
                <circleGeometry args={[1.7, 28]} />
                <meshPhysicalMaterial color="#08080b" roughness={0.08} clearcoat={1} envMapIntensity={1.6} />
              </mesh>
              {/* microphone hole */}
              <mesh position={[13.6, 6.2, PLATE_TOP + 0.02]}>
                <circleGeometry args={[0.5, 14]} />
                <meshStandardMaterial color="#020202" roughness={0.9} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
