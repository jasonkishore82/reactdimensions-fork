import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { bezelTexture, dialTexture } from './textures.js'

function useSettled(value, ms = 160) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// Case body: a lathe of the side profile, axis along +z (the face).
function caseGeometry() {
  const prof = [
    [0.0, -0.32],
    [0.98, -0.32],
    [1.07, -0.27],
    [1.12, -0.2],
    [1.12, 0.14],
    [1.09, 0.2],
    [1.02, 0.225],
    [0.97, 0.2],
  ].map(([r, z]) => new THREE.Vector2(r, z))
  const g = new THREE.LatheGeometry(prof, 96)
  g.rotateX(Math.PI / 2)
  return g
}

// Domed crystal: a shallow cap of a big sphere, pointing along +z.
function crystalGeometry() {
  const g = new THREE.SphereGeometry(6, 64, 8, 0, Math.PI * 2, 0, 0.1645)
  g.rotateX(Math.PI / 2)
  return g
}

// Diver bezel insert: a solid ring standing on the case top, with a small
// chamfer on its outer edge. The printed scale goes on its top face.
const BEZEL_TOP = 0.265
function diverBezelGeometry() {
  const prof = [
    [0.93, 0.2],
    [0.93, BEZEL_TOP],
    [1.1, BEZEL_TOP],
    [1.12, 0.235],
    [1.12, 0.2],
  ].map(([r, z]) => new THREE.Vector2(r, z))
  const g = new THREE.LatheGeometry(prof, 96)
  g.rotateX(Math.PI / 2)
  return g
}

// Spring bar between a pair of lugs: what the strap wraps round.
const LUG_X = 0.66
const LUG_Y = 1.2

// A tapered, flat watch hand as an extruded outline lying in x/y, length along +y.
function handGeometry({ length, width, tail = 0.12, lume = false }) {
  const s = new THREE.Shape()
  const w = width / 2
  s.moveTo(-w * 0.55, -tail)
  s.lineTo(w * 0.55, -tail)
  s.lineTo(w, 0)
  s.lineTo(w * (lume ? 1 : 0.55), length * 0.75)
  s.lineTo(0, length)
  s.lineTo(-w * (lume ? 1 : 0.55), length * 0.75)
  s.lineTo(-w, 0)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false })
}

// dialStyle: 'index' | 'numerals' | 'diver'.  time: 'live' | '10:10'.
export default function Analog({ caseColor, dialColor, handsColor, accent, dialStyle, bezelColor, shine, time }) {
  const caseGeo = useMemo(caseGeometry, [])
  const crystalGeo = useMemo(crystalGeometry, [])
  const diverGeo = useMemo(diverBezelGeometry, [])
  const hourGeo = useMemo(() => handGeometry({ length: 0.5, width: 0.1, lume: true }), [])
  const minGeo = useMemo(() => handGeometry({ length: 0.8, width: 0.075, lume: true }), [])
  const secGeo = useMemo(() => handGeometry({ length: 0.86, width: 0.018, tail: 0.2 }), [])
  useEffect(
    () => () => {
      for (const g of [caseGeo, crystalGeo, diverGeo, hourGeo, minGeo, secGeo]) g.dispose()
    },
    [caseGeo, crystalGeo, diverGeo, hourGeo, minGeo, secGeo],
  )

  const dialKey = useSettled(`${dialColor}|${dialStyle}`)
  const dial = useMemo(() => {
    const [c, s] = dialKey.split('|')
    return dialTexture({ color: c, style: s })
  }, [dialKey])
  useEffect(() => () => dial.dispose(), [dial])
  const bezelKey = useSettled(bezelColor)
  const bezel = useMemo(() => bezelTexture({ color: bezelKey }), [bezelKey])
  useEffect(() => () => bezel.dispose(), [bezel])

  const hourRef = useRef()
  const minRef = useRef()
  const secRef = useRef()
  useFrame(() => {
    let h = 10
    let m = 10
    let s = 36
    if (time === 'live') {
      const d = new Date()
      h = d.getHours()
      m = d.getMinutes()
      s = d.getSeconds() + d.getMilliseconds() / 1000
    }
    const tau = Math.PI * 2
    // hands turn clockwise as seen from the front (+z), so the angle is negative
    secRef.current.rotation.z = -(s / 60) * tau
    minRef.current.rotation.z = -((m + s / 60) / 60) * tau
    hourRef.current.rotation.z = -(((h % 12) + m / 60) / 12) * tau
  })

  const metal = (
    <meshPhysicalMaterial color={caseColor} metalness={1} roughness={0.34 - shine * 0.24} envMapIntensity={1.35} />
  )
  const handMat = <meshPhysicalMaterial color={handsColor} metalness={0.85} roughness={0.25} envMapIntensity={1.2} />
  const diver = dialStyle === 'diver'

  return (
    <group>
      {/* case, lugs, crown */}
      <mesh geometry={caseGeo} castShadow>
        {metal}
      </mesh>
      {[
        [-LUG_X, LUG_Y],
        [LUG_X, LUG_Y],
        [-LUG_X, -LUG_Y],
        [LUG_X, -LUG_Y],
      ].map(([x, y], i) => (
        <RoundedBox key={i} args={[0.2, 0.62, 0.26]} radius={0.05} smoothness={3} position={[x, y, -0.05]} rotation={[y > 0 ? -0.1 : 0.1, 0, 0]} castShadow>
          {metal}
        </RoundedBox>
      ))}
      {/* spring bars between the lugs, where the strap starts and ends */}
      {[LUG_Y, -LUG_Y].map((y) => (
        <mesh key={y} position={[0, y, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, LUG_X * 2, 12]} />
          {metal}
        </mesh>
      ))}
      {/* crown: stem into the case, with a knurled cap overlapping its end */}
      <mesh position={[1.22, 0, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 20]} />
        {metal}
      </mesh>
      <mesh position={[1.385, 0, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.05, 20]} />
        {metal}
      </mesh>

      {/* bezel: a plain polished ring, or a dark rotating insert for the diver */}
      {diver ? (
        <>
          <mesh geometry={diverGeo} castShadow>
            <meshPhysicalMaterial color={bezelColor} roughness={0.4} clearcoat={0.5} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, BEZEL_TOP + 0.001]}>
            <ringGeometry args={[0.93, 1.1, 96]} />
            <meshPhysicalMaterial map={bezel} roughness={0.35} clearcoat={0.6} metalness={0.2} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0, 0.215]} castShadow>
          <torusGeometry args={[1.0, 0.075, 16, 96]} />
          {metal}
        </mesh>
      )}

      {/* dial, hands, crystal */}
      <mesh position={[0, 0, 0.2]}>
        <circleGeometry args={[diver ? 0.93 : 0.98, 96]} />
        <meshPhysicalMaterial map={dial} roughness={0.5} metalness={0.1} />
      </mesh>
      <group position={[0, 0, 0.215]}>
        <mesh ref={hourRef} geometry={hourGeo} position={[0, 0, 0.0]} castShadow>
          {handMat}
        </mesh>
        <mesh ref={minRef} geometry={minGeo} position={[0, 0, 0.016]} castShadow>
          {handMat}
        </mesh>
        <mesh ref={secRef} geometry={secGeo} position={[0, 0, 0.032]}>
          <meshPhysicalMaterial color={accent} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.03, 24]} />
          <meshPhysicalMaterial color={accent} metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
      <mesh geometry={crystalGeo} position={[0, 0, -5.69]} renderOrder={3}>
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.12}
          roughness={0.02}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={1.6}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
