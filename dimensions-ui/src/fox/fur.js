import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Shell fur. Each furry part is drawn as an InstancedMesh of N copies ("shells")
// of its surface, each pushed a little further out along the normal. The
// fragment shader keeps only the pixels that fall inside a strand at that
// height, so the shells build up thousands of tapering hairs. Strands come from
// a 3D hash of the surface point (no UVs, so no seams or pole pinching), are
// darker at the root (self-shadowing), bend under gravity and trail behind
// motion (the `lag` uniform), and catch a soft rim light at the tips.
//
// Each geometry carries two extra attributes, written by `paint`:
//   color (vec3) - the fur colour at that point
//   fur   (float) - the fur length there (0 = bare)

const vertex = /* glsl */ `
  attribute float fur;
  uniform float uShells;
  uniform vec3 uGravity;
  uniform vec3 uLag;
  varying vec3 vBase;
  varying vec3 vColor;
  varying float vH;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float h = float(gl_InstanceID) / max(uShells - 1.0, 1.0);
    vec3 p = position + normal * fur * h;
    vec4 w = modelMatrix * vec4(p, 1.0);
    // tips bend more than roots
    w.xyz += (uGravity + uLag) * fur * h * h;
    vBase = position;
    vColor = color;
    vH = h;
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const fragment = /* glsl */ `
  uniform float uDensity;
  uniform vec3 uKey;
  uniform vec3 uFill;
  uniform vec3 uKeyColor;
  uniform vec3 uRimColor;
  varying vec3 vBase;
  varying vec3 vColor;
  varying float vH;
  varying vec3 vN;
  varying vec3 vView;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 q = vBase * uDensity;
    vec3 cell = floor(q);
    vec3 f = fract(q) - 0.5;
    float r = hash(cell);
    float len = 0.35 + 0.65 * r; // each strand has its own length
    if (vH > 0.001) {
      // jitter the strand centre inside its cell, and taper it to a point
      vec3 o = vec3(hash(cell + 3.1), hash(cell + 7.7), hash(cell + 1.3)) - 0.5;
      float thick = 0.55 * (1.0 - vH / len);
      if (vH > len || length(f - o * 0.35) > thick) discard;
    }
    vec3 N = normalize(vN);
    float key = max(dot(N, uKey), 0.0) * 0.8 + 0.28; // wrapped, so fur never goes black
    float fill = max(dot(N, uFill), 0.0) * 0.3;
    float ao = mix(0.32, 1.0, pow(vH, 0.65)); // roots sit in the shade of the coat
    float rim = pow(1.0 - max(dot(N, vView), 0.0), 2.2) * 0.55 * vH;
    vec3 col = vColor * (key * uKeyColor + fill) * ao;
    col *= 0.86 + 0.28 * r; // strand-to-strand colour variation
    col *= mix(1.0, 1.12, vH); // sun-bleached tips
    col += rim * uRimColor * vColor;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function furMaterial({ shells = 32, density = 70 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    vertexColors: true,
    alphaToCoverage: true,
    uniforms: {
      uShells: { value: shells },
      uDensity: { value: density },
      uGravity: { value: new THREE.Vector3(0, -0.35, 0.05) },
      uLag: { value: new THREE.Vector3() },
      uKey: { value: new THREE.Vector3(-0.45, 0.75, 0.5).normalize() },
      uFill: { value: new THREE.Vector3(0.6, 0.1, 0.5).normalize() },
      uKeyColor: { value: new THREE.Color('#fff4e6') },
      uRimColor: { value: new THREE.Color('#fff1d0') },
    },
  })
}

// Writes the colour and fur-length attributes: fn(p, n) returns [Color, length]
// for the point p (object space) with normal n.
export function paint(geometry, fn) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal
  const colors = new Float32Array(pos.count * 3)
  const fur = new Float32Array(pos.count)
  const p = new THREE.Vector3(), n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nor, i)
    const [c, len] = fn(p, n, i)
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    fur[i] = len
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('fur', new THREE.BufferAttribute(fur, 1))
  return geometry
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// A unit sphere reshaped by fn(v) -> [x, y, z], with normals recomputed.
export function shaped(fn, w = 72, h = 56) {
  // weld the seam so the recomputed normals are smooth all round
  const s = new THREE.SphereGeometry(1, w, h)
  s.deleteAttribute('normal')
  s.deleteAttribute('uv')
  const g = mergeVertices(s)
  s.dispose()
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const [x, y, z] = fn(v)
    p.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}
