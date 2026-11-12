import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { simulate, setStiffness, pair } from './cloth.js'
import { buildShirt, bodyAt, arm, ARM_R, OVERLAY, FABRICS, weaveTexture, torsoTexture, plainTexture, Y_TOP } from './pattern.js'

// A long-sleeve button-up shirt on a ghost mannequin, simulated as cloth.
//
// The torso is one sheet that wraps right round the body; its two front edges
// overlap as the placket. Each button is a constraint that holds the button
// side under the buttonhole side. Undo one and that stretch of the front is
// free: it falls open under gravity and the fabric's own spring. The sleeves
// are cloth tubes held at the armhole and the cuff, cut longer than the arm so
// they bunch. The fabric choice sets the weave, the sheen and how stiffly the
// cloth bends (linen creases softly, denim holds its shape).

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

const SUBSTEPS = 2

// the collar: a stand round the neck, folding over into a collar with points
// at the front; `open` spreads the two ends when the collar button is undone
function collarGeometry(open) {
  const A = 72
  const S = 14
  const a0 = 0.05 + 0.32 * open
  const a1 = Math.PI * 2 - 0.05 - 0.32 * open
  const pos = []
  const uv = []
  const rx = 0.19
  const rz = 0.17
  for (let j = 0; j <= S; j++) {
    const s = j / S
    for (let i = 0; i <= A; i++) {
      const a = a0 + ((a1 - a0) * i) / A
      const front = Math.max(0, Math.cos(a)) ** 2 // 1 at the points
      let y
      let grow
      if (s <= 0.42) {
        const t = s / 0.42
        y = Y_TOP - 0.005 + 0.08 * t
        grow = 0.012 * t
      } else {
        const t = (s - 0.42) / 0.58
        const lf = 0.085 + 0.06 * front
        y = Y_TOP + 0.075 + 0.012 * Math.sin(Math.PI * t) - lf * t * 0.78
        grow = 0.018 + lf * 0.55 * t
      }
      // the points sweep forward and down at the front
      const swing = s > 0.42 ? front * 0.1 * ((s - 0.42) / 0.58) * (a < Math.PI ? -1 : 1) : 0
      const aa = a + swing
      pos.push((rx + grow) * Math.sin(aa), y, (rz + grow) * Math.cos(aa))
      uv.push(i / A, s)
    }
  }
  const index = []
  for (let j = 0; j < S; j++)
    for (let i = 0; i < A; i++) {
      const a = j * (A + 1) + i
      const b = a + 1
      const c = a + A + 1
      const d = c + 1
      index.push(a, b, c, b, d, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  g.computeVertexNormals()
  return { g, a0 }
}

function Button({ color, onToggle, refCb }) {
  return (
    <group
      ref={refCb}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh castShadow>
        <cylinderGeometry args={[0.021, 0.021, 0.007, 24]} />
        <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.15} />
      </mesh>
      {/* the four holes and the thread through them */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([a, b], i) => (
        <mesh key={i} position={[a * 0.0055, 0.0036, b * 0.0055]}>
          <cylinderGeometry args={[0.0026, 0.0026, 0.002, 8]} />
          <meshStandardMaterial color={new THREE.Color(color).multiplyScalar(0.55)} roughness={0.8} />
        </mesh>
      ))}
      {/* a fatter invisible disc, easier to click */}
      <mesh>
        <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

// color, stitchColor, buttonColor: the colours. fabric: oxford | poplin |
// linen | denim. buttoned: all done up or not (click a button for just that
// one). memory: how strongly an undone front springs open. wind: a breeze.
export default function Shirt({
  color = '#9ec5ea',
  stitchColor = '#c9def3',
  buttonColor = '#b4d2f0',
  fabric = 'oxford',
  buttoned: buttonedProp = true,
  memory = 1,
  wind = false,
  onChange,
}) {
  const [allButtoned, setAllButtoned] = useTwoWay(buttonedProp, 'buttoned', onChange)
  const shirt = useMemo(() => buildShirt(), [])
  const { cloth, uv, TC, TR, SC, SR, torsoIndex, sleeveIndex, buttons, sleeves } = shirt
  // 0: collar button, 1..6: front buttons
  const [done, setDone] = useState(() => Array(7).fill(buttonedProp))
  useEffect(() => setDone(Array(7).fill(allButtoned)), [allButtoned])
  const toggle = (i) => {
    setDone((d) => {
      const n = d.slice()
      n[i] = !n[i]
      if (n.every((x) => x === n[0]) && n[0] !== allButtoned) setAllButtoned(n[0])
      return n
    })
  }
  const live = useRef({})
  live.current = { done, memory, wind, fabric }

  // fabric stiffness
  useEffect(() => {
    const f = FABRICS[fabric] ?? FABRICS.oxford
    setStiffness(cloth, 1, f.shear, f.bend)
  }, [cloth, fabric])

  // geometry: each piece's position buffer is a window onto the cloth's own array
  const geos = useMemo(() => {
    const make = (start, count, index) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(cloth.pos.subarray(start * 3, (start + count) * 3), 3))
      g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(start * 2, (start + count) * 2), 2))
      g.setIndex(index)
      g.computeVertexNormals()
      return g
    }
    const torso = make(0, TC * TR, torsoIndex)
    const sl = sleeves.map((s) => make(s.base, SC * SR, sleeveIndex))
    return { torso, sleeves: sl }
  }, [cloth, uv, TC, TR, SC, SR, torsoIndex, sleeveIndex, sleeves])
  useEffect(() => () => [geos.torso, ...geos.sleeves].forEach((g) => g.dispose()), [geos])

  // materials
  const weave = useMemo(() => weaveTexture(fabric), [fabric])
  const torsoTex = useMemo(() => torsoTexture(color, stitchColor, fabric), [color, stitchColor, fabric])
  const sleeveTex = useMemo(() => plainTexture(color, stitchColor, fabric, { seamU: 0.5, placket: true }), [color, stitchColor, fabric])
  const plainTex = useMemo(() => plainTexture(color, stitchColor, fabric), [color, stitchColor, fabric])
  const mats = useMemo(() => {
    const f = FABRICS[fabric] ?? FABRICS.oxford
    const bump = (rep) => {
      const t = weave.clone()
      t.repeat.set(rep[0], rep[1])
      t.needsUpdate = true
      return t
    }
    const outer = (map, rep) =>
      new THREE.MeshPhysicalMaterial({
        map,
        bumpMap: bump(rep),
        bumpScale: f.bump,
        roughness: f.rough,
        sheen: f.sheen,
        sheenRoughness: f.sheenRough,
        sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.3),
        side: THREE.FrontSide,
      })
    const inner = (map) => new THREE.MeshStandardMaterial({ map, color: '#c3c9d2', roughness: 0.95, side: THREE.BackSide })
    return {
      torso: outer(torsoTex, [170, 90]),
      torsoIn: inner(torsoTex),
      sleeve: outer(sleeveTex, [40, 70]),
      sleeveIn: inner(sleeveTex),
      plain: outer(plainTex, [60, 10]),
      plainIn: inner(plainTex),
      plainDouble: new THREE.MeshPhysicalMaterial({ map: plainTex, bumpMap: bump([50, 8]), bumpScale: f.bump, roughness: f.rough, sheen: f.sheen, sheenRoughness: f.sheenRough, side: THREE.DoubleSide }),
    }
  }, [weave, torsoTex, sleeveTex, plainTex, fabric, color])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => (m.bumpMap?.dispose(), m.dispose()))
    },
    [mats],
  )
  useEffect(() => () => [weave, torsoTex, sleeveTex, plainTex].forEach((t) => t.dispose()), [weave, torsoTex, sleeveTex, plainTex])

  // collar (rebuilt as it opens and closes)
  const collar = useRef({ open: buttonedProp ? 0 : 1, geo: collarGeometry(buttonedProp ? 0 : 1) })
  const collarOut = useRef()
  const collarIn = useRef()
  useEffect(() => () => collar.current.geo.g.dispose(), [])

  // ---- body collisions: the mannequin's torso and arms ----
  const arms = useMemo(() => [arm(-1), arm(1)], [])
  const collide = useMemo(() => {
    const M = 0.008
    return (pos, inv) => {
      for (let i = 0; i < cloth.n; i++) {
        if (inv[i] === 0) continue
        const o = i * 3
        const x = pos[o]
        const y = pos[o + 1]
        const z = pos[o + 2]
        if (y < 1.45 && y > -0.4) {
          const [rx, rz] = bodyAt(y)
          const ax = rx + M
          const az = rz + M
          const d = Math.sqrt((x / ax) ** 2 + (z / az) ** 2)
          if (d < 1 && d > 1e-6) {
            pos[o] = x / d
            pos[o + 2] = z / d
          }
        }
        for (const A of arms) {
          // capsule from shoulder to wrist
          const px = pos[o] - A.S.x
          const py = pos[o + 1] - A.S.y
          const pz = pos[o + 2] - A.S.z
          let t = (px * A.dir.x + py * A.dir.y + pz * A.dir.z) / A.len
          t = Math.min(1, Math.max(0, t))
          const qx = px - A.dir.x * t * A.len
          const qy = py - A.dir.y * t * A.len
          const qz = pz - A.dir.z * t * A.len
          const r = ARM_R[0] + (ARM_R[1] - ARM_R[0]) * t + M
          const d = Math.sqrt(qx * qx + qy * qy + qz * qz)
          if (d < r && d > 1e-6) {
            const k = r / d
            pos[o] = A.S.x + A.dir.x * t * A.len + qx * k
            pos[o + 1] = A.S.y + A.dir.y * t * A.len + qy * k
            pos[o + 2] = A.S.z + A.dir.z * t * A.len + qz * k
          }
        }
      }
    }
  }, [cloth, arms])

  // grabbing the fabric
  const { camera, controls, raycaster, pointer } = useThree()
  const grab = useRef(null)
  const dragPlane = useMemo(() => new THREE.Plane(), [])
  const grabAt = (start, count) => (e) => {
    e.stopPropagation()
    let best = -1
    let bd = Infinity
    for (let i = start; i < start + count; i++) {
      if (cloth.inv[i] === 0) continue
      const d = (cloth.pos[i * 3] - e.point.x) ** 2 + (cloth.pos[i * 3 + 1] - e.point.y) ** 2 + (cloth.pos[i * 3 + 2] - e.point.z) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    if (best < 0) return
    const p = new THREE.Vector3(cloth.pos[best * 3], cloth.pos[best * 3 + 1], cloth.pos[best * 3 + 2])
    dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), p)
    grab.current = { i: best, target: p, from: p.clone() }
    cloth.inv[best] = 0
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }
  useEffect(() => {
    const up = () => {
      if (!grab.current) return
      cloth.inv[grab.current.i] = 1
      grab.current = null
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [cloth, controls])

  // button meshes
  const btnRefs = useRef([])
  const cuffBtn = useRef([])
  const openness = useRef(new Float32Array(TR))
  const tmpN = useMemo(() => new THREE.Vector3(), [])
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    if (dt <= 1e-5) return
    const w = live.current
    const t = state.clock.elapsedTime

    // how open each row of the front is: from its nearest button
    const op = openness.current
    for (let v = 0; v < TR; v++) {
      let near = 0
      for (let b = 1; b < buttons.length; b++) if (Math.abs(buttons[b].v - v) < Math.abs(buttons[near].v - v)) near = b
      const target = w.done[near + 1] ? 0 : 1
      op[v] += (target - op[v]) * Math.min(1, dt * 3)
    }

    // forces: the undone front springs open; a breeze
    const F = cloth.force
    F.fill(0)
    const fab = FABRICS[w.fabric] ?? FABRICS.oxford
    const spring = 3.5 * w.memory * (0.6 + fab.bend * 2) // stiffer cloth springs back further
    for (let v = 0; v < TR; v++) {
      const o = op[v]
      if (o < 0.01) continue
      for (let k = 0; k < 4; k++) {
        const fall = o * spring * (1 - k / 4)
        const ia = (v * TC + k) * 3 // button side: opens to the wearer's left (+x)
        const ib = (v * TC + (TC - 1 - k)) * 3 // buttonhole side: to the right (-x)
        F[ia] += fall
        F[ia + 2] += fall * 0.5
        F[ib] -= fall
        F[ib + 2] += fall * 0.5
      }
    }
    if (w.wind) {
      for (let i = 0; i < cloth.n; i++) {
        const y = cloth.pos[i * 3 + 1]
        const gust = 2.5 + 2 * Math.sin(t * 1.3 + y * 2.2) + Math.sin(t * 3.1 + i * 0.013)
        F[i * 3] += gust * 0.6
        F[i * 3 + 2] += gust
      }
    }

    // the grabbed particle follows the pointer
    if (grab.current) {
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(dragPlane, grab.current.target)) {
        // cloth can only be pulled so far from where it was taken hold of
        const off = grab.current.target.sub(grab.current.from)
        if (off.length() > 0.28) off.setLength(0.28)
        grab.current.target.copy(grab.current.from).add(off)
        const i = grab.current.i * 3
        cloth.pos[i] = cloth.prev[i] = grab.current.target.x
        cloth.pos[i + 1] = cloth.prev[i + 1] = grab.current.target.y
        cloth.pos[i + 2] = cloth.prev[i + 2] = grab.current.target.z
      }
    }

    const pos = cloth.pos
    const inv = cloth.inv
    const buttonsDone = buttons.map((_, b) => w.done[b + 1])
    const extra = () => {
      for (let b = 0; b < buttons.length; b++) if (buttonsDone[b]) pair(pos, buttons[b].button, inv[buttons[b].button], pos, buttons[b].hole, inv[buttons[b].hole], OVERLAY)
    }
    for (let s = 0; s < SUBSTEPS; s++) simulate(cloth, dt / SUBSTEPS, { iterations: 7, extra, collide })

    geos.torso.attributes.position.needsUpdate = true
    geos.torso.computeVertexNormals()
    geos.sleeves.forEach((g) => {
      g.attributes.position.needsUpdate = true
      g.computeVertexNormals()
    })

    // buttons ride on the button side of the placket, facing out
    const nrm = geos.torso.attributes.normal
    buttons.forEach((b, k) => {
      const g = btnRefs.current[k + 1]
      if (!g) return
      tmpN.fromBufferAttribute(nrm, b.button).normalize()
      const lift = w.done[k + 1] ? OVERLAY + 0.006 : 0.005
      g.position.set(pos[b.button * 3] + tmpN.x * lift, pos[b.button * 3 + 1] + tmpN.y * lift, pos[b.button * 3 + 2] + tmpN.z * lift)
      g.quaternion.setFromUnitVectors(Y, tmpN)
    })

    // the collar opens and closes with its button
    const c = collar.current
    const target = w.done[0] ? 0 : 1
    if (Math.abs(c.open - target) > 0.002) {
      c.open += (target - c.open) * Math.min(1, dt * 6)
      const next = collarGeometry(c.open)
      c.geo.g.dispose()
      c.geo = next
      if (collarOut.current) collarOut.current.geometry = next.g
      if (collarIn.current) collarIn.current.geometry = next.g
    }
    const cb = btnRefs.current[0]
    if (cb) {
      const a = c.geo.a0 + 0.035
      tmpN.set(Math.sin(a), 0, Math.cos(a))
      cb.position.set((0.19 + 0.012) * Math.sin(a) + tmpN.x * 0.006, Y_TOP + 0.04, (0.17 + 0.012) * Math.cos(a) + tmpN.z * 0.006)
      cb.quaternion.setFromUnitVectors(Y, tmpN)
    }
  })

  // cuffs: a band round each wrist, buttoned on the outside
  const cuffs = useMemo(
    () =>
      arms.map((A, k) => {
        const side = k === 0 ? -1 : 1
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A.dir)
        const centre = A.W.clone().addScaledVector(A.dir, -0.01) // the sleeve's end sits well inside it
        const out = new THREE.Vector3(0, 0, 1).cross(A.dir).multiplyScalar(side).normalize()
        const btn = centre.clone().addScaledVector(out, 0.098)
        const bq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out)
        return { q, centre, btn, bq }
      }),
    [arms],
  )

  return (
    <group>
      {/* torso */}
      <mesh geometry={geos.torso} material={mats.torso} castShadow receiveShadow onPointerDown={grabAt(0, TC * TR)} />
      <mesh geometry={geos.torso} material={mats.torsoIn} />
      {/* sleeves */}
      {geos.sleeves.map((g, k) => (
        <group key={k}>
          <mesh geometry={g} material={mats.sleeve} castShadow receiveShadow onPointerDown={grabAt(sleeves[k].base, SC * SR)} />
          <mesh geometry={g} material={mats.sleeveIn} />
        </group>
      ))}
      {/* collar */}
      <mesh ref={collarOut} geometry={collar.current.geo.g} material={mats.plain} castShadow />
      <mesh ref={collarIn} geometry={collar.current.geo.g} material={mats.plainIn} />
      {/* cuffs */}
      {cuffs.map((c, k) => (
        <group key={k}>
          <mesh position={c.centre} quaternion={c.q} material={mats.plainDouble} castShadow>
            <cylinderGeometry args={[0.095, 0.093, 0.13, 32, 1, true]} />
          </mesh>
          <group position={c.btn} quaternion={c.bq} ref={(g) => (cuffBtn.current[k] = g)}>
            <mesh>
              <cylinderGeometry args={[0.018, 0.018, 0.006, 20]} />
              <meshPhysicalMaterial color={buttonColor} roughness={0.25} clearcoat={0.8} />
            </mesh>
          </group>
        </group>
      ))}
      {/* buttons */}
      {Array.from({ length: 7 }, (_, i) => (
        <Button key={i} color={buttonColor} onToggle={() => toggle(i)} refCb={(g) => (btnRefs.current[i] = g)} />
      ))}
    </group>
  )
}
