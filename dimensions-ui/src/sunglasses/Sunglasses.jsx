import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildGlasses } from './build.js'
import { lensTexture, tortoiseTexture } from './textures.js'

// Colour pickers fire on every drag step; texture drawing is heavy, so wait
// until the value settles.
function useSettled(value, ms = 160) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// One half of the glasses, built on the right. The left half is the same
// thing mirrored (the parent flips it), so both stay identical.
function Half({ g, mats, fold, left }) {
  const temple = useRef()
  useFrame(() => {
    const f = fold.current
    const t = temple.current
    // arms splay out a touch when open, and fold in over the lenses; the left
    // one folds in first and sits a little higher so the two don't collide
    t.rotation.y = -0.05 * (1 - f) + f * (left ? 1.5 : 1.56)
    t.position.y = g.hinge.y + (left ? f * 0.075 : 0)
  })
  return (
    <group>
      <mesh geometry={g.rim} castShadow>
        {mats.frame}
      </mesh>
      <mesh geometry={g.lensGeo} renderOrder={2}>
        {mats.lens}
      </mesh>
      <mesh position={[g.pad.x, g.pad.y, g.pad.z]} scale={[0.5, 1, 0.4]}>
        <sphereGeometry args={[0.1, 14, 10]} />
        <meshPhysicalMaterial color="#e6e6e9" roughness={0.2} transparent opacity={0.8} />
      </mesh>
      <group ref={temple} position={[g.hinge.x, g.hinge.y, g.hinge.z]}>
        <mesh rotation={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, g.metal ? 0.16 : 0.28, 14]} />
          <meshPhysicalMaterial color="#cfd2d8" metalness={1} roughness={0.25} />
        </mesh>
        <mesh geometry={g.mainGeo} castShadow>
          {mats.frame}
        </mesh>
        <mesh geometry={g.tipGeo} castShadow>
          {mats.tip}
        </mesh>
      </group>
    </group>
  )
}

export default function Sunglasses({
  shape = 'wayfarer',
  lensWidth = 2.0,
  lensHeight = 1.5,
  bridge = 0.45,
  thickness = 0.16,
  templeLength = 3.6,
  wrap = 0.35,
  finish = 'gloss',
  frameColor = '#16120f',
  accent = '#d99a2b',
  tipColor = '#16120f',
  lensColor = '#2a2a2f',
  lensOpacity = 0.88,
  gradient = true,
  mirror = 0,
  mirrorColor = '#6aa8ff',
  fold = 0,
}) {
  const metal = finish === 'metal'
  const g = useMemo(
    () => buildGlasses({ shape, lensW: lensWidth, lensH: lensHeight, bridge, thickness, templeLen: templeLength, wrap, metal }),
    [shape, lensWidth, lensHeight, bridge, thickness, templeLength, wrap, metal],
  )
  useEffect(() => () => {
    for (const geo of [g.rim, g.lensGeo, ...g.bridges, g.mainGeo, g.tipGeo]) geo.dispose()
  }, [g])

  const tortoiseKey = useSettled(`${accent}|${frameColor}`)
  const tortoise = useMemo(() => {
    if (finish !== 'tortoise') return null
    const [a, d] = tortoiseKey.split('|')
    return tortoiseTexture({ amber: a, dark: d })
  }, [finish, tortoiseKey])
  useEffect(() => () => tortoise?.dispose(), [tortoise])
  // A mirror coating reflects in its own colour, so it takes over the tint.
  const tintColor = useMemo(() => new THREE.Color(lensColor).lerp(new THREE.Color(mirrorColor), Math.min(1, mirror * 1.1)).getStyle(), [lensColor, mirrorColor, mirror])
  const lensTex = useMemo(() => lensTexture({ color: tintColor, gradient }), [tintColor, gradient])
  useEffect(() => () => lensTex.dispose(), [lensTex])

  const frame =
    finish === 'metal' ? (
      <meshPhysicalMaterial color={frameColor} metalness={1} roughness={0.2} envMapIntensity={1.3} />
    ) : finish === 'matte' ? (
      <meshPhysicalMaterial color={frameColor} roughness={0.78} metalness={0} />
    ) : finish === 'tortoise' ? (
      <meshPhysicalMaterial map={tortoise} color="#ffffff" roughness={0.22} clearcoat={1} clearcoatRoughness={0.06} />
    ) : (
      <meshPhysicalMaterial color={frameColor} roughness={0.28} clearcoat={1} clearcoatRoughness={0.05} />
    )

  // Lens: tinted glass; the mirror coating turns it into a metallic reflector
  const mats = {
    frame,
    tip: <meshPhysicalMaterial color={tipColor} roughness={finish === 'matte' ? 0.75 : 0.3} clearcoat={finish === 'matte' ? 0 : 0.8} metalness={metal ? 0.9 : 0} />,
    lens: (
      <meshPhysicalMaterial
        map={lensTex}
        transparent
        opacity={Math.max(lensOpacity, mirror * 0.97)}
        metalness={mirror * 0.95}
        roughness={0.04 + (1 - mirror) * 0.02}
        clearcoat={1}
        clearcoatRoughness={0.02}
        envMapIntensity={1 + mirror * 1.6}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    ),
  }

  // Fold animates on a spring-ish ease, shared by both arms.
  const foldState = useRef(fold)
  const root = useRef()
  const targetFold = useRef(fold)
  targetFold.current = fold
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    foldState.current += (targetFold.current - foldState.current) * (1 - Math.exp(-dt * 7))
    // keep the glasses centred whether open or folded
    root.current.position.z = templeLength * 0.3 * (1 - 0.75 * foldState.current)
    root.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.04
  })

  return (
    <group ref={root}>
      <Half g={g} mats={mats} fold={foldState} />
      <group scale={[-1, 1, 1]}>
        <Half g={g} mats={mats} fold={foldState} left />
      </group>
      {g.bridges.map((geo, i) => (
        <mesh key={i} geometry={geo} castShadow>
          {frame}
        </mesh>
      ))}
    </group>
  )
}
