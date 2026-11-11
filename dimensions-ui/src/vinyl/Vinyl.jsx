import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { REC_R, sheenTexture, sleeveTexture, vinylTextures } from './textures.js'

const SLEEVE = 5.95 // sleeve is a little bigger than the 12 inch record
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// Colour pickers fire on every drag step; texture drawing is heavy, so wait
// until the value settles.
function useSettled(value, ms = 180) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// spin / rpm: the record turns by itself. Drag it to spin it by hand (it keeps
// its momentum). tilt: it leans towards the pointer. sleeve + pullOut: the
// record stands in a paper sleeve and slides out of it.
export default function Vinyl({
  spin = true,
  rpm = 33,
  tilt = true,
  vinyl = '#0b0b0d',
  accent = '#ffffff',
  finish = 'solid',
  label = '#e3302b',
  labelText = 'SIDE A',
  shine = 0.7,
  sleeve = false,
  sleeveColor = '#e9e1d0',
  pullOut = 0.55,
}) {
  const { camera, pointer, size } = useThree()

  const key = useSettled(`${vinyl}|${accent}|${finish}|${label}|${labelText}`)
  const disc = useMemo(() => {
    const [v, a, f, l, t] = key.split('|')
    return vinylTextures({ vinyl: v, accent: a, finish: f, label: l, labelText: t })
  }, [key])
  useEffect(() => () => disc.dispose(), [disc])
  const sleeveKey = useSettled(`${sleeveColor}|${labelText}`)
  const sleeveTex = useMemo(() => {
    const [c, t] = sleeveKey.split('|')
    return sleeveTexture({ color: c, title: t })
  }, [sleeveKey])
  useEffect(() => () => sleeveTex.dispose(), [sleeveTex])
  const sheen = useMemo(() => sheenTexture(), [])
  useEffect(() => () => sheen.dispose(), [sheen])

  const tiltRef = useRef()
  const recRef = useRef()
  const spinRef = useRef()
  const sheenRef = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover, 'grab')

  const s = useRef({
    omega: 0,
    angle: 0,
    dragging: false,
    lastA: 0,
    rx: 0,
    ry: 0,
    vx: 0,
    vy: 0,
    y: 0,
    center: new THREE.Vector3(),
  })

  // Angle of the pointer around the record's centre on screen. Positive is
  // anticlockwise, the same sense as a positive spin.
  const pointerAngle = () => {
    const st = s.current
    st.center.setFromMatrixPosition(recRef.current.matrixWorld).project(camera)
    return Math.atan2(pointer.y - st.center.y, (pointer.x - st.center.x) * (size.width / size.height))
  }

  useEffect(() => {
    const up = () => (s.current.dragging = false)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const st = s.current
    const target = spin ? (rpm * Math.PI * 2) / 60 : 0

    if (st.dragging) {
      const a = pointerAngle()
      const da = wrap(a - st.lastA)
      st.lastA = a
      st.angle += da
      st.omega += (da / Math.max(dt, 1e-3) - st.omega) * 0.35
    } else {
      st.omega += (target - st.omega) * (1 - Math.exp(-dt / 1.3))
      st.angle += st.omega * dt
    }
    spinRef.current.rotation.y = st.angle

    // Lean towards the pointer on a damped spring
    const px = tilt ? pointer.x : 0
    const py = tilt ? pointer.y : 0
    st.vy += ((px * 0.4 - st.ry) * 70 - st.vy * 9) * dt
    st.vx += ((-py * 0.28 - st.rx) * 70 - st.vx * 9) * dt
    st.ry += st.vy * dt
    st.rx += st.vx * dt
    tiltRef.current.rotation.set(st.rx, st.ry, 0)
    tiltRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.05

    // Slide out of / back into the sleeve
    const yT = sleeve ? pullOut * 3.2 - 0.1 : 0
    st.y += (yT - st.y) * (1 - Math.exp(-dt * 6))
    recRef.current.position.y = st.y

    // The light bands drift as the pointer moves, like moving round a real record
    sheenRef.current.rotation.z = px * 1.1 + 0.6 + st.ry * 0.8
  })

  const half = SLEEVE / 2
  const edge = <meshStandardMaterial color="#cfc6b4" roughness={0.9} />

  return (
    <group ref={tiltRef}>
      {sleeve && (
        <group position={[0, 0, 0]}>
          {/* Front and back covers, open at the top */}
          <mesh position={[0, 0, 0.065]} castShadow receiveShadow>
            <boxGeometry args={[SLEEVE, SLEEVE, 0.03]} />
            <meshStandardMaterial map={sleeveTex} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0, -0.065]} castShadow receiveShadow>
            <boxGeometry args={[SLEEVE, SLEEVE, 0.03]} />
            <meshStandardMaterial color={sleeveColor} roughness={0.9} />
          </mesh>
          {/* closed sides and bottom */}
          <mesh position={[-half, 0, 0]}>
            <boxGeometry args={[0.03, SLEEVE, 0.16]} />
            {edge}
          </mesh>
          <mesh position={[half, 0, 0]}>
            <boxGeometry args={[0.03, SLEEVE, 0.16]} />
            {edge}
          </mesh>
          <mesh position={[0, -half, 0]}>
            <boxGeometry args={[SLEEVE, 0.03, 0.16]} />
            {edge}
          </mesh>
        </group>
      )}

      {/* The record stands facing the camera: its top face points along +z */}
      <group ref={recRef}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <group ref={spinRef}>
            <mesh
              castShadow
              receiveShadow
              onPointerDown={(e) => {
                e.stopPropagation()
                s.current.dragging = true
                s.current.lastA = pointerAngle()
              }}
              onPointerOver={() => setHover(true)}
              onPointerOut={() => setHover(false)}
            >
              <cylinderGeometry args={[REC_R, REC_R, 0.03, 128]} />
              <meshPhysicalMaterial attach="material-0" color="#0b0b0d" roughness={0.3} />
              <meshPhysicalMaterial
                attach="material-1"
                map={disc.map}
                bumpMap={disc.bump}
                bumpScale={1.4}
                roughness={0.45}
                metalness={0.05}
                clearcoat={0.2}
                clearcoatRoughness={0.3}
                envMapIntensity={0.35}
              />
              <meshPhysicalMaterial attach="material-2" color="#0b0b0d" roughness={0.4} />
            </mesh>
          </group>
          <mesh ref={sheenRef} position={[0, 0.019, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <circleGeometry args={[REC_R - 0.01, 96]} />
            <meshBasicMaterial map={sheen} blending={THREE.AdditiveBlending} transparent depthWrite={false} opacity={shine} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
