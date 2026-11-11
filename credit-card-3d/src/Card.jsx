import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createChipTextures, createFaceTextures } from './textures.js'

// Card size in scene units (1 unit = 1 inch). ISO/IEC 7810 ID-1.
const W = 3.37
const H = 2.125
const T = 0.03
const R = 0.12
const BEVEL = 0.004
const CHIP_T = 0.004
const CHIP_POS = [(0.1805 - 0.5) * W, (0.5 - 0.415) * H]

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

// Flat face geometry with UVs spanning 0..1 across the card.
function faceGeometry(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 24)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5)
  }
  return g
}

// Spring constants for the card's rotation.
const STIFFNESS = 55
const DAMPING = 7.5
const DRAG_SPEED = 0.009

export default function Card() {
  const group = useRef()
  const { gl, viewport } = useThree()
  const [hovered, setHovered] = useState(false)

  const [front, setFront] = useState(() => createFaceTextures('front'))
  const [back, setBack] = useState(() => createFaceTextures('back'))
  const chip = useMemo(() => createChipTextures(), [])

  // Redraw the printed text once the web font has loaded.
  useEffect(() => {
    let alive = true
    document.fonts?.load("500 64px 'Saira'").then(() => {
      if (!alive) return
      setFront(createFaceTextures('front'))
      setBack(createFaceTextures('back'))
    })
    return () => {
      alive = false
    }
  }, [])

  const geo = useMemo(() => {
    const inner = W - BEVEL * 2
    const innerH = H - BEVEL * 2
    const depth = T - BEVEL * 2
    const body = new THREE.ExtrudeGeometry(roundedRect(inner, innerH, R - BEVEL), {
      depth,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 4,
      curveSegments: 24,
    })
    body.translate(0, 0, -depth / 2)
    return {
      body,
      face: faceGeometry(inner, innerH, R - BEVEL),
      chip: faceGeometry(W * 0.131, H * 0.158, 0.035),
      // Thin raised plate under the chip face so it has a visible edge.
      chipBody: (() => {
        const g = new THREE.ExtrudeGeometry(roundedRect(W * 0.131, H * 0.158, 0.035), {
          depth: CHIP_T,
          bevelEnabled: true,
          bevelThickness: 0.002,
          bevelSize: 0.002,
          bevelSegments: 3,
          curveSegments: 16,
        })
        return g
      })(),
    }
  }, [])

  // Physics state lives in a ref so it never triggers React renders.
  const phys = useRef({
    rot: new THREE.Vector2(0, 0), // x = pitch, y = yaw
    vel: new THREE.Vector2(0, 0),
    face: 0, // which multiple of PI the yaw settles to
    dragging: false,
    last: { x: 0, y: 0, t: 0 },
  })

  useEffect(() => {
    const el = gl.domElement
    const onMove = (e) => {
      const p = phys.current
      if (!p.dragging) return
      const now = performance.now()
      const dt = Math.max((now - p.last.t) / 1000, 1 / 240)
      const dx = (e.clientX - p.last.x) * DRAG_SPEED
      const dy = (e.clientY - p.last.y) * DRAG_SPEED
      p.rot.y += dx
      p.rot.x = THREE.MathUtils.clamp(p.rot.x + dy, -1.1, 1.1)
      // Smoothed angular velocity so a flick carries momentum.
      p.vel.x = THREE.MathUtils.lerp(p.vel.x, dy / dt, 0.5)
      p.vel.y = THREE.MathUtils.lerp(p.vel.y, dx / dt, 0.5)
      p.last = { x: e.clientX, y: e.clientY, t: now }
    }
    const onUp = () => {
      const p = phys.current
      if (!p.dragging) return
      p.dragging = false
      el.style.cursor = hovered ? 'grab' : 'auto'
      // Settle on whichever face the momentum is carrying us towards.
      const projected = p.rot.y + p.vel.y * 0.18
      p.face = Math.round(projected / Math.PI)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [gl, hovered])

  useEffect(() => {
    gl.domElement.style.cursor = hovered ? 'grab' : 'auto'
  }, [hovered, gl])

  const onPointerDown = (e) => {
    e.stopPropagation()
    const p = phys.current
    p.dragging = true
    p.vel.set(0, 0)
    p.last = { x: e.clientX, y: e.clientY, t: performance.now() }
    gl.domElement.style.cursor = 'grabbing'
  }

  const onDoubleClick = (e) => {
    e.stopPropagation()
    const p = phys.current
    p.face += 1
    p.vel.y += 6
  }

  const scale = Math.min(1, (viewport.width * 0.85) / W)

  useFrame((state, delta) => {
    const p = phys.current
    const dt = Math.min(delta, 1 / 30)
    const t = state.clock.elapsedTime

    if (!p.dragging) {
      // Hover tilt: the card leans gently toward the pointer.
      const tiltY = state.pointer.x * 0.35
      const tiltX = -state.pointer.y * 0.25
      const targetY = p.face * Math.PI + tiltY
      const targetX = tiltX
      // Damped spring: a = -k(x - target) - c v
      p.vel.y += (-STIFFNESS * (p.rot.y - targetY) - DAMPING * p.vel.y) * dt
      p.vel.x += (-STIFFNESS * (p.rot.x - targetX) - DAMPING * p.vel.x) * dt
      p.rot.y += p.vel.y * dt
      p.rot.x += p.vel.x * dt
    }

    const g = group.current
    g.rotation.set(p.rot.x, p.rot.y, Math.sin(t * 0.6) * 0.015, 'YXZ')
    g.position.y = Math.sin(t * 0.9) * 0.05 + 0.1
  })

  const faceMat = (tex) => ({
    map: tex.color,
    roughnessMap: tex.orm,
    metalnessMap: tex.orm,
    roughness: 1,
    metalness: 1,
    bumpMap: tex.bump,
    bumpScale: 1.2,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 0.25,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [200, 500],
    envMapIntensity: 1.1,
  })

  return (
    <group scale={scale}>
      <group
        ref={group}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Card body with bevelled edges */}
        <mesh geometry={geo.body} castShadow>
          <meshPhysicalMaterial
            color="#141517"
            metalness={0.4}
            roughness={0.3}
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        </mesh>

        {/* Printed front */}
        <mesh geometry={geo.face} position={[0, 0, T / 2 + 0.0005]}>
          <meshPhysicalMaterial key={front.color.uuid} {...faceMat(front)} />
        </mesh>

        {/* EMV chip: gold plate with engraved contact pads */}
        <mesh geometry={geo.chipBody} position={[...CHIP_POS, T / 2]}>
          <meshPhysicalMaterial color="#c99a4c" metalness={0.9} roughness={0.3} envMapIntensity={1.3} />
        </mesh>
        <mesh geometry={geo.chip} position={[...CHIP_POS, T / 2 + CHIP_T + 0.0025]}>
          <meshPhysicalMaterial
            map={chip.color}
            roughnessMap={chip.orm}
            metalnessMap={chip.orm}
            roughness={1}
            metalness={0.75}
            bumpMap={chip.bump}
            bumpScale={1.5}
            clearcoat={0.3}
            clearcoatRoughness={0.15}
            emissive="#4a3210"
            emissiveIntensity={0.35}
            envMapIntensity={1.3}
          />
        </mesh>

        {/* Printed back */}
        <mesh geometry={geo.face} position={[0, 0, -T / 2 - 0.0005]} rotation={[0, Math.PI, 0]}>
          <meshPhysicalMaterial key={back.color.uuid} {...faceMat(back)} />
        </mesh>
      </group>
    </group>
  )
}
