import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

// Text printed on a long satin ribbon that ripples and twists in the wind.
// Waves travel along its length, it rolls about its own axis as they pass,
// and the light slides over the folds. The surface normals are worked out
// from the same wave in the shader, so the shading follows every ripple.
function makeTexture(text, ribbon, ink) {
  const c = document.createElement('canvas')
  const H = 128
  const g = c.getContext('2d')
  const font = `600 ${H * 0.52}px 'Helvetica Neue', Arial, sans-serif`
  g.font = font
  const unit = `${text}   ✦   `
  const w = Math.ceil(g.measureText(unit).width)
  const reps = Math.max(2, Math.ceil(1700 / w))
  c.width = w * reps
  c.height = H
  g.fillStyle = ribbon
  g.fillRect(0, 0, c.width, H)
  // a fine woven edge stripe
  g.fillStyle = 'rgba(255,255,255,.35)'
  g.fillRect(0, 6, c.width, 2)
  g.fillRect(0, H - 8, c.width, 2)
  g.font = font
  g.fillStyle = ink
  g.textBaseline = 'middle'
  for (let i = 0; i < reps; i++) g.fillText(unit, i * w, H * 0.53)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return { t, aspect: c.width / H }
}

const LEN = 16

function Ribbon({ text, ribbon, ink, wind, amplitude, twist }) {
  const mesh = useRef()
  const { t, aspect } = useMemo(() => makeTexture(text, ribbon, ink), [text, ribbon, ink])
  useEffect(() => () => t.dispose(), [t])
  const W = LEN / aspect > 0.25 ? LEN / aspect : 0.25 // keep the print undistorted
  const geo = useMemo(() => new THREE.PlaneGeometry(LEN, W * 1, 400, 6), [W])
  useEffect(() => () => geo.dispose(), [geo])

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: amplitude }, uTwist: { value: twist }, uWind: { value: wind } }), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.42, metalness: 0.05 })
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uTime; uniform float uAmp; uniform float uTwist; uniform float uWind;
// the ribbon's centre line waves up and down and front to back, and the
// cross-section rolls about it, all as waves travelling along x
vec3 ribbonAt(vec3 p) {
  float x = p.x;
  float ph = x * 0.55 - uTime * uWind;
  float env = 0.35 + 0.65 * smoothstep(-8.0, 8.0, x); // the held end moves less
  float y = sin(ph) * uAmp * env + sin(ph * 2.3 + 1.7) * uAmp * 0.25 * env;
  float z = cos(ph * 0.8 + 0.6) * uAmp * 0.9 * env;
  float roll = sin(x * 0.32 - uTime * uWind * 0.7) * uTwist * env;
  return vec3(x, y + p.y * cos(roll), z + p.y * sin(roll));
}`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `vec3 pp = ribbonAt(position);
vec3 tx = ribbonAt(position + vec3(0.01, 0.0, 0.0)) - pp;
vec3 ty = ribbonAt(position + vec3(0.0, 0.01, 0.0)) - pp;
vec3 objectNormal = normalize(cross(tx, ty));
#ifdef USE_TANGENT
vec3 objectTangent = normalize(tx);
#endif`,
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = pp;')
    }
    return m
  }, [t])
  useEffect(() => () => mat.dispose(), [mat])

  useFrame((_, dt) => {
    uniforms.uTime.value += Math.min(dt, 1 / 30)
    uniforms.uAmp.value = amplitude
    uniforms.uTwist.value = twist
    uniforms.uWind.value = wind
  })

  return <mesh ref={mesh} geometry={geo} material={mat} rotation-z={0.06} />
}

export default function RibbonText({
  text = 'CARRIED ON THE WIND',
  ribbon = '#ff4d1a',
  ink = '#fff7ee',
  wind = 1.6,
  amplitude = 0.7,
  twist = 0.9,
  background = '#f7f7f8',
  style,
}) {
  return (
    <div role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', background, ...style }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 32, position: [0, 0.4, 11.5] }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={[background]} />
        <Ribbon text={text} ribbon={ribbon} ink={ink} wind={wind} amplitude={amplitude} twist={twist} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 6]} intensity={1.6} />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={2} position={[0, 5, 3]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
          <Lightformer form="rect" intensity={1} position={[-6, 0, 4]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} />
        </Environment>
      </Canvas>
    </div>
  )
}
