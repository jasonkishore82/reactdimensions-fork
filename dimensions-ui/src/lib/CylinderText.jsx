import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Text printed around a clear drum. Drag sideways to spin it; let go and it
// keeps turning with the speed you gave it, slowing under friction back to a
// gentle idle drift. The far side shows through faintly, mirrored, the way
// lettering on a glass looks from the front.
function makeTexture(text, color, font, weight) {
  const c = document.createElement('canvas')
  const H = 256
  const g = c.getContext('2d')
  const unit = `${text}  ·  `
  // weight and style go before the size in a canvas font string
  const css = `${weight} ${H * 0.62}px ${font}`
  g.font = css
  const w = Math.ceil(g.measureText(unit).width)
  // repeat the line enough times to go round once
  const reps = Math.max(1, Math.round(4096 / w))
  c.width = Math.min(8192, w * reps)
  c.height = H
  g.font = css
  g.fillStyle = color
  g.textBaseline = 'middle'
  for (let i = 0; i < reps; i++) g.fillText(unit, i * w, H * 0.54)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.wrapS = THREE.RepeatWrapping
  return { t, aspect: c.width / H }
}

function Drum({ text, color, font, weight, friction, idle, st }) {
  const group = useRef()
  const { t, aspect } = useMemo(() => makeTexture(text, color, font, weight), [text, color, font, weight])
  useEffect(() => () => t.dispose(), [t])
  // the drum's height follows the text, so the letters keep their shape
  const R = 2
  const h = (2 * Math.PI * R) / aspect

  useFrame((_, dt) => {
    dt = Math.min(dt, 1 / 30)
    const s = st.current
    if (!s.drag) {
      // friction pulls the spin toward the idle drift
      s.w += (idle - s.w) * (1 - Math.exp(-dt * friction))
      s.a += s.w * dt
    }
    group.current.rotation.y = s.a
  })

  return (
    <group ref={group} rotation-z={0.08}>
      <mesh>
        <cylinderGeometry args={[R, R, h, 128, 1, true]} />
        <meshBasicMaterial map={t} transparent side={THREE.BackSide} opacity={0.22} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[R, R, h, 128, 1, true]} />
        <meshBasicMaterial map={t} transparent side={THREE.FrontSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default function CylinderText({
  text = 'ROUND AND ROUND',
  color = '#1c1a16',
  font = "'Helvetica Neue', Arial, sans-serif",
  weight = 700,
  friction = 1.2,
  idle = 0.35,
  background = '#f7f7f8',
  style,
}) {
  const st = useRef({ a: 0, w: idle, drag: null })
  const wrap = useRef()

  const down = (e) => {
    const s = st.current
    s.drag = { x: e.clientX, t: performance.now() }
    s.w = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    const s = st.current
    if (!s.drag) return
    const now = performance.now()
    const dx = e.clientX - s.drag.x
    const dt = Math.max(1, now - s.drag.t) / 1000
    const k = 4.5 / (wrap.current?.clientWidth || 600) // radians per pixel
    s.a += dx * k
    s.w = (dx * k) / dt
    s.drag = { x: e.clientX, t: now }
  }
  const up = () => {
    st.current.drag = null
  }

  return (
    <div
      ref={wrap}
      role="img"
      aria-label={text}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ position: 'relative', width: '100%', height: '100%', background, cursor: 'grab', touchAction: 'none', ...style }}
    >
      <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 1.1, 9] }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
        <Drum text={text} color={color} font={font} weight={weight} friction={friction} idle={idle} st={st} />
      </Canvas>
    </div>
  )
}
