import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createKnifeAudio } from './audio.js'

// A pocket multi-tool. 1 unit = 10 mm: the handle is 91 x 25 mm. It lies in
// the x/y plane facing +z, with the open edge of the handle on top (+y) and
// the backsprings along the bottom.
//
// Tools turn on two rivets, one near each end, and live in three layers
// separated by steel liners, so they never touch:
//   front layer:  main blade (left rivet)
//   middle layer: small blade (left rivet) and bottle opener (right rivet);
//                 closed, their tips stop 0.7 apart
//   back layer:   saw (right rivet)
// Every tool swings out through the open top edge, never down through the
// springs, and the long tools' sweep stops short of the other rivet.
const L = 9.1
const HH = 2.5
const END_R = 1.15
const PIV = { a: -3.5, b: 3.5, y: 0.15 }
const SCALE_T = 0.3
const LINER_T = 0.06
const SLOT = 0.14
const TOOL_T = 0.09
const TOTAL = SCALE_T * 2 + LINER_T * 4 + SLOT * 3
const zOfSlot = (i) => -TOTAL / 2 + SCALE_T + LINER_T + i * (SLOT + LINER_T) + SLOT / 2 // 0 back .. 2 front
const zOfLiner = (i) => -TOTAL / 2 + SCALE_T + i * (SLOT + LINER_T) + LINER_T / 2
const SPRING = { x0: -2.9, x1: 2.9, y0: -1.12, y1: -0.9 }
const STOPS = [0, 0.5, 1]

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

// A flat part of the given thickness, centred on z = 0.
function plate(shape, t, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: t - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  })
  g.translate(0, 0, -(t - bevel * 2) / 2)
  return g
}

// Every tool is drawn open and pointing along +x from its rivet at the origin,
// with its working edge down. A rivet hole goes through the round tang.
function startTang(s) {
  s.moveTo(0, -0.5)
  s.absarc(0, 0, 0.5, -Math.PI / 2, Math.PI / 2, true) // round the back of the tang
}
function rivetHole() {
  const h = new THREE.Path()
  h.absarc(0, 0, 0.13, 0, Math.PI * 2, false)
  return h
}
function bladeShape(len, k, style) {
  const s = new THREE.Shape()
  startTang(s)
  const top = 0.5 * k
  const edge = -0.62 * k
  if (style === 'clip') {
    s.lineTo(len * 0.58, top)
    s.lineTo(len * 0.72, top * 0.62) // the clip, cut down towards the point
    s.quadraticCurveTo(len * 0.9, top * 0.35, len, 0.02 * k)
  } else {
    s.lineTo(len * 0.62, top)
    s.quadraticCurveTo(len * 0.93, top * 0.95, len, 0.02 * k) // the spine drops to the point
  }
  s.quadraticCurveTo(len * 0.9, edge, len * 0.68, edge) // the belly
  s.lineTo(0.62, edge)
  s.lineTo(0.48, -0.47) // the ricasso, where the edge stops
  s.lineTo(0, -0.5)
  s.holes.push(rivetHole())
  return s
}
function openerShape() {
  const s = new THREE.Shape()
  startTang(s)
  s.lineTo(1.1, 0.42)
  s.lineTo(1.1, 0.1) // the hook's slot
  s.lineTo(1.45, 0.1)
  s.lineTo(1.62, 0.3)
  s.lineTo(1.78, 0.42)
  s.lineTo(2.45, 0.42)
  s.lineTo(2.9, 0.2) // a flat screwdriver at the tip
  s.lineTo(2.9, -0.2)
  s.lineTo(2.45, -0.42)
  s.lineTo(0.5, -0.42)
  s.lineTo(0, -0.5)
  s.holes.push(rivetHole())
  return s
}
function sawShape() {
  const s = new THREE.Shape()
  startTang(s)
  s.lineTo(5.4, 0.45)
  s.lineTo(6.0, 0.1)
  s.lineTo(6.0, -0.38)
  // teeth along the bottom, raked back towards the handle
  for (let x = 5.85; x > 0.8; x -= 0.22) {
    s.lineTo(x - 0.06, -0.52)
    s.lineTo(x - 0.22, -0.38)
  }
  s.lineTo(0.5, -0.45)
  s.lineTo(0, -0.5)
  s.holes.push(rivetHole())
  return s
}

// A wood grain for the wooden scales.
function woodTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 128 })
  const g = c.getContext('2d')
  g.fillStyle = '#7a4a2a'
  g.fillRect(0, 0, 512, 128)
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 128
    g.strokeStyle = Math.random() < 0.6 ? `rgba(40,20,8,${0.12 + Math.random() * 0.2})` : `rgba(190,130,80,${0.08 + Math.random() * 0.12})`
    g.lineWidth = 0.6 + Math.random() * 2
    g.beginPath()
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x / 70 + i) * 4)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.12, 0.35)
  return t
}

// Ribbing for the aluminium scales.
function ribTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 16, height: 128 })
  const g = c.getContext('2d')
  for (let y = 0; y < 128; y++) {
    const v = y % 16 < 8 ? 220 : 60
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 16, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 1.6)
  return t
}

// The tools: which rivet, which layer, how long.
const TOOLS = [
  { key: 'blade', end: 'a', slot: 2, len: 6.0 },
  { key: 'small', end: 'a', slot: 1, len: 3.4 },
  { key: 'opener', end: 'b', slot: 1, len: 2.9 },
  { key: 'saw', end: 'b', slot: 0, len: 6.0 },
]
const POSES = { closed: [0, 0, 0, 0], blade: [1, 0, 0, 0], all: [1, 1, 1, 1] }
export const KNIFE_POSES = Object.keys(POSES)

// Where the tips are, so the camera can keep everything in view.
export const knifeView = { minX: -L / 2, maxX: L / 2, maxY: HH / 2 }
const dirOf = (tool, o) => (tool.end === 'a' ? Math.PI * o : Math.PI * (1 - o)) // angle of the tool, 0 = +x

// pose: closed | blade | all, the tools the knife starts with open (and
// returns to when changed). Drag a tool to open it; let go and it snaps to
// closed, half open or open. Click a tool to flick it fully open or shut.
export default function Knife({
  pose = 'blade',
  bladeStyle = 'drop',
  scaleColor = '#b3202b',
  scaleFinish = 'gloss',
  steel = 'satin',
  sound = false,
}) {
  const { camera, controls } = useThree()
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)
  useCursor(hover || dragging, dragging ? 'grabbing' : 'grab')

  // ---- geometry ----
  const geo = useMemo(() => {
    const B = 0.09
    return {
      scale: plate(roundedRect(L - B * 2, HH - B * 2, END_R - B), SCALE_T, B),
      liner: plate(roundedRect(L - 0.12, HH - 0.12, END_R - 0.06), LINER_T),
      spring: new THREE.BoxGeometry(SPRING.x1 - SPRING.x0, SPRING.y1 - SPRING.y0, SLOT - 0.04),
      rivet: new THREE.CylinderGeometry(0.12, 0.12, TOTAL - 0.1, 16).rotateX(Math.PI / 2),
      head: new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2),
      opener: plate(openerShape(), TOOL_T, 0.012),
      saw: plate(sawShape(), TOOL_T, 0.012),
      nick: new THREE.BoxGeometry(0.42, 0.05, TOOL_T + 0.006),
    }
  }, [])
  const bladeGeo = useMemo(() => ({ blade: plate(bladeShape(6.0, 1, bladeStyle), TOOL_T, 0.012), small: plate(bladeShape(3.4, 0.72, bladeStyle), TOOL_T, 0.012) }), [bladeStyle])
  const tex = useMemo(() => ({ wood: woodTexture(), rib: ribTexture() }), [])
  const mats = useMemo(
    () => ({
      scale: new THREE.MeshPhysicalMaterial({ envMapIntensity: 1.1 }),
      steel: new THREE.MeshPhysicalMaterial({ metalness: 1, envMapIntensity: 1.4 }),
      liner: new THREE.MeshStandardMaterial({ color: '#aeb3b9', metalness: 1, roughness: 0.32 }),
      spring: new THREE.MeshStandardMaterial({ color: '#9ca1a8', metalness: 1, roughness: 0.4 }),
      nick: new THREE.MeshStandardMaterial({ color: '#2a2c30', metalness: 0.6, roughness: 0.6 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(bladeGeo).forEach((g) => g.dispose()), [bladeGeo])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(tex).forEach((t) => t.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, tex, mats],
  )
  useEffect(() => {
    const s = mats.scale
    s.map = scaleFinish === 'wood' ? tex.wood : null
    s.bumpMap = scaleFinish === 'aluminium' ? tex.rib : null
    s.bumpScale = 1.5
    s.color.set(scaleFinish === 'wood' ? '#ffffff' : scaleColor)
    s.metalness = scaleFinish === 'aluminium' ? 1 : 0
    s.roughness = scaleFinish === 'gloss' ? 0.3 : scaleFinish === 'matte' ? 0.8 : scaleFinish === 'wood' ? 0.55 : 0.35
    s.clearcoat = scaleFinish === 'gloss' ? 1 : scaleFinish === 'wood' ? 0.4 : 0
    s.clearcoatRoughness = 0.12
    s.needsUpdate = true
    const st = mats.steel
    st.color.set(steel === 'black' ? '#2b2c30' : '#d3d6db')
    st.roughness = steel === 'polished' ? 0.1 : steel === 'black' ? 0.42 : 0.3
    st.metalness = steel === 'black' ? 0.7 : 1
  }, [mats, tex, scaleColor, scaleFinish, steel])

  // ---- sound ----
  const audio = useRef(null)
  const soundOn = useRef(sound)
  soundOn.current = sound
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, arg) => {
    if (!soundOn.current) return
    if (!audio.current) audio.current = createKnifeAudio()
    audio.current?.[name](arg)
  }

  // ---- tool state: how open each one is, on a spring towards its target ----
  const st = useRef(TOOLS.map((_, i) => ({ o: POSES[pose]?.[i] ?? 0, v: 0, target: POSES[pose]?.[i] ?? 0, settled: true })))
  useEffect(() => {
    const p = POSES[pose] || POSES.closed
    st.current.forEach((t, i) => {
      t.target = p[i]
      t.settled = false
    })
  }, [pose])
  const toolRefs = useRef([])
  const rootRef = useRef()
  const grab = useRef({ i: -1, start: 0, ang: 0, moved: false })
  const plane = useMemo(() => new THREE.Plane(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const up = () => {
      const g = grab.current
      if (g.i < 0) return
      const t = st.current[g.i]
      // a click flicks it fully open or shut; a drag snaps to the nearest stop
      t.target = g.moved ? STOPS.reduce((a, b) => (Math.abs(b - t.o) < Math.abs(a - t.o) ? b : a)) : g.start > 0.5 ? 0 : 1
      t.settled = false
      t.v = 0
      g.i = -1
      setDragging(false)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  // the pointer's angle round a tool's rivet, in the knife's own plane
  const angleAt = (i, worldPoint) => {
    const p = rootRef.current.worldToLocal(worldPoint.clone())
    const px = TOOLS[i].end === 'a' ? PIV.a : PIV.b
    return Math.atan2(p.y - PIV.y, p.x - px)
  }
  const startGrab = (i, e) => {
    e.stopPropagation()
    grab.current = { i, start: st.current[i].o, ang: angleAt(i, e.point), moved: false }
    setDragging(true)
    if (controls) controls.enabled = false
  }
  const onDown = (i) => (e) => startGrab(i, e)
  // Closed tools sit right inside the handle, so pressing near either end of
  // the handle takes hold of the first closed tool at that end, front layer first.
  const onHandleDown = (e) => {
    const p = rootRef.current.worldToLocal(e.point.clone())
    const end = p.x < 0 ? 'a' : 'b'
    const pick = TOOLS.map((t, i) => ({ t, i }))
      .filter(({ t, i }) => t.end === end && st.current[i].o < 0.5)
      .sort((x, y) => y.t.slot - x.t.slot)[0]
    if (pick) startGrab(pick.i, e)
  }

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const g = grab.current
    const root = rootRef.current

    // dragging: the tool points at the pointer, measured round its rivet
    if (g.i >= 0) {
      const tool = TOOLS[g.i]
      root.updateMatrixWorld()
      normal.set(0, 0, 1).transformDirection(root.matrixWorld)
      hit.setFromMatrixPosition(root.matrixWorld)
      plane.setFromNormalAndCoplanarPoint(normal, hit)
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        // follow the pointer's turn round the rivet since the press, so a
        // tool never jumps: anticlockwise opens the left tools, clockwise the right
        const ang = angleAt(g.i, hit)
        const turn = Math.atan2(Math.sin(ang - g.ang), Math.cos(ang - g.ang))
        const o = Math.min(1, Math.max(0, g.start + (tool.end === 'a' ? turn : -turn) / Math.PI))
        const t = st.current[g.i]
        t.o += (o - t.o) * Math.min(1, dt * 20)
        t.v = 0
        t.target = t.o
        if (Math.abs(t.o - g.start) > 0.04) g.moved = true
      }
    }

    // springs; a snap when a tool lands on a stop
    let minX = -L / 2
    let maxX = L / 2
    let maxY = HH / 2
    st.current.forEach((t, i) => {
      if (g.i !== i) {
        t.v += ((t.target - t.o) * 90 - t.v * 11) * dt
        t.o += t.v * dt
        if (t.o < 0) {
          t.o = 0
          t.v = 0
        }
        if (t.o > 1) {
          t.o = 1
          t.v = 0
        }
        if (!t.settled && Math.abs(t.o - t.target) < 0.012) {
          t.settled = true
          if (t.target === 0.5) play('detent')
          else play('snap', 1)
        }
      }
      const tool = TOOLS[i]
      const grp = toolRefs.current[i]
      if (grp) grp.rotation.z = tool.end === 'a' ? -Math.PI * (1 - t.o) : Math.PI * (1 - t.o)
      // where its tip is, for framing
      const a = dirOf(tool, t.o)
      const px = tool.end === 'a' ? PIV.a : PIV.b
      const tx = px + tool.len * Math.cos(a)
      const ty = PIV.y + tool.len * Math.sin(a)
      minX = Math.min(minX, tx)
      maxX = Math.max(maxX, tx)
      maxY = Math.max(maxY, ty)
    })
    knifeView.minX = minX
    knifeView.maxX = maxX
    knifeView.maxY = maxY
    root.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.06
  })

  const toolGeo = { blade: bladeGeo.blade, small: bladeGeo.small, opener: geo.opener, saw: geo.saw }

  return (
    <group ref={rootRef}>
      {/* scales, outside */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={geo.scale}
          material={mats.scale}
          position={[0, 0, s * (TOTAL / 2 - SCALE_T / 2)]}
          castShadow
          receiveShadow
          onPointerDown={onHandleDown}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
          }}
          onPointerOut={() => setHover(false)}
        />
      ))}
      {/* steel liners between the tool layers */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geo.liner} material={mats.liner} position={[0, 0, zOfLiner(i)]} />
      ))}
      {/* a backspring along the bottom of each layer */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={geo.spring} material={mats.spring} position={[(SPRING.x0 + SPRING.x1) / 2, (SPRING.y0 + SPRING.y1) / 2, zOfSlot(i)]} />
      ))}
      {/* the two rivets, with domed heads on both scales */}
      {[PIV.a, PIV.b].map((x) => (
        <group key={x} position={[x, PIV.y, 0]}>
          <mesh geometry={geo.rivet} material={mats.steel} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.head} material={mats.steel} position={[0, 0, s * (TOTAL / 2 - 0.02)]} scale={[1, 1, 0.35]} rotation={[s < 0 ? Math.PI : 0, 0, 0]} />
          ))}
        </group>
      ))}

      {/* the tools */}
      {TOOLS.map((tool, i) => (
        <group key={tool.key} position={[tool.end === 'a' ? PIV.a : PIV.b, PIV.y, zOfSlot(tool.slot)]}>
          <group ref={(el) => (toolRefs.current[i] = el)}>
            {/* tools on the left rivet are mirrored so they open to the left */}
            <group scale={[tool.end === 'a' ? -1 : 1, 1, 1]}>
              <mesh
                geometry={toolGeo[tool.key]}
                material={mats.steel}
                castShadow
                onPointerDown={onDown(i)}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  setHover(true)
                }}
                onPointerOut={() => setHover(false)}
              />
              {/* the nail nick on the blades */}
              {(tool.key === 'blade' || tool.key === 'small') && <mesh geometry={geo.nick} material={mats.nick} position={[tool.key === 'blade' ? 1.3 : 0.95, tool.key === 'blade' ? 0.3 : 0.2, 0]} rotation={[0, 0, 0.12]} />}
            </group>
          </group>
        </group>
      ))}
    </group>
  )
}
