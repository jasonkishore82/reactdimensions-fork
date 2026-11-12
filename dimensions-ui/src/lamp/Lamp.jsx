import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A balanced-arm desk lamp. 1 unit is about 10 cm. A weighted base carries a
// turret that turns; the turret's two plates hold the shoulder bolt; the lower
// arm (a pair of rods) runs to the elbow bolt, where the upper arm's wider pair
// of rods straddles it; the shade hangs on the head bolt between the upper
// rods. Two springs, anchored on the turret and the arms, stretch as the joints
// open. A real spotlight inside the shade lights the desk.
//
// Posing is two-link geometry: drag an arm and the head joint follows the
// pointer, the elbow found from the two arm lengths (elbow up, like the real
// thing), with the head kept above the desk and clear of the base.

const BASE_R = 1.3
const BASE_H = 0.3
const SHOULDER_Y = 0.85 // shoulder bolt height
const LOWER = 3.6
const UPPER = 3.4
const LOWER_Z = 0.11 // lower rods either side of the centre plane
const UPPER_Z = 0.2 // upper rods, outside the lower ones
const SHADE = { top: 0.36, mouth: 1.0, depth: 1.3 }
const LIMITS = { lower: [-0.7, 1.05], tiltMin: -0.45, tiltMax: 1.45 }

// Coils along +y, unit length: scaled along y to span between two anchors,
// so the coils open up as the spring stretches.
function helixGeometry(coils = 16, radius = 0.075, wire = 0.022) {
  const pts = []
  const n = coils * 16
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = t * coils * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t, Math.sin(a) * radius))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 6, false)
}

// Shoulder and elbow angles (from straight up, positive leaning forward) that
// put the head joint at (x, y) in the arm's plane.
function solve(x, y, L1, L2) {
  const px = x
  const py = y - SHOULDER_Y
  let d = Math.hypot(px, py)
  d = THREE.MathUtils.clamp(d, Math.abs(L1 - L2) + 0.3, L1 + L2 - 0.05)
  const phi = Math.atan2(px, py)
  const alpha = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
  const a1 = THREE.MathUtils.clamp(phi - alpha, LIMITS.lower[0], LIMITS.lower[1]) // elbow up and back
  const ex = L1 * Math.sin(a1)
  const ey = SHOULDER_Y + L1 * Math.cos(a1)
  const tx = ex + (x - ex) // aim the upper arm at the target from wherever the elbow ended up
  const ty = ey + (y - ey)
  const a2 = Math.atan2(tx - ex, ty - ey)
  return { a1, a2 }
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

// bodyColor: the paint. lightColor, brightness: the bulb. armLength: scales
// both arms. on: the light (click the switch on the base). Drag an arm to move
// the head, the shade to tilt it, the base to turn the lamp.
export default function Lamp({
  bodyColor = '#1f5f74',
  lightColor = '#ffd9a3',
  brightness = 0.8,
  armLength = 1,
  on: onProp = true,
  onChange,
}) {
  const [on, setOn] = useTwoWay(onProp, 'on', onChange)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(null)
  useCursor(hover || !!dragging, dragging ? 'grabbing' : 'grab')
  const { camera, controls } = useThree()
  const L1 = LOWER * armLength
  const L2 = UPPER * armLength

  const geo = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(BASE_R, BASE_R + 0.08, BASE_H, 64),
      baseTop: new THREE.CylinderGeometry(BASE_R - 0.15, BASE_R, 0.06, 64),
      turret: new THREE.CylinderGeometry(0.32, 0.36, 0.3, 32),
      plate: new THREE.BoxGeometry(0.42, 0.62, 0.04),
      lever: new THREE.BoxGeometry(0.5, 0.1, 0.1),
      bolt: new THREE.CylinderGeometry(0.07, 0.07, 1, 16).rotateX(Math.PI / 2),
      boltHead: new THREE.CylinderGeometry(0.11, 0.11, 0.05, 6).rotateX(Math.PI / 2),
      rod: new THREE.CylinderGeometry(0.045, 0.045, 1, 12).translate(0, 0.5, 0),
      spring: helixGeometry(),
      shade: new THREE.CylinderGeometry(SHADE.top, SHADE.mouth, SHADE.depth, 48, 1, true).translate(0, -SHADE.depth / 2 - 0.25, 0),
      shadeCap: new THREE.SphereGeometry(SHADE.top, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, -0.25, 0),
      shadeRim: new THREE.TorusGeometry(SHADE.mouth, 0.035, 8, 48).rotateX(Math.PI / 2).translate(0, -SHADE.depth - 0.25, 0),
      knuckle: new THREE.BoxGeometry(0.22, 0.3, 2 * UPPER_Z - 0.05),
      bulb: new THREE.SphereGeometry(0.22, 24, 16),
      socket: new THREE.CylinderGeometry(0.13, 0.13, 0.22, 16),
      button: new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24),
      tab: new THREE.BoxGeometry(1, 0.08, 0.02),
      // an invisible, fatter arm so it is easy to take hold of
      grip: new THREE.CylinderGeometry(0.3, 0.3, 1, 12).translate(0, 0.5, 0),
    }),
    [],
  )
  const cableGeo = useMemo(
    () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-BASE_R + 0.1, 0.12, 0), new THREE.Vector3(-BASE_R - 0.6, 0.04, 0.2), new THREE.Vector3(-4, 0.04, 1.4), new THREE.Vector3(-7, 0.04, 1.2)]), 64, 0.045, 8, false),
    [],
  )
  const mats = useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({ metalness: 0.3, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      inside: new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.5, side: THREE.BackSide }),
      chrome: new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: 0.2 }),
      steel: new THREE.MeshStandardMaterial({ color: '#8a9097', metalness: 0.9, roughness: 0.35 }),
      black: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.7 }),
      bulb: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffd9a3', emissiveIntensity: 0, roughness: 0.2 }),
      button: new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.45 }),
      grip: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  )
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      cableGeo.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, cableGeo, mats],
  )
  useEffect(() => {
    mats.paint.color.set(bodyColor)
    mats.bulb.emissive.set(lightColor)
  }, [mats, bodyColor, lightColor])

  // ---- pose ----
  const st = useRef({ yaw: 0.35, a1: -0.32, a2: 1.62, tilt: 0.55, light: onProp ? 1 : 0, press: 0 })
  const live = useRef({})
  live.current = { on, brightness, lightColor, L1, L2 }
  const drag = useRef(null) // { kind, x0, y0, yaw0, tilt0 }

  const yawRef = useRef()
  const lowerRef = useRef()
  const upperRef = useRef()
  const headRef = useRef()
  const spring1 = useRef()
  const spring2 = useRef()
  const lightRef = useRef()
  const targetRef = useRef()
  const buttonRef = useRef()
  useEffect(() => {
    lightRef.current.target = targetRef.current
  }, [])

  useEffect(() => {
    const up = () => {
      drag.current = null
      setDragging(null)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  const grab = (kind) => (e) => {
    e.stopPropagation()
    const s = st.current
    drag.current = { kind, x0: e.clientX, y0: e.clientY, yaw0: s.yaw, tilt0: s.tilt }
    setDragging(kind)
    if (controls) controls.enabled = false
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const s = st.current
    if (d.kind === 'base') s.yaw = d.yaw0 + (e.clientX - d.x0) * 0.01
    if (d.kind === 'shade') s.tilt = THREE.MathUtils.clamp(d.tilt0 - (e.clientY - d.y0) * 0.01, LIMITS.tiltMin, LIMITS.tiltMax) // drag up to swing it forward
  }
  useEffect(() => {
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  })

  const plane = useMemo(() => new THREE.Plane(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const nrm = useMemo(() => new THREE.Vector3(), [])
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  // place a spring between two points given in the arm plane (x forward, y up)
  const span = (mesh, ax, ay, bx, by) => {
    tmpA.set(ax, ay, 0)
    tmpB.set(bx - ax, by - ay, 0)
    const len = tmpB.length()
    mesh.position.copy(tmpA)
    mesh.quaternion.setFromUnitVectors(Y, tmpB.normalize())
    mesh.scale.set(1, len, 1)
  }

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const w = live.current

    // dragging an arm: the head joint follows the pointer in the arm's plane
    if (drag.current?.kind === 'arm') {
      const g = yawRef.current
      g.updateMatrixWorld()
      nrm.set(0, 0, 1).transformDirection(g.matrixWorld)
      hit.setFromMatrixPosition(g.matrixWorld)
      plane.setFromNormalAndCoplanarPoint(nrm, hit)
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        g.worldToLocal(hit)
        // keep the head above the desk and out of the base
        let tx = hit.x
        let ty = Math.max(hit.y, 2.1)
        if (Math.abs(tx) < BASE_R + 1.2) ty = Math.max(ty, 3.0)
        const sol = solve(tx, ty, w.L1, w.L2)
        s.a1 += (sol.a1 - s.a1) * Math.min(1, dt * 18)
        s.a2 += (sol.a2 - s.a2) * Math.min(1, dt * 18)
      }
    }

    yawRef.current.rotation.y = s.yaw
    lowerRef.current.rotation.z = -s.a1
    // the upper arm hangs off the elbow at its absolute angle
    upperRef.current.position.set(w.L1 * Math.sin(s.a1), SHOULDER_Y + w.L1 * Math.cos(s.a1), 0)
    upperRef.current.rotation.z = -s.a2
    headRef.current.position.set(0, w.L2, 0)
    // the shade keeps its own tilt from straight down, whatever the arm does
    // (it hangs from the upper arm, so undo that arm's angle first)
    headRef.current.rotation.z = s.a2 + s.tilt

    // springs: shoulder spring from the turret lever to the lower arm; elbow
    // spring from the lower arm to the upper arm, both on the back side
    const ex = w.L1 * Math.sin(s.a1)
    const ey = SHOULDER_Y + w.L1 * Math.cos(s.a1)
    const back1 = [-Math.cos(s.a1), Math.sin(s.a1)] // perpendicular to the lower arm, to the back
    const back2 = [-Math.cos(s.a2), Math.sin(s.a2)]
    span(spring1.current, -0.3, SHOULDER_Y - 0.28, 1.5 * Math.sin(s.a1) + back1[0] * 0.17, SHOULDER_Y + 1.5 * Math.cos(s.a1) + back1[1] * 0.17)
    span(spring2.current, ex - 0.7 * Math.sin(s.a1) + back1[0] * 0.32, ey - 0.7 * Math.cos(s.a1) + back1[1] * 0.32, ex + 0.95 * Math.sin(s.a2) + back2[0] * 0.32, ey + 0.95 * Math.cos(s.a2) + back2[1] * 0.32)

    // the light: the bulb glows, the spot lights the desk
    s.light += ((w.on ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 14))
    lightRef.current.intensity = s.light * w.brightness * 70
    lightRef.current.color.set(w.lightColor)
    mats.bulb.emissiveIntensity = s.light * (0.6 + w.brightness * 2.4)
    s.press = Math.max(0, s.press - dt * 6)
    buttonRef.current.position.y = BASE_H + 0.06 - Math.sin(Math.min(1, s.press) * Math.PI) * 0.035
  })

  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }

  const rods = (len, z, mat) => [
    ...[-z, z].map((zz) => <mesh key={zz} geometry={geo.rod} material={mat} position={[0, 0, zz]} scale={[1, len, 1]} castShadow />),
    <mesh key="grip" geometry={geo.grip} material={mats.grip} scale={[1, len, 1]} />,
  ]

  return (
    <group>
      {/* base, switch and cable */}
      <mesh geometry={geo.base} material={mats.paint} position-y={BASE_H / 2} castShadow receiveShadow onPointerDown={grab('base')} {...hoverProps} />
      <mesh geometry={geo.baseTop} material={mats.steel} position-y={BASE_H + 0.03} receiveShadow onPointerDown={grab('base')} {...hoverProps} />
      <mesh
        ref={buttonRef}
        geometry={geo.button}
        material={mats.button}
        position={[0.85, BASE_H + 0.06, 0.55]}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          st.current.press = 1
          setOn(!on)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      />
      <mesh geometry={cableGeo} material={mats.black} castShadow />

      {/* everything above the base turns with the turret */}
      <group ref={yawRef}>
        <mesh geometry={geo.turret} material={mats.steel} position-y={BASE_H + 0.06 + 0.15} castShadow onPointerDown={grab('base')} {...hoverProps} />
        {/* two plates hold the shoulder bolt; the spring lever sticks out behind */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.plate} material={mats.steel} position={[0, SHOULDER_Y - 0.12, s * (LOWER_Z + 0.08)]} castShadow />
        ))}
        <mesh geometry={geo.lever} material={mats.steel} position={[-0.2, SHOULDER_Y - 0.28, 0]} />
        <mesh geometry={geo.bolt} material={mats.chrome} position-y={SHOULDER_Y} scale={[1, 1, 2 * (LOWER_Z + 0.12)]} />

        {/* lower arm: a pair of rods from the shoulder bolt to the elbow bolt */}
        <group ref={lowerRef} position-y={SHOULDER_Y} onPointerDown={grab('arm')} {...hoverProps}>
          {rods(L1, LOWER_Z, mats.paint)}
          {/* spring pins, on tabs behind the rods: the shoulder spring's top, the elbow spring's bottom */}
          {[
            [0.17, 1.5],
            [0.32, L1 - 0.7],
          ].map(([off, along]) => (
            <SpringPin key={along} off={off} along={along} z={LOWER_Z} geo={geo} mats={mats} />
          ))}
        </group>

        {/* upper arm: a wider pair that straddles the lower arm at the elbow */}
        <group ref={upperRef}>
          <mesh geometry={geo.bolt} material={mats.chrome} scale={[1, 1, 2 * UPPER_Z + 0.08]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.boltHead} material={mats.chrome} position-z={s * (UPPER_Z + 0.04)} />
          ))}
          <group onPointerDown={grab('arm')} {...hoverProps}>
            {rods(L2, UPPER_Z, mats.paint)}
            <SpringPin off={0.32} along={0.95} z={UPPER_Z} geo={geo} mats={mats} />
          </group>

          {/* head: the shade hangs on its bolt between the upper rods */}
          <group ref={headRef}>
            <mesh geometry={geo.bolt} material={mats.chrome} scale={[1, 1, 2 * UPPER_Z + 0.08]} />
            <group onPointerDown={grab('shade')} {...hoverProps}>
              <mesh geometry={geo.knuckle} material={mats.steel} position-y={-0.12} />
              <mesh geometry={geo.shadeCap} material={mats.paint} castShadow />
              <mesh geometry={geo.shade} material={mats.paint} castShadow />
              <mesh geometry={geo.shade} material={mats.inside} />
              <mesh geometry={geo.shadeRim} material={mats.paint} />
            </group>
            <mesh geometry={geo.socket} material={mats.black} position-y={-0.42} />
            <mesh geometry={geo.bulb} material={mats.bulb} position-y={-0.68} />
            <spotLight ref={lightRef} position={[0, -0.7, 0]} angle={0.62} penumbra={0.55} distance={22} decay={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} />
            <object3D ref={targetRef} position={[0, -6, 0]} />
          </group>
        </group>
      </group>

      {/* springs are drawn in the turret's frame, between their anchors */}
      <group rotation-y={0}>
        <SpringFrame yawRef={yawRef}>
          <mesh ref={spring1} geometry={geo.spring} material={mats.chrome} castShadow />
          <mesh ref={spring2} geometry={geo.spring} material={mats.chrome} castShadow />
        </SpringFrame>
      </group>
    </group>
  )
}

// A pin behind an arm's pair of rods, held on two tabs, where a spring hooks on.
function SpringPin({ off, along, z, geo, mats }) {
  return (
    <group position={[-off, along, 0]}>
      <mesh geometry={geo.bolt} material={mats.chrome} scale={[0.6, 0.6, 2 * z + 0.02]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.tab} material={mats.steel} position={[off / 2, 0, s * z]} scale={[off + 0.06, 1, 1]} />
      ))}
    </group>
  )
}

// Keeps its children turned with the turret, so the springs share the arms' plane.
function SpringFrame({ yawRef, children }) {
  const ref = useRef()
  useFrame(() => {
    if (yawRef.current) ref.current.rotation.y = yawRef.current.rotation.y
  })
  return <group ref={ref}>{children}</group>
}
