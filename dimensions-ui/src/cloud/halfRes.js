import * as THREE from 'three'

// Raymarching every screen pixel is expensive, and clouds are soft anyway: the
// march runs into an offscreen target at a fraction of the resolution, and a
// cheap composite pass stretches it back over the screen. The target holds
// linear, premultiplied colour; the composite un-premultiplies before tone
// mapping and sRGB, so thin edges don't flare into a bright halo.
export function createHalfRes(marchMaterial, geometry, scale = 0.5) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })
  const marchScene = new THREE.Scene()
  const marchMesh = new THREE.Mesh(geometry, marchMaterial)
  marchMesh.frustumCulled = false
  marchScene.add(marchMesh)

  const composite = new THREE.ShaderMaterial({
    side: marchMaterial.side,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    depthTest: false,
    uniforms: { uTex: { value: target.texture }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: /* glsl */ `
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform vec2 uRes;
      void main() {
        vec4 c = texture2D(uTex, gl_FragCoord.xy / uRes);
        if (c.a < 0.002) discard;
        gl_FragColor = vec4(c.rgb / c.a, c.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb *= gl_FragColor.a;
      }
    `,
  })

  const size = new THREE.Vector2()
  const clear = new THREE.Color()
  let res = scale

  return {
    composite,
    marchMesh,
    setScale(s) {
      res = s
    },
    render(gl, camera) {
      gl.getDrawingBufferSize(size)
      composite.uniforms.uRes.value.copy(size)
      const w = Math.max(1, Math.round(size.x * res))
      const h = Math.max(1, Math.round(size.y * res))
      if (target.width !== w || target.height !== h) target.setSize(w, h)
      const prevTarget = gl.getRenderTarget()
      const prevAlpha = gl.getClearAlpha()
      gl.getClearColor(clear)
      gl.setRenderTarget(target)
      gl.setClearColor(0x000000, 0)
      gl.clear(true, false, false)
      gl.render(marchScene, camera)
      gl.setRenderTarget(prevTarget)
      gl.setClearColor(clear, prevAlpha)
    },
    dispose() {
      target.dispose()
      composite.dispose()
    },
  }
}
