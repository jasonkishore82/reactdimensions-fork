import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EYELET_X, EYELET_Z, OUTLINE, ROCKER, TOP_LINE_GLSL, TREAD_BOX, buildOutsole, buildSole, buildUpper, surfaceAt } from './last.js'
import { thud } from './audio.js'

// A low-top leather court sneaker: a moulded upper on a stitched-look
// cupsole, suede toe and heel overlays, a perforated toe box, mesh quarters
// and a padded tongue, laced and tied.
//
// Mechanics: drag the toe up and the forefoot flexes at the ball of the foot
// like a real sole, then springs back. Click the shoe and it hops, tumbles a
// little, lands with a thud and rocks to rest on its curved sole; the lace
// ends flop as it lands.

// ---- shaders --------------------------------------------------------------

// Bend the forefoot about the ball of the foot. Every part of the shoe uses
// this so they flex together.
const BEND_PIVOT = 4.5
function addBend(shader, uniforms) {
  shader.uniforms.uBend = uniforms.uBend
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uBend;')
    .replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      float rdA = uBend * smoothstep(3.5, 8.5, position.x);
      float rdC = cos(rdA), rdS = sin(rdA);
      objectNormal = vec3(rdC * objectNormal.x - rdS * objectNormal.y, rdS * objectNormal.x + rdC * objectNormal.y, objectNormal.z);`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec2 rdQ = transformed.xy - vec2(${BEND_PIVOT.toFixed(1)}, 0.0);
      transformed.xy = vec2(${BEND_PIVOT.toFixed(1)}, 0.0) + vec2(rdC * rdQ.x - rdS * rdQ.y, rdS * rdQ.x + rdC * rdQ.y);`,
    )
}

// The upper's panels are drawn from where each point sits on the side of the
// shoe: suede toe guard and heel piece, leather toe box, eyestays and collar,
// mesh quarters, with seams, stitch rows, perforations and eyelets.
const PANELS_GLSL = /* glsl */ `
${TOP_LINE_GLSL}
float rdHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rdNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rdHash(i), rdHash(i + vec3(1,0,0)), f.x), mix(rdHash(i + vec3(0,1,0)), rdHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rdHash(i + vec3(0,0,1)), rdHash(i + vec3(1,0,1)), f.x), mix(rdHash(i + vec3(0,1,1)), rdHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// a thin line along d = 0, antialiased
float rdLine(float d, float w) { float fw = fwidth(d) + 1e-4; return 1.0 - smoothstep(w - fw, w + fw, abs(d)); }
// a dashed stitch row along d = 0; s runs along the seam
float rdStitch(float d, float s, float w) { float dash = smoothstep(0.25, 0.35, fract(s * 3.2)) * (1.0 - smoothstep(0.75, 0.85, fract(s * 3.2))); return rdLine(d, w) * dash; }
`
const EYELETS = EYELET_X.map((x) => `vec2(${x.toFixed(2)}, ${EYELET_Z.toFixed(2)})`).join(', ')

function upperMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uLeather: uniforms.uLeather,
      uSuede: uniforms.uSuede,
      uMesh: uniforms.uMesh,
      uLining: uniforms.uLining,
      uPerf: uniforms.uPerf,
    })
    addBend(shader, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aPart;\nvarying vec3 vSP;\nvarying vec2 vPart;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSP = position;\nvPart = aPart;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uLeather; uniform vec3 uSuede; uniform vec3 uMesh; uniform vec3 uLining; uniform float uPerf;
        varying vec3 vSP; varying vec2 vPart;
        ${PANELS_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = vSP;
        float az = abs(p.z);
        float Tl = rdT(p.x);
        // signed distances to each panel's edge (negative inside), roughly in cm
        float dToe = max(p.y - (4.5 + max(11.6 - p.x, 0.0) * 0.34), (0.4 + (p.y - 3.0) * 0.72) - p.x) * 0.8;
        float dHeel = max(p.x - (-6.9 - (p.y - 3.0) * 0.62), p.y - 8.5) * 0.8;
        float dLea = min((Tl - 1.75) - p.y, (5.6 - (p.y - 6.0) * 0.55) - p.x);
        float dGap = max(az - 1.05, (Tl - 0.9) - p.y);
        dGap = max(dGap, max(-2.9 - p.x, p.x - 6.3));

        // knit mesh: a fine weave that fades out before it can shimmer
        float fq = 34.0;
        float weave = sin(p.x * fq) * sin((p.y + p.z) * fq);
        float fw = fwidth(p.x * fq) + fwidth((p.y + p.z) * fq);
        float meshPat = smoothstep(0.1, 0.9, weave) * (1.0 - smoothstep(0.7, 1.8, fw));
        vec3 col = uMesh * (1.0 - 0.09 * meshPat);
        float rdRough = 0.88;

        if (dLea < 0.0) { col = uLeather * (0.985 + 0.03 * rdNoise(p * 9.0)); rdRough = 0.52; }
        if (dToe < 0.0 || dHeel < 0.0) { col = uSuede * (0.95 + 0.08 * rdNoise(p * 26.0)); rdRough = 0.97; }
        if (dGap < 0.0) { col = uMesh * (1.0 - 0.09 * meshPat); rdRough = 0.88; }

        // seams where pieces overlap, and the stitching just inside them
        float seam = max(max(rdLine(dToe, 0.018), rdLine(dHeel, 0.018)), rdLine(dLea, 0.018));
        seam = max(seam, rdLine(dGap, 0.02));
        float st = max(rdStitch(dToe + 0.15, p.x + p.y, 0.022), rdStitch(dHeel + 0.15, p.x - p.y, 0.022));
        st = max(st, rdStitch(dLea + 0.16, p.x + p.y + p.z, 0.022));
        st = max(st, rdStitch(az - 1.25, p.x, 0.022) * step(dGap, 0.4) * step(-0.8, Tl - 0.2 - p.y) * step(p.x, 6.4) * step(-2.6, p.x));
        // perforations on the toe box
        float perf = 0.0;
        if (uPerf > 0.5 && dLea < -0.25 && dToe > 0.35 && p.x > 8.2 && p.x < 13.0 && p.y > Tl - 1.5 && az < 3.2) {
          float sp = 0.4;
          float row = floor(p.x / sp);
          vec2 g = vec2(fract(p.x / sp), fract(p.z / sp + 0.5 * mod(row, 2.0))) - 0.5;
          perf = 1.0 - smoothstep(0.13, 0.2, length(g));
        }
        // eyelets: a punched ring with a dark hole
        float eye = 0.0, hole = 0.0;
        vec2 ez = vec2(p.x, az);
        vec2 eyes[6] = vec2[6](${EYELETS});
        for (int i = 0; i < 6; i++) {
          float r = length(ez - eyes[i]);
          eye = max(eye, rdLine(r - 0.17, 0.03));
          hole = max(hole, 1.0 - smoothstep(0.09, 0.12, r));
        }
        eye *= step(Tl - 2.0, p.y);
        hole *= step(Tl - 2.0, p.y);

        col *= 1.0 - 0.28 * seam;
        col *= 1.0 - 0.22 * st;
        col *= 1.0 - 0.5 * perf;
        col *= 1.0 - 0.25 * eye;
        col = mix(col, col * 0.35, hole);
        // the tongue and the lining inside
        vec3 tongueCol = uMesh * (1.0 - 0.07 * meshPat) * (0.985 + 0.03 * rdNoise(p * 7.0));
        col = mix(col, tongueCol, vPart.y);
        // inside: darker the deeper in, as little light gets down there
        float depth = (0.16 + 0.84 * smoothstep(3.4, 10.8, p.y)) * (1.0 - 0.6 * smoothstep(-3.0, 6.0, p.x));
        col = mix(col, uLining * (0.97 + 0.04 * rdNoise(p * 30.0)) * depth, vPart.x);
        rdRough = mix(rdRough, 0.9, max(vPart.x, vPart.y));
        diffuseColor.rgb = col;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rdRough;')
  }
  m.customProgramCacheKey = () => 'rd-sneaker-upper'
  return m
}

function bentMaterial(params, uniforms, key) {
  const m = new THREE.MeshStandardMaterial(params)
  m.onBeforeCompile = (shader) => addBend(shader, uniforms)
  m.customProgramCacheKey = () => `rd-sneaker-${key}`
  return m
}

// ---- outsole tread --------------------------------------------------------

// The tread, drawn into a canvas: a ring of bars round the edge, herringbone
// panels at the heel, a pivot circle under the ball, flex grooves across the
// forefoot. White is raised, dark is a groove; it's used as a bump map.
function treadTexture() {
  const W = 1500
  const H = 600
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')
  const to = (x, z) => [((x - TREAD_BOX[0]) / TREAD_BOX[2]) * W, (1 - (z - TREAD_BOX[1]) / TREAD_BOX[3]) * H]
  const px = W / TREAD_BOX[2] // pixels per cm
  c.fillStyle = '#fff'
  c.fillRect(0, 0, W, H)
  const path = (inset) => {
    c.beginPath()
    OUTLINE.forEach(([x, z], i) => {
      // pull each point towards the centre line
      const k = Math.max(0, 1 - inset / Math.max(Math.abs(z), 0.6))
      const [X, Y] = to(x - Math.sign(x) * inset * 0.4, z * k)
      i ? c.lineTo(X, Y) : c.moveTo(X, Y)
    })
    c.closePath()
  }
  c.strokeStyle = '#3a3a3a'
  c.lineCap = 'round'
  // bars round the edge
  c.save()
  path(0.55)
  c.lineWidth = 1.0 * px
  c.setLineDash([0.18 * px, 0.32 * px])
  c.stroke()
  c.restore()
  // a groove inside the bars
  path(1.2)
  c.lineWidth = 0.1 * px
  c.stroke()
  // inside that groove, the panels
  c.save()
  path(1.3)
  c.clip()
  c.lineWidth = 0.1 * px
  const lines = (x0, x1, angle, gap) => {
    for (let s = -20; s < 20; s += gap) {
      const [ax, ay] = to(x0, s)
      const [bx, by] = to(x1, s + (x1 - x0) * Math.tan(angle))
      c.beginPath()
      c.moveTo(ax, ay)
      c.lineTo(bx, by)
      c.stroke()
    }
  }
  const box = (x0, x1, z0, z1, draw) => {
    c.save()
    const [ax, ay] = to(x0, z1)
    const [bx, by] = to(x1, z0)
    c.beginPath()
    c.rect(ax, ay, bx - ax, by - ay)
    c.clip()
    draw()
    c.restore()
    c.beginPath()
    c.rect(ax, ay, bx - ax, by - ay)
    c.stroke()
  }
  // heel: herringbone, two panels
  box(-14, -8.4, 0.12, 5, () => lines(-14, -8.4, 0.75, 0.42))
  box(-14, -8.4, -5, -0.12, () => lines(-14, -8.4, -0.75, 0.42))
  // arch: a diamond lattice
  box(-7.8, 0.2, -5, 5, () => {
    lines(-7.8, 0.2, 0.9, 0.9)
    lines(-7.8, 0.2, -0.9, 0.9)
  })
  // forefoot: grooves across, with the pivot circle under the ball
  box(0.8, 14.5, -5, 5, () => {
    for (let x = 1.2; x < 14.5; x += 0.55) {
      const [ax, ay] = to(x, -5)
      const [, by] = to(x, 5)
      c.beginPath()
      c.moveTo(ax, ay)
      c.lineTo(ax, by)
      c.stroke()
    }
  })
  c.restore()
  const [cx, cy] = to(7.6, -0.6)
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(cx, cy, 2.1 * px, 0, Math.PI * 2)
  c.fill()
  c.lineWidth = 0.12 * px
  for (const r of [2.1, 1.35, 0.55]) {
    c.beginPath()
    c.arc(cx, cy, r * px, 0, Math.PI * 2)
    c.stroke()
  }
  const t = new THREE.CanvasTexture(cv)
  t.anisotropy = 8
  return t
}

// ---- laces ----------------------------------------------------------------

const LACE_R = 0.125
const tube = (pts, r = LACE_R, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, r, 6, false)
const onTop = (x, z, lift) => new THREE.Vector3(x, surfaceAt(x, z).y + lift, z)

function buildLaces() {
  const parts = []
  const n = EYELET_X.length
  const Z = EYELET_Z
  // the bar across the bottom pair
  const xb = EYELET_X[n - 1]
  parts.push(tube([-1, -0.5, 0, 0.5, 1].map((t) => onTop(xb, t * Z, 0.06 + 0.05 * (1 - t * t))), LACE_R, 12))
  // crossing pairs going up the throat; one strand goes over, one under
  for (let i = n - 1; i > 0; i--) {
    const x0 = EYELET_X[i]
    const x1 = EYELET_X[i - 1]
    for (const [s, over] of [[1, 1], [-1, 0]]) {
      const pts = []
      for (let k = 0; k <= 6; k++) {
        const t = k / 6
        const arch = Math.sin(Math.PI * t)
        pts.push(onTop(x0 + (x1 - x0) * t, s * Z * (1 - 2 * t), 0.05 + arch * (0.06 + over * 0.13)))
      }
      parts.push(tube(pts, LACE_R, 16))
    }
  }
  return mergeGeometries(parts)
}

// the knot at the top, with two loose ends lying forward over the laces
const KNOT = [-0.55, 0]
function buildBow() {
  const k = onTop(KNOT[0], KNOT[1], 0.26)
  const knot = new THREE.SphereGeometry(0.27, 14, 10)
  knot.scale(1.25, 0.7, 1.15)
  knot.translate(k.x, k.y, k.z)
  knot.deleteAttribute('uv')
  const ends = []
  for (const s of [1, -1]) {
    const pts = [[0, 0.12], [1.1, 0.5], [2.3, 0.8], [3.3, 0.7], [4.0, 0.95]].map(([dx, dz]) => onTop(KNOT[0] + dx, s * dz, 0.34).sub(k))
    const g = tube(pts, LACE_R, 20)
    g.deleteAttribute('uv')
    ends.push(g)
  }
  return { loops: knot, ends: mergeGeometries(ends), knot: k }
}

// ---- the shoe -------------------------------------------------------------

const Sneaker = forwardRef(function Sneaker(
  {
    leatherColor = '#f3f3f1',
    suedeColor = '#dcdcd8',
    meshColor = '#efefed',
    soleColor = '#f6f6f4',
    laceColor = '#f2f2f0',
    perforations = true,
    sound = true,
  },
  ref,
) {
  const outer = useRef()
  const inner = useRef()
  const endsRef = useRef()
  const controls = useThree((s) => s.controls)
  const gl = useThree((s) => s.gl)

  const geo = useMemo(() => {
    const t0 = performance.now()
    const g = { upper: buildUpper(), sole: buildSole(), outsole: buildOutsole(), laces: buildLaces(), bow: buildBow() }
    if (import.meta.env?.DEV) console.debug(`sneaker built in ${Math.round(performance.now() - t0)} ms`)
    return g
  }, [])
  const uniforms = useMemo(
    () => ({
      uBend: { value: 0 },
      uLeather: { value: new THREE.Color() },
      uSuede: { value: new THREE.Color() },
      uMesh: { value: new THREE.Color() },
      uLining: { value: new THREE.Color() },
      uPerf: { value: 1 },
    }),
    [],
  )
  const mats = useMemo(() => {
    const tread = treadTexture()
    return {
      upper: upperMaterial(uniforms),
      sole: bentMaterial({ color: '#ffffff', roughness: 0.62 }, uniforms, 'sole'),
      outsole: bentMaterial({ color: '#ffffff', roughness: 0.85, bumpMap: tread, bumpScale: 2.2 }, uniforms, 'outsole'),
      lace: bentMaterial({ color: '#ffffff', roughness: 0.9 }, uniforms, 'lace'),
      ends: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
      tread,
    }
  }, [uniforms])

  useEffect(() => {
    uniforms.uLeather.value.set(leatherColor)
    uniforms.uSuede.value.set(suedeColor)
    uniforms.uMesh.value.set(meshColor)
    // the lining is a slightly darker take on the mesh
    uniforms.uLining.value.set(meshColor).multiplyScalar(0.62)
    uniforms.uPerf.value = perforations ? 1 : 0
    mats.sole.color.set(soleColor)
    mats.outsole.color.set(soleColor).multiplyScalar(0.9)
    mats.lace.color.set(laceColor)
    mats.ends.color.set(laceColor)
  }, [uniforms, mats, leatherColor, suedeColor, meshColor, soleColor, laceColor, perforations])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose?.())
      geo.bow.loops.dispose()
      geo.bow.ends.dispose()
      Object.values(mats).forEach((m) => m.dispose?.())
    },
    [geo, mats],
  )

  // y: height off the floor; th: pitch (toe up +); bend: forefoot flex;
  // flop: how far the lace ends have lifted
  const st = useRef({ y: 0, vy: 0, th: 0, w: 0, bend: 0, bv: 0, target: 0, dragging: false, flop: 0, fv: 0 })
  const soundRef = useRef(sound)
  soundRef.current = sound

  const hop = (fromX = 0) => {
    const s = st.current
    if (s.y > 0.6) return
    s.vy = 88 + Math.random() * 12
    // clicking near an end tips that end down as it goes up
    s.w += -fromX * 0.13 + (Math.random() - 0.5) * 0.6
    s.fv += 3
  }
  const flex = () => {
    const s = st.current
    s.target = 0.42
    setTimeout(() => {
      if (!s.dragging) s.target = 0
    }, 450)
  }
  useImperativeHandle(ref, () => ({ hop: () => hop(0), flex }))

  // how high the shoe must sit so its lowest point just touches the floor
  const groundOffset = (th) => {
    const c = Math.cos(th)
    const sn = Math.sin(th)
    let lo = Infinity
    for (const [x, y] of ROCKER) lo = Math.min(lo, x * sn + y * c)
    return -lo
  }

  useFrame((_, delta) => {
    const s = st.current
    const dt = Math.min(delta, 1 / 30)
    const n = 5
    const h = dt / n
    for (let i = 0; i < n; i++) {
      // forefoot flex: a stiff spring while held, a lively one when let go
      const k = s.dragging ? 520 : 240
      const zeta = s.dragging ? 1 : 0.2
      s.bv += (k * (s.target - s.bend) - 2 * zeta * Math.sqrt(k) * s.bv) * h
      s.bend += s.bv * h

      // hop: ballistic in the air, rocking on the curved sole on the ground
      if (s.y > 0 || s.vy > 0) {
        s.vy -= 981 * h
        s.y += s.vy * h
        s.th += s.w * h
        s.w *= 1 - 0.4 * h
        if (s.y <= 0) {
          s.y = 0
          const impact = -s.vy
          if (impact > 70) {
            s.vy = impact * 0.26
            s.w = s.w * 0.45 - s.th * 1.5
            s.fv += impact * 0.035
            if (soundRef.current) thud(Math.min(1, impact / 220))
          } else {
            s.vy = 0
            if (impact > 20 && soundRef.current) thud(impact / 400)
          }
        }
      } else {
        const kr = 70
        s.w += (-kr * s.th - 2 * 0.28 * Math.sqrt(kr) * s.w) * h
        s.th += s.w * h
      }
      s.th = Math.max(-0.9, Math.min(0.9, s.th))

      // lace ends: kicked up on impacts, gravity lays them back down
      s.fv += (-38 * s.flop - 1.2 * s.fv) * h
      s.flop += s.fv * h
      if (s.flop < 0) {
        s.flop = 0
        s.fv = -s.fv * 0.25
      }
      if (s.flop > 1.1) {
        s.flop = 1.1
        s.fv = 0
      }
    }
    uniforms.uBend.value = s.bend
    if (outer.current) {
      outer.current.position.y = s.y + groundOffset(s.th)
      outer.current.rotation.z = s.th
    }
    if (endsRef.current) endsRef.current.rotation.z = s.flop
  })

  // pointer: the toe flexes, anywhere else is a click to hop
  const local = new THREE.Vector3()
  const onDown = (e) => {
    local.copy(e.point)
    inner.current.worldToLocal(local)
    if (local.x < 6) return
    e.stopPropagation()
    const s = st.current
    s.dragging = true
    if (controls) controls.enabled = false
    const y0 = e.clientY
    const H = gl.domElement.clientHeight || 500
    const move = (ev) => {
      s.target = Math.max(0, Math.min(0.5, ((y0 - ev.clientY) / H) * 2.2))
    }
    const up = () => {
      s.dragging = false
      s.target = 0
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const onClick = (e) => {
    if (e.delta > 4) return
    local.copy(e.point)
    inner.current.worldToLocal(local)
    if (local.x >= 6) return
    e.stopPropagation()
    hop(local.x)
  }
  const onOver = (e) => {
    local.copy(e.point)
    inner.current.worldToLocal(local)
    document.body.style.cursor = local.x >= 6 ? 'ns-resize' : 'pointer'
  }

  const k = geo.bow.knot
  return (
    <group ref={outer}>
      <group
        ref={inner}
        onPointerDown={onDown}
        onClick={onClick}
        onPointerMove={onOver}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <mesh geometry={geo.upper} material={mats.upper} castShadow receiveShadow />
        <mesh geometry={geo.sole} material={mats.sole} castShadow receiveShadow />
        <mesh geometry={geo.outsole} material={mats.outsole} />
        <mesh geometry={geo.laces} material={mats.lace} castShadow />
        <mesh geometry={geo.bow.loops} material={mats.lace} castShadow />
        <group position={[k.x, k.y, k.z]}>
          <group ref={endsRef}>
            <mesh geometry={geo.bow.ends} material={mats.ends} castShadow />
          </group>
        </group>
      </group>
    </group>
  )
})

export default Sneaker
