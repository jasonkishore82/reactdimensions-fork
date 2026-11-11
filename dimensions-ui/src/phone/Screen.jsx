import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { outline, shapeOf } from './outline.js'

// A lock screen and a home screen drawn in generic shapes (no real app icons).
function draw(g, W, H, mode, now) {
  g.clearRect(0, 0, W, H)
  const pad = (n) => String(n).padStart(2, '0')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const glass = (x, y, w, h, r, a) => {
    g.fillStyle = `rgba(255,255,255,${a})`
    g.beginPath()
    g.roundRect(x, y, w, h, r)
    g.fill()
  }
  g.textBaseline = 'middle'

  // home indicator, on both
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  g.roundRect(W / 2 - 80, H - 36, 160, 8, 4)
  g.fill()

  if (mode === 'lock') {
    g.textAlign = 'center'
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.font = '500 34px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText(`${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`, W / 2, 230)
    g.fillStyle = '#fff'
    g.font = '600 210px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText(`${now.getHours()}:${pad(now.getMinutes())}`, W / 2, 360)
    // notification
    glass(34, 690, W - 68, 130, 36, 0.24)
    g.textAlign = 'left'
    g.fillStyle = '#fff'
    g.font = '600 30px "Hanken Grotesk", system-ui, sans-serif'
    g.fillText('Dimensions', 118, 728)
    g.font = '400 28px "Hanken Grotesk", system-ui, sans-serif'
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.fillText('Your order is on its way.', 118, 772)
    glass(58, 716, 44, 44, 11, 0.9)
    // flashlight and camera
    for (const x of [70, W - 70]) {
      g.fillStyle = 'rgba(0,0,0,0.38)'
      g.beginPath()
      g.arc(x, H - 130, 48, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#fff'
    g.fillRect(58, H - 150, 24, 14)
    g.fillRect(64, H - 136, 12, 30)
    g.beginPath()
    g.roundRect(W - 96, H - 148, 52, 36, 9)
    g.fill()
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.beginPath()
    g.arc(W - 70, H - 130, 11, 0, Math.PI * 2)
    g.fill()
    return
  }

  // status bar
  g.fillStyle = '#fff'
  g.textAlign = 'left'
  g.font = '600 31px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText(`${now.getHours()}:${pad(now.getMinutes())}`, 62, 52)
  g.fillRect(W - 168, 54, 6, 12)
  g.fillRect(W - 156, 48, 6, 18)
  g.fillRect(W - 144, 42, 6, 24)
  g.fillRect(W - 132, 36, 6, 30)
  g.strokeStyle = '#fff'
  g.lineWidth = 3
  g.beginPath()
  g.roundRect(W - 100, 36, 56, 28, 9)
  g.stroke()
  g.beginPath()
  g.roundRect(W - 95, 41, 40, 18, 5)
  g.fill()

  // widgets
  glass(34, 110, (W - 90) / 2, 250, 40, 0.24)
  glass(W / 2 + 11, 110, (W - 90) / 2, 250, 40, 0.24)
  g.fillStyle = '#fff'
  g.font = '600 30px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText('Local', 62, 150)
  g.font = '300 88px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText('21°', 60, 240)
  g.font = '400 26px "Hanken Grotesk", system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillText('Clear all day', 62, 320)
  g.fillStyle = '#fff'
  g.font = '600 30px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText('Steps', W / 2 + 40, 150)
  const bars = [0.35, 0.6, 0.45, 0.8, 0.55, 0.95, 0.7]
  bars.forEach((b, i) => {
    g.fillStyle = i === 5 ? '#fff' : 'rgba(255,255,255,0.5)'
    g.beginPath()
    g.roundRect(W / 2 + 40 + i * 33, 330 - b * 130, 20, b * 130, 6)
    g.fill()
  })

  // app grid: generic coloured squares
  const hues = [210, 25, 140, 340, 50, 270, 190, 8, 100, 300, 230, 70, 160, 0, 40, 250]
  const cols = 4
  const cell = (W - 68) / cols
  for (let i = 0; i < 16; i++) {
    const x = 34 + (i % cols) * cell + (cell - 104) / 2
    const y = 400 + Math.floor(i / cols) * 150
    const grad = g.createLinearGradient(x, y, x + 104, y + 104)
    grad.addColorStop(0, `hsl(${hues[i]} 80% 62%)`)
    grad.addColorStop(1, `hsl(${(hues[i] + 35) % 360} 75% 42%)`)
    g.fillStyle = grad
    g.beginPath()
    g.roundRect(x, y, 104, 104, 26)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.88)'
    g.beginPath()
    g.roundRect(x + 30, y + 32, 44, 10, 5)
    g.fill()
  }
  // dock
  glass(24, H - 220, W - 48, 150, 48, 0.26)
  for (let i = 0; i < 4; i++) {
    const x = 24 + (W - 48 - cell * 4) / 2 + i * cell + (cell - 104) / 2
    const grad = g.createLinearGradient(x, H - 198, x + 104, H - 94)
    grad.addColorStop(0, `hsl(${hues[(i * 3 + 2) % 16]} 80% 62%)`)
    grad.addColorStop(1, `hsl(${(hues[(i * 3 + 2) % 16] + 35) % 360} 75% 42%)`)
    g.fillStyle = grad
    g.beginPath()
    g.roundRect(x, H - 198, 104, 104, 26)
    g.fill()
  }
}

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const frag = `
uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
uniform float t; uniform float on; uniform float uiAmt;
uniform sampler2D ui;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float w1 = sin(uv.y * 3.2 + uv.x * 2.0 + t * 0.2 + sin(uv.x * 3.0 + t * 0.12) * 1.4) * 0.5 + 0.5;
  float w2 = sin(uv.y * 5.0 - uv.x * 3.0 + t * 0.14) * 0.5 + 0.5;
  vec3 col = mix(c1, c2, smoothstep(0.05, 0.95, (1.0 - uv.y) * 0.9 + w1 * 0.35));
  col = mix(col, c3, smoothstep(0.5, 1.0, w2) * 0.4 * uv.y);
  vec4 u = texture2D(ui, uv);
  col = mix(col, u.rgb, u.a * uiAmt);
  gl_FragColor = vec4(col * on, 1.0);
  #include <colorspace_fragment>
}`

// mode: 'lock' | 'home' | 'off'. The wallpaper colour eases when it changes.
export default function Screen({ width, height, radius, wallpaper, mode }) {
  const geo = useMemo(() => {
    const g = new THREE.ShapeGeometry(shapeOf(outline(width, height, radius, 3.2, 12)), 1)
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / width + 0.5, p.getY(i) / height + 0.5)
    return g
  }, [width, height, radius])
  useEffect(() => () => geo.dispose(), [geo])

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 560
    c.height = Math.round((560 * height) / width)
    return c
  }, [width, height])
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
          on: { value: mode === 'off' ? 0 : 1 },
          uiAmt: { value: mode === 'off' ? 0 : 1 },
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
  want.current = { wallpaper, mode }
  const target = useMemo(() => new THREE.Color(), [])
  const tmp = useMemo(() => ({ dark: new THREE.Color('#0c0618'), white: new THREE.Color('#ffffff') }), [])
  const last = useRef('')
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const u = mat.uniforms
    const w = want.current
    u.c1.value.lerp(target.set(w.wallpaper), 1 - Math.exp(-dt * 5))
    u.c2.value.copy(u.c1.value).multiplyScalar(0.3).lerp(tmp.dark, 0.5)
    u.c3.value.copy(u.c1.value).lerp(tmp.white, 0.5)
    u.on.value += ((w.mode === 'off' ? 0 : 1) - u.on.value) * (1 - Math.exp(-dt * 7))
    u.t.value = state.clock.elapsedTime
    const now = new Date()
    const key = `${w.mode}|${now.getMinutes()}`
    if (key !== last.current && w.mode !== 'off') {
      last.current = key
      draw(canvas.getContext('2d'), canvas.width, canvas.height, w.mode, now)
      ui.needsUpdate = true
    }
  })

  return <mesh geometry={geo} material={mat} />
}
