import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// A streaming "home screen" drawn in generic shapes, over the wallpaper.
function drawHome(g, W, H, now) {
  g.clearRect(0, 0, W, H)
  const glass = (x, y, w, h, r, a) => {
    g.fillStyle = `rgba(0,0,0,${a})`
    g.beginPath()
    g.roundRect(x, y, w, h, r)
    g.fill()
  }
  const pad = (n) => String(n).padStart(2, '0')
  g.textBaseline = 'middle'
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.font = '600 28px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText('◼  Dimensions TV', 60, 48)
  g.textAlign = 'right'
  g.font = '500 26px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText(`${pad(now.getHours())}:${pad(now.getMinutes())}`, W - 60, 48)
  g.textAlign = 'left'
  // tabs
  g.font = '500 24px "Hanken Grotesk", system-ui, sans-serif'
  ;['Home', 'Movies', 'Shows', 'Live', 'Library'].forEach((t, i) => {
    g.fillStyle = i === 0 ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)'
    g.fillText(t, 400 + i * 120, 48)
  })
  // hero
  glass(60, 90, W - 120, 300, 22, 0.38)
  g.fillStyle = '#fff'
  g.font = '700 68px "Instrument Serif", Georgia, serif'
  g.fillText('Built to Scale', 100, 200)
  g.font = '400 26px "Hanken Grotesk", system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.fillText('A documentary in eight sizes · 2025 · 4K', 100, 258)
  g.fillStyle = '#fff'
  g.beginPath()
  g.roundRect(100, 300, 170, 54, 27)
  g.fill()
  g.fillStyle = '#111'
  g.font = '600 24px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText('▶  Play', 128, 328)
  // rows of tiles
  const hues = [18, 200, 330, 140, 48, 262, 8, 180]
  const row = (label, y, h) => {
    g.fillStyle = 'rgba(255,255,255,0.92)'
    g.font = '600 26px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText(label, 60, y - 24)
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 195
      const hue = hues[(i + (y > 500 ? 3 : 0)) % hues.length]
      const grad = g.createLinearGradient(x, y, x + 180, y + h)
      grad.addColorStop(0, `hsl(${hue} 70% 58%)`)
      grad.addColorStop(1, `hsl(${(hue + 40) % 360} 65% 28%)`)
      g.fillStyle = grad
      g.beginPath()
      g.roundRect(x, y, 180, h, 14)
      g.fill()
      g.fillStyle = 'rgba(0,0,0,0.4)'
      g.fillRect(x + 12, y + h - 26, 80, 8)
    }
  }
  row('Continue watching', 450, 112)
  row('Recommended', 616, 88)
}

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const frag = `
uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
uniform float t; uniform float on; uniform float uiAmt;
uniform sampler2D ui;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float w1 = sin(uv.x * 3.4 + t * 0.2 + sin(uv.y * 2.6 + t * 0.12) * 1.7) * 0.5 + 0.5;
  float w2 = sin(uv.x * 5.0 - uv.y * 3.0 + t * 0.14) * 0.5 + 0.5;
  vec3 col = mix(c1, c2, smoothstep(0.05, 0.95, (1.0 - uv.y) * 0.8 + w1 * 0.45));
  col = mix(col, c3, smoothstep(0.55, 1.0, w2) * 0.4 * uv.y);
  vec4 u = texture2D(ui, uv);
  col = mix(col, u.rgb, u.a * uiAmt);
  gl_FragColor = vec4(col * on, 1.0);
  #include <colorspace_fragment>
}`

// content: 'home' | 'wallpaper' | 'off'. Colours ease when they change.
export default function Screen({ width, height, wallpaper, content }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(width, height), [width, height])
  useEffect(() => () => geo.dispose(), [geo])
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1280
    c.height = 720
    return c
  }, [])
  const ui = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [canvas])
  useEffect(() => () => ui.dispose(), [ui])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          c1: { value: new THREE.Color(wallpaper) },
          c2: { value: new THREE.Color() },
          c3: { value: new THREE.Color() },
          t: { value: 0 },
          on: { value: content === 'off' ? 0 : 1 },
          uiAmt: { value: content === 'home' ? 1 : 0 },
          ui: { value: ui },
        },
        vertexShader: vert,
        fragmentShader: frag,
        toneMapped: false,
      }),
    [ui],
  )
  useEffect(() => () => mat.dispose(), [mat])

  const want = useRef({})
  want.current = { wallpaper, content }
  const target = useMemo(() => new THREE.Color(), [])
  const tmp = useMemo(() => ({ dark: new THREE.Color('#10081c'), white: new THREE.Color('#ffffff') }), [])
  const minute = useRef(-1)
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const u = mat.uniforms
    const w = want.current
    u.c1.value.lerp(target.set(w.wallpaper), 1 - Math.exp(-dt * 5))
    u.c2.value.copy(u.c1.value).multiplyScalar(0.28).lerp(tmp.dark, 0.5)
    u.c3.value.copy(u.c1.value).lerp(tmp.white, 0.5)
    u.on.value += ((w.content === 'off' ? 0 : 1) - u.on.value) * (1 - Math.exp(-dt * 7))
    u.uiAmt.value += ((w.content === 'home' ? 1 : 0) - u.uiAmt.value) * (1 - Math.exp(-dt * 7))
    u.t.value = state.clock.elapsedTime
    const now = new Date()
    if (now.getMinutes() !== minute.current) {
      minute.current = now.getMinutes()
      drawHome(canvas.getContext('2d'), canvas.width, canvas.height, now)
      ui.needsUpdate = true
    }
  })

  return <mesh geometry={geo} material={mat} />
}
