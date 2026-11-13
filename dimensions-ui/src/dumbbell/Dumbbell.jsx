import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { dims, impulse, makeBody, samplePoints, step, updateW, wake } from './physics.js'
import { clunk, thud } from './audio.js'

// A pair of round rubber dumbbells on the floor. Units: metres, kilograms.
// The physics is in physics.js; this file draws them and handles the hand.
//
// Pick one up anywhere and it hangs and swings from that point (grab a head
// and it dangles; grab the middle of the handle and it balances). Let go to
// drop or throw it. Click one without dragging to shove it: it rolls on its
// heads and slows to a stop on the rubber.

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)

// the rubber head: a lathe of its section. Rounded rim, a fine stepped ring on
// the outer face (the moulded inner disc), flat inner face against the collar
function headGeometry(d) {
  const { R, h, RHO, collarR } = d
  const pts = [new THREE.Vector2(collarR * 1.02, -h), new THREE.Vector2(R - RHO, -h)]
  for (let k = 1; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * (Math.PI / 2)
    pts.push(new THREE.Vector2(R - RHO + Math.cos(a) * RHO, -(h - RHO) + Math.sin(a) * RHO))
  }
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * (Math.PI / 2)
    pts.push(new THREE.Vector2(R - RHO + Math.cos(a) * RHO, h - RHO + Math.sin(a) * RHO))
  }
  pts.push(
    new THREE.Vector2(R * 0.88, h),
    new THREE.Vector2(R * 0.875, h - 0.0012),
    new THREE.Vector2(R * 0.862, h - 0.0012),
    new THREE.Vector2(R * 0.857, h - 0.0004),
    new THREE.Vector2(0.0001, h - 0.0004),
  )
  const g = new THREE.LatheGeometry(pts, 128)
  g.rotateZ(-Math.PI / 2) // lathe axis y -> the dumbbell's axis x; outer face toward +x
  return g
}

// diamond knurling, as a bump map
function knurlTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  x.fillStyle = '#9a9a9a'
  x.fillRect(0, 0, 128, 128)
  x.strokeStyle = '#1a1a1a'
  x.lineWidth = 3
  for (let i = -128; i <= 256; i += 16) {
    x.beginPath()
    x.moveTo(i, 0)
    x.lineTo(i + 128, 128)
    x.moveTo(i, 128)
    x.lineTo(i + 128, 0)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 7)
  return t
}

// the weight, moulded faintly into the outer face
function labelTexture(kg) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const x = c.getContext('2d')
  x.fillStyle = '#fff'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.font = '700 92px system-ui, Helvetica, Arial, sans-serif'
  x.fillText(`${Number.isInteger(kg) ? kg : kg.toFixed(1)}`, 256, 236)
  x.font = '600 44px system-ui, Helvetica, Arial, sans-serif'
  x.fillText('KG', 256, 318)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  return t
}

function arrange(bodies, d, how) {
  bodies.forEach((b, i) => {
    const s = i ? 1 : -1
    if (how === 'stand') {
      b.p.set(s * 0.17, d.c + d.h, 0)
      b.q.setFromUnitVectors(X, Y).premultiply(new THREE.Quaternion().setFromAxisAngle(Y, i * 0.6))
    } else if (how === 'drop') {
      b.p.set(s * 0.08 + (Math.random() - 0.5) * 0.06, 0.45 + i * 0.32, (Math.random() - 0.5) * 0.12)
      b.q.setFromEuler(new THREE.Euler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28))
    } else {
      // lying on their heads, side by side, turned a little
      b.p.set(s * 0.04, d.R, s * (d.R + 0.1))
      b.q.setFromAxisAngle(Y, 0.42 + i * 0.12)
    }
    b.v.set(0, 0, 0)
    b.L.set(0, 0, 0)
    if (how === 'drop') b.L.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4)
    b.grab = null
    updateW(b, d)
    wake(b)
  })
}

const Dumbbell = forwardRef(function Dumbbell({ weight = 10, rubberColor = '#161616', metalColor = '#dcdde0', label = true, sound = true }, ref) {
  const d = useMemo(() => dims(weight), [weight])
  const pts = useMemo(() => samplePoints(d), [d])
  const bodies = useMemo(() => [makeBody(new THREE.Vector3(), new THREE.Quaternion()), makeBody(new THREE.Vector3(), new THREE.Quaternion())], [])
  useMemo(() => arrange(bodies, d, 'lay'), [bodies, d])

  const head = useMemo(() => headGeometry(d), [d])
  useEffect(() => () => head.dispose(), [head])
  const knurl = useMemo(() => knurlTexture(), [])
  const labelTex = useMemo(() => labelTexture(weight), [weight])
  useEffect(() => () => labelTex.dispose(), [labelTex])
  const mat = useMemo(
    () => ({
      rubber: new THREE.MeshPhysicalMaterial({ roughness: 0.68, clearcoat: 0.08, clearcoatRoughness: 0.6, sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color('#555555') }),
      chrome: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.16 }),
      grip: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.4, bumpMap: knurl, bumpScale: 2.5 }),
      label: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    }),
    [knurl],
  )
  useEffect(() => {
    mat.rubber.color.set(rubberColor)
    mat.chrome.color.set(metalColor)
    mat.grip.color.set(metalColor)
    mat.label.map = labelTex
    mat.label.needsUpdate = true
  }, [mat, rubberColor, metalColor, labelTex])
  useEffect(
    () => () => {
      Object.values(mat).forEach((m) => m.dispose())
      knurl.dispose()
    },
    [mat, knurl],
  )

  const groups = useRef([])
  const { camera, controls, gl } = useThree()
  const live = useRef({})
  live.current = { sound, d }
  const hand = useRef(null)
  const lastSound = useRef([0, 0])

  useImperativeHandle(ref, () => ({
    drop: () => arrange(bodies, live.current.d, 'drop'),
    lay: () => arrange(bodies, live.current.d, 'lay'),
    stand: () => arrange(bodies, live.current.d, 'stand'),
  }))

  const plane = useMemo(() => new THREE.Plane(), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  const onDown = (i) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const b = bodies[i]
    const local = e.point.clone().sub(b.p).applyQuaternion(b.q.clone().invert())
    // drag in the plane through the grab point that faces the camera, kept upright
    const n = camera.getWorldDirection(new THREE.Vector3())
    n.y = 0
    n.normalize()
    plane.setFromNormalAndCoplanarPoint(n, e.point)
    hand.current = { i, local, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, moved: false, point: e.point.clone(), dir: e.ray.direction.clone() }
    if (controls) controls.enabled = false
    gl.domElement.style.cursor = 'grabbing'
  }

  useEffect(() => {
    const move = (ev) => {
      const g = hand.current
      if (!g) return
      if (!g.moved && Math.hypot(ev.clientX - g.x, ev.clientY - g.y) > 4) {
        g.moved = true
        const b = bodies[g.i]
        b.grab = { local: g.local, target: g.point.clone() }
        wake(b)
      }
      if (!g.moved) return
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(plane, hit)) {
        hit.y = Math.max(hit.y, 0.01)
        hit.x = THREE.MathUtils.clamp(hit.x, -1.2, 1.2)
        hit.z = THREE.MathUtils.clamp(hit.z, -0.9, 0.9)
        bodies[g.i].grab.target.copy(hit)
      }
    }
    const up = () => {
      const g = hand.current
      if (!g) return
      hand.current = null
      if (controls) controls.enabled = true
      gl.domElement.style.cursor = ''
      const b = bodies[g.i]
      const dd = live.current.d
      if (g.moved) {
        b.grab = null
        // a throw, but no faster than an arm can
        if (b.v.length() > 6) b.v.setLength(6)
        wake(b)
      } else {
        // a click: a shove along the floor, at the point clicked
        const J = g.dir.clone()
        J.y = 0
        J.normalize().multiplyScalar(dd.m * 0.9)
        wake(b)
        impulse(b, dd, g.point.clone().sub(b.p), J)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [bodies, camera, controls, gl, plane, ray, ndc, hit])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const n = Math.min(24, Math.ceil(dt / (1 / 600)))
    const dd = live.current.d
    for (let k = 0; k < n; k++) step(bodies, dd, pts, dt / n)
    const now = state.clock.elapsedTime
    bodies.forEach((b, i) => {
      const g = groups.current[i]
      if (g) {
        g.position.copy(b.p)
        g.quaternion.copy(b.q)
      }
      if (live.current.sound && now - lastSound.current[i] > 0.09) {
        if (b.knock > 0.3) {
          clunk(b.knock / 2.5)
          lastSound.current[i] = now
        } else if (b.impact > 0.35) {
          thud(b.impact / 2.5, dd.kg)
          lastSound.current[i] = now
        }
      }
      b.impact = 0
      b.knock = 0
    })
  })

  const gripCore = d.gripL - 0.018
  return (
    <group>
      {bodies.map((b, i) => (
        <group key={i} ref={(g) => (groups.current[i] = g)} position={b.p} quaternion={b.q} onPointerDown={onDown(i)} onPointerOver={() => (gl.domElement.style.cursor = 'grab')} onPointerOut={() => !hand.current && (gl.domElement.style.cursor = '')}>
          {[1, -1].map((s) => (
            <group key={s} position-x={s * d.c} rotation-y={s > 0 ? 0 : Math.PI}>
              <mesh geometry={head} material={mat.rubber} castShadow receiveShadow />
              {label && (
                <mesh material={mat.label} position-x={d.h - 0.0003} rotation-y={Math.PI / 2}>
                  <circleGeometry args={[d.R * 0.8, 48]} />
                </mesh>
              )}
              {/* collar, tapering down to the grip */}
              <mesh material={mat.chrome} position-x={-d.h - d.collarL / 2} rotation-z={Math.PI / 2} castShadow>
                <cylinderGeometry args={[d.collarR, d.collarR, d.collarL, 40]} />
              </mesh>
              <mesh material={mat.chrome} position-x={-d.h - d.collarL - 0.002} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[d.collarR * 0.86, d.collarR, 0.004, 40]} />
              </mesh>
            </group>
          ))}
          {/* the grip: knurled, with a smooth band at each end */}
          <mesh material={mat.grip} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[d.gripR, d.gripR, gripCore, 48, 1, true]} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} material={mat.chrome} position-x={s * (gripCore / 2 + 0.0045)} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[d.gripR * 1.01, d.gripR * 1.01, 0.009, 48]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
})

export default Dumbbell
