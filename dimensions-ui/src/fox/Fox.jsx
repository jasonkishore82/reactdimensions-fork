import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { furMaterial, paint, shaped, smooth } from './fur.js'

// A fluffy fox kit holding a map, built entirely in code: every furry part is
// shell fur (see fur.js), the eyes are glossy painted spheres. It turns its
// head to follow the pointer anywhere on the page, eyes leading, and its fur
// trails a little as the head moves. Left alone it looks back down at its map,
// and it blinks, twitches its ears, sways its tail and breathes.
// 1 unit is roughly 10 cm; the fox is about 3.4 units tall.

const C = (hex) => new THREE.Color(hex)

// --- geometry for each furry part, painted with colour and fur length ---
function buildParts({ furColor, bellyColor, earColor, pawColor, furScale }) {
  const fur = C(furColor), belly = C(bellyColor), ear = C(earColor), paw = C(pawColor)
  const mix = (a, b, t) => a.clone().lerp(b, t)
  const L = (x) => x * furScale

  const head = shaped((v) => {
    // wide, slightly flattened head with fluffy cheek tufts low on the sides
    const k = smooth(0.15, -0.65, v.y) * smooth(0.2, 0.95, Math.abs(v.x))
    return [v.x * 0.93 + Math.sign(v.x) * 0.24 * k, v.y * 0.8 - 0.06 * k, v.z * 0.82]
  })
  paint(head, (p) => {
    const v = p.clone()
    // cream lower face and cheeks, orange crown and back of the head
    const low = smooth(0.0, -0.25, v.y - 0.12 * v.z) * smooth(-0.55, -0.05, v.z)
    const cheek = smooth(0.15, -0.55, v.y) * smooth(0.55, 0.95, Math.abs(v.x))
    return [mix(fur, belly, Math.max(low, cheek)), L(0.075 + 0.11 * cheek + 0.02 * smooth(0.4, 0.8, v.y))]
  })

  const muzzle = shaped((v) => [v.x * 0.3, v.y * 0.2, v.z * 0.26 + Math.max(0, v.z) * 0.06], 40, 30)
  paint(muzzle, () => [belly, L(0.035)])

  const body = shaped((v) => {
    const pear = 1 + 0.2 * Math.max(0, -v.y)
    return [v.x * 0.7 * pear, v.y * 0.86, v.z * 0.6 * pear]
  })
  paint(body, (p, n) => {
    const chest = smooth(0.15, 0.5, n.z) * (1 - smooth(0.55, 0.85, p.y))
    const ruff = smooth(0.3, 0.75, p.y) * smooth(0.0, 0.4, n.z)
    return [mix(fur, belly, Math.max(chest, ruff * 0.8)), L(0.09 + 0.08 * ruff)]
  })

  const thigh = shaped((v) => [v.x * 0.34, v.y * 0.36, v.z * 0.36], 48, 36)
  paint(thigh, () => [fur, L(0.08)])
  const foot = shaped((v) => [v.x * 0.21, v.y * 0.13, v.z * 0.29 + Math.max(0, v.z) * 0.04], 40, 28)
  paint(foot, (p) => [mix(fur, paw, 0.55 + 0.3 * smooth(0, 0.25, p.z)), L(0.045)])

  const arm = new THREE.CapsuleGeometry(0.15, 0.42, 10, 28)
  paint(arm, () => [fur, L(0.07)])
  const hand = shaped((v) => [v.x * 0.16, v.y * 0.15, v.z * 0.17], 36, 26)
  paint(hand, () => [mix(fur, paw, 0.5), L(0.045)])

  // ear: a flattened cone with a cupped, pale inside and longer inner tufts
  const earGeo = new THREE.ConeGeometry(0.33, 0.9, 48, 16, true)
  {
    const p = earGeo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const cup = z > 0 ? -0.55 * z * (1 - (y + 0.45) / 0.9) : 0
      p.setXYZ(i, x * 1.05, y, z * 0.5 + cup)
    }
    earGeo.computeVertexNormals()
  }
  paint(earGeo, (p, n) => {
    const inner = smooth(0.0, 0.35, n.z) * smooth(0.4, 0.2, p.y)
    return [mix(fur, ear, inner), L(0.04 + 0.08 * inner)]
  })

  // tail: a tube along a curve, swelling in the middle, with a cream tip
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.3, 0.42, -0.42), new THREE.Vector3(0.85, 0.55, -0.55), new THREE.Vector3(1.18, 1.0, -0.5),
    new THREE.Vector3(1.12, 1.55, -0.42), new THREE.Vector3(0.86, 1.86, -0.36),
  ])
  const SEG = 90, RAD = 32
  const tail = new THREE.TubeGeometry(path, SEG, 1, RAD, false)
  const prof = (t) => 0.1 + 0.36 * Math.pow(Math.sin(Math.PI * Math.min(0.97, t * 0.92 + 0.05)), 0.7)
  {
    const p = tail.attributes.position
    const c = new THREE.Vector3(), v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / (RAD + 1)) / SEG
      path.getPointAt(t, c)
      v.fromBufferAttribute(p, i).sub(c).multiplyScalar(prof(t)).add(c)
      p.setXYZ(i, v.x, v.y, v.z)
    }
    tail.computeVertexNormals()
  }
  paint(tail, (p, n, i) => {
    const t = Math.floor(i / (RAD + 1)) / SEG
    return [mix(fur, belly, smooth(0.7, 0.86, t)), L(0.15 + 0.04 * Math.sin(t * Math.PI))]
  })
  const tailTip = shaped((v) => [v.x * 0.15, v.y * 0.15, v.z * 0.15], 32, 24)
  paint(tailTip, () => [belly, L(0.12)])
  const tipAt = path.getPointAt(1)

  return { head, muzzle, body, thigh, foot, arm, hand, ear: earGeo, tail, tailTip, tipAt }
}

// --- the glossy eye: painted sclera, iris and big pupil, front at +z ---
function eyeTexture(irisColor) {
  const W = 1024, H = 512
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const c = cv.getContext('2d')
  const sclera = c.createLinearGradient(0, 0, 0, H)
  sclera.addColorStop(0, '#d9d2c8'); sclera.addColorStop(0.5, '#fbf8f2'); sclera.addColorStop(1, '#d9d2c8')
  c.fillStyle = sclera
  c.fillRect(0, 0, W, H)
  const cx = W * 0.25, cy = H * 0.5, R = 120 // the front of a SphereGeometry is at u = 0.25
  const iris = c.createRadialGradient(cx, cy, R * 0.35, cx, cy, R)
  const col = new THREE.Color(irisColor)
  const dark = '#' + col.clone().multiplyScalar(0.35).getHexString()
  const light = '#' + col.clone().lerp(new THREE.Color('#ffb36b'), 0.35).getHexString()
  iris.addColorStop(0, light); iris.addColorStop(0.7, '#' + col.getHexString()); iris.addColorStop(1, dark)
  c.fillStyle = iris
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill()
  // fibres in the iris
  c.strokeStyle = 'rgba(255,220,170,.18)'
  c.lineWidth = 2
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2
    c.beginPath(); c.moveTo(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5); c.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); c.stroke()
  }
  c.fillStyle = '#0b0605'
  c.beginPath(); c.arc(cx, cy, R * 0.52, 0, Math.PI * 2); c.fill()
  c.fillStyle = 'rgba(255,255,255,.95)'
  c.beginPath(); c.ellipse(cx - R * 0.3, cy - R * 0.32, R * 0.2, R * 0.16, -0.5, 0, Math.PI * 2); c.fill()
  c.fillStyle = 'rgba(255,255,255,.6)'
  c.beginPath(); c.arc(cx + R * 0.3, cy + R * 0.3, R * 0.07, 0, Math.PI * 2); c.fill()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// --- the map the fox is puzzling over ---
function mapTexture() {
  const W = 1024, H = 720
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const c = cv.getContext('2d')
  c.fillStyle = '#efe4c8'
  c.fillRect(0, 0, W, H)
  for (let i = 0; i < 2500; i++) {
    c.fillStyle = `rgba(120,95,60,${Math.random() * 0.06})`
    c.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  const blob = (x, y, r, col) => {
    c.fillStyle = col
    c.beginPath()
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) {
      const rr = r * (0.75 + 0.25 * Math.sin(a * 3 + x) + 0.1 * Math.cos(a * 5 + y))
      a === 0 ? c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    c.fill()
  }
  ;[[180, 160, 120], [430, 520, 150], [820, 180, 140], [700, 560, 90], [90, 560, 80]].forEach(([x, y, r]) => blob(x, y, r, 'rgba(160,185,125,.75)'))
  ;[[330, 120, 60], [890, 420, 70]].forEach(([x, y, r]) => blob(x, y, r, 'rgba(205,190,150,.8)'))
  // the lake
  c.fillStyle = '#86b8d8'
  c.beginPath(); c.moveTo(560, 330); c.bezierCurveTo(660, 260, 760, 300, 740, 380); c.bezierCurveTo(720, 470, 620, 430, 600, 500); c.bezierCurveTo(580, 560, 520, 520, 540, 450); c.bezierCurveTo(555, 400, 520, 370, 560, 330); c.fill()
  // contour lines
  c.strokeStyle = 'rgba(140,110,70,.35)'
  c.lineWidth = 2
  for (let r = 40; r < 130; r += 22) { c.beginPath(); c.ellipse(820, 180, r * 1.2, r * 0.8, 0.3, 0, Math.PI * 2); c.stroke() }
  // the dotted trail, ending at a red X
  c.setLineDash([14, 12])
  c.strokeStyle = '#6b4b2a'
  c.lineWidth = 6
  c.beginPath(); c.moveTo(60, 380); c.bezierCurveTo(200, 260, 260, 470, 380, 420); c.bezierCurveTo(470, 380, 430, 600, 300, 610); c.stroke()
  c.setLineDash([])
  c.strokeStyle = '#c8322c'
  c.lineWidth = 12
  c.lineCap = 'round'
  c.beginPath(); c.moveTo(270, 580); c.lineTo(330, 640); c.moveTo(330, 580); c.lineTo(270, 640); c.stroke()
  // the fold down the middle
  const g = c.createLinearGradient(W / 2 - 40, 0, W / 2 + 40, 0)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(90,70,40,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.fillRect(W / 2 - 40, 0, 80, H)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function halfPlane(w, h, left) {
  const g = new THREE.PlaneGeometry(w, h)
  g.translate(left ? -w / 2 : w / 2, 0, 0)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setX(i, left ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5)
  return g
}

function FurPart({ geometry, material, shells, ...props }) {
  return <instancedMesh args={[geometry, material, shells]} frustumCulled={false} {...props} />
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function Fox({
  furColor = '#e07a2e',
  bellyColor = '#f7efe3',
  earColor = '#f3d2c4',
  pawColor = '#9a4a1c',
  eyeColor = '#7a3a12',
  furLength = 1,
  quality = 'high',
  tracking = 'head + eyes',
}) {
  const { camera, gl } = useThree()
  const shells = quality === 'high' ? 40 : 24
  const parts = useMemo(() => buildParts({ furColor, bellyColor, earColor, pawColor, furScale: furLength }), [furColor, bellyColor, earColor, pawColor, furLength])
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose?.()), [parts])

  const mats = useMemo(() => {
    const m = {
      head: furMaterial({ shells, density: 78 }),
      body: furMaterial({ shells, density: 70 }),
      tail: furMaterial({ shells, density: 62 }),
      eye: new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 }),
      nose: new THREE.MeshPhysicalMaterial({ color: '#1a1210', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 }),
      mouth: new THREE.MeshStandardMaterial({ color: '#3a1712', roughness: 0.6 }),
      lid: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
      brow: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
      map: new THREE.MeshStandardMaterial({ map: mapTexture(), roughness: 0.85, side: THREE.DoubleSide }),
    }
    return m
  }, [shells])
  useEffect(() => {
    mats.eye.map?.dispose()
    mats.eye.map = eyeTexture(eyeColor)
    mats.eye.needsUpdate = true
  }, [mats, eyeColor])
  useEffect(() => {
    mats.lid.color.set(furColor).multiplyScalar(0.9)
    mats.brow.color.set(furColor).multiplyScalar(0.62)
  }, [mats, furColor])
  useEffect(() => () => {
    Object.values(mats).forEach((m) => { m.map?.dispose(); m.dispose() })
  }, [mats])

  const geo = useMemo(() => ({
    eye: new THREE.SphereGeometry(0.235, 48, 32),
    lid: new THREE.SphereGeometry(0.25, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    nose: new THREE.SphereGeometry(1, 32, 24),
    brow: new THREE.CapsuleGeometry(0.035, 0.2, 6, 12),
    mapL: halfPlane(0.62, 0.86, true),
    mapR: halfPlane(0.62, 0.86, false),
  }), [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  // --- pointer anywhere on the page ---
  const pointer = useRef({ x: 0, y: 0, active: false, last: -10 })
  useEffect(() => {
    const move = (e) => {
      const r = gl.domElement.getBoundingClientRect()
      pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.current.y = -((e.clientY - r.top) / r.height) * 2 + 1
      pointer.current.active = true
      pointer.current.last = performance.now() / 1000
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', move)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', move) }
  }, [gl])

  const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  const r = {
    root: useRef(), body: useRef(), headPivot: useRef(), eyeL: useRef(), eyeR: useRef(), lidL: useRef(), lidR: useRef(),
    earL: useRef(), earR: useRef(), tail: useRef(), map: useRef(), browL: useRef(), browR: useRef(),
  }
  const s = useRef({ yaw: 0, pitch: 0, yawV: 0, pitchV: 0, eyeYaw: 0, eyePitch: 0, blinkAt: 2, blink: 0, earAt: [3, 5], ear: [0, 0], t: 0, glanceAt: 6, glance: 0 })
  const tmp = useMemo(() => ({ ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.6), hit: new THREE.Vector3(), head: new THREE.Vector3(), v: new THREE.Vector2() }), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const st = s.current
    st.t += dt
    const now = performance.now() / 1000
    const idle = !pointer.current.active || now - pointer.current.last > 4

    // where to look: the pointer on a plane in front of the fox, or the map
    let yawT = 0, pitchT = -0.38, eyeYawT = 0, eyePitchT = -0.25
    if (!idle && tracking !== 'off') {
      tmp.ray.setFromCamera(tmp.v.set(pointer.current.x, pointer.current.y), camera)
      if (tmp.ray.ray.intersectPlane(tmp.plane, tmp.hit)) {
        r.headPivot.current.getWorldPosition(tmp.head)
        tmp.head.y += 0.45
        const d = tmp.hit.sub(tmp.head)
        const yaw = clamp(Math.atan2(d.x, d.z), -0.85, 0.85)
        const pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.5, 0.55)
        if (tracking === 'head + eyes') { yawT = yaw * 0.85; pitchT = pitch * 0.8 } else { yawT = 0; pitchT = -0.1 }
        eyeYawT = clamp(yaw - yawT, -0.45, 0.45) + yaw * 0.12
        eyePitchT = clamp(pitch - pitchT, -0.35, 0.35) + pitch * 0.1
      }
    } else if (!reduced) {
      // now and then, glance up from the map at the viewer
      if (st.t > st.glanceAt) { st.glance = 1.6; st.glanceAt = st.t + 6 + Math.random() * 5 }
      if (st.glance > 0) { st.glance -= dt; pitchT = 0.05; eyePitchT = 0.1; yawT = 0.08 }
    }

    // the head turns on a soft spring; small steps keep it stable
    const n = Math.ceil(dt / 0.005)
    const pyaw = st.yaw, ppitch = st.pitch
    for (let i = 0; i < n; i++) {
      const h = dt / n
      if (reduced) { st.yaw = yawT; st.pitch = pitchT; break }
      st.yawV += ((yawT - st.yaw) * 70 - st.yawV * 13) * h
      st.pitchV += ((pitchT - st.pitch) * 70 - st.pitchV * 13) * h
      st.yaw += st.yawV * h
      st.pitch += st.pitchV * h
    }
    const ease = 1 - Math.exp(-dt * 18) // eyes are quicker than the head
    st.eyeYaw += (eyeYawT - st.eyeYaw) * ease
    st.eyePitch += (eyePitchT - st.eyePitch) * ease

    const hp = r.headPivot.current
    hp.rotation.set(-st.pitch, st.yaw, -st.yaw * 0.14, 'YXZ')
    r.body.current.rotation.y = st.yaw * 0.16
    for (const e of [r.eyeL.current, r.eyeR.current]) e.rotation.set(-st.eyePitch, st.eyeYaw, 0, 'YXZ')

    // fur trails behind the head's motion
    const vy = (st.yaw - pyaw) / Math.max(dt, 1e-3), vp = (st.pitch - ppitch) / Math.max(dt, 1e-3)
    mats.head.uniforms.uLag.value.set(clamp(-vy * 0.12, -0.5, 0.5), clamp(-vp * 0.08, -0.4, 0.4), 0)

    // blinking, ears, tail, breathing
    if (!reduced && st.t > st.blinkAt) { st.blink = 1; st.blinkAt = st.t + 2.2 + Math.random() * 3.5 }
    st.blink = Math.max(0, st.blink - dt / 0.18)
    const b = Math.sin(st.blink * Math.PI)
    const lidRest = 0.25 + (idle ? 0.25 : 0) // heavier lids while reading the map
    r.lidL.current.rotation.x = lidRest + b * 1.35
    r.lidR.current.rotation.x = lidRest + b * 1.35
    const browLift = 0.04 + (idle ? 0 : 0.03)
    r.browL.current.position.y = 0.34 + browLift + b * 0.02
    r.browR.current.position.y = 0.34 + browLift + b * 0.02
    for (let i = 0; i < 2; i++) {
      if (!reduced && st.t > st.earAt[i]) { st.ear[i] = 1; st.earAt[i] = st.t + 3 + Math.random() * 5 }
      st.ear[i] = Math.max(0, st.ear[i] - dt / 0.35)
    }
    const tw = (k) => Math.sin(st.ear[k] * Math.PI) * 0.22
    r.earL.current.rotation.set(-0.12 - tw(0) * 0.5, 0.15, 0.42 + tw(0))
    r.earR.current.rotation.set(-0.12 - tw(1) * 0.5, -0.15, -0.42 - tw(1))
    const sway = reduced ? 0 : Math.sin(st.t * 1.3) * 0.1
    r.tail.current.rotation.y = sway
    mats.tail.uniforms.uLag.value.set(-Math.cos(st.t * 1.3) * 0.13 * (reduced ? 0 : 1), 0, 0)
    const breath = reduced ? 0 : Math.sin(st.t * 2.1) * 0.012
    r.body.current.scale.set(1 + breath * 0.6, 1 + breath, 1 + breath * 0.6)
    r.map.current.rotation.z = reduced ? 0 : Math.sin(st.t * 0.9) * 0.015
  })

  const P = parts
  return (
    <group ref={r.root}>
      <group ref={r.body}>
        <FurPart geometry={P.body} material={mats.body} shells={shells} position={[0, 0.95, 0]} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <FurPart geometry={P.thigh} material={mats.body} shells={shells} position={[sx * 0.4, 0.42, 0.08]} />
            <FurPart geometry={P.foot} material={mats.body} shells={shells} position={[sx * 0.37, 0.11, 0.4]} rotation-y={sx * -0.12} />
            <FurPart geometry={P.arm} material={mats.body} shells={shells} position={[sx * 0.5, 1.33, 0.52]} rotation={[1.05, 0, sx * 0.28]} />
            <FurPart geometry={P.hand} material={mats.body} shells={shells} position={[sx * 0.47, 1.18, 0.82]} />
          </group>
        ))}
        <group ref={r.tail} position={[0.3, 0.42, -0.42]}>
          <group position={[-0.3, -0.42, 0.42]}>
            <FurPart geometry={P.tail} material={mats.tail} shells={shells} />
            <FurPart geometry={P.tailTip} material={mats.tail} shells={shells} position={P.tipAt.toArray()} />
          </group>
        </group>
        {/* the map, folded open between the paws */}
        <group ref={r.map} position={[0, 1.2, 0.92]} rotation-x={-0.18}>
          <mesh geometry={geo.mapL} material={mats.map} rotation-y={0.28} />
          <mesh geometry={geo.mapR} material={mats.map} rotation-y={-0.28} />
        </group>

        {/* head on a neck pivot */}
        <group ref={r.headPivot} position={[0, 1.72, 0.02]}>
          <group position={[0, 0.5, 0.06]}>
            <FurPart geometry={P.head} material={mats.head} shells={shells} />
            <FurPart geometry={P.muzzle} material={mats.head} shells={shells} position={[0, -0.27, 0.66]} />
            <mesh geometry={geo.nose} material={mats.nose} position={[0, -0.18, 0.93]} scale={[0.085, 0.065, 0.07]} />
            <mesh geometry={geo.nose} material={mats.mouth} position={[0, -0.39, 0.89]} scale={[0.045, 0.055, 0.03]} />
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * 0.33, 0.07, 0.6]}>
                <mesh ref={sx < 0 ? r.eyeL : r.eyeR} geometry={geo.eye} material={mats.eye} />
                <mesh ref={sx < 0 ? r.lidL : r.lidR} geometry={geo.lid} material={mats.lid} />
              </group>
            ))}
            <mesh ref={r.browL} geometry={geo.brow} material={mats.brow} position={[-0.3, 0.38, 0.72]} rotation={[0.3, 0, 1.97]} />
            <mesh ref={r.browR} geometry={geo.brow} material={mats.brow} position={[0.3, 0.38, 0.72]} rotation={[0.3, 0, -1.97]} />
            <group ref={r.earL} position={[-0.5, 0.62, -0.1]}>
              <FurPart geometry={P.ear} material={mats.head} shells={shells} position-y={0.38} />
            </group>
            <group ref={r.earR} position={[0.5, 0.62, -0.1]}>
              <FurPart geometry={P.ear} material={mats.head} shells={shells} position-y={0.38} />
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
