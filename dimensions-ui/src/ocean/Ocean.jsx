import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { WAVES, waterHeight } from './waves.js'
import { oceanVertex, oceanFragment } from './oceanShader.js'

// Circular grid: dense near the centre, sparse toward the horizon.
function createRadialGrid(rings = 300, segments = 384, a = 15, b = 0.0228) {
  const positions = [0, 0, 0]
  for (let i = 1; i <= rings; i++) {
    const r = a * (Math.exp(b * i) - 1)
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2
      positions.push(Math.cos(t) * r, 0, Math.sin(t) * r)
    }
  }
  const index = []
  for (let j = 0; j < segments; j++) index.push(0, 1 + ((j + 1) % segments), 1 + j)
  for (let i = 0; i < rings - 1; i++) {
    const r0 = 1 + i * segments
    const r1 = r0 + segments
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      index.push(r0 + j, r0 + j1, r1 + j)
      index.push(r0 + j1, r1 + j1, r1 + j)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  return geo
}

export function sunDirection(elevation, azimuth) {
  return new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth))
}

// A marker buoy that rides the waves: its height and tilt come from the same
// wave sum the shader draws, so it sits exactly on the surface.
function Buoy({ clock, chop, target, color }) {
  const ref = useRef()
  const lamp = useRef()
  const s = useRef({ x: 0, z: 0, vx: 0, vz: 0, n: new THREE.Vector3(0, 1, 0), y: 0 })
  const tmp = useMemo(() => ({ n: new THREE.Vector3(), q: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0) }), [])
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.45 }), [color])
  useEffect(() => () => red.dispose(), [red])

  useFrame((_, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    // drift towards the clicked point, slowed by the water
    const dx = target.current.x - st.x
    const dz = target.current.z - st.z
    st.vx += (THREE.MathUtils.clamp(dx * 0.3, -4, 4) - st.vx) * Math.min(1, dt * 0.8)
    st.vz += (THREE.MathUtils.clamp(dz * 0.3, -4, 4) - st.vz) * Math.min(1, dt * 0.8)
    st.x += st.vx * dt
    st.z += st.vz * dt
    const t = clock.current
    const e = 1.2 // about the buoy's radius: it averages out ripples smaller than itself
    const h = waterHeight(st.x, st.z, t, chop)
    const hx = waterHeight(st.x + e, st.z, t, chop) - waterHeight(st.x - e, st.z, t, chop)
    const hz = waterHeight(st.x, st.z + e, t, chop) - waterHeight(st.x, st.z - e, t, chop)
    tmp.n.set(-hx, 2 * e, -hz).normalize()
    // a little lag, as a heavy buoy has inertia
    st.n.lerp(tmp.n, Math.min(1, dt * 4)).normalize()
    st.y += (h - st.y) * Math.min(1, dt * 6)
    const g = ref.current
    if (!g) return
    g.position.set(st.x, st.y, st.z)
    g.quaternion.setFromUnitVectors(tmp.up, st.n)
    if (lamp.current) lamp.current.emissiveIntensity = (t * 0.5) % 1 < 0.12 ? 6 : 0.2
  })

  return (
    <group ref={ref}>
      {/* float, half under the waterline */}
      <mesh material={red} position-y={-0.1} castShadow>
        <cylinderGeometry args={[1.1, 0.9, 1.6, 32]} />
      </mesh>
      <mesh position-y={0.55}>
        <cylinderGeometry args={[1.12, 1.12, 0.3, 32]} />
        <meshStandardMaterial color="#f2f2ee" roughness={0.5} />
      </mesh>
      {/* the tower: four legs and a top ring, all meeting at the lamp deck */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh key={i} material={red} position={[Math.cos(a) * 0.45, 2.0, Math.sin(a) * 0.45]} rotation={[-Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12]}>
            <cylinderGeometry args={[0.06, 0.06, 2.9, 8]} />
          </mesh>
        )
      })}
      <mesh material={red} position-y={3.45}>
        <cylinderGeometry args={[0.32, 0.32, 0.12, 24]} />
      </mesh>
      <mesh material={red} position-y={2.5} scale={[0.5, 0.5, 0.5]}>
        <torusGeometry args={[1.0, 0.1, 8, 32]} />
      </mesh>
      <mesh position-y={3.68}>
        <cylinderGeometry args={[0.16, 0.2, 0.34, 16]} />
        <meshStandardMaterial ref={lamp} color="#ffffff" emissive="#ffd84a" emissiveIntensity={0.2} roughness={0.2} />
      </mesh>
    </group>
  )
}

// elevation, azimuth: the sun, in degrees. chop: wave steepness. speed: time
// scale. foam: whitecaps (lower makes more). deepColor, scatterColor: the
// water body and the green light through the crests. buoy: a floating marker
// that you send round by clicking the water.
export default function Ocean({
  elevation = 6,
  azimuth = -140,
  chop = 1,
  speed = 1,
  foam = 0.8,
  deepColor = '#0b2c3d',
  scatterColor = '#1f8f7f',
  exposure = 0.5,
  buoy = true,
  buoyColor = '#d0342c',
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const clock = useRef(0)
  const target = useRef(new THREE.Vector3())
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])

  const sky = useMemo(() => {
    const s = new Sky()
    s.scale.setScalar(10000)
    const u = s.material.uniforms
    u.turbidity.value = 6
    u.rayleigh.value = 1.6
    u.mieCoefficient.value = 0.005
    u.mieDirectionalG.value = 0.85
    return s
  }, [])

  // A cube map of the sky, used for the water's reflections and to light the buoy.
  const env = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType })
    const cam = new THREE.CubeCamera(1, 30000, rt)
    const envScene = new THREE.Scene()
    const skyCopy = new THREE.Mesh(sky.geometry, sky.material)
    skyCopy.scale.setScalar(10000)
    envScene.add(skyCopy)
    return { rt, cam, envScene }
  }, [sky])

  const geometry = useMemo(() => createRadialGrid(), [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: oceanVertex,
        fragmentShader: oceanFragment,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uChop: { value: 1 },
          uWaves: { value: WAVES.map((w) => new THREE.Vector4(w.dir[0], w.dir[1], w.steepness, w.wavelength)) },
          uEnv: { value: env.rt.texture },
          uSunDir: { value: new THREE.Vector3() },
          uDeep: { value: new THREE.Color() },
          uScatter: { value: new THREE.Color() },
          uFoam: { value: 0.8 },
        },
      }),
    [env],
  )

  useEffect(() => {
    sky.material.uniforms.sunPosition.value.copy(sunDir)
    material.uniforms.uSunDir.value.copy(sunDir)
    env.cam.update(gl, env.envScene)
    env.rt.texture.needsPMREMUpdate = true
    const prev = scene.environment
    scene.environment = env.rt.texture
    return () => {
      if (scene.environment === env.rt.texture) scene.environment = prev
    }
  }, [sunDir, sky, env, material, gl, scene])

  useEffect(() => {
    material.uniforms.uDeep.value.set(deepColor)
    material.uniforms.uScatter.value.set(scatterColor)
    material.uniforms.uFoam.value = foam
  }, [material, deepColor, scatterColor, foam])

  useEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => (gl.toneMappingExposure = prev)
  }, [gl, exposure])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      env.rt.dispose()
      sky.geometry.dispose()
      sky.material.dispose()
    },
    [geometry, material, env, sky],
  )

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.1) * speed
    material.uniforms.uTime.value = clock.current
    material.uniforms.uChop.value = chop
  })

  const sunLight = Math.max(Math.sin(THREE.MathUtils.degToRad(elevation)), 0) * 2 + 0.6

  return (
    <>
      <primitive object={sky} />
      {/* the shader moves the vertices, so pick on a flat stand-in instead of the 230k-triangle grid */}
      <mesh geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      <mesh
        rotation-x={-Math.PI / 2}
        onClick={(e) => {
          if (e.delta > 6) return // that was an orbit drag
          const r = Math.hypot(e.point.x, e.point.z)
          target.current.set(e.point.x, 0, e.point.z).multiplyScalar(r > 60 ? 60 / r : 1)
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {buoy && <Buoy clock={clock} chop={chop} target={target} color={buoyColor} />}
      <directionalLight position={sunDir.clone().multiplyScalar(200)} intensity={sunLight} color="#ffe2c4" />
      <ambientLight intensity={0.15} />
    </>
  )
}
