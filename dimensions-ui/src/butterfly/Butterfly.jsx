import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { outlines, wingGeometry, wingTexture } from './wings.js'
import { createButterflyAudio } from './audio.js'

// Frame: the butterfly's body runs along +x (head forward), +y is up and +z
// is its right side. Wings hinge on the side of the thorax and flap about the
// body axis; 0 is flat out, positive is raised.

// The flower: a coneflower whose domed centre the butterfly stands on.
const DISK_R = 0.55
const DISK_H = 0.19 // height of the dome above its rim
const DISK_TOP = 3.0 // world y of the top of the dome
const RIM_Y = DISK_TOP - DISK_H
const PERCH_H = 0.26 // body axis above the dome top when perched
const PERCH_Y = DISK_TOP + PERCH_H
// Height of the dome at a distance r from the stem.
const domeY = (r) => RIM_Y + DISK_H * Math.sqrt(Math.max(0, 1 - (r / DISK_R) ** 2))

const HINGE = { y: 0.04, z: 0.08 } // inside the thorax, so the wing roots never show a gap
const FLAP_MAX = 1.42 // wings up over the back (the two sides stay apart)
const FLAP_DOWN = -0.55 // bottom of a wingbeat in open air
const NEAR_R = 3.0 // inside this radius of the stem, close to the flower...
const NEAR_H = 0.8 // ...and below this height over the perch, wingbeats stay shallow
// (shallow beats never dip below the body, so they clear the petals). Outside
// NEAR_R a full downstroke reaches 1.5 in from the body, still outside the
// petals as long as the body stays above LOW.
const LOW = PERCH_Y - 0.2
const WANDER_R = 3.4

const BODY = {
  monarch: '#1a1512',
  morpho: '#1c1712',
  swallowtail: '#16130f',
  peacock: '#2a1712',
  'cabbage white': '#4a4a44',
  glasswing: '#2b1d14',
}

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

const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 6, false)

function Wings({ species, side }) {
  const parts = useMemo(() => {
    const o = outlines(species)
    const glass = species === 'glasswing'
    const make = (outline, kind) => {
      const geo = wingGeometry(outline)
      const map = wingTexture(outline, kind, species)
      const opts = {
        map,
        side: THREE.DoubleSide,
        roughness: species === 'morpho' ? 0.32 : 0.62,
        metalness: 0,
        transparent: glass,
        depthWrite: !glass,
        alphaTest: glass ? 0 : 0.5,
        // the hindwing sits just under the forewing where they overlap
        polygonOffset: kind === 'hind',
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }
      const mat = species === 'morpho'
        ? new THREE.MeshPhysicalMaterial({ ...opts, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [250, 600], clearcoat: 0.4 })
        : new THREE.MeshStandardMaterial(opts)
      return { geo, mat, map }
    }
    return { fore: make(o.fore, 'fore'), hind: make(o.hind, 'hind') }
  }, [species])
  useEffect(
    () => () => {
      for (const p of [parts.fore, parts.hind]) {
        p.geo.dispose()
        p.mat.dispose()
        p.map.dispose()
      }
    },
    [parts],
  )
  // Fore and hind wing ride on one hinge, as real butterflies couple them, so
  // the pair moves as one surface and never passes through itself.
  return (
    <group scale={[1, 1, side]}>
      <group position={[0, HINGE.y, HINGE.z]}>
        <mesh geometry={parts.fore.geo} material={parts.fore.mat} castShadow renderOrder={2} />
        <mesh geometry={parts.hind.geo} material={parts.hind.mat} position-y={-0.004} castShadow renderOrder={1} />
      </group>
    </group>
  )
}

function Body({ color, legsRef, antennaRefs }) {
  const g = useMemo(() => {
    // abdomen: a lathe along -x with a ripple for the segments
    const prof = []
    const L = 0.86
    for (let i = 0; i <= 48; i++) {
      const t = i / 48
      const r = 0.078 * (1 - 0.82 * t ** 1.7) * (1 + 0.07 * Math.cos(t * Math.PI * 2 * 7))
      prof.push(new THREE.Vector2(i === 48 ? 0.001 : r, t * L))
    }
    prof.unshift(new THREE.Vector2(0.001, 0))
    const abdomen = new THREE.LatheGeometry(prof, 24)

    // antennae: from the top of the head, out and forward, ending in a club
    const antenna = tube([[0, 0, 0], [0.18, 0.12, 0.04], [0.42, 0.3, 0.13], [0.62, 0.46, 0.22]], 0.008, 20)

    // proboscis: a coiled spring under the head
    const coil = []
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2 * 2.4
      const r = 0.055 * (1 - (i / 60) * 0.75)
      coil.push([Math.sin(a) * r, -Math.cos(a) * r - 0.0, 0])
    }
    const proboscis = tube(coil, 0.006, 80)

    // legs: root under the thorax, knee out to the side, foot on the dome
    const legs = [0.13, 0.02, -0.1].map((x, i) => {
      const reach = [0.12, 0.02, -0.12][i]
      const footX = x + reach
      const footZ = 0.36
      const footY = domeY(Math.hypot(footX, footZ)) - PERCH_Y
      return tube([[x, -0.08, 0.04], [x + reach * 0.5, -0.03, 0.2], [x + reach * 0.85, -0.06, 0.3], [footX, footY, footZ]], 0.011, 24)
    })
    return { abdomen, antenna, proboscis, legs }
  }, [])
  useEffect(() => () => [g.abdomen, g.antenna, g.proboscis, ...g.legs].forEach((x) => x.dispose()), [g])

  const fuzz = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }), [color])
  const eye = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.25, metalness: 0.1 }), [])
  useEffect(() => () => (fuzz.dispose(), eye.dispose()), [fuzz, eye])

  return (
    <group>
      {/* thorax */}
      <mesh scale={[0.24, 0.13, 0.11]} material={fuzz} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      {/* head and eyes */}
      <mesh position={[0.29, 0.01, 0]} material={fuzz} castShadow>
        <sphereGeometry args={[0.09, 20, 14]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.32, 0.03, 0.06 * s]} material={eye}>
          <sphereGeometry args={[0.062, 18, 12]} />
        </mesh>
      ))}
      {/* abdomen */}
      <mesh geometry={g.abdomen} material={fuzz} position={[-0.16, 0, 0]} rotation-z={Math.PI / 2} castShadow />
      {/* antennae, each with its club */}
      {[-1, 1].map((s, i) => (
        <group key={s} scale={[1, 1, s]} position={[0.34, 0.08, 0.025 * s]}>
          <group ref={(el) => (antennaRefs.current[i] = el)}>
            <mesh geometry={g.antenna} material={fuzz} />
            <mesh position={[0.62, 0.46, 0.22]} scale={[1.8, 1, 1]} rotation={[0, -0.34, 0.64]} material={fuzz}>
              <sphereGeometry args={[0.022, 12, 8]} />
            </mesh>
          </group>
        </group>
      ))}
      <mesh geometry={g.proboscis} material={fuzz} position={[0.37, -0.06, 0]} />
      {/* six legs; tucked in by scaling towards the body in flight */}
      {[-1, 1].map((s, i) => (
        <group key={s} scale={[1, 1, s]}>
          <group ref={(el) => (legsRef.current[i] = el)} position={[0, 0, 0.04]}>
            <group position={[0, 0, -0.04]}>
              {g.legs.map((geo, j) => (
                <mesh key={j} geometry={geo} material={fuzz} />
              ))}
            </group>
          </group>
        </group>
      ))}
    </group>
  )
}

function Flower({ petalColor, centerColor, onClick }) {
  const g = useMemo(() => {
    const stem = tube([[0, 0, 0], [0.12, 1.0, 0.05], [-0.05, 2.0, -0.04], [0, RIM_Y, 0]], 0.06, 40)
    // a petal: long, slightly cupped, rooted under the rim and drooping out
    const shape = new THREE.Shape()
    shape.moveTo(0, -0.05)
    shape.bezierCurveTo(0.16, -0.17, 1.1, -0.2, 1.45, 0)
    shape.bezierCurveTo(1.1, 0.2, 0.16, 0.17, 0, 0.05)
    const petal = new THREE.ShapeGeometry(shape, 16)
    const pos = petal.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const w = pos.getY(i)
      // lie flat (y -> z), cup across the width, droop more towards the tip
      pos.setXYZ(i, x, w * w * 1.2 - 0.12 * (x / 1.45) ** 2, w)
    }
    petal.computeVertexNormals()
    const leaf = new THREE.ShapeGeometry(
      (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.bezierCurveTo(0.3, 0.28, 0.9, 0.22, 1.3, 0)
        s.bezierCurveTo(0.9, -0.22, 0.3, -0.28, 0, 0)
        return s
      })(),
      12,
    )
    // the seed head: spiralled florets painted on the dome
    const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
    const x = c.getContext('2d')
    x.fillStyle = '#3a1e08'
    x.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 700; i++) {
      const r = Math.sqrt(i / 700) * 250
      const a = i * 2.39996
      x.fillStyle = `hsl(${22 + (i % 7)}, 70%, ${26 + (1 - r / 250) * 16}%)`
      x.beginPath()
      x.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 5.5, 0, Math.PI * 2)
      x.fill()
    }
    const seeds = new THREE.CanvasTexture(c)
    seeds.colorSpace = THREE.SRGBColorSpace
    // a dome with planar UVs from above, so the spiral sits on top
    const dome = new THREE.SphereGeometry(DISK_R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    dome.scale(1, DISK_H / DISK_R, 1)
    const dp = dome.attributes.position
    const uv = dome.attributes.uv
    for (let i = 0; i < dp.count; i++) uv.setXY(i, 0.5 + dp.getX(i) / (2 * DISK_R), 0.5 + dp.getZ(i) / (2 * DISK_R))
    return { stem, petal, leaf, seeds, dome }
  }, [])
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g])

  const N = 15
  return (
    <group onClick={onClick}>
      <mesh geometry={g.stem} castShadow>
        <meshStandardMaterial color="#4f7a2c" roughness={0.7} />
      </mesh>
      {/* leaves: rooted on the stem, angled up and twisted so the blade faces the sky */}
      {[
        [0.95, 0.4, 0.11],
        [1.7, -2.6, 0.0],
      ].map(([y, ry, x], i) => (
        <group key={i} position={[x, y, 0]} rotation-y={ry}>
          <mesh geometry={g.leaf} rotation={[0.9, 0, 0.45, 'ZYX']} castShadow>
            <meshStandardMaterial color="#5a8a32" roughness={0.65} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh geometry={g.dome} position-y={RIM_Y} castShadow>
        <meshStandardMaterial map={g.seeds} color={centerColor} roughness={0.9} />
      </mesh>
      {/* underside of the head, so the dome reads as solid from below */}
      <mesh position-y={RIM_Y - 0.03} scale={[1, 0.25, 1]}>
        <sphereGeometry args={[DISK_R * 0.98, 32, 12]} />
        <meshStandardMaterial color="#4f7a2c" roughness={0.8} />
      </mesh>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} rotation-y={(i / N) * Math.PI * 2 + (i % 2) * 0.08} position-y={RIM_Y - 0.01 * (i % 2)}>
          <mesh geometry={g.petal} position-x={DISK_R * 0.82} rotation-z={-0.42 - (i % 3) * 0.06} castShadow>
            <meshStandardMaterial color={petalColor} roughness={0.55} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// species: the wing pattern. petalColor, centerColor: the flower. speed: the
// wingbeat and flight pace. flying: click the butterfly to take off, click
// the flower (or the butterfly) to call it back to land. follow: in flight it
// follows the pointer at a distance. sound: a soft flutter per wingbeat.
export default function Butterfly({
  species = 'monarch',
  petalColor = '#d9568c',
  centerColor = '#ffffff',
  speed = 1,
  follow = true,
  flying: flyingProp = false,
  sound = false,
  onChange,
}) {
  const [flying, setFlying] = useTwoWay(flyingProp, 'flying', onChange)
  const root = useRef()
  const wingsRef = useRef()
  const legsRef = useRef([])
  const antennaRefs = useRef([])
  const { camera, raycaster } = useThree()
  const s = useRef({
    mode: flyingProp ? 'flying' : 'perched',
    p: new THREE.Vector3(0, flyingProp ? PERCH_Y + 1.6 : PERCH_Y, 0),
    v: new THREE.Vector3(),
    yaw: 0.6,
    yawRate: 0,
    roll: 0,
    pitch: 0,
    phase: 0,
    flap: 0.9,
    lo: FLAP_DOWN,
    t: 0,
    tuck: 0,
    lastMove: -10,
    ptr: new THREE.Vector2(0, 0),
  })
  const tmp = useMemo(() => ({ plane: new THREE.Plane(), hit: new THREE.Vector3(), n: new THREE.Vector3(), target: new THREE.Vector3(), want: new THREE.Vector3() }), [])
  const audio = useRef(null)
  useEffect(() => () => audio.current?.dispose(), [])

  // the flying prop drives take-off and landing
  useEffect(() => {
    const st = s.current
    if (flying && st.mode !== 'flying') {
      st.mode = 'flying'
      if (st.v.lengthSq() < 0.01) st.v.set(0, 1.2, 0)
    } else if (!flying && st.mode === 'flying') st.mode = 'landing'
  }, [flying])

  useFrame((state, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    st.t += dt
    const t = st.t
    const { p, v } = st

    // track pointer movement, for following
    if (!st.ptr.equals(state.pointer)) {
      st.ptr.copy(state.pointer)
      st.lastMove = t
    }

    const hd = Math.hypot(p.x, p.z)
    const h = p.y - PERCH_Y
    const near = hd < NEAR_R && h < NEAR_H
    let flapTarget

    if (st.mode === 'perched') {
      p.set(0, PERCH_Y, 0)
      v.set(0, 0, 0)
      // basking: slow opening and closing, with an occasional quick flick
      const flick = Math.max(0, Math.sin(t * 0.37) - 0.93) * 6
      flapTarget = 0.9 + 0.48 * Math.sin(t * 0.7 * speed) + flick
      st.flap += (Math.min(FLAP_MAX, flapTarget) - st.flap) * Math.min(1, dt * 4)
      st.roll += (0 - st.roll) * Math.min(1, dt * 4)
      st.pitch += (0 - st.pitch) * Math.min(1, dt * 4)
      st.tuck += (0 - st.tuck) * Math.min(1, dt * 5)
    } else {
      const T = tmp.target
      if (st.mode === 'landing') {
        // hover over the flower, then come straight down onto it
        if (hd > 0.12 || h > 1.2) T.set(0, PERCH_Y + 1.1, 0)
        else T.set(0, PERCH_Y, 0)
      } else if (near) {
        // climb clear of the petals while heading out
        const out = hd > 0.05 ? [p.x / hd, p.z / hd] : [Math.cos(st.yaw), -Math.sin(st.yaw)]
        T.set(p.x + out[0] * 1.5, PERCH_Y + NEAR_H + 0.3, p.z + out[1] * 1.5)
      } else if (follow && t - st.lastMove < 2.5 && Math.abs(state.pointer.x) < 1 && Math.abs(state.pointer.y) < 1) {
        // follow the pointer across a vertical plane through the flower, facing the camera
        tmp.n.set(camera.position.x, 0, camera.position.z).normalize()
        tmp.plane.setFromNormalAndCoplanarPoint(tmp.n, tmp.hit.set(0, PERCH_Y, 0))
        raycaster.setFromCamera(state.pointer, camera)
        if (raycaster.ray.intersectPlane(tmp.plane, T)) {
          T.y = THREE.MathUtils.clamp(T.y, 1.6, PERCH_Y + 1.8)
          const r = Math.hypot(T.x, T.z)
          if (r > 5) T.multiplyScalar(5 / r)
          if (r < NEAR_R + 0.2 && T.y < PERCH_Y + NEAR_H + 0.3) {
            // keep beside or above the flower, never in it
            const k = r > 0.01 ? (NEAR_R + 0.2) / r : 1
            if (r > 0.01) {
              T.x *= k
              T.z *= k
            } else T.y = PERCH_Y + NEAR_H + 0.5
          }
        } else T.set(3, PERCH_Y + 1, 0)
      } else {
        // wander in loose loops round the flower
        const w = t * 0.32 * speed
        T.set(Math.cos(w) * WANDER_R, LOW + 0.45 + 0.45 * Math.sin(t * 0.8), Math.sin(w) * WANDER_R)
      }

      const descending = st.mode === 'landing' && hd <= 0.12 && h <= 1.2
      const maxV = (descending ? 0.7 : 2.6) * speed
      tmp.want.subVectors(T, p).multiplyScalar(1.8)
      if (tmp.want.length() > maxV) tmp.want.setLength(maxV)
      v.x += (tmp.want.x - v.x) * Math.min(1, dt * 3)
      v.z += (tmp.want.z - v.z) * Math.min(1, dt * 3)
      v.y += (tmp.want.y - v.y) * Math.min(1, dt * 2)

      // wingbeat: shallow near the flower so the wings clear the petals
      const freq = 5.2 * speed
      const prevPhase = st.phase
      st.phase += dt * Math.PI * 2 * freq
      st.lo += ((near || descending ? 0.32 : FLAP_DOWN) - st.lo) * Math.min(1, dt * 6)
      const f = st.lo + (FLAP_MAX - st.lo) * (0.5 + 0.5 * Math.sin(st.phase))
      st.flap += (f - st.flap) * Math.min(1, dt * 30)
      // each downstroke lifts it, so it bobs as it flies
      const down = Math.max(0, -Math.cos(st.phase))
      v.y += (down * 2.2 - 0.7) * dt * (descending ? 0.3 : 1)
      if (sound && Math.floor((prevPhase - Math.PI / 2) / (Math.PI * 2)) !== Math.floor((st.phase - Math.PI / 2) / (Math.PI * 2))) {
        audio.current ??= createButterflyAudio()
        audio.current?.flutter(near ? 0.5 : 1)
      }

      p.addScaledVector(v, dt)
      // stay off the ground, in view, and out of the flower
      if (p.y < 1.5) {
        p.y = 1.5
        v.y = Math.max(v.y, 0)
      }
      const r = Math.hypot(p.x, p.z)
      if (r > 5.5) {
        p.x *= 5.5 / r
        p.z *= 5.5 / r
      }
      // never into the flower: above the dome and petals near it, above LOW further out
      if (!descending && r < 2.1 && p.y < PERCH_Y + 0.05) p.y = PERCH_Y + 0.05
      if (r >= 2.1 && p.y < LOW) {
        p.y = LOW
        v.y = Math.max(v.y, 0)
      }

      if (descending && Math.abs(h) < 0.03 && hd < 0.12) {
        st.mode = 'perched'
        p.set(0, PERCH_Y, 0)
      }

      // heading follows the horizontal velocity; bank into turns, pitch with climb
      const hs = Math.hypot(v.x, v.z)
      let rate = 0
      if (hs > 0.2) {
        let d = Math.atan2(-v.z, v.x) - st.yaw
        d = Math.atan2(Math.sin(d), Math.cos(d))
        rate = d * Math.min(4, 1 / dt) * 0.5
        st.yaw += d * Math.min(1, dt * 3)
      }
      st.yawRate += (rate - st.yawRate) * Math.min(1, dt * 4)
      st.roll += (THREE.MathUtils.clamp(-st.yawRate * 0.35, -0.5, 0.5) - st.roll) * Math.min(1, dt * 4)
      st.pitch += (THREE.MathUtils.clamp(v.y * 0.25, -0.35, 0.45) - st.pitch) * Math.min(1, dt * 4)
      st.tuck += (1 - st.tuck) * Math.min(1, dt * 5)
    }

    const g = root.current
    if (!g) return
    g.position.copy(p)
    g.rotation.set(st.roll, st.yaw, st.pitch, 'YZX')
    wingsRef.current?.children.forEach((side) => {
      const hinge = side.children[0]
      if (hinge) hinge.rotation.x = -st.flap
    })
    // legs fold in towards the body in flight, clear of the downstroke
    legsRef.current.forEach((l) => l && l.scale.set(1, 1 - st.tuck * 0.2, 1 - st.tuck * 0.65))
    antennaRefs.current.forEach((a, i) => {
      if (a) a.rotation.set(0, 0, 0.05 * Math.sin(t * 1.4 + i * 1.7) + st.tuck * 0.18)
    })
  })

  const toggle = (e) => {
    e.stopPropagation()
    setFlying(!flying)
  }
  const land = (e) => {
    e.stopPropagation()
    if (flying) setFlying(false)
  }
  const color = BODY[species] ?? BODY.monarch

  return (
    <group>
      <Flower petalColor={petalColor} centerColor={centerColor} onClick={land} />
      <group
        ref={root}
        onClick={toggle}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <Body color={color} legsRef={legsRef} antennaRefs={antennaRefs} />
        <group ref={wingsRef}>
          <Wings species={species} side={1} />
          <Wings species={species} side={-1} />
        </group>
      </group>
    </group>
  )
}
