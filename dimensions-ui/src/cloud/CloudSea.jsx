import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { seaVertex, seaFragment } from './cloudSeaShader.js'
import { getCloudNoise } from './noise.js'
import { sunDirection, sunlight, makeSky, horizonDirs } from './sun.js'
import { createHalfRes } from './halfRes.js'

const BOTTOM = 0 // the deck's base
const TOP = 60 // its highest domes
const SCALE = 60 // size of one billow, in world units

// elevation, azimuth: the sun, in degrees. coverage: how closed the deck is.
// density: how thick (darker valleys). detail: edge erosion. speed: how fast
// you fly over it. ceiling: amount of high overcast above (0 = clear sky).
// quality: raymarch steps. resolution: fraction of the screen resolution the
// volume is marched at.
export default function CloudSea({
  elevation = 10,
  azimuth = 200,
  exposure = 0.42,
  coverage = 0.9,
  density = 1,
  detail = 1,
  speed = 6,
  ceiling = 0.75,
  sunIntensity = 1,
  quality = 64,
  resolution = 0.5,
}) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const domeMesh = useRef()
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  // a hazier sky than the single cloud's: more glow around a low sun
  const sky = useMemo(() => makeSky({ turbidity: 5, rayleigh: 1.2, mie: 0.004, mieG: 0.86 }), [])
  const noise = useMemo(() => getCloudNoise(gl), [gl])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: seaVertex,
        fragmentShader: seaFragment,
        side: THREE.BackSide,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uShape: { value: noise.shape },
          uDetail: { value: noise.detail },
          uEnv: { value: sky.envTexture },
          uBottom: { value: BOTTOM },
          uTop: { value: TOP },
          uScale: { value: SCALE },
          uTime: { value: 0 },
          uSpeed: { value: 6 },
          uDensity: { value: 1 },
          uCoverage: { value: 0.9 },
          uDetailAmt: { value: 1 },
          uSteps: { value: 56 },
          uHigh: { value: 900 },
          uCeiling: { value: 0.75 },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uSkyDirs: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
        },
      }),
    [noise, sky],
  )

  // the shader works out each pixel's ray, so the dome just has to surround the camera
  const dome = useMemo(() => new THREE.SphereGeometry(1000, 32, 16), [])
  const half = useMemo(() => createHalfRes(material, dome), [material, dome])
  useEffect(() => half.setScale(resolution), [half, resolution])
  useEffect(
    () => () => {
      half.dispose()
      dome.dispose()
    },
    [half, dome],
  )

  useEffect(() => {
    sky.update(gl, sunDir)
    material.uniforms.uSunDir.value.copy(sunDir)
    horizonDirs(sunDir, material.uniforms.uSkyDirs.value)
  }, [sunDir, sky, material, gl])

  useEffect(() => {
    const u = material.uniforms
    u.uSunColor.value.copy(sunlight(elevation)).multiplyScalar(sunIntensity * 2.2)
    u.uDensity.value = density
    u.uCoverage.value = coverage
    u.uDetailAmt.value = detail
    u.uSpeed.value = speed
    u.uCeiling.value = ceiling
    u.uSteps.value = quality
  }, [material, elevation, sunIntensity, density, coverage, detail, speed, ceiling, quality])

  useEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => (gl.toneMappingExposure = prev)
  }, [gl, exposure])

  useEffect(
    () => () => {
      material.dispose()
      sky.dispose()
    },
    [material, sky],
  )

  useFrame((_, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 0.1)
    domeMesh.current?.position.copy(camera.position)
    half.marchMesh.position.copy(camera.position)
    half.render(gl, camera)
  })

  return (
    <>
      <primitive object={sky.sky} />
      <mesh ref={domeMesh} geometry={dome} material={half.composite} frustumCulled={false} renderOrder={1} />
    </>
  )
}
