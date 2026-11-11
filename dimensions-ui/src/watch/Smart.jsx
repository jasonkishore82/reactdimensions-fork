import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { drawSmartFace } from './textures.js'

const CASE_W = 1.95
const CASE_H = 2.35
const SCREEN_W = 1.72
const SCREEN_H = 2.12

function roundedRect(w, h, r) {
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

// face: 'rings' | 'analog' | 'digital'. The screen redraws about once a second.
export default function Smart({ caseColor, dialColor, accent, face, shine, time }) {
  const body = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRect(CASE_W - 0.12, CASE_H - 0.12, 0.54), {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 5,
      curveSegments: 20,
    })
    g.translate(0, 0, -0.26)
    return g
  }, [])
  const screenGeo = useMemo(() => {
    const g = new THREE.ShapeGeometry(roundedRect(SCREEN_W, SCREEN_H, 0.44), 24)
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SCREEN_W + 0.5, p.getY(i) / SCREEN_H + 0.5)
    return g
  }, [])

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 632
    return c
  }, [])
  const screen = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [canvas])
  useEffect(() => () => screen.dispose(), [screen])

  const last = useRef('')
  const settings = useRef({})
  settings.current = { face, bg: dialColor, accent, time }
  useFrame(() => {
    const { face: f, bg, accent: a, time: tm } = settings.current
    const now = tm === 'live' ? new Date() : new Date(2025, 5, 3, 10, 10, 36)
    const key = `${f}|${bg}|${a}|${now.getSeconds()}|${now.getMinutes()}`
    if (key === last.current) return
    last.current = key
    drawSmartFace(canvas.getContext('2d'), canvas.width, canvas.height, { face: f, bg, accent: a, now })
    screen.needsUpdate = true
  })

  const metal = <meshPhysicalMaterial color={caseColor} metalness={0.95} roughness={0.38 - shine * 0.26} envMapIntensity={1.25} />

  return (
    <group>
      <mesh geometry={body} castShadow>
        {metal}
      </mesh>
      {/* screen */}
      <mesh geometry={screenGeo} position={[0, 0, 0.206]}>
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {/* cover glass over the whole front, for reflections */}
      <RoundedBox args={[CASE_W - 0.1, CASE_H - 0.1, 0.012]} radius={0.5} smoothness={4} position={[0, 0, 0.215]} renderOrder={3}>
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.06}
          roughness={0.02}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={1.0}
          depthWrite={false}
        />
      </RoundedBox>
      {/* digital crown and side button */}
      <mesh position={[CASE_W / 2 + 0.02, 0.52, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.16, 24]} />
        {metal}
      </mesh>
      <mesh position={[CASE_W / 2 + 0.07, 0.52, -0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 24]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.6} />
      </mesh>
      <RoundedBox args={[0.1, 0.5, 0.14]} radius={0.04} smoothness={3} position={[CASE_W / 2 + 0.0, -0.22, -0.02]} castShadow>
        {metal}
      </RoundedBox>
      {/* the strap slots into the case, so there are no lugs */}
    </group>
  )
}
