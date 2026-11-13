import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { cloudVertex, cloudFragment, MAX_PUFFS } from './cloudShader.js'
import { getCloudNoise, cumulusPuffs } from './noise.js'

export function sunDirection(elevation, azimuth) {
  return new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth))
}

// Sunlight after its path through the air: the lower the sun, the longer the
// path (Kasten-Young air mass) and the more blue is scattered out, so it reddens.
function sunlight(elevation) {
  const e = Math.max(elevation, 0)
  const m = 1 / (Math.sin(THREE.MathUtils.degToRad(e)) + 0.50572 * Math.pow(e + 6.07995, -1.6364))
  const tau = [0.06, 0.13, 0.3]
  const fade = THREE.MathUtils.smoothstep(elevation, -2, 3)
  return new THREE.Color(Math.exp(-tau[0] * m) * fade, Math.exp(-tau[1] * m) * fade, Math.exp(-tau[2] * m) * fade)
}

const SIZE = 22 // world units per cloud-shape unit: the cloud is ~65 wide, ~35 tall
const BASE = 4 // height of its flat base

// elevation, azimuth: the sun, in degrees. density: how thick the water is
// (darker, heavier undersides). coverage: how much of the shape fills in.
// detail: how strongly the edges are eroded into wisps. wind: drift and
// billowing speed. seed: reshapes the cloud. quality: raymarch steps.
export default function Cloud({
  elevation = 22,
  azimuth = 150,
  exposure = 0.5,
  density = 0.55,
  coverage = 1.05,
  detail = 1,
  wind = 1,
  seed = 3,
  sunIntensity = 1,
  quality = 90,
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])

  const sky = useMemo(() => {
    const s = new Sky()
    s.scale.setScalar(10000)
    const u = s.material.uniforms
    u.turbidity.value = 4
    u.rayleigh.value = 1.4
    u.mieCoefficient.value = 0.004
    u.mieDirectionalG.value = 0.85
    return s
  }, [])

  // The sky as a cube map: the cloud samples it for the light falling on it from above and around.
  const env = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType })
    const cam = new THREE.CubeCamera(1, 30000, rt)
    const envScene = new THREE.Scene()
    const skyCopy = new THREE.Mesh(sky.geometry, sky.material)
    skyCopy.scale.setScalar(10000)
    envScene.add(skyCopy)
    return { rt, cam, envScene }
  }, [sky])

  const noise = useMemo(() => getCloudNoise(), [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        side: THREE.BackSide,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        uniforms: {
          uShape: { value: noise.shape },
          uDetail: { value: noise.detail },
          uEnv: { value: env.rt.texture },
          uPuffs: { value: Array.from({ length: MAX_PUFFS }, () => new THREE.Vector4()) },
          uCount: { value: 0 },
          uBoxMin: { value: new THREE.Vector3() },
          uBoxMax: { value: new THREE.Vector3() },
          uScale: { value: SIZE },
          uBase: { value: BASE },
          uTime: { value: 0 },
          uWind: { value: 1 },
          uDensity: { value: 0.5 },
          uCoverage: { value: 1 },
          uDetailAmt: { value: 1 },
          uSteps: { value: 90 },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uSkyDirs: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
        },
      }),
    [noise, env],
  )

  // The puffs in world space, and a box around them that the rays march through.
  const shape = useMemo(() => {
    const puffs = cumulusPuffs(seed).slice(0, MAX_PUFFS)
    const box = new THREE.Box3()
    const v = puffs.map(([x, y, z, r]) => {
      const c = new THREE.Vector4(x * SIZE, BASE + y * SIZE, z * SIZE, r * SIZE)
      box.expandByPoint(new THREE.Vector3(c.x - c.w, c.y - c.w, c.z - c.w))
      box.expandByPoint(new THREE.Vector3(c.x + c.w, c.y + c.w, c.z + c.w))
      return c
    })
    box.expandByScalar(SIZE * 0.25)
    box.min.y = BASE
    return { puffs: v, box }
  }, [seed])

  const boxGeo = useMemo(() => {
    const size = shape.box.getSize(new THREE.Vector3())
    const center = shape.box.getCenter(new THREE.Vector3())
    const g = new THREE.BoxGeometry(size.x, size.y, size.z)
    g.translate(center.x, center.y, center.z)
    return g
  }, [shape])

  useEffect(() => {
    const u = material.uniforms
    shape.puffs.forEach((p, i) => u.uPuffs.value[i].copy(p))
    u.uCount.value = shape.puffs.length
    u.uBoxMin.value.copy(shape.box.min)
    u.uBoxMax.value.copy(shape.box.max)
  }, [material, shape])

  useEffect(() => {
    sky.material.uniforms.sunPosition.value.copy(sunDir)
    env.cam.update(gl, env.envScene)
    const u = material.uniforms
    u.uSunDir.value.copy(sunDir)
    // four horizon directions that never look straight at the sun disc
    const az = Math.atan2(sunDir.x, sunDir.z)
    u.uSkyDirs.value.forEach((d, i) => {
      const a = az + Math.PI / 4 + (i * Math.PI) / 2
      d.set(Math.sin(a), 0.08, Math.cos(a)).normalize()
    })
  }, [sunDir, sky, env, material, gl])

  useEffect(() => {
    const u = material.uniforms
    u.uSunColor.value.copy(sunlight(elevation)).multiplyScalar(sunIntensity * 2.2)
    u.uDensity.value = density
    u.uCoverage.value = coverage
    u.uDetailAmt.value = detail
    u.uWind.value = wind
    u.uSteps.value = quality
  }, [material, elevation, sunIntensity, density, coverage, detail, wind, quality])

  useEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => (gl.toneMappingExposure = prev)
  }, [gl, exposure])

  useEffect(() => () => boxGeo.dispose(), [boxGeo])
  useEffect(
    () => () => {
      material.dispose()
      env.rt.dispose()
      sky.geometry.dispose()
      sky.material.dispose()
    },
    [material, env, sky],
  )

  useFrame((_, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 0.1)
  })

  return (
    <>
      <primitive object={sky} />
      <mesh geometry={boxGeo} material={material} frustumCulled={false} renderOrder={1} />
    </>
  )
}
