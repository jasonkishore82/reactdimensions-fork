import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, ContactShadows, Environment, Html, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A smart speaker with pulsing hotspots on its surface. Click one to open a
// small note card pinned beside it while the camera eases round to face it;
// only one is open at a time. Click empty space or press Escape to close.
//
// Each frame every marker is tested for occlusion: a ray from the camera to the
// marker that meets the speaker first means the marker is round the back, so it
// fades out and can't be clicked (and its card hides with it).
//
// Markers live on their own layer (1): the camera and the pointer raycaster see
// it, but the contact-shadow pass doesn't, so they cast no shadow.

const R = 1.05 // body radius
const FOOT = 0.08
const H = 2.8 // body height, from the top of the foot
const TOP = FOOT + H
const CORNER = 0.22
const MARK_LAYER = 1
const FOV = 32
const CENTER = new THREE.Vector3(0, 1.55, 0)

const n3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize()
const HOTSPOTS = [
  { id: 'controls', title: 'Touch controls', text: 'Tap the glass to play or pause; slide a finger round the ring for volume.', pos: new THREE.Vector3(-0.25, TOP + 0.016, -0.05), normal: n3(0, 1, 0) },
  { id: 'ring', title: 'Light ring', text: 'Glows the colour of what is playing, and breathes while it listens.', pos: new THREE.Vector3(0, TOP + 0.02, 0.74), normal: n3(0, 0.6, 0.8) },
  { id: 'fabric', title: 'Acoustic knit', text: 'Three drivers behind a recycled knit fill the room in every direction.', pos: new THREE.Vector3(R * Math.sin(0.61), 1.5, R * Math.cos(0.61)), normal: n3(Math.sin(0.61), 0, Math.cos(0.61)) },
  { id: 'power', title: 'USB-C power', text: 'One cable for power; it also takes a wired line-in.', pos: new THREE.Vector3(0, 0.55, -R - 0.04), normal: n3(0, 0, -1) },
]

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

// A rounded cylinder, turned from its profile: flat base, rounded corners.
function bodyGeometry() {
  const pts = [new THREE.Vector2(0.0001, 0)]
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10
      pts.push(new THREE.Vector2(cx + Math.cos(a) * CORNER, cy + Math.sin(a) * CORNER))
    }
  }
  arc(R - CORNER, CORNER, -Math.PI / 2, 0)
  arc(R - CORNER, H - CORNER, 0, Math.PI / 2)
  pts.push(new THREE.Vector2(0.0001, H))
  return new THREE.LatheGeometry(pts, 96)
}

function useKnitTexture() {
  const tex = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 })
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 64, 64)
    // little interlocking stitches
    for (let y = 0; y < 64; y += 8)
      for (let x = 0; x < 64; x += 8) {
        g.fillStyle = 'rgba(0,0,0,0.16)'
        g.beginPath()
        g.ellipse(x + 2.5, y + 4, 1.6, 3.4, 0.5, 0, Math.PI * 2)
        g.ellipse(x + 5.5, y + 4, 1.6, 3.4, -0.5, 0, Math.PI * 2)
        g.fill()
      }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(48, 18)
    t.anisotropy = 8
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

function Speaker({ fabricColor, accentColor, lightColor, innerRef }) {
  const knit = useKnitTexture()
  const geo = useMemo(() => bodyGeometry(), [])
  const mats = useMemo(
    () => ({
      fabric: new THREE.MeshStandardMaterial({ map: knit, roughness: 0.95 }),
      plastic: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#111216', roughness: 0.08, clearcoat: 1, metalness: 0.1 }),
      light: new THREE.MeshStandardMaterial({ color: '#ffffff', emissiveIntensity: 1.6, roughness: 0.3 }),
      port: new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.7 }),
    }),
    [knit],
  )
  useEffect(
    () => () => {
      geo.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, mats],
  )
  useEffect(() => {
    mats.fabric.color.set(fabricColor)
    mats.plastic.color.set(accentColor)
    mats.light.emissive.set(lightColor)
    mats.light.color.set(lightColor)
  }, [mats, fabricColor, accentColor, lightColor])

  return (
    <group ref={innerRef}>
      <mesh material={mats.plastic} position-y={FOOT / 2}>
        <cylinderGeometry args={[0.9, 0.94, FOOT, 64]} />
      </mesh>
      <mesh geometry={geo} material={mats.fabric} position-y={FOOT} />
      {/* top: a plastic plate on the flat of the lathe, a glass disc and the light ring */}
      <mesh material={mats.plastic} position-y={TOP + 0.004}>
        <cylinderGeometry args={[R - CORNER, R - CORNER, 0.012, 64]} />
      </mesh>
      <mesh material={mats.glass} position-y={TOP + 0.01}>
        <cylinderGeometry args={[0.6, 0.6, 0.012, 64]} />
      </mesh>
      <mesh material={mats.light} position-y={TOP + 0.01} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.7, 0.028, 12, 96]} />
      </mesh>
      {/* the power socket on the back */}
      <RoundedBox args={[0.34, 0.22, 0.1]} radius={0.04} smoothness={3} position={[0, 0.55, -R + 0.01]} material={mats.plastic} />
      <RoundedBox args={[0.16, 0.06, 0.02]} radius={0.02} smoothness={2} position={[0, 0.55, -R - 0.04]} material={mats.port} />
    </group>
  )
}

function Marker({ spot, color, open, onToggle, visRef, index }) {
  const ring = useRef()
  const core = useRef()
  const mats = useMemo(
    () => ({
      core: new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }),
      edge: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, depthWrite: false }),
      ring: new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.core.color.set(color)
    mats.ring.color.set(color)
  }, [mats, color])
  const reduced = useMemo(reducedMotion, [])
  const pos = useMemo(() => spot.pos.clone().addScaledVector(spot.normal, 0.07), [spot])

  useFrame((state) => {
    const v = visRef.current[index]
    const t = (state.clock.elapsedTime * 0.8 + index * 0.27) % 1
    const s = reduced ? 1.6 : 1 + t * 1.4
    ring.current.scale.setScalar(s)
    mats.ring.opacity = (reduced ? 0.35 : (1 - t) * 0.6) * v
    mats.core.opacity = v
    mats.edge.opacity = v
    core.current.scale.setScalar(open ? 1.25 : 1)
  })

  return (
    <Billboard position={pos}>
      <mesh ref={ring} material={mats.ring} renderOrder={10} layers={MARK_LAYER}>
        <ringGeometry args={[0.085, 0.105, 40]} />
      </mesh>
      <group ref={core}>
        <mesh material={mats.edge} renderOrder={11} layers={MARK_LAYER}>
          <circleGeometry args={[0.085, 40]} />
        </mesh>
        <mesh material={mats.core} renderOrder={12} position-z={0.001} layers={MARK_LAYER}>
          <circleGeometry args={[0.062, 40]} />
        </mesh>
      </group>
      {/* a larger, invisible target for fingers */}
      <mesh
        material={mats.hit}
        layers={MARK_LAYER}
        onClick={(e) => {
          if (visRef.current[index] < 0.5) return // round the back: let the click through
          e.stopPropagation()
          onToggle(spot.id)
        }}
        onPointerOver={(e) => {
          if (visRef.current[index] < 0.5) return
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <circleGeometry args={[0.24, 24]} />
      </mesh>
    </Billboard>
  )
}

function Card({ spot, color, visRef, index, onClose }) {
  const box = useRef()
  useFrame(() => {
    if (box.current) box.current.style.opacity = String(visRef.current[index])
  })
  return (
    <Html position={spot.pos.clone().addScaledVector(spot.normal, 0.07)} zIndexRange={[5, 0]}>
      <style>{`@keyframes hn-in{from{opacity:0;transform:translate(18px,-50%) scale(.94)}to{opacity:1;transform:translate(18px,-50%)}}@media (prefers-reduced-motion: reduce){.hn-card{animation:none!important}}`}</style>
      <div ref={box} style={{ pointerEvents: 'none' }}>
        <div
          className="hn-card"
          style={{ pointerEvents: 'auto', transform: 'translate(18px,-50%)', transformOrigin: 'left center', animation: 'hn-in .28s cubic-bezier(.2,.8,.2,1)', width: 220, padding: '12px 14px 13px', borderRadius: 12, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 10px 30px rgba(40,30,20,0.22), 0 1px 0 rgba(255,255,255,0.8) inset', color: '#2b2824' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: color, flex: 'none' }} />
            <span style={{ font: '600 12px/1.3 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', flex: 1 }}>{spot.title}</span>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{ border: 0, background: 'rgba(0,0,0,0.06)', width: 22, height: 22, borderRadius: 11, cursor: 'pointer', font: '500 13px/22px ui-monospace, Menlo, monospace', color: '#4f4a43', padding: 0 }}
            >
              ×
            </button>
          </div>
          <div style={{ font: '400 12px/1.5 system-ui, -apple-system, Segoe UI, sans-serif', color: '#4f4a43' }}>{spot.text}</div>
        </div>
      </div>
    </Html>
  )
}

function Scene({ fabricColor, accentColor, lightColor, hotspotColor, autoRotate, missRef }) {
  const [open, setOpen] = useState(null)
  const reduced = useMemo(reducedMotion, [])
  const { camera, controls, raycaster, size } = useThree()
  const speaker = useRef()
  const visRef = useRef(HOTSPOTS.map(() => 1))

  useEffect(() => {
    camera.layers.enable(MARK_LAYER)
    raycaster.layers.enable(MARK_LAYER)
  }, [camera, raycaster])
  useEffect(() => () => (document.body.style.cursor = ''), [])

  // camera tween: target, viewing direction (slerped, so it swings round the
  // speaker rather than through it) and distance
  const tw = useRef(null)
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), qi: new THREE.Quaternion(), dir: new THREE.Vector3(), ray: new THREE.Raycaster(), w: new THREE.Vector3() }), [])
  useEffect(() => {
    if (!controls) return
    const stop = () => (tw.current = null)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])
  const fitDist = (radius) => {
    const half = THREE.MathUtils.degToRad(FOV / 2)
    return (radius / Math.min(Math.tan(half), Math.tan(half) * (size.width / size.height))) * 1.1
  }
  const go = (target, dir, dist) => {
    if (!controls) return
    const t0 = controls.target.clone()
    const off = camera.position.clone().sub(t0)
    tw.current = { t0, t1: target.clone(), d0: off.length(), d1: dist, dir0: off.clone().normalize(), dir1: dir.clone().normalize(), k: reduced ? 1 : 0 }
  }

  const placed = useRef(false)
  useEffect(() => {
    if (placed.current || !controls) return
    placed.current = true
    camera.position.copy(CENTER).addScaledVector(n3(0.55, 0.42, 1), fitDist(1.9))
    controls.target.copy(CENTER)
    controls.update()
  }, [controls]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => {
    if (id === null && open === null) return
    if (id === null || id === open) {
      setOpen(null)
      if (controls) go(CENTER, camera.position.clone().sub(controls.target), fitDist(1.9))
      return
    }
    setOpen(id)
    const s = HOTSPOTS.find((h) => h.id === id)
    // face the hotspot: its normal, leaning towards the current side and up a
    // little, so top-facing spots are seen at an angle
    const cur = camera.position.clone().sub(controls ? controls.target : CENTER)
    cur.y = 0
    cur.normalize()
    const dir = s.normal.clone().addScaledVector(cur, 0.45).add(new THREE.Vector3(0, 0.3, 0))
    go(CENTER.clone().lerp(s.pos, 0.4), dir, fitDist(1.5))
  }
  const toggleRef = useRef(toggle)
  toggleRef.current = toggle
  missRef.current = () => toggleRef.current(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && toggleRef.current(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const t = tw.current
    if (t && controls) {
      t.k = Math.min(1, t.k + dt / 0.9)
      const e = easeInOut(t.k)
      controls.target.lerpVectors(t.t0, t.t1, e)
      tmp.q.setFromUnitVectors(t.dir0, t.dir1)
      tmp.qi.identity().slerp(tmp.q, e)
      tmp.dir.copy(t.dir0).applyQuaternion(tmp.qi)
      camera.position.copy(controls.target).addScaledVector(tmp.dir, THREE.MathUtils.lerp(t.d0, t.d1, e))
      controls.update()
      if (t.k >= 1) tw.current = null
    }
    // occlusion: is the speaker between the camera and each marker?
    if (!speaker.current) return
    HOTSPOTS.forEach((h, i) => {
      tmp.w.copy(h.pos).addScaledVector(h.normal, 0.07)
      const dist = tmp.w.distanceTo(camera.position)
      tmp.ray.set(camera.position, tmp.w.sub(camera.position).normalize())
      tmp.ray.far = dist
      const hidden = tmp.ray.intersectObject(speaker.current, true).length > 0
      const want = hidden ? 0 : 1
      visRef.current[i] = reduced ? want : visRef.current[i] + (want - visRef.current[i]) * (1 - Math.exp(-dt * 14))
    })
  })

  const openIdx = HOTSPOTS.findIndex((h) => h.id === open)
  return (
    <>
      <Speaker fabricColor={fabricColor} accentColor={accentColor} lightColor={lightColor} innerRef={speaker} />
      {HOTSPOTS.map((h, i) => (
        <Marker key={h.id} spot={h} index={i} color={hotspotColor} open={open === h.id} onToggle={toggle} visRef={visRef} />
      ))}
      {openIdx >= 0 && <Card key={open} spot={HOTSPOTS[openIdx]} index={openIdx} color={hotspotColor} visRef={visRef} onClose={() => toggle(null)} />}
      <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate && !open} autoRotateSpeed={0.6} minDistance={3} maxDistance={24} minPolarAngle={0.15} maxPolarAngle={1.5} />
    </>
  )
}

// fabricColor: the knit. accentColor: the top, foot and socket. lightColor:
// the light ring. hotspotColor: the markers. floorColor: the studio.
export default function HotspotNotes({ fabricColor = '#7d8a96', accentColor = '#e9e5dd', lightColor = '#7fd3ff', hotspotColor = '#ff5a36', floorColor = '#d9d4cb', autoRotate = false }) {
  const missRef = useRef(null)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [4, 4, 8], fov: FOV, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }} onPointerMissed={() => missRef.current?.()}>
        <color attach="background" args={[floorColor]} />
        <fog attach="fog" args={[floorColor, 16, 36]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
        <directionalLight position={[-5, 9, 6]} intensity={0.6} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={floorColor} roughness={0.9} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={8} resolution={512} blur={2.2} opacity={0.5} far={3} />
        <Scene fabricColor={fabricColor} accentColor={accentColor} lightColor={lightColor} hotspotColor={hotspotColor} autoRotate={autoRotate} missRef={missRef} />
      </Canvas>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', pointerEvents: 'none', font: '500 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', color: '#4f4a43' }}>
        Click a hotspot to read its note · Esc or click away to close
      </div>
    </div>
  )
}
