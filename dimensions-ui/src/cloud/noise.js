import * as THREE from 'three'

// Tileable 3D noise for the clouds, generated on the GPU (a few milliseconds)
// into two 3D textures, one slice at a time:
//   shape  (128³): R = Perlin-Worley (the billowy body), G/B/A = Worley fBm at
//                  rising frequencies (used to carve the body).
//   detail  (64³): R/G/B = finer Worley fBm, for the wispy, eroded edges.
// Everything wraps, so the textures repeat without seams as the wind moves them.

const noiseFragment = /* glsl */ `
precision highp float;
precision highp int;
uniform float uZ;
uniform float uSize;
uniform int uMode; // 0 = shape, 1 = detail
out vec4 fragColor;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(vec3 c, float salt) {
  return vec3(pcg3d(uvec3(ivec3(c) + 4096) + uint(salt) * 7919u)) / 4294967295.0;
}

// cellular noise with 'cells' feature points per axis: 1 on a point, 0 far away
float worley(vec3 p, float cells) {
  p *= cells;
  vec3 id = floor(p);
  vec3 f = p - id;
  float best = 1e9;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(x, y, z);
    vec3 d = o + hash3(mod(id + o, cells), cells) - f;
    best = min(best, dot(d, d));
  }
  return 1.0 - clamp(sqrt(best), 0.0, 1.0);
}

// gradient noise repeating every 'period' cells, about -1..1
float perlin(vec3 p, float period) {
  p *= period;
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n[8];
  for (int k = 0; k < 8; k++) {
    vec3 c = vec3(k & 1, (k >> 1) & 1, (k >> 2) & 1);
    vec3 g = normalize(hash3(mod(i + c, period), period + 101.0) * 2.0 - 1.0);
    n[k] = dot(g, f - c);
  }
  return mix(mix(mix(n[0], n[1], u.x), mix(n[2], n[3], u.x), u.y), mix(mix(n[4], n[5], u.x), mix(n[6], n[7], u.x), u.y), u.z) * 1.6;
}

float fbm3(float a, float b, float c) { return a * 0.625 + b * 0.25 + c * 0.125; }

void main() {
  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);
  if (uMode == 0) {
    float a = worley(p, 4.0);
    float b = worley(p, 8.0);
    float c = worley(p, 16.0);
    float d = worley(p, 32.0);
    float e = worley(p, 64.0);
    float per = clamp((perlin(p, 4.0) + perlin(p, 8.0) * 0.5 + perlin(p, 16.0) * 0.25) * 0.5 + 0.5, 0.0, 1.0);
    float w = fbm3(a, b, c);
    fragColor = vec4(w + per * (1.0 - w), w, fbm3(b, c, d), fbm3(c, d, e));
  } else {
    float a = worley(p, 2.0);
    float b = worley(p, 4.0);
    float c = worley(p, 8.0);
    float d = worley(p, 16.0);
    float e = worley(p, 32.0);
    fragColor = vec4(fbm3(a, b, c), fbm3(b, c, d), fbm3(c, d, e), 1.0);
  }
}
`

function bake(gl, size, mode) {
  const rt = new THREE.WebGL3DRenderTarget(size, size, size, { depthBuffer: false })
  const t = rt.texture
  t.format = THREE.RGBAFormat
  t.type = THREE.UnsignedByteType
  t.minFilter = t.magFilter = THREE.LinearFilter
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: noiseFragment,
    uniforms: { uZ: { value: 0 }, uSize: { value: size }, uMode: { value: mode } },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)
  const cam = new THREE.OrthographicCamera()
  const prev = gl.getRenderTarget()
  for (let z = 0; z < size; z++) {
    mat.uniforms.uZ.value = (z + 0.5) / size
    gl.setRenderTarget(rt, z)
    gl.render(scene, cam)
  }
  gl.setRenderTarget(prev)
  quad.geometry.dispose()
  mat.dispose()
  return t
}

const cache = new WeakMap()

// Built once per renderer and shared by every cloud on it.
export function getCloudNoise(gl) {
  let n = cache.get(gl)
  if (!n) {
    n = { shape: bake(gl, 128, 0), detail: bake(gl, 64, 1) }
    cache.set(gl, n)
  }
  return n
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A cumulus silhouette: a broad base of large puffs, smaller towers stacked on
// top and a crown. Positions in units of the cloud's size; `seed` reshuffles it.
export function cumulusPuffs(seed = 1) {
  const r = mulberry32(seed * 9973 + 17)
  const rand = (a, b) => a + (b - a) * r()
  const puffs = []
  const row = (n, x0, x1, y0, y1, r0, r1, zs) => {
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1) + rand(-0.12, 0.12)
      puffs.push([x, rand(y0, y1), rand(-zs, zs), rand(r0, r1)])
    }
  }
  row(6, -1.35, 1.35, 0.32, 0.42, 0.42, 0.58, 0.32)
  row(3, -0.9, 0.9, 0.3, 0.38, 0.38, 0.48, 0.55) // depth, so it is not a flat wall
  row(5, -0.95, 0.95, 0.72, 0.92, 0.36, 0.48, 0.28)
  const shift = rand(-0.35, 0.35)
  row(3, -0.5 + shift, 0.55 + shift, 1.1, 1.3, 0.3, 0.4, 0.2)
  row(2, -0.18 + shift, 0.22 + shift, 1.42, 1.52, 0.24, 0.3, 0.12)
  return puffs
}
