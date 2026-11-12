import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A little robot that builds itself as you scroll. The component has its own
// scroll container: a tall track with the canvas pinned (position: sticky) on
// top, so the page itself never scrolls. Scroll progress moves each part from a
// scattered start pose to its place on the robot, one part after another, each
// with its own eased window; the caption and the progress rail follow the
// current stage. Scroll back up and it comes apart again.
//
// Assembled layout (y up, the floor at 0), checked for clearance:
//   base     x ±0.8 (wheels to ±0.88)  y 0..0.3    z ±0.5
//   torso    x ±0.7                    y 0.3..1.7  z ±0.45
//   panel    x ±0.4                    y 0.8..1.3  z 0.45..0.51
//   arms     x ±0.73..±1.05            y 0.49..1.61
//   head     x ±0.55 (ears to ±0.61)   y 1.7..2.65 (neck from 1.7)
//   antenna                            y 2.65..3.14
// Start poses only ever add height, so nothing passes below the floor.

const TRACK = 5 // scroll track height, in viewports
const SPAN = 0.22 // each part's share of the scroll

// c: the part's centre, which it turns about in flight; from: its start offset;
// rot: its start rotation; at: where in the scroll (0..1) it sets off
const PARTS = [
  { id: 'base', stage: 0, at: 0.05, c: [0, 0.15, 0], from: [-3.2, 0, 1.4], rot: [0, -1.1, 0] },
  { id: 'torso', stage: 1, at: 0.18, c: [0, 1.0, 0], from: [0, 2.4, 0], rot: [0, 0.9, 0] },
  { id: 'armL', stage: 2, at: 0.31, c: [-0.89, 1.05, 0], from: [-2.4, 0.8, 0.6], rot: [0, 0, 1.2] },
  { id: 'armR', stage: 2, at: 0.35, c: [0.89, 1.05, 0], from: [2.4, 0.8, 0.6], rot: [0, 0, -1.2] },
  { id: 'panel', stage: 3, at: 0.46, c: [0, 1.05, 0.48], from: [0, 0.3, 2.6], rot: [-0.9, 0, 0] },
  { id: 'head', stage: 4, at: 0.58, c: [0, 2.2, 0], from: [0, 2.0, 0.4], rot: [0.4, -1.4, 0] },
  { id: 'antenna', stage: 5, at: 0.7, c: [0, 2.9, 0], from: [0.4, 1.6, 0], rot: [0, 0, 0.8] },
]
const PART = Object.fromEntries(PARTS.map((p) => [p.id, p]))
const STAGES = [
  ['Base', 'Ballast and wheels roll in'],
  ['Chassis', 'The torso drops onto the base'],
  ['Arms', 'Clipped on at the shoulders'],
  ['Core panel', 'The status display slots in'],
  ['Head', 'Sensors and eyes'],
  ['Antenna', 'Signal up'],
  ['Assembled', 'Ready to roll'],
]
const DONE = PARTS[PARTS.length - 1].at + SPAN

function stageOf(p) {
  if (p < PARTS[0].at) return -1
  if (p >= DONE) return STAGES.length - 1
  let s = 0
  for (const part of PARTS) if (p >= part.at) s = part.stage
  return s
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8a8580']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 7, 6]} rotation-y={Math.PI / 3} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eaf0ff" position={[8, 5, 5]} rotation-y={-Math.PI / 3} scale={[6, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
      <Lightformer form="ring" intensity={0.9} color="#fff4e6" position={[0, 3, -9]} scale={4} />
    </Environment>
  )
}

function Robot({ progress, bodyColor, accentColor, glowColor, autoRotate }) {
  const reduced = useMemo(reducedMotion, [])
  const mats = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      accent: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c3c7cd', metalness: 1, roughness: 0.28 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.85 }),
      screen: new THREE.MeshStandardMaterial({ color: '#0f1418', roughness: 0.2 }),
      glow: new THREE.MeshStandardMaterial({ color: '#ffffff', emissiveIntensity: 1.8, roughness: 0.3 }),
    }),
    [],
  )
  const capsule = useMemo(() => new THREE.CapsuleGeometry(0.16, 0.8, 8, 24), [])
  useEffect(
    () => () => {
      capsule.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [mats, capsule],
  )
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.accent.color.set(accentColor)
    mats.glow.color.set(glowColor)
    mats.glow.emissive.set(glowColor)
  }, [mats, bodyColor, accentColor, glowColor])

  const refs = useRef({})
  const root = useRef()
  const sp = useRef(progress.current)
  const yaw = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const p = progress.current
    sp.current = reduced ? p : sp.current + (p - sp.current) * (1 - Math.exp(-dt * 8))
    for (const part of PARTS) {
      const g = refs.current[part.id]
      if (!g) continue
      const t = THREE.MathUtils.clamp((sp.current - part.at) / SPAN, 0, 1)
      // reduced motion: each part is either scattered or in place, no flight
      const e = reduced ? (t >= 0.5 ? 1 : 0) : easeInOut(t)
      const k = 1 - e
      g.position.set(part.c[0] + part.from[0] * k, part.c[1] + part.from[1] * k, part.c[2] + part.from[2] * k)
      g.rotation.set(part.rot[0] * k, part.rot[1] * k, part.rot[2] * k)
    }
    // a slow turn linked to the scroll, plus an optional idle spin
    if (autoRotate && !reduced) yaw.current += dt * 0.3
    root.current.rotation.y = -0.45 + sp.current * 0.8 + yaw.current
  })

  // a part: an outer group at its centre (moved and turned in flight) holding
  // the meshes, which are modelled in assembled world positions
  const Part = (id, children, key) => (
    <group key={key} ref={(o) => (refs.current[id] = o)} position={PART[id].c}>
      <group position={PART[id].c.map((v) => -v)}>{children}</group>
    </group>
  )
  return (
    <group ref={root}>
      {/* each part is a group at its assembled place; the group's offset is the flight */}
      {Part(
        'base',
        <>
          <RoundedBox args={[1.6, 0.3, 1.0]} radius={0.08} smoothness={4} position-y={0.15} material={mats.accent} />
          {[-1, 1].map((sx) =>
            [-0.3, 0.3].map((z) => (
              <group key={`${sx}${z}`} position={[sx * 0.84, 0.14, z]}>
                <mesh material={mats.rubber} rotation-z={Math.PI / 2}>
                  <cylinderGeometry args={[0.14, 0.14, 0.08, 28]} />
                </mesh>
                <mesh material={mats.steel} rotation-z={Math.PI / 2} position-x={sx * 0.041}>
                  <cylinderGeometry args={[0.06, 0.06, 0.004, 20]} />
                </mesh>
              </group>
            )),
          )}
        </>,
      )}

      {Part(
        'torso',
        <>
          <RoundedBox args={[1.4, 1.4, 0.9]} radius={0.15} smoothness={5} position-y={1.0} material={mats.body} />
          {/* shoulder sockets, set into the sides */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} material={mats.steel} position={[sx * 0.7, 1.45, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.1, 0.1, 0.02, 24]} />
            </mesh>
          ))}
        </>,
      )}

      {[-1, 1].map((sx) =>
        Part(
          sx < 0 ? 'armL' : 'armR',
          <>
            <mesh geometry={capsule} material={mats.body} position={[sx * 0.89, 1.05, 0]} />
            <mesh material={mats.accent} position={[sx * 0.89, 1.45, 0]}>
              <sphereGeometry args={[0.165, 24, 16]} />
            </mesh>
            {/* a pin from the shoulder into the socket */}
            <mesh material={mats.steel} position={[sx * 0.715, 1.45, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.05, 0.05, 0.05, 16]} />
            </mesh>
          </>,
          sx,
        ),
      )}

      {Part(
        'panel',
        <>
          <RoundedBox args={[0.8, 0.5, 0.06]} radius={0.025} smoothness={3} position={[0, 1.05, 0.48]} material={mats.screen} />
          {[-0.2, 0, 0.2].map((x, i) => (
            <mesh key={x} material={mats.glow} position={[x, 1.0 + i * 0.03, 0.512]}>
              <boxGeometry args={[0.12, 0.14 + i * 0.08, 0.004]} />
            </mesh>
          ))}
        </>,
      )}

      {Part(
        'head',
        <>
          <mesh material={mats.steel} position-y={1.775}>
            <cylinderGeometry args={[0.18, 0.2, 0.15, 24]} />
          </mesh>
          <RoundedBox args={[1.1, 0.8, 0.85]} radius={0.16} smoothness={5} position-y={2.25} material={mats.body} />
          <RoundedBox args={[0.82, 0.32, 0.04]} radius={0.015} smoothness={3} position={[0, 2.3, 0.43]} material={mats.screen} />
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} material={mats.glow} position={[x, 2.3, 0.45]} scale={[1, 1, 0.45]}>
              <sphereGeometry args={[0.085, 24, 16]} />
            </mesh>
          ))}
          {[-1, 1].map((sx) => (
            <mesh key={sx} material={mats.accent} position={[sx * 0.58, 2.25, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.14, 0.14, 0.06, 28]} />
            </mesh>
          ))}
        </>,
      )}

      {Part(
        'antenna',
        <>
          <mesh material={mats.steel} position-y={2.825}>
            <cylinderGeometry args={[0.03, 0.03, 0.35, 12]} />
          </mesh>
          <mesh material={mats.glow} position-y={3.06}>
            <sphereGeometry args={[0.08, 20, 14]} />
          </mesh>
        </>,
      )}
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    // fit the assembled robot comfortably; the scattered parts fly in from the edges
    const dist = Math.max(4.2 / 2 / tan, 5.2 / 2 / (tan * aspect))
    camera.position.set(0, 1.55 + dist * 0.32, dist)
    camera.lookAt(0, 1.45, 0)
  }, [camera, size.width, size.height])
  return null
}

const mono = { font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4f4a43' }

// bodyColor, accentColor: the robot's shell and base. glowColor: its eyes and
// display. floorColor: the studio. autoRotate: a slow idle spin.
export default function ScrollAssembly({ bodyColor = '#f0ece4', accentColor = '#3d6f8f', glowColor = '#5ff2c4', floorColor = '#d9d4cb', autoRotate = false }) {
  const scroller = useRef()
  const progress = useRef(0)
  const [stage, setStage] = useState(-1)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = scroller.current
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      const p = max > 0 ? THREE.MathUtils.clamp(el.scrollTop / max, 0, 1) : 0
      progress.current = p
      setStage(stageOf(p))
      setScrolled(p > 0.01)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const caption = stage < 0 ? ['Scroll to assemble', 'Seven parts, one robot'] : STAGES[stage]
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: floorColor }}>
      <style>{`.sa-scroll{scrollbar-width:none}.sa-scroll::-webkit-scrollbar{display:none}.sa-scroll:focus-visible{outline:2px solid ${accentColor};outline-offset:-2px}.sa-cap{animation:sa-in .3s ease}@keyframes sa-in{from{opacity:0;transform:translateY(4px)}}@keyframes sa-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}@media (prefers-reduced-motion: reduce){.sa-cap{animation:none}.sa-hint{animation:none!important}}`}</style>
      <div ref={scroller} className="sa-scroll" tabIndex={0} aria-label="Scroll to assemble the robot" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>
        <div style={{ position: 'relative', height: `${TRACK * 100}%` }}>
          <div style={{ position: 'sticky', top: 0, height: `${100 / TRACK}%` }}>
            <Canvas style={{ pointerEvents: 'none' }} dpr={[1, 1.75]} camera={{ position: [0, 3, 10], fov: 30, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
              <color attach="background" args={[floorColor]} />
              <fog attach="fog" args={[floorColor, 16, 36]} />
              <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
              <directionalLight position={[-5, 9, 6]} intensity={0.6} />
              <Studio />
              <mesh rotation-x={-Math.PI / 2}>
                <planeGeometry args={[80, 80]} />
                <meshStandardMaterial color={floorColor} roughness={0.9} />
              </mesh>
              <ContactShadows position={[0, 0.002, 0]} scale={10} resolution={512} blur={2.4} opacity={0.45} far={4} />
              <Robot progress={progress} bodyColor={bodyColor} accentColor={accentColor} glowColor={glowColor} autoRotate={autoRotate} />
              <Rig />
            </Canvas>

            {/* progress rail: one dot per stage */}
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
              {STAGES.map((_, i) => (
                <span key={i} style={{ width: 6, height: i === stage ? 16 : 6, borderRadius: 6, background: i <= stage ? accentColor : 'rgba(79,74,67,0.25)', transition: 'height .2s ease, background .2s ease' }} />
              ))}
            </div>

            <div className="sa-hint" style={{ ...mono, position: 'absolute', left: 0, right: 0, top: 14, textAlign: 'center', pointerEvents: 'none', opacity: scrolled ? 0 : 1, transition: 'opacity .3s ease', animation: 'sa-bob 1.6s ease-in-out infinite' }}>
              Scroll inside ↓
            </div>

            <div key={stage} className="sa-cap" style={{ ...mono, position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none' }}>
              <span style={{ color: accentColor, fontWeight: 600 }}>{stage < 0 ? '0' : Math.min(stage + 1, STAGES.length - 1)}/{STAGES.length - 1}</span>
              {'  '}
              <b style={{ fontWeight: 600, color: '#2b2824' }}>{caption[0]}</b> · {caption[1]}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
