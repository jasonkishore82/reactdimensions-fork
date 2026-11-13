// Above the clouds: an endless cumulus deck below, a thin high overcast above
// and the sun breaking through between them. The deck is a slab of volume
// raymarched with the same noise and lighting as the single cloud (Perlin-
// Worley body, Worley erosion, sun march with multiple scattering, two-lobe
// phase), with steps that grow with distance so it reaches the horizon. The
// upper deck is a cheap 2D layer lit by forward scattering, so the sky glows
// around the sun.
export const seaVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const seaFragment = /* glsl */ `
precision highp float;
precision highp sampler3D;

#define PI 3.14159265

uniform sampler3D uShape;
uniform sampler3D uDetail;
uniform samplerCube uEnv;
uniform float uBottom;
uniform float uTop;
uniform float uScale;
uniform float uTime;
uniform float uSpeed;
uniform float uDensity;
uniform float uCoverage;
uniform float uDetailAmt;
uniform float uSteps;
uniform float uHigh;
uniform float uCeiling;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyDirs[4];

varying vec3 vWorld;

float remap(float v, float l0, float h0, float l1, float h1) {
  return l1 + (v - l0) * (h1 - l1) / (h0 - l0);
}

// the deck flows past below: the camera seems to fly forward (-z)
vec3 flow() { return vec3(uTime * uSpeed * 0.3, 0.0, -uTime * uSpeed); }

float density(vec3 p, bool hi, float lod) {
  float hf = (p.y - uBottom) / (uTop - uBottom);
  if (hf <= 0.0 || hf >= 1.0) return 0.0;
  vec3 q = p + flow();
  // broad patches of thicker and thinner cloud
  float weather = textureLod(uShape, vec3(q.x, 7.0, q.z) / (uScale * 14.0), 0.0).g;
  float cov = clamp(uCoverage * (0.55 + 0.7 * weather), 0.0, 1.0);
  // cumulus profile: firm base, rounded domes on top
  float grad = smoothstep(0.0, 0.12, hf) * smoothstep(1.0, 0.35, hf);
  vec4 n = textureLod(uShape, q / (uScale * 3.2), 0.0);
  float wfbm = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
  float body = remap(n.r, wfbm - 1.0, 1.0, 0.0, 1.0) * grad;
  float d = clamp(remap(body, 1.0 - cov, 1.0, 0.0, 1.0), 0.0, 1.0) * cov;
  if (!hi || d <= 0.0 || lod > 0.6) return d;
  vec3 dn = textureLod(uDetail, (q + vec3(0.0, uTime * uSpeed * 0.15, 0.0)) / (uScale * 0.6), 0.0).rgb;
  float dfbm = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
  float m = mix(dfbm, 1.0 - dfbm, clamp(hf * 3.0, 0.0, 1.0));
  // erosion fades out with distance, where it would only shimmer
  return clamp(remap(d, m * 0.22 * uDetailAmt * (1.0 - lod), 1.0, 0.0, 1.0), 0.0, 1.0);
}

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

float phase(float c, float k) {
  return mix(hg(c, -0.25 * k), hg(c, 0.8 * k), 0.7);
}

float sunDepth(vec3 p, float jitter) {
  float od = 0.0;
  float step = (uTop - uBottom) * 0.07;
  float t = step * jitter;
  for (int i = 0; i < 5; i++) {
    vec3 q = p + uSunDir * t;
    if (q.y > uTop) break;
    od += density(q, false, 1.0) * step;
    t += step;
    step *= 1.7;
  }
  return od * uDensity;
}

float ign(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);

  vec3 skyUp = textureLod(uEnv, vec3(0.0, 1.0, 0.0), 0.0).rgb;
  vec3 skyH = vec3(0.0);
  for (int i = 0; i < 4; i++) skyH += textureLod(uEnv, uSkyDirs[i], 0.0).rgb;
  skyH *= 0.25;
  float cosT = dot(rd, uSunDir);

  vec3 col = vec3(0.0);
  float T = 1.0;

  if (rd.y < -0.0005) {
    // ---- the cumulus deck below ----
    float t0 = max((uTop - ro.y) / rd.y, 0.0);
    float t1 = (uBottom - ro.y) / rd.y;
    float maxT = uScale * 90.0;
    t1 = min(t1, maxT);
    float ph0 = phase(cosT, 1.0);
    float ph1 = phase(cosT, 0.5);
    float ph2 = phase(cosT, 0.25);
    // evenly spaced steps through the slab (no banding), never finer than
    // the near-field step: grazing rays toward the horizon get coarser steps
    float dt = max((t1 - t0) / uSteps, (uTop - uBottom) / uSteps);
    float jit = ign(gl_FragCoord.xy);
    float t = t0 + dt * jit;
    vec3 lastL = skyH;
    for (int i = 0; i < 160; i++) {
      if (t > t1 || T < 0.02) break;
      float lod = clamp((t - t0) / (uScale * 40.0), 0.0, 1.0);
      vec3 p = ro + rd * t;
      float d = density(p, true, lod);
      if (d > 0.002) {
        float sig = d * uDensity;
        float od = sunDepth(p, fract(jit + float(i) * 0.618034));
        float sun = exp(-od) * ph0 + 0.5 * exp(-od * 0.5) * ph1 + 0.25 * exp(-od * 0.25) * ph2;
        float powder = 1.0 - exp(-sig * (uTop - uBottom) * 0.25);
        sun *= mix(1.0, powder, 0.55 * (0.5 - 0.5 * cosT) + 0.25);
        float hf = clamp((p.y - uBottom) / (uTop - uBottom), 0.0, 1.0);
        vec3 amb = skyUp * mix(0.2, 1.0, hf) + skyH * 0.15 * (1.0 - hf);
        vec3 L = uSunColor * sun * 4.0 * PI + amb;
        lastL = L;
        vec3 S = L * sig;
        float tr = exp(-sig * dt);
        col += T * (S - S * tr) / max(sig, 1e-5);
        T *= tr;
      }
      t += dt;
    }
    // past the march range the deck is solid: fill the rest with its colour
    if (t1 >= maxT - 1.0) {
      col += T * lastL * 0.9;
      T = 0.0;
    }
    // aerial perspective: distant cloud fades into the horizon haze
    float haze = 1.0 - exp(-t0 / (uScale * 35.0));
    vec3 hazeCol = skyH * 1.05 + uSunColor * hg(cosT, 0.75) * 0.8;
    col = mix(col, hazeCol * (1.0 - T), haze);
  } else if (uCeiling > 0.0) {
    // ---- the high overcast above ----
    float th = (uHigh - ro.y) / max(rd.y, 1e-4);
    vec2 xz = ro.xz + rd.xz * th + flow().xz * 0.4;
    // two octaves drifting through the noise volume, so the pattern never visibly repeats
    float n1 = textureLod(uShape, vec3(xz.x, uTime * 0.6, xz.y) / (uScale * 45.0), 0.0).g;
    float n2 = textureLod(uShape, vec3(xz.y, -uTime * 0.9, xz.x) / (uScale * 13.0), 0.0).r;
    float n = n1 * 0.65 + n2 * 0.35;
    float a = smoothstep(1.0 - uCeiling, 1.5 - uCeiling, n);
    // toward the horizon the deck is seen edge-on: blend to its average cover
    a = mix(smoothstep(0.1, 0.9, uCeiling), a, smoothstep(0.03, 0.3, rd.y));
    a *= smoothstep(0.0, 0.05, rd.y) * 0.97;
    // dense parts are darker underneath; thin parts glow where the sun shines through
    float thick = smoothstep(0.3, 0.9, n * a);
    float through = hg(cosT, 0.85) * 3.0 * (1.0 - thick * 0.85);
    vec3 L = uSunColor * (through + 0.2) + skyUp * mix(1.0, 0.4, thick) + skyH * 0.25;
    col = L * a;
    T = 1.0 - a;
  }

  if (T > 0.998) discard;
  gl_FragColor = vec4(col, 1.0 - T);
}
`
