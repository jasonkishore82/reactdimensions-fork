import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cloudVertex, cloudFragment } from './cloudShader.js'
import { getCloudNoise, cumulusPuffs } from './noise.js'
import { sunDirection, sunlight, makeSky, horizonDirs } from './sun.js'
import { createHalfRes } from './halfRes.js'

const SIZE = 22 // world units per cloud-shape unit: the cloud is ~65 wide, ~35 tall
const BASE = 4 // height of its flat base

// Bakes the smooth union of the puffs into a 3D texture over the box:
// signed distance in units of SIZE, mapped from -1..1 to 0..255.
function bakeShape(seed) {
  const puffs = cumulusPuffs(seed).map(([x, y, z, r]) => [x * SIZE, BASE + y * SIZE, z * SIZE, r * SIZE])
  const box = new THREE.Box3()
  for (const [x, y, z, r] of puffs) {
    box.expandByPoint(new THREE.Vector3(x - r, y - r, z - r))
    box.expandByPoint(new THREE.Vector3(x + r, y + r, z + r))
  }
  box.expandByScalar(SIZE * 0.25)
  box.min.y = BASE
  const size = box.getSize(new THREE.Vector3())
  const cell = Math.max(size.x, size.y, size.z) / 72
  const nx = Math.ceil(size.x / cell)
  const ny = Math.ceil(size.y / cell)
  const nz = Math.ceil(size.z / cell)
  const k = SIZE * 0.4
  const data = new Uint8Array(nx * ny * nz)
  for (let z = 0, i = 0; z < nz; z++) {
    const pz = box.min.z + ((z + 0.5) / nz) * size.z
    for (let y = 0; y < ny; y++) {
      const py = box.min.y + ((y + 0.5) / ny) * size.y
      for (let x = 0; x < nx; x++, i++) {
        const px = box.min.x + ((x + 0.5) / nx) * size.x
        let d = 1e5
        for (const [cx, cy, cz, r] of puffs) {
          const s = Math.hypot(px - cx, py - cy, pz - cz) - r
          const h = Math.max(k - Math.abs(d - s), 0) / k
          d = Math.min(d, s) - h * h * k * 0.25
        }
        data[i] = Math.round(THREE.MathUtils.clamp(d / SIZE, -1, 1) * 127.5 + 127.5)
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, nx, ny, nz)
  tex.format = THREE.RedFormat
  tex.type = THREE.UnsignedByteType
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return { tex, box }
}

// elevation, azimuth: the sun, in degrees. density: how thick the water is
// (darker, heavier undersides). coverage: how much of the shape fills in.
// detail: how strongly the edges are eroded into wisps. wind: drift and
// billowing speed. seed: reshapes the cloud. quality: raymarch steps.
// resolution: fraction of the screen resolution the volume is marched at.
export default function Cloud({
  elevation = 25,
  azimuth = -70,
  exposure = 0.5,
  density = 0.8,
  coverage = 1.05,
  detail = 1,
  wind = 1,
  seed = 3,
  sunIntensity = 1,
  quality = 72,
  resolution = 0.5,
}) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  const sky = useMemo(() => makeSky(), [])
  const noise = useMemo(() => getCloudNoise(gl), [gl])
  const shape = useMemo(() => bakeShape(seed), [seed])

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
          uEnv: { value: sky.envTexture },
          uSdf: { value: null },
          uBoxMin: { value: new THREE.Vector3() },
          uBoxMax: { value: new THREE.Vector3() },
          uScale: { value: SIZE },
          uBase: { value: BASE },
          uTime: { value: 0 },
          uWind: { value: 1 },
          uDensity: { value: 0.5 },
          uCoverage: { value: 1 },
          uDetailAmt: { value: 1 },
          uSteps: { value: 72 },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uSkyDirs: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
        },
      }),
    [noise, sky],
  )

  const boxGeo = useMemo(() => {
    const size = shape.box.getSize(new THREE.Vector3())
    const center = shape.box.getCenter(new THREE.Vector3())
    const g = new THREE.BoxGeometry(size.x, size.y, size.z)
    g.translate(center.x, center.y, center.z)
    return g
  }, [shape])

  const half = useMemo(() => createHalfRes(material, boxGeo), [material, boxGeo])
  useEffect(() => half.setScale(resolution), [half, resolution])
  useEffect(() => () => half.dispose(), [half])

  useEffect(() => {
    const u = material.uniforms
    u.uSdf.value = shape.tex
    u.uBoxMin.value.copy(shape.box.min)
    u.uBoxMax.value.copy(shape.box.max)
  }, [material, shape])

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
    u.uWind.value = wind
    u.uSteps.value = quality
  }, [material, elevation, sunIntensity, density, coverage, detail, wind, quality])

  useEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => (gl.toneMappingExposure = prev)
  }, [gl, exposure])

  useEffect(() => () => boxGeo.dispose(), [boxGeo])
  useEffect(() => () => shape.tex.dispose(), [shape])
  useEffect(
    () => () => {
      material.dispose()
      sky.dispose()
    },
    [material, sky],
  )

  useFrame((_, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 0.1)
    half.render(gl, camera)
  })

  return (
    <>
      <primitive object={sky.sky} />
      <mesh geometry={boxGeo} material={half.composite} frustumCulled={false} renderOrder={1} />
    </>
  )
}
