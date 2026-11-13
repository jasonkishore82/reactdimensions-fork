import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

export function sunDirection(elevation, azimuth) {
  return new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth))
}

// Sunlight after its path through the air: the lower the sun, the longer the
// path (Kasten-Young air mass) and the more blue is scattered out, so it reddens.
export function sunlight(elevation) {
  const e = Math.max(elevation, 0)
  const m = 1 / (Math.sin(THREE.MathUtils.degToRad(e)) + 0.50572 * Math.pow(e + 6.07995, -1.6364))
  const tau = [0.06, 0.13, 0.3]
  const fade = THREE.MathUtils.smoothstep(elevation, -2, 3)
  return new THREE.Color(Math.exp(-tau[0] * m) * fade, Math.exp(-tau[1] * m) * fade, Math.exp(-tau[2] * m) * fade)
}

// A physical sky, plus a small cube map of it that the clouds sample for the
// light falling on them from above and around.
export function makeSky({ turbidity = 4, rayleigh = 1.4, mie = 0.004, mieG = 0.85 } = {}) {
  const sky = new Sky()
  sky.scale.setScalar(10000)
  const u = sky.material.uniforms
  u.turbidity.value = turbidity
  u.rayleigh.value = rayleigh
  u.mieCoefficient.value = mie
  u.mieDirectionalG.value = mieG
  const rt = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType })
  const cam = new THREE.CubeCamera(1, 30000, rt)
  const envScene = new THREE.Scene()
  const copy = new THREE.Mesh(sky.geometry, sky.material)
  copy.scale.setScalar(10000)
  envScene.add(copy)
  return {
    sky,
    envTexture: rt.texture,
    update(gl, sunDir) {
      u.sunPosition.value.copy(sunDir)
      cam.update(gl, envScene)
    },
    dispose() {
      rt.dispose()
      sky.geometry.dispose()
      sky.material.dispose()
    },
  }
}

// Four directions just above the horizon that never look straight at the sun disc.
export function horizonDirs(sunDir, out) {
  const az = Math.atan2(sunDir.x, sunDir.z)
  out.forEach((d, i) => {
    const a = az + Math.PI / 4 + (i * Math.PI) / 2
    d.set(Math.sin(a), 0.08, Math.cos(a)).normalize()
  })
}
