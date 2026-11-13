import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CASE, CASE_Y, SPLIT, SHELL, WELL, BUD, BUD_POINTS, phiAt, sectionAt, superBand, plate, ellipse, budGeometries } from './shapes.js'
import { createEarbudsAudio } from './audio.js'

// Wireless earbuds and their charging case.
//
// The lid turns on a hinge along the back edge. Three things act on it: a
// magnet that pulls it shut in the last few degrees, a spring detent that
// flips it open once it is lifted past about 20 degrees, and gravity (which
// closes it while its weight is in front of the hinge and opens it once past
// upright). A stop holds it at 110 degrees. Drag it, or click it.
//
// The buds sit in wells, stem down, held by magnets on charging pins. Take
// one out (lid open) and let go: it falls as a rigid body, bouncing off the
// floor and the case, and settles on its side. Bring it back near its own
// well and the magnet pulls it in. Docked buds charge from the case; loose
// ones drain.

const SPLIT_Y = CASE_Y + SPLIT // world height of the seam
const HINGE = { y: SPLIT_Y - 0.08, z: -(CASE.c - 0.14) } // the hinge pin, along x, buried in the back wall
const LID_MAX = 1.72 // just past upright, about 100 degrees
const GRAV = 420 // gravity for a dropped bud, in cm/s^2 (slowed from 980 for clarity)
// docked: stem straight down in its slot, the ear tip pointing to the middle of the case
const DOCK = (side) => ({ pos: new THREE.Vector3(side * (WELL.x + WELL.slotX + BUD.stemZ), SPLIT_Y - 0.2, 0), quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * Math.PI / 2) })

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

const tmp = { r: new THREE.Vector3(), wp: new THREE.Vector3(), vp: new THREE.Vector3(), c: new THREE.Vector3(), l: new THREE.Vector3(), n: new THREE.Vector3(), qi: new THREE.Quaternion(), dq: new THREE.Quaternion() }
const INV_M = 1
const INV_I = 4.5

function impulse(b, r, n, j) {
  b.v.addScaledVector(n, j * INV_M)
  tmp.c.crossVectors(r, n)
  b.w.addScaledVector(tmp.c, j * INV_I)
}

// one contact point against a surface with outward normal n, penetration pen
function contact(b, r, n, pen, mu) {
  const vp = tmp.vp.crossVectors(b.w, r).add(b.v)
  const vn = vp.dot(n)
  let hit = 0
  if (vn < 0) {
    hit = -vn
    const e = vn < -60 ? 0.3 : 0
    const jn = (-(1 + e) * vn) / (INV_M + INV_I * tmp.c.crossVectors(r, n).lengthSq())
    impulse(b, r, n, jn)
    vp.crossVectors(b.w, r).add(b.v)
    const vt = vp.addScaledVector(n, -vp.dot(n))
    const s = vt.length()
    if (s > 1e-6) {
      vt.divideScalar(s)
      const jt = Math.max(-mu * jn, -s / (INV_M + INV_I * tmp.c.crossVectors(r, vt).lengthSq()))
      impulse(b, r, vt, jt)
    }
  }
  return { hit, pen }
}

// the case as solid boxes for loose buds: the base, and the lid at its angle
function caseBoxes(lid) {
  const k = Math.cos(phiAt(SPLIT))
  return [
    { c: new THREE.Vector3(0, SPLIT_Y / 2, 0), h: new THREE.Vector3(CASE.a * 0.98, SPLIT_Y / 2, CASE.c * 0.96), q: new THREE.Quaternion() },
    (() => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -lid)
      const local = new THREE.Vector3(0, 0.55, -HINGE.z).applyQuaternion(q)
      return { c: new THREE.Vector3(0, HINGE.y, HINGE.z).add(local), h: new THREE.Vector3(CASE.a * k * 0.96, 0.58, CASE.c * k * 0.94), q }
    })(),
  ]
}

function Bud({ side, mats, geos, groupRef, onGrab }) {
  return (
    <group ref={groupRef} onPointerDown={onGrab}>
      <group scale={[side, 1, 1]}>
        <mesh geometry={geos.head} material={mats.white} castShadow />
        <mesh geometry={geos.stem} material={mats.white} castShadow />
        <mesh geometry={geos.tip} material={mats.silicone} castShadow />
        {/* the mesh grille behind the tip, a vent and two sensor dots on the outside */}
        {/* the mesh behind the tip */}
        <mesh geometry={geos.grille} material={mats.mesh} position={[0, geos.tipAt.y - 0.03, geos.tipAt.z + 0.05]} rotation-x={BUD.tipTilt} />
        {/* a small dark vent slot on the head's top, over on the outer side, and another at the back */}
        <mesh geometry={geos.vent} material={mats.black} position={[0, BUD.hy * 0.8, -BUD.hz * 0.58]} rotation={[-Math.PI / 2 + 0.72, 0, 0]} />
        <mesh geometry={geos.vent} material={mats.black} position={[0, BUD.hy * 0.2, -BUD.hz * 0.985]} rotation={[0, Math.PI, 0]} />
        {/* the skin sensor, on the inner face beside the tip */}
        <mesh geometry={geos.dot} material={mats.black} position={[0, BUD.hy * 0.52, BUD.hz * 0.6]} rotation={[-0.95, 0, 0]} />
        {/* the touch strip, set into the stem's forward face */}
        <mesh geometry={geos.touch} material={mats.touch} />
        {/* the stem's end: a metal ring round the bottom mic */}
        <mesh geometry={geos.ring} material={mats.steel} />
      </group>
    </group>
  )
}

// color: the plastic. tipColor: the silicone tips. lightColor: the status
// light when charged. open: the lid (two-way). sound: clicks and snaps.
export default function Earbuds({ color = '#f4f4f2', tipColor = '#dcdcdc', open: openProp = false, sound = false, onChange, onStatus }) {
  const [open, setOpen] = useTwoWay(openProp, 'open', onChange)
  const { camera, controls, raycaster, pointer } = useThree()
  const geos = useMemo(() => {
    const phiS = phiAt(SPLIT)
    const base = superBand(-Math.PI / 2, phiS)
    const lidOuter = superBand(phiS, Math.PI / 2)
    const outline = sectionAt(SPLIT)
    // the base's top: a flat deck with a well for each bud
    const holes = [-1, 1].map((s) => ellipse(s * WELL.x, 0, WELL.rx, WELL.rz, 48, true))
    const deck = plate(outline, holes, SPLIT)
    // the lid's underside: the same flat face, with a recess over each bud's head
    const lidRim = plate(outline, [-1, 1].map((s) => ellipse(s * WELL.x, 0, WELL.rx, WELL.rz, 48, false)), SPLIT, false)
    const lidInner = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    lidInner.scale(WELL.rx, 0.78, WELL.rz)
    lidInner.translate(0, SPLIT, 0)
    void SHELL
    // well: a shallow bowl and the stem's slot below it
    const bowl = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    bowl.scale(WELL.rx, WELL.depth, WELL.rz)
    const slot = new THREE.CylinderGeometry(WELL.slotR, WELL.slotR, WELL.slotDepth, 24, 1, false)
    slot.translate(0, -WELL.slotDepth / 2 - WELL.depth * 0.5, 0)
    // shift everything so the case's centre is at CASE_Y
    for (const g of [base, lidOuter, lidInner, deck, lidRim]) g.translate(0, CASE_Y, 0)
    // the lid's parts relative to the hinge
    for (const g of [lidOuter, lidInner, lidRim]) g.translate(0, -HINGE.y, -HINGE.z)
    // the seam where lid meets base: a fine dark line round the case
    const seamPts = outline.map(([x, z]) => new THREE.Vector3(x * 1.002, SPLIT + CASE_Y, z * 1.004))
    const seam = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts, true), 192, 0.012, 4, true)
    return { base, lidOuter, lidInner, deck, lidRim, bowl, slot, seam, ...budGeometries() }
  }, [])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose?.()), [geos])

  const mats = useMemo(
    () => ({
      white: new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
      inside: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.9), roughness: 0.6, side: THREE.BackSide }),
      deck: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.96), roughness: 0.5, side: THREE.DoubleSide }),
      well: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.82), roughness: 0.7, side: THREE.BackSide }),
      silicone: new THREE.MeshPhysicalMaterial({ color: tipColor, roughness: 0.75, sheen: 0.4, sheenColor: '#ffffff' }),
      mesh: new THREE.MeshStandardMaterial({ color: '#4a4c50', roughness: 0.6, metalness: 0.5 }),
      black: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.35 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.25 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d9a944', metalness: 1, roughness: 0.25 }),
      led: new THREE.MeshStandardMaterial({ color: '#202020', emissive: '#000000', emissiveIntensity: 2.5 }),
      touch: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.86), roughness: 0.55 }),
      seam: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.6 }),
    }),
    [color, tipColor],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  // ---- state ----
  const sim = useRef(null)
  if (!sim.current) {
    const mk = (side) => {
      const d = DOCK(side)
      return { side, state: 'docked', p: d.pos.clone(), q: d.quat.clone(), v: new THREE.Vector3(), w: new THREE.Vector3(), still: 0, charge: side < 0 ? 64 : 78 }
    }
    sim.current = { lid: openProp ? LID_MAX : 0, lidV: 0, buds: [mk(-1), mk(1)], caseCharge: 72, drag: null, lastStatus: 0, lidHeld: false }
  }
  const lidRef = useRef()
  const budRefs = [useRef(), useRef()]
  const audio = useRef(null)
  const live = useRef({})
  live.current = { open, sound, onStatus }
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (k, s) => {
    if (!live.current.sound) return
    audio.current ??= createEarbudsAudio()
    audio.current?.[k]?.(s)
  }

  // the open prop (and clicks) kick the lid open or shut; the mechanics do the rest
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const s = sim.current
    s.kick = performance.now()
    if (open && s.lid < 0.5 && s.lidV < 1) s.lidV = 6
    if (!open && s.lid > 0.3 && s.lidV > -1) s.lidV = -9
  }, [open])

  // ---- dragging ----
  const plane = useMemo(() => new THREE.Plane(), [])
  const hitP = useMemo(() => new THREE.Vector3(), [])
  const grabLid = (e) => {
    e.stopPropagation()
    sim.current.drag = { kind: 'lid', x: e.clientX, y: e.clientY, moved: false }
    if (controls) controls.enabled = false
  }
  const grabBud = (i) => (e) => {
    const s = sim.current
    const b = s.buds[i]
    // docked buds can only be lifted out with the lid well open
    if (b.state === 'docked' && s.lid < 1.2) return
    e.stopPropagation()
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), b.p)
    s.drag = { kind: 'bud', i, x: e.clientX, y: e.clientY, moved: false, off: b.p.clone().sub(e.point) }
    b.state = 'held'
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }
  useEffect(() => {
    const move = (e) => {
      const d = sim.current.drag
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true
    }
    const up = () => {
      const s = sim.current
      const d = s.drag
      if (!d) return
      if (d.kind === 'lid') {
        s.kick = performance.now()
        if (!d.moved) {
          // a click: kick it the other way; the magnet, detent and gravity do the rest
          const toOpen = s.lid < 0.5
          s.lidV = toOpen ? 6 : -9
          setOpen(toOpen)
        } else setOpen(s.lid > 0.6)
      } else {
        const b = s.buds[d.i]
        const dock = DOCK(b.side)
        // near its own well with the lid open: the magnet takes it
        if (s.lid > 1.0 && b.p.distanceTo(dock.pos) < 1.4) {
          b.state = 'docking'
        } else {
          b.state = 'loose'
          b.still = 0
          b.w.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)
        }
      }
      s.drag = null
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls]) // eslint-disable-line react-hooks/exhaustive-deps

  const lightCol = useMemo(() => ({ green: new THREE.Color('#2bd96b'), amber: new THREE.Color('#ffae2b'), off: new THREE.Color('#000000') }), [])
  const upright = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0.5, 0.15)), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    if (dt <= 1e-5) return
    const s = sim.current
    const d = s.drag
    raycaster.setFromCamera(pointer, camera)

    // ---- the lid ----
    if (d?.kind === 'lid' && d.moved) {
      // follow the pointer round the hinge
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, HINGE.y, HINGE.z))
      if (raycaster.ray.intersectPlane(plane, hitP)) {
        // shut, the lid's front points forward (+z) from the hinge; opening swings it up
        const t = THREE.MathUtils.clamp(Math.atan2(hitP.y - HINGE.y, hitP.z - HINGE.z), 0, LID_MAX)
        s.lidV += (60 * (t - s.lid) - 12 * s.lidV) * dt
      }
    } else {
      // magnet near shut, the detent spring past ~20 degrees, gravity, damping
      let tau = 0
      if (s.lid < 0.22) tau -= 40 * (0.22 - s.lid) + 3
      if (s.lid > 0.35) tau += 5
      const zc = -0.5 * Math.sin(s.lid) + 1.0 * Math.cos(s.lid) // the lid's weight in front of the hinge
      tau -= 4 * zc
      s.lidV += (tau - 2.2 * s.lidV) * dt * 2
    }
    s.lid += s.lidV * dt
    if (s.lid < 0) {
      if (s.lidV < -1.5) play('snap', Math.min(1, -s.lidV / 8))
      s.lid = 0
      s.lidV = s.lidV < -1.5 ? -s.lidV * 0.15 : 0
    }
    if (s.lid > LID_MAX) {
      if (s.lidV > 2) play('tick', 0.5)
      s.lid = LID_MAX
      s.lidV = -s.lidV * 0.2
    }
    if (lidRef.current) lidRef.current.rotation.x = -s.lid
    // keep the open prop in step with where the lid ends up
    const isOpen = s.lid > 1.2
    if (!d && isOpen !== live.current.open && Math.abs(s.lidV) < 0.05 && performance.now() - (s.kick ?? 0) > 700) setOpen(isOpen)

    // ---- the buds ----
    const boxes = caseBoxes(s.lid)
    s.buds.forEach((b, i) => {
      const dock = DOCK(b.side)
      if (b.state === 'held' && d?.kind === 'bud' && d.i === i) {
        if (raycaster.ray.intersectPlane(plane, hitP)) {
          const target = hitP.add(d.off)
          target.y = Math.max(target.y, 0.9)
          b.v.copy(target).sub(b.p).multiplyScalar(1 / Math.max(dt, 1e-3)).clampLength(0, 80)
          b.p.lerp(target, Math.min(1, dt * 20))
          b.q.slerp(upright, Math.min(1, dt * 6))
          b.w.set(0, 0, 0)
        }
      } else if (b.state === 'docking') {
        // pulled in by the magnet: ease onto the pins
        b.p.lerp(dock.pos, Math.min(1, dt * 9))
        b.q.slerp(dock.quat, Math.min(1, dt * 9))
        if (b.p.distanceTo(dock.pos) < 0.01) {
          b.p.copy(dock.pos)
          b.q.copy(dock.quat)
          b.state = 'docked'
          play('click', 1)
        }
      } else if (b.state === 'docked') {
        b.p.copy(dock.pos)
        b.q.copy(dock.quat)
      } else if (b.state === 'loose' && b.still < 0.6) {
        // a rigid body: gravity, then contacts with the floor and the case
        const N = 6
        const h = dt / N
        for (let k = 0; k < N; k++) {
          b.v.y -= GRAV * h
          b.p.addScaledVector(b.v, h)
          tmp.dq.set(b.w.x, b.w.y, b.w.z, 0).multiply(b.q)
          b.q.x += 0.5 * h * tmp.dq.x
          b.q.y += 0.5 * h * tmp.dq.y
          b.q.z += 0.5 * h * tmp.dq.z
          b.q.w += 0.5 * h * tmp.dq.w
          b.q.normalize()
          let loud = 0
          for (let pass = 0; pass < 2; pass++) {
            let push = new THREE.Vector3()
            for (const pt of BUD_POINTS) {
              const r = tmp.r.copy(pt).applyQuaternion(b.q)
              const wp = tmp.wp.copy(b.p).add(r)
              // floor
              if (wp.y < 0) {
                const c = contact(b, r, new THREE.Vector3(0, 1, 0), -wp.y, 0.5)
                loud = Math.max(loud, c.hit)
                push.y = Math.max(push.y, -wp.y)
              }
              // the case
              for (const box of boxes) {
                tmp.qi.copy(box.q).invert()
                const l = tmp.l.copy(wp).sub(box.c).applyQuaternion(tmp.qi)
                const px = box.h.x - Math.abs(l.x)
                const py = box.h.y - Math.abs(l.y)
                const pz = box.h.z - Math.abs(l.z)
                if (px <= 0 || py <= 0 || pz <= 0) continue
                const n = new THREE.Vector3()
                let pen
                if (px < py && px < pz) {
                  n.x = Math.sign(l.x)
                  pen = px
                } else if (py < pz) {
                  n.y = Math.sign(l.y)
                  pen = py
                } else {
                  n.z = Math.sign(l.z)
                  pen = pz
                }
                n.applyQuaternion(box.q)
                const c = contact(b, r, n, pen, 0.35)
                loud = Math.max(loud, c.hit)
                push.addScaledVector(n, pen * 0.5)
              }
            }
            b.p.add(push.multiplyScalar(0.8))
          }
          if (loud > 30) play('tap', loud / 200)
          b.v.multiplyScalar(1 - h * 0.3)
          b.w.multiplyScalar(1 - h * 1.2)
        }
        const slow = b.v.lengthSq() < 0.5 && b.w.lengthSq() < 0.3
        b.still = slow ? b.still + dt : 0
        if (b.still >= 0.6) {
          b.v.set(0, 0, 0)
          b.w.set(0, 0, 0)
        }
      }
      const g = budRefs[i].current
      if (g) {
        g.position.copy(b.p)
        g.quaternion.copy(b.q)
      }
    })
    // the two buds' heads keep apart
    const [L, R] = s.buds
    if (L.state === 'loose' || R.state === 'loose') {
      const dd = tmp.n.subVectors(L.p, R.p)
      const len = dd.length()
      if (len < 1.15 && len > 1e-4) {
        dd.multiplyScalar((1.15 - len) / len / 2)
        if (L.state === 'loose') L.p.add(dd)
        if (R.state === 'loose') R.p.sub(dd)
      }
    }

    // ---- charging and the status light ----
    for (const b of s.buds) {
      if (b.state === 'docked' && b.charge < 100 && s.caseCharge > 0) {
        b.charge = Math.min(100, b.charge + dt * 0.8)
        s.caseCharge = Math.max(0, s.caseCharge - dt * 0.25)
      } else if (b.state !== 'docked') b.charge = Math.max(0, b.charge - dt * 0.25)
    }
    const charging = s.buds.some((b) => b.state === 'docked' && b.charge < 99.5)
    const lit = s.lid > 0.4
    mats.led.emissive.copy(lit ? (charging ? lightCol.amber : lightCol.green) : lightCol.off)
    mats.led.color.set(lit ? '#ffffff' : '#222222')

    const now = state.clock.elapsedTime
    if (live.current.onStatus && now - s.lastStatus > 0.25) {
      s.lastStatus = now
      live.current.onStatus({
        lid: s.lid / LID_MAX,
        left: Math.round(L.charge),
        right: Math.round(R.charge),
        case: Math.round(s.caseCharge),
        leftIn: L.state === 'docked',
        rightIn: R.state === 'docked',
        charging,
      })
    }
  })

  const hover = {
    onPointerOver: (e) => {
      e.stopPropagation()
      document.body.style.cursor = 'grab'
    },
    onPointerOut: () => (document.body.style.cursor = ''),
  }

  return (
    <group>
      {/* the base: shell, deck, wells with their charging pins */}
      <group>
        <mesh geometry={geos.base} material={mats.white} castShadow receiveShadow />
        <mesh geometry={geos.deck} material={mats.deck} receiveShadow />
        <mesh geometry={geos.seam} material={mats.seam} />
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * WELL.x, SPLIT_Y, 0]}>
            <mesh geometry={geos.bowl} material={mats.well} />
            <mesh geometry={geos.slot} material={mats.well} position-x={sd * WELL.slotX} />
            {/* two gold pins at the foot of the slot, where the stem's contacts land */}
            {[-0.08, 0.08].map((z) => (
              <mesh key={z} material={mats.gold} position={[sd * WELL.slotX, -WELL.depth * 0.5 - WELL.slotDepth + 0.08, z]}>
                <cylinderGeometry args={[0.045, 0.045, 0.04, 12]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* status light on the front, USB-C port underneath, setup button at the back */}
        <mesh material={mats.led} position={[0, CASE_Y - 0.15, CASE.c + 0.002]}>
          <circleGeometry args={[0.07, 20]} />
        </mesh>
        <mesh material={mats.black} position={[0, 0.002, 0]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[0.9, 0.28]} />
        </mesh>
        <mesh material={mats.deck} position={[0, CASE_Y - 0.4, -CASE.c - 0.003]} rotation-y={Math.PI}>
          <circleGeometry args={[0.13, 24]} />
        </mesh>
      </group>

      {/* the lid, on its hinge */}
      <group position={[0, HINGE.y, HINGE.z]}>
        <group ref={lidRef}>
          <group onPointerDown={grabLid} {...hover}>
            <mesh geometry={geos.lidOuter} material={mats.white} castShadow />
            {[-1, 1].map((sd) => (
              <mesh key={sd} geometry={geos.lidInner} material={mats.well} position-x={sd * WELL.x} />
            ))}
            <mesh geometry={geos.lidRim} material={mats.deck} />
          </group>
        </group>
        {/* the hinge plate on the back, below the seam */}
        <mesh material={mats.deck} position={[0, -0.2, -0.17]}>
          <boxGeometry args={[1.5, 0.4, 0.04]} />
        </mesh>
        {/* the hinge knuckle */}
        <mesh material={mats.steel} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 1.3, 16]} />
        </mesh>
      </group>

      {/* the buds */}
      {[0, 1].map((i) => (
        <Bud key={i} side={i === 0 ? -1 : 1} mats={mats} geos={geos} groupRef={budRefs[i]} onGrab={grabBud(i)} />
      ))}
    </group>
  )
}
