// A raymarched cumulus. The rays run through the cloud's bounding box; the
// shape is a smooth union of puffs, carved by baked Perlin-Worley noise and
// eroded at the edges by finer Worley noise. Each sample is lit by a short
// march toward the sun (Beer's law with a multiple-scattering approximation
// and a two-lobe phase function, for the silver lining), plus sky light from
// above and a dim bounce from below, integrated energy-conservingly.
export const MAX_PUFFS = 24

export const cloudVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const cloudFragment = /* glsl */ `
precision highp float;
precision highp sampler3D;

#define MAX_PUFFS ${MAX_PUFFS}
#define PI 3.14159265

uniform sampler3D uShape;
uniform sampler3D uDetail;
uniform samplerCube uEnv;
uniform vec4 uPuffs[MAX_PUFFS];
uniform int uCount;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform float uScale;
uniform float uBase;
uniform float uTime;
uniform float uWind;
uniform float uDensity;
uniform float uCoverage;
uniform float uDetailAmt;
uniform float uSteps;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyDirs[4];

varying vec3 vWorld;

float remap(float v, float l0, float h0, float l1, float h1) {
  return l1 + (v - l0) * (h1 - l1) / (h0 - l0);
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float shapeSDF(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < MAX_PUFFS; i++) {
    if (i >= uCount) break;
    vec4 s = uPuffs[i];
    d = smin(d, length(p - s.xyz) - s.w, uScale * 0.4);
  }
  return d;
}

vec2 boxHit(vec3 ro, vec3 rd) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (uBoxMin - ro) * inv;
  vec3 t1 = (uBoxMax - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
}

float heightFrac(vec3 p) {
  return clamp((p.y - uBase) / (uBoxMax.y - uBase), 0.0, 1.0);
}

// 0..1 water content at p. 'hi' adds the fine erosion (skipped for light rays).
float density(vec3 p, float sdf, bool hi) {
  float hf = heightFrac(p);
  // soft field from the silhouette: 1 well inside, 0 a little outside
  float field = smoothstep(0.22 * uScale, -0.6 * uScale, sdf);
  // cumulus have flat, sharp bases at the condensation level
  field *= smoothstep(uBase, uBase + 0.1 * uScale, p.y);
  // and round, slightly thinner tops
  field *= 1.0 - smoothstep(0.85, 1.0, hf);
  if (field <= 0.0) return 0.0;

  vec3 wind = vec3(uTime * uWind, 0.0, uTime * uWind * 0.35);
  vec4 n = texture(uShape, (p + wind) / (uScale * 2.4));
  float wfbm = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
  float body = remap(n.r, wfbm - 1.0, 1.0, 0.0, 1.0);
  float cov = clamp(field * uCoverage, 0.0, 1.0);
  float d = clamp(remap(body, 1.0 - cov, 1.0, 0.0, 1.0), 0.0, 1.0) * cov;
  if (!hi || d <= 0.0) return d;

  // billowing detail: rises and churns faster than the body drifts
  vec3 q = (p + wind * 1.6 + vec3(0.0, uTime * uWind * 0.8, 0.0)) / (uScale * 0.42);
  vec3 dn = texture(uDetail, q).rgb;
  float dfbm = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
  // wispy at the base, cauliflower-like higher up
  float m = mix(dfbm, 1.0 - dfbm, clamp(hf * 4.0, 0.0, 1.0));
  return clamp(remap(d, m * 0.4 * uDetailAmt, 1.0, 0.0, 1.0), 0.0, 1.0);
}

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

// strong forward lobe (silver lining) + a soft back lobe
float phase(float c, float k) {
  return mix(hg(c, -0.25 * k), hg(c, 0.8 * k), 0.7);
}

// optical depth from p toward the sun
float sunDepth(vec3 p) {
  float od = 0.0;
  float step = uScale * 0.06;
  float t = step * 0.5;
  for (int i = 0; i < 6; i++) {
    vec3 q = p + uSunDir * t;
    float s = shapeSDF(q);
    if (s < 0.25 * uScale) od += density(q, s, false) * step;
    t += step;
    step *= 1.55;
  }
  return od * uDensity;
}

// interleaved gradient noise: decorrelates the march start between pixels
float ign(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec2 tb = boxHit(ro, rd);
  float t0 = max(tb.x, 0.0);
  float t1 = tb.y;
  if (t1 <= t0) discard;

  vec3 skyUp = texture(uEnv, vec3(0.0, 1.0, 0.0)).rgb;
  vec3 skyH = vec3(0.0);
  for (int i = 0; i < 4; i++) skyH += texture(uEnv, uSkyDirs[i]).rgb;
  skyH *= 0.25;
  vec3 ground = skyH * vec3(0.18, 0.22, 0.26); // dim bounce off the sea below

  float cosT = dot(rd, uSunDir);
  float ph[3];
  ph[0] = phase(cosT, 1.0);
  ph[1] = phase(cosT, 0.5);
  ph[2] = phase(cosT, 0.25);

  float baseStep = (uBoxMax.x - uBoxMin.x) / uSteps;
  float t = t0 + baseStep * ign(gl_FragCoord.xy);
  vec3 col = vec3(0.0);
  float T = 1.0;

  for (int i = 0; i < 256; i++) {
    if (t > t1 || T < 0.01) break;
    vec3 p = ro + rd * t;
    float sdf = shapeSDF(p);
    // empty space: jump ahead by the distance to the silhouette
    if (sdf > 0.3 * uScale) {
      t += max(sdf - 0.25 * uScale, baseStep);
      continue;
    }
    float d = density(p, sdf, true);
    if (d > 0.002) {
      float sig = d * uDensity;
      float od = sunDepth(p);
      // multiple scattering: each octave goes deeper and scatters wider
      float sun = exp(-od) * ph[0] + 0.5 * exp(-od * 0.5) * ph[1] + 0.25 * exp(-od * 0.25) * ph[2];
      // 'powder': light has to scatter in before it can scatter out, darkening sunlit edges' interiors
      float powder = 1.0 - exp(-sig * uScale * 0.35);
      sun *= mix(1.0, powder, 0.55 * (0.5 - 0.5 * cosT) + 0.25);
      float hf = heightFrac(p);
      vec3 amb = skyUp * mix(0.25, 1.0, hf) * 0.9 + ground * (1.0 - hf);
      vec3 S = (uSunColor * sun * 4.0 * PI + amb) * sig;
      float tr = exp(-sig * baseStep);
      col += T * (S - S * tr) / max(sig, 1e-5);
      T *= tr;
    }
    t += baseStep;
  }

  if (T > 0.995) discard;
  // a touch of atmosphere between the camera and a distant cloud
  float haze = 1.0 - exp(-t0 / (uScale * 60.0));
  col = mix(col, skyH * (1.0 - T), haze);

  gl_FragColor = vec4(col, 1.0 - T);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
