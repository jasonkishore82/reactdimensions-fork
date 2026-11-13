import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  BLACK_LEN, CASE_FRONT, CHEEK, DAMPER_DEPTH, DAMPER_TOP, HALF, HAMMER_DEPTH, KEYBOARD_WIDTH, KEYS, KEY_Y,
  RIM_BOTTOM, RIM_TOP, STRINGS, STRING_Y, TAIL, WHITE_LEN, outlinePoints,
} from './layout.js'
import * as audio from './audio.js'

// A concert-style grand with a working action. Each key is a weighted lever:
// it lifts a hammer that escapes just before the string and flies the last
// few millimetres on its own, so how hard you hit the key decides how fast
// the hammer arrives and how loud the note is. The hammer bounces off, is
// caught by the backcheck while the key is held, and resets as the key comes
// up. Dampers lift off the strings while a key or the sustain pedal is down
// and stop the string when they land. The strings visibly ring. The three
// pedals work (soft shifts the whole action sideways, sostenuto holds only
// the dampers that were up), and the lid swings on its hinge onto the prop.

// ---- shapes -------------------------------------------------------------------

const shapeOf = (pts, path = new THREE.Shape()) => {
  pts.forEach(([x, d], i) => (i ? path.lineTo(x, d) : path.moveTo(x, d)))
  path.closePath()
  return path
}
// shapes are drawn in (x, depth); turned flat they become (x, -z), extruded up
const FLAT = [-Math.PI / 2, 0, 0]
const extrude = (shape, depth, bevel = 0) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 })

function caseGeometry() {
  const rim = shapeOf(outlinePoints(0))
  rim.holes.push(shapeOf(outlinePoints(2.6), new THREE.Path()))
  const veneer = shapeOf(outlinePoints(2.55))
  veneer.holes.push(shapeOf(outlinePoints(2.7), new THREE.Path()))
  // the iron plate: a frame round the edge with a solid band at the front for
  // the tuning pins, open over the soundboard
  const plate = shapeOf(outlinePoints(4.5))
  plate.holes.push(shapeOf(outlinePoints(12, HAMMER_DEPTH - 1.6), new THREE.Path()))
  return {
    rim: extrude(rim, RIM_TOP - RIM_BOTTOM - 0.6, 0.3),
    veneer: extrude(veneer, RIM_TOP - RIM_BOTTOM - 4),
    bottom: extrude(shapeOf(outlinePoints(0.8)), 2.5),
    soundboard: extrude(shapeOf(outlinePoints(2.6)), 0.8),
    plate: extrude(plate, 1.1, 0.25),
    lid: extrude(shapeOf(outlinePoints(-0.6)), 1.4, 0.35),
  }
}

// struts of the plate fanning back over the strings
const STRUTS = [
  [[-HALF + 22, 30], [-HALF + 30, 150]],
  [[-8, 30], [6, 140]],
  [[22, 30], [34, 112]],
]

// a black key: tapered sides and a sloped front
function blackKeyGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, -1.3)
  s.lineTo(BLACK_LEN, -1.3)
  s.lineTo(BLACK_LEN, 0.55)
  s.lineTo(BLACK_LEN - 0.9, 1.05)
  s.lineTo(0, 1.05)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelSize: 0.13, bevelThickness: 0.13, bevelSegments: 2 })
  // profile drawn in (length, height), extruded across the width
  g.rotateY(-Math.PI / 2)
  g.translate(0.5, 0, 0)
  // narrow the top so the sides taper
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + 1.3) / 2.35
    p.setX(i, p.getX(i) * (1 - 0.18 * t))
  }
  g.computeVertexNormals()
  return g // from z = 0 (back) to z = BLACK_LEN (front), x centred
}

// ---- the action's numbers ------------------------------------------------------

const PIVOT_DEPTH = 40 // keys pivot on the balance rail, hidden under the fallboard
const TRAVEL = 1.0 / PIVOT_DEPTH // ~1 cm of key dip at the front
const LET_OFF = 0.9 // key travel where the jack slips out from under the hammer
const CHECK_H = 0.55 // where the backcheck catches a falling hammer
const HAMMER_PIVOT = [74.6, -22] // flange y, z
const HAMMER_SWING = 0.18 // radians from rest to string
const WHITE_W_KEY = 2.21
const NO_DAMPER = KEYS.map((k) => k.midi > DAMPER_TOP)
const naturalDecay = (midi) => Math.max(0.6, 6.5 - (midi - 21) * 0.065)

// The prop stick, which follows the lid round so its tip stays under it.
// Its tip sits in a cup CONTACT cm along the lid from the hinge (measured
// along the tilted lid, so it's always on the lid however far it's open).
const LID_OPEN = 0.5
const HINGE_X = -HALF - 0.6
const STICK = [HALF - 3.4, RIM_TOP - 1.1, -46] // pivot, on a hinge block inside the rim, so it folds under the lid
const CONTACT = 122
const STICK_LEN = Math.hypot(
  STICK[0] - (HINGE_X + CONTACT * Math.cos(LID_OPEN)),
  RIM_TOP + CONTACT * Math.sin(LID_OPEN) - STICK[1],
)
function stickAngle(lid) {
  // how far the stick's tip is above (+) or below (-) the lid at angle a
  const f = (a) => STICK[1] + STICK_LEN * Math.cos(a) - (RIM_TOP + (STICK[0] - STICK_LEN * Math.sin(a) - HINGE_X) * Math.tan(lid))
  // swing it up from folded flat until the tip meets the lid
  const STEPS = 90
  let prev = Math.PI / 2
  let best = prev
  let bestF = -Infinity
  for (let i = 1; i <= STEPS; i++) {
    const a = (Math.PI / 2) * (1 - i / STEPS)
    const v = f(a)
    if (v >= 0) {
      let lo = a
      let hi = prev
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2
        if (f(m) >= 0) lo = m
        else hi = m
      }
      return hi
    }
    if (v > bestF) (bestF = v), (best = a)
    prev = a
  }
  // can't quite reach: as close as it gets
  return best
}
// the cup on the lid's underside goes where the tip lands when it's open
const CUP = (() => {
  const a = stickAngle(LID_OPEN)
  return [(STICK[0] - STICK_LEN * Math.sin(a) - HINGE_X) / Math.cos(LID_OPEN), 0]
})()

const DYN = [[16, 'ppp'], [33, 'pp'], [49, 'p'], [64, 'mp'], [80, 'mf'], [96, 'f'], [112, 'ff'], [128, 'fff']]
export const dynamic = (v) => DYN.find(([m]) => v < m)[1]

// ---- the piano ---------------------------------------------------------------

const Piano = forwardRef(function Piano({ lacquerColor = '#0c0c0e', woodColor = '#9a6a3c', plateColor = '#b48d3e', keyColor = '#f3eee2', sound = true, onNote, onState }, ref) {
  const controls = useThree((s) => s.controls)
  const geo = useMemo(() => {
    const white = new RoundedBoxGeometry(WHITE_W_KEY, 2.3, WHITE_LEN, 2, 0.14)
    return {
      ...caseGeometry(),
      white,
      black: blackKeyGeometry(),
      hammerHead: new RoundedBoxGeometry(1.05, 2.4, 1.7, 2, 0.35),
      shank: new THREE.BoxGeometry(0.3, 0.3, 12),
      felt: new THREE.BoxGeometry(1.1, 1.0, 2.6),
      damperHead: new THREE.BoxGeometry(1.0, 1.7, 1.9),
      string: new THREE.BoxGeometry(1, 1, 1),
      pin: new THREE.CylinderGeometry(0.32, 0.32, 1.8, 8),
      cheek: new RoundedBoxGeometry(CHEEK, 12, 19.6, 3, 0.9),
      fallboard: new RoundedBoxGeometry(KEYBOARD_WIDTH + 0.6, 7.6, 3.6, 3, 1.2),
      desk: new RoundedBoxGeometry(56, 20, 0.9, 2, 0.35),
      legTop: new RoundedBoxGeometry(10, 5, 10, 2, 0.8),
      lyreBox: new RoundedBoxGeometry(24, 7, 8, 2, 1.2),
      pedal: new RoundedBoxGeometry(3.2, 1.0, 11, 2, 0.4),
    }
  }, [])

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const mats = useMemo(() => {
    const lacquer = new THREE.MeshPhysicalMaterial({ color: lacquerColor, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 })
    const strings = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.9, roughness: 0.28 })
    strings.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aAmp;\nattribute float aRate;')
        .replace(
          '#include <begin_vertex>',
          // the string swings as its first mode: a half sine along its length
          '#include <begin_vertex>\ntransformed.x += aAmp * sin(3.14159 * (position.z + 0.5)) * sin(uTime * aRate);',
        )
    }
    strings.customProgramCacheKey = () => 'rd-piano-strings'
    return {
      lacquer,
      wood: new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.42 }),
      soundboard: new THREE.MeshStandardMaterial({ color: '#d8b47e', roughness: 0.55 }),
      plate: new THREE.MeshStandardMaterial({ color: plateColor, metalness: 0.75, roughness: 0.32 }),
      white: new THREE.MeshPhysicalMaterial({ color: keyColor, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.2 }),
      black: new THREE.MeshPhysicalMaterial({ color: '#111113', roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
      felt: new THREE.MeshStandardMaterial({ color: '#efe8d8', roughness: 0.95 }),
      darkFelt: new THREE.MeshStandardMaterial({ color: '#1b1a1c', roughness: 1 }),
      maple: new THREE.MeshStandardMaterial({ color: '#d9bc8c', roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.9, roughness: 0.3 }),
      brass: new THREE.MeshStandardMaterial({ color: '#caa24e', metalness: 0.95, roughness: 0.22 }),
      redFelt: new THREE.MeshStandardMaterial({ color: '#7a1f24', roughness: 1 }),
      strings,
    }
  }, [uniforms])

  useEffect(() => {
    mats.lacquer.color.set(lacquerColor)
    mats.wood.color.set(woodColor)
    mats.plate.color.set(plateColor)
    mats.white.color.set(keyColor)
  }, [mats, lacquerColor, woodColor, plateColor, keyColor])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, mats],
  )

  // ---- state for every key, held in plain arrays and stepped each frame ------
  const N = KEYS.length
  const s = useRef(null)
  if (!s.current)
    s.current = {
      held: new Float32Array(N), // how hard each key is being pressed (MIDI velocity), 0 = not
      a: new Float32Array(N), // key travel 0..1
      av: new Float32Array(N),
      h: new Float32Array(N), // hammer 0 (rest) .. 1 (on the string)
      hv: new Float32Array(N),
      hs: new Uint8Array(N), // hammer: 0 riding the jack, 1 in flight, 2 caught by the backcheck
      d: new Float32Array(N), // damper lift 0..1
      dv: new Float32Array(N),
      amp: new Float32Array(N), // how hard each string is ringing
      sounding: new Uint8Array(N),
      sost: new Uint8Array(N),
      pedal: { soft: 0, sost: 0, sustain: 0 },
      pedalPos: [0, 0, 0],
      shift: 0,
      lid: LID_OPEN,
      lidV: 0,
      lidMode: 'open',
      desk: 1,
      time: 0,
    }
  const soundRef = useRef(sound)
  soundRef.current = sound
  const cb = useRef({ onNote, onState })
  cb.current = { onNote, onState }

  const setPedal = (name, on) => {
    const st = s.current
    const v = on ? 1 : 0
    if (st.pedal[name] === v) return
    st.pedal[name] = v
    // the sostenuto pedal catches the dampers that are up right now
    if (name === 'sost') for (let i = 0; i < N; i++) st.sost[i] = on && st.a[i] > 0.4 && !NO_DAMPER[i] ? 1 : 0
    cb.current.onState?.({ ...st.pedal, lid: st.lidMode })
  }
  const toggleLid = () => {
    const st = s.current
    st.lidMode = st.lidMode === 'open' || st.lidMode === 'opening' ? 'closing' : 'opening'
    cb.current.onState?.({ ...st.pedal, lid: st.lidMode })
  }
  useImperativeHandle(ref, () => ({
    press: (i, vel = 90) => {
      if (i >= 0 && i < N) s.current.held[i] = Math.max(1, Math.min(127, vel))
    },
    release: (i) => {
      if (i >= 0 && i < N) s.current.held[i] = 0
    },
    releaseAll: () => s.current.held.fill(0),
    setPedal,
    toggleLid,
  }))

  // ---- meshes we drive each frame ------------------------------------------------
  const whiteRef = useRef()
  const blackRef = useRef()
  const headRef = useRef()
  const shankRef = useRef()
  const feltRef = useRef()
  const dheadRef = useRef()
  const stringRef = useRef()
  const lidRef = useRef()
  const stickRef = useRef()
  const deskRef = useRef()
  const pedalRefs = [useRef(), useRef(), useRef()]

  const WHITES = useMemo(() => KEYS.filter((k) => !k.black), [])
  const BLACKS = useMemo(() => KEYS.filter((k) => k.black), [])
  const DAMPED = useMemo(() => KEYS.filter((k) => !NO_DAMPER[k.i]), [])

  // per-string attributes for the vibration shader
  const stringAttrs = useMemo(() => {
    const amp = new THREE.InstancedBufferAttribute(new Float32Array(STRINGS.length), 1)
    const rate = new THREE.InstancedBufferAttribute(
      Float32Array.from(STRINGS, (st) => 40 + KEYS[st.note].midi * 0.9 + Math.random() * 6),
      1,
    )
    amp.setUsage(THREE.DynamicDrawUsage)
    geo.string.setAttribute('aAmp', amp)
    geo.string.setAttribute('aRate', rate)
    return { amp }
  }, [geo])

  // static instances: strings and tuning pins
  const pinRef = useRef()
  // Instanced parts move every frame, so three's cached bounds (worked out
  // once, on the first raycast) can be stale; if the pointer was over the
  // canvas before the first frame they'd say every key is at the origin and
  // no click would ever land. Give them fixed bounds round the whole piano.
  useEffect(() => {
    const all = new THREE.Sphere(new THREE.Vector3(0, 70, -85), 190)
    for (const r of [whiteRef, blackRef, headRef, shankRef, feltRef, dheadRef, stringRef, pinRef]) {
      if (!r.current) continue
      r.current.boundingSphere = all.clone()
      r.current.boundingBox = null
    }
  }, [])
  useEffect(() => {
    const m = new THREE.Object3D()
    const col = new THREE.Color()
    STRINGS.forEach((st, i) => {
      m.position.set(st.x, STRING_Y, -(st.front + st.back) / 2)
      m.rotation.set(0, 0, 0)
      m.scale.set(st.thick, st.thick, st.back - st.front)
      m.updateMatrix()
      stringRef.current.setMatrixAt(i, m.matrix)
      stringRef.current.setColorAt(i, col.set(st.wound ? '#b5743a' : '#d4d7dc'))
      m.position.set(st.x, 78.9, -(st.front - 0.4))
      m.scale.set(1, 1, 1)
      m.updateMatrix()
      pinRef.current.setMatrixAt(i, m.matrix)
    })
    stringRef.current.instanceMatrix.needsUpdate = true
    stringRef.current.instanceColor.needsUpdate = true
    pinRef.current.instanceMatrix.needsUpdate = true
  }, [])

  // ---- the physics -------------------------------------------------------------
  const m4 = useMemo(() => new THREE.Object3D(), [])
  const place = (mesh, idx, x, y, z, rx = 0) => {
    m4.position.set(x, y, z)
    m4.rotation.set(rx, 0, 0)
    m4.updateMatrix()
    mesh.setMatrixAt(idx, m4.matrix)
  }

  useFrame((_, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    st.time += dt
    uniforms.uTime.value = st.time
    const SUB = 4
    const h = dt / SUB
    for (let step = 0; step < SUB; step++) {
      for (let i = 0; i < N; i++) {
        // the key: pressed down by the finger, pushed back up by the weight of
        // the action, stopped by felt at both ends
        const vel = st.held[i]
        const push = vel > 0 ? 260 + 2600 * Math.pow(vel / 127, 1.6) : 0
        st.av[i] += (push - 140 - 60 * st.a[i] - 6 * st.av[i]) * h
        const a0 = st.a[i]
        const vKey = st.av[i] // before any bounce off the felt, for the hammer
        st.a[i] += st.av[i] * h
        if (st.a[i] > 1) {
          st.a[i] = 1
          if (st.av[i] > 0) st.av[i] *= -0.12
        } else if (st.a[i] < 0) {
          st.a[i] = 0
          if (st.av[i] < 0) st.av[i] *= -0.15
        }

        // the hammer
        const kin = (st.a[i] / LET_OFF) * 0.96
        if (st.hs[i] === 0) {
          st.h[i] = Math.min(kin, 0.96)
          st.hv[i] = (vKey / LET_OFF) * 0.96
          // let-off: the jack slips out and the hammer flies on by itself
          if (a0 < LET_OFF && st.a[i] >= LET_OFF && vKey > 0) st.hs[i] = 1
        } else {
          if (st.hs[i] === 1) {
            st.hv[i] -= 55 * h
            st.h[i] += st.hv[i] * h
            if (st.h[i] >= 1) {
              // it hits the string
              const v = Math.round(Math.min(127, Math.max(1, (127 * st.hv[i]) / 75)))
              st.h[i] = 1
              st.hv[i] *= -0.45
              const soft = st.shift > 0.15
              st.amp[i] = Math.max(st.amp[i], (v / 127) * (soft ? 0.7 : 1))
              st.sounding[i] = 1
              if (soundRef.current) audio.strike(KEYS[i].midi, v, { soft })
              cb.current.onNote?.(KEYS[i].midi, v)
            }
            // the backcheck catches it on the way down while the key is held
            if (st.hv[i] < 0 && st.h[i] <= CHECK_H && st.a[i] > 0.6) {
              st.hs[i] = 2
              st.h[i] = CHECK_H
              st.hv[i] = 0
            }
          } else if (st.a[i] < 0.6) st.hs[i] = 1 // key coming up frees it
          // back down onto the jack
          if (st.hs[i] !== 0 && st.h[i] <= kin && st.a[i] < LET_OFF) st.hs[i] = 0
        }

        // the damper: lifted by the key or the pedals, falls back by its weight
        if (NO_DAMPER[i]) {
          st.d[i] = 0
        } else {
          const up = st.a[i] > 0.45 || st.pedal.sustain > 0.5 || (st.sost[i] && st.pedal.sost)
          if (up) {
            st.d[i] += (1 - st.d[i]) * Math.min(1, h * 35)
            st.dv[i] = 0
          } else if (st.d[i] > 0) {
            st.dv[i] -= 140 * h
            st.d[i] += st.dv[i] * h
            if (st.d[i] <= 0) {
              st.d[i] = 0
              st.dv[i] = 0
              if (st.sounding[i]) {
                st.sounding[i] = 0
                audio.release(KEYS[i].midi)
              }
            }
          }
        }
        // the string rings down; much faster with the felt on it
        const damped = !NO_DAMPER[i] && st.d[i] < 0.05
        st.amp[i] *= Math.exp(-h / (damped ? 0.05 : naturalDecay(KEYS[i].midi)))
      }

      // pedals and the soft-pedal shift
      ;['soft', 'sost', 'sustain'].forEach((p, j) => {
        st.pedalPos[j] += (st.pedal[p] - st.pedalPos[j]) * Math.min(1, h * 25)
      })
      st.shift += (st.pedal.soft * 0.35 - st.shift) * Math.min(1, h * 14)

      // the lid
      if (st.lidMode === 'opening') {
        st.lidV += (40 * (LID_OPEN - st.lid) - 2 * 0.95 * Math.sqrt(40) * st.lidV) * h
        st.lid += st.lidV * h
        if (Math.abs(LID_OPEN - st.lid) < 0.002 && Math.abs(st.lidV) < 0.01) {
          st.lid = LID_OPEN
          st.lidV = 0
          st.lidMode = 'open'
          cb.current.onState?.({ ...st.pedal, lid: 'open' })
        }
      } else if (st.lidMode === 'closing') {
        // a heavy lid on a hinge: gravity, a little hinge friction
        st.lidV += (-11 * Math.cos(st.lid) - 0.9 * st.lidV) * h
        st.lid += st.lidV * h
        if (st.lid <= 0) {
          st.lid = 0
          const hit = -st.lidV
          if (hit > 0.35) {
            if (soundRef.current) audio.thud(Math.min(1, hit / 2.2))
            st.lidV = hit * 0.18
          } else {
            st.lidV = 0
            st.lidMode = 'closed'
            cb.current.onState?.({ ...st.pedal, lid: 'closed' })
          }
        }
      }
      // the music desk folds down before the lid can close on it
      const deskUp = st.lid > 0.22 ? 1 : 0
      st.desk += (deskUp - st.desk) * Math.min(1, h * (deskUp ? 6 : 14))
    }

    // ---- draw ----
    const sx = st.shift
    WHITES.forEach((k, j) => {
      const th = st.a[k.i] * TRAVEL
      const oz = PIVOT_DEPTH - WHITE_LEN / 2
      const oy = -1.15
      place(whiteRef.current, j, k.x + sx, KEY_Y + oy * Math.cos(th) - oz * Math.sin(th), -PIVOT_DEPTH + oy * Math.sin(th) + oz * Math.cos(th), th)
    })
    BLACKS.forEach((k, j) => {
      const th = st.a[k.i] * TRAVEL
      const oz = PIVOT_DEPTH - WHITE_LEN
      place(blackRef.current, j, k.x + sx, KEY_Y + 0.05 - oz * Math.sin(th), -PIVOT_DEPTH + oz * Math.cos(th), th)
    })
    const [py, pz] = HAMMER_PIVOT
    KEYS.forEach((k, i) => {
      const th = st.h[i] * HAMMER_SWING
      const x = k.x * 0.94 + sx
      // head: 12 cm back from the flange along the shank
      const hy = 2.1
      const hz = -12
      place(headRef.current, i, x, py + hy * Math.cos(th) - hz * Math.sin(th), pz + hy * Math.sin(th) + hz * Math.cos(th), th)
      const sy = 0.6
      const sz = -6
      place(shankRef.current, i, x, py + sy * Math.cos(th) - sz * Math.sin(th), pz + sy * Math.sin(th) + sz * Math.cos(th), th)
    })
    DAMPED.forEach((k, j) => {
      const lift = st.d[k.i] * 1.1
      const x = k.x * 0.94
      place(feltRef.current, j, x, STRING_Y + 0.62 + lift, -DAMPER_DEPTH)
      place(dheadRef.current, j, x, STRING_Y + 1.95 + lift, -DAMPER_DEPTH)
    })
    for (const m of [whiteRef, blackRef, headRef, shankRef, feltRef, dheadRef]) m.current.instanceMatrix.needsUpdate = true
    const amp = stringAttrs.amp.array
    STRINGS.forEach((str, i) => (amp[i] = (st.amp[str.note] * 0.16) / str.thick))
    stringAttrs.amp.needsUpdate = true

    lidRef.current.rotation.z = st.lid
    stickRef.current.rotation.z = stickAngle(st.lid)
    deskRef.current.rotation.x = -0.28 - (1 - st.desk) * (Math.PI / 2 - 0.3)
    pedalRefs.forEach((r, j) => (r.current.rotation.x = st.pedalPos[j] * 0.13))
  })

  // ---- pointer: play the keys by clicking or dragging across them ----------------
  const down = useRef(null) // key index under a held pointer
  const pressAt = (e, list) => {
    const k = list[e.instanceId]
    if (!k) return
    // further towards the front of the key = more leverage = louder
    const front = THREE.MathUtils.clamp(1 + e.point.z / (k.black ? WHITE_LEN : WHITE_LEN), 0, 1)
    const vel = Math.round(40 + front * 80)
    if (down.current !== null && down.current !== k.i) s.current.held[down.current] = 0
    down.current = k.i
    s.current.held[k.i] = vel
  }
  useEffect(() => {
    const up = () => {
      if (down.current !== null) s.current.held[down.current] = 0
      down.current = null
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])
  const keyEvents = (list) => ({
    onPointerDown: (e) => {
      e.stopPropagation()
      if (controls) controls.enabled = false
      pressAt(e, list)
    },
    onPointerMove: (e) => {
      if (down.current === null) return
      e.stopPropagation()
      if (list[e.instanceId]?.i !== down.current) pressAt(e, list)
    },
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = ''),
  })
  const pedalEvents = (name) => ({
    onPointerDown: (e) => {
      e.stopPropagation()
      if (controls) controls.enabled = false
      setPedal(name, true)
      const up = () => {
        setPedal(name, false)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointerup', up)
    },
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = ''),
  })

  const legs = [
    [-HALF + 9, -27],
    [HALF - 9, -27],
    [-HALF + 30, -(TAIL - 34)],
  ]
  const KW2 = KEYBOARD_WIDTH / 2
  return (
    <group>
      {/* the case */}
      <mesh geometry={geo.rim} material={mats.lacquer} position={[0, RIM_BOTTOM + 0.3, 0]} rotation={FLAT} castShadow receiveShadow />
      <mesh geometry={geo.veneer} material={mats.wood} position={[0, RIM_BOTTOM + 3.5, 0]} rotation={FLAT} />
      <mesh geometry={geo.bottom} material={mats.lacquer} position={[0, RIM_BOTTOM - 2.2, 0]} rotation={FLAT} castShadow />
      <mesh geometry={geo.soundboard} material={mats.soundboard} position={[0, 69, 0]} rotation={FLAT} receiveShadow />
      <mesh geometry={geo.plate} material={mats.plate} position={[0, 76.6, 0]} rotation={FLAT} castShadow receiveShadow />
      {STRUTS.map(([[x0, d0], [x1, d1]], i) => {
        const len = Math.hypot(x1 - x0, d1 - d0)
        return (
          <mesh key={i} material={mats.plate} position={[(x0 + x1) / 2, 77.6, -(d0 + d1) / 2]} rotation={[0, Math.atan2(x1 - x0, d1 - d0), 0]} castShadow>
            <boxGeometry args={[2.2, 1.6, len]} />
          </mesh>
        )
      })}
      {/* felt strip where the strings leave the pins */}
      <mesh material={mats.redFelt} position={[0, STRING_Y + 0.05, -(CASE_FRONT + 13.5)]}>
        <boxGeometry args={[KEYBOARD_WIDTH * 0.97, 0.5, 1.1]} />
      </mesh>
      <instancedMesh ref={stringRef} args={[geo.string, mats.strings, STRINGS.length]} frustumCulled={false} />
      <instancedMesh ref={pinRef} args={[geo.pin, mats.steel, STRINGS.length]} />

      {/* the action: hammers under the strings, dampers sitting on them */}
      <instancedMesh ref={headRef} args={[geo.hammerHead, mats.felt, KEYS.length]} frustumCulled={false} castShadow />
      <instancedMesh ref={shankRef} args={[geo.shank, mats.maple, KEYS.length]} frustumCulled={false} />
      <instancedMesh ref={feltRef} args={[geo.felt, mats.darkFelt, DAMPED.length]} frustumCulled={false} />
      <instancedMesh ref={dheadRef} args={[geo.damperHead, mats.maple, DAMPED.length]} frustumCulled={false} castShadow />

      {/* keyboard: keybed, key slip, cheeks, fallboard */}
      <mesh material={mats.lacquer} position={[0, KEY_Y - 4.6, -8]} castShadow receiveShadow>
        <boxGeometry args={[KEYBOARD_WIDTH + CHEEK * 2, 3.2, 18.5]} />
      </mesh>
      <mesh material={mats.lacquer} position={[0, KEY_Y - 2.6, 0.75]}>
        <boxGeometry args={[KEYBOARD_WIDTH + 0.4, 2.2, 1.0]} />
      </mesh>
      {[-1, 1].map((sgn) => (
        <mesh geometry={geo.cheek} key={sgn} material={mats.lacquer} position={[sgn * (KW2 + CHEEK / 2), KEY_Y + 0.4, -8.3]} castShadow />
      ))}
      <mesh geometry={geo.fallboard} material={mats.lacquer} position={[0, KEY_Y + 3.6, -CASE_FRONT + 0.4]} castShadow />
      <instancedMesh ref={whiteRef} args={[geo.white, mats.white, WHITES.length]} frustumCulled={false} castShadow receiveShadow {...keyEvents(WHITES)} />
      <instancedMesh ref={blackRef} args={[geo.black, mats.black, BLACKS.length]} frustumCulled={false} castShadow {...keyEvents(BLACKS)} />

      {/* music desk, pivoting on its bottom edge */}
      <group ref={deskRef} position={[0, RIM_TOP - 3.4, -(CASE_FRONT + 6)]}>
        <mesh geometry={geo.desk} material={mats.lacquer} position={[0, 10.5, 0]} castShadow />
        <mesh material={mats.lacquer} position={[0, 0.8, 1.6]} castShadow>
          <boxGeometry args={[56, 1.1, 2.8]} />
        </mesh>
      </group>

      {/* the lid, hinged along the straight (bass) side, and its prop stick */}
      <group ref={lidRef} position={[HINGE_X, RIM_TOP, 0]}>
        <mesh
          geometry={geo.lid}
          material={mats.lacquer}
          position={[-HINGE_X, 0, 0]}
          rotation={FLAT}
          castShadow
          onClick={(e) => {
            if (e.delta > 4) return
            e.stopPropagation()
            toggleLid()
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        />
        {/* the cup the stick's tip sits in */}
        <mesh material={mats.lacquer} position={[CUP[0], CUP[1] - 0.75, STICK[2]]}>
          <cylinderGeometry args={[1.5, 1.2, 1.1, 16]} />
        </mesh>
      </group>
      <mesh material={mats.brass} position={[HALF - 3.1, RIM_TOP - 1.6, STICK[2]]}>
        <boxGeometry args={[1.6, 1.8, 3.6]} />
      </mesh>
      <group ref={stickRef} position={STICK}>
        <mesh material={mats.lacquer} position={[0, STICK_LEN / 2, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.9, STICK_LEN, 12]} />
        </mesh>
      </group>

      {/* legs on brass casters */}
      {legs.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={geo.legTop} material={mats.lacquer} position={[0, RIM_BOTTOM - 4.5, 0]} castShadow />
          <mesh material={mats.lacquer} position={[0, (RIM_BOTTOM - 7 + 6) / 2, 0]} castShadow>
            <cylinderGeometry args={[4.2, 2.9, RIM_BOTTOM - 13, 28]} />
          </mesh>
          <mesh material={mats.brass} position={[0, 4.8, 0]}>
            <cylinderGeometry args={[3.0, 2.7, 2.6, 24]} />
          </mesh>
          <mesh material={mats.brass} position={[0, 2.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[2.2, 2.2, 2.6, 20]} />
          </mesh>
        </group>
      ))}

      {/* the lyre: two posts, the pedal box and three brass pedals */}
      <group position={[0, 0, -30]}>
        {[-6, 6].map((x) => (
          <mesh key={x} material={mats.lacquer} position={[x, 33, 0]} castShadow>
            <cylinderGeometry args={[1.0, 1.4, 50, 12]} />
          </mesh>
        ))}
        <mesh geometry={geo.lyreBox} material={mats.lacquer} position={[0, 6.5, 0]} castShadow />
        <mesh material={mats.lacquer} position={[0, RIM_BOTTOM - 3, 0]}>
          <boxGeometry args={[22, 3, 8]} />
        </mesh>
        {['soft', 'sost', 'sustain'].map((p, j) => (
          <group key={p} ref={pedalRefs[j]} position={[(j - 1) * 6.2, 6, 2]}>
            <mesh geometry={geo.pedal} material={mats.brass} position={[0, 0, 5.5]} castShadow {...pedalEvents(p)} />
          </group>
        ))}
      </group>
    </group>
  )
})


export default Piano
