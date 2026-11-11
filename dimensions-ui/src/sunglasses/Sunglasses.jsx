import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
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

// A prop that can also be changed from inside the scene (clicking the
// glasses); `onChange` lets the owner stay in sync.
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

// How far each arm folds. The left one folds first and a touch further, and
// sits a little higher, so the two cross without touching.
const FOLD_RIGHT = 1.56
const FOLD_LEFT = 1.5
const LEFT_LIFT = 0.075

// One half of the glasses, built on the right. The left half is the same
// thing mirrored (the parent flips it), so both stay identical.
function Half({ g, mats, fold, left }) {
  const temple = useRef()
  useFrame(() => {
    const f = fold.current
    const t = temple.current
    // arms splay out a touch when open, and fold in behind the lenses
    t.rotation.y = -0.05 * (1 - f) + f * (left ? FOLD_LEFT : FOLD_RIGHT)
    t.position.y = g.hinge.y + (left ? f * LEFT_LIFT : 0)
  })
  return (
    <group>
      <mesh geometry={g.rim} material={mats.frame} castShadow />
      <mesh geometry={g.lensGeo} material={mats.lens} renderOrder={2} />
      {/* nose pad, behind the rim's nose edge */}
      <mesh position={[g.pad.x, g.pad.y, g.pad.z]} scale={[0.5, 1, 0.4]} material={mats.pad}>
        <sphereGeometry args={[0.1, 14, 10]} />
      </mesh>
      {g.padArm && <mesh geometry={g.padArm} material={mats.metal} />}
      {/* end piece: fixed to the rim, carries the hinge */}
      <mesh geometry={g.endPiece.geo} material={mats.frame} position={g.endPiece.position} castShadow />
      {/* the arm, pivoting on the hinge knuckle */}
      <group ref={temple} position={[g.hinge.x, g.hinge.y, g.hinge.z]}>
        <mesh material={mats.metal} castShadow>
          <cylinderGeometry args={[g.barrelR, g.barrelR, g.metal ? 0.16 : 0.3, 14]} />
        </mesh>
        <mesh geometry={g.mainGeo} material={mats.frame} castShadow />
        <mesh geometry={g.tipGeo} material={mats.tip} castShadow />
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
  fold: foldProp = 0,
  onChange,
}) {
  const [fold, setFold] = useTwoWay(foldProp, 'fold', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const metal = finish === 'metal'
  const g = useMemo(
    () => buildGlasses({ shape, lensW: lensWidth, lensH: lensHeight, bridge, thickness, templeLen: templeLength, wrap, metal }),
    [shape, lensWidth, lensHeight, bridge, thickness, templeLength, wrap, metal],
  )
  useEffect(
    () => () => {
      for (const geo of [g.rim, g.lensGeo, ...g.bridges, g.mainGeo, g.tipGeo, g.endPiece.geo, g.padArm]) geo?.dispose()
    },
    [g],
  )

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

  // One material per part, shared by both halves and updated in place.
  const mats = useMemo(
    () => ({
      frame: new THREE.MeshPhysicalMaterial(),
      tip: new THREE.MeshPhysicalMaterial(),
      lens: new THREE.MeshPhysicalMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02 }),
      metal: new THREE.MeshPhysicalMaterial({ color: '#cfd2d8', metalness: 1, roughness: 0.25 }),
      pad: new THREE.MeshPhysicalMaterial({ color: '#e6e6e9', roughness: 0.2, transparent: true, opacity: 0.8 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    const f = mats.frame
    f.map = finish === 'tortoise' ? tortoise : null
    f.color.set(finish === 'tortoise' ? '#ffffff' : frameColor)
    f.metalness = metal ? 1 : 0
    f.roughness = metal ? 0.2 : finish === 'matte' ? 0.78 : finish === 'tortoise' ? 0.22 : 0.28
    f.clearcoat = finish === 'gloss' ? 1 : finish === 'tortoise' ? 1 : 0
    f.clearcoatRoughness = finish === 'tortoise' ? 0.06 : 0.05
    f.envMapIntensity = metal ? 1.3 : 1
    f.needsUpdate = true
    const t = mats.tip
    t.color.set(tipColor)
    t.roughness = finish === 'matte' ? 0.75 : 0.3
    t.clearcoat = finish === 'matte' ? 0 : 0.8
    t.metalness = metal ? 0.9 : 0
  }, [mats, finish, metal, frameColor, tipColor, tortoise])
  useEffect(() => {
    // tinted glass; the mirror coating turns it into a metallic reflector
    const l = mats.lens
    l.map = lensTex
    l.opacity = Math.max(lensOpacity, mirror * 0.97)
    l.metalness = mirror * 0.95
    l.roughness = 0.04 + (1 - mirror) * 0.02
    l.envMapIntensity = 1 + mirror * 1.6
    l.needsUpdate = true
  }, [mats, lensTex, lensOpacity, mirror])

  // Fold animates on a smooth ease, shared by both arms.
  const foldState = useRef(foldProp)
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
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation()
        setFold(fold > 0.5 ? 0 : 1)
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <Half g={g} mats={mats} fold={foldState} />
      <group scale={[-1, 1, 1]}>
        <Half g={g} mats={mats} fold={foldState} left />
      </group>
      {g.bridges.map((geo, i) => (
        <mesh key={i} geometry={geo} material={mats.frame} castShadow />
      ))}
    </group>
  )
}
