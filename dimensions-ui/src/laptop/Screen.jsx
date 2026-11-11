import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export const SCREEN_W = 5.8
export const SCREEN_H = 3.625

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

// The interface drawn over the wallpaper: a menu bar, two windows and a dock.
// All generic, in translucent white so it works over any wallpaper colour.
function drawDesktop(g, W, H, now) {
  g.clearRect(0, 0, W, H)
  const glass = (x, y, w, h, r, a = 0.2) => {
    g.fillStyle = `rgba(255,255,255,${a})`
    g.beginPath()
    g.roundRect(x, y, w, h, r)
    g.fill()
  }
  // menu bar
  g.fillStyle = 'rgba(0,0,0,0.22)'
  g.fillRect(0, 0, W, 34)
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.font = '600 17px "Hanken Grotesk", system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText('◼  Dimensions', 20, 18)
  g.font = '400 16px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText('File    Edit    View    Window', 168, 18)
  const pad = (n) => String(n).padStart(2, '0')
  g.textAlign = 'right'
  g.fillText(`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()]} ${now.getDate()}   ${pad(now.getHours())}:${pad(now.getMinutes())}`, W - 20, 18)
  g.textAlign = 'left'

  // code window
  glass(70, 90, 520, 330, 16, 0.16)
  g.fillStyle = 'rgba(10,10,14,0.72)'
  g.beginPath()
  g.roundRect(70, 90, 520, 330, 16)
  g.fill()
  for (let i = 0; i < 3; i++) {
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.beginPath()
    g.arc(540 + i * 14, 112, 4.5, 0, Math.PI * 2)
    g.fill()
  }
  g.font = '500 17px "IBM Plex Mono", Menlo, monospace'
  const code = [
    ['import', ' { Laptop } ', 'from', " 'react-dimensions'"],
    ['', '', '', ''],
    ['export default function', ' App() {', '', ''],
    ['  return ', '<Laptop', '', ''],
    ['    body', '="orange"', '', ''],
    ['    open', '={0.9}', '', ''],
    ['  />', '', '', ''],
    ['}', '', '', ''],
  ]
  const cols = ['#ff9a4d', '#f2efe6', '#ff9a4d', '#a8e08a']
  code.forEach((line, i) => {
    let x = 96
    line.forEach((seg, j) => {
      g.fillStyle = cols[j]
      g.fillText(seg, x, 150 + i * 30)
      x += g.measureText(seg).width
    })
  })

  // widget cards on the right
  glass(640, 90, 300, 150, 16, 0.22)
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.font = '600 18px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText('This week', 664, 122)
  const bars = [0.4, 0.62, 0.5, 0.8, 0.55, 0.92, 0.7]
  bars.forEach((b, i) => {
    g.fillStyle = i === 5 ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.45)'
    g.beginPath()
    g.roundRect(664 + i * 38, 218 - b * 70, 24, b * 70, 5)
    g.fill()
  })
  glass(640, 262, 300, 158, 16, 0.2)
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.font = '300 66px "Hanken Grotesk", system-ui, sans-serif'
  g.fillText(`${pad(now.getHours())}:${pad(now.getMinutes())}`, 664, 332)
  g.font = '500 17px "Hanken Grotesk", system-ui, sans-serif'
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.fillText('Next: design review', 664, 384)

  // dock
  const icons = ['#ffffff', '#ffd27a', '#7ad0ff', '#a5f0b0', '#ff9db5', '#c8b0ff', '#ffffff']
  const dw = icons.length * 62 + 26
  glass((W - dw) / 2, H - 82, dw, 66, 22, 0.24)
  icons.forEach((c, i) => {
    g.fillStyle = c
    g.globalAlpha = 0.92
    g.beginPath()
    g.roundRect((W - dw) / 2 + 20 + i * 62, H - 72, 46, 46, 12)
    g.fill()
    g.globalAlpha = 1
  })
}

const vert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

// Sunset waves in three colours that can be animated, with the interface on top.
const frag = `
uniform vec3 c1; uniform vec3 c2; uniform vec3 c3;
uniform float t; uniform float on;
uniform sampler2D ui;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float w1 = sin(uv.x * 3.2 + t * 0.18 + sin(uv.y * 2.4 + t * 0.1) * 1.6) * 0.5 + 0.5;
  float w2 = sin(uv.x * 5.5 - uv.y * 3.4 + t * 0.12) * 0.5 + 0.5;
  float w3 = sin(uv.x * 2.0 + uv.y * 4.0 - t * 0.09) * 0.5 + 0.5;
  vec3 col = mix(c1, c2, smoothstep(0.05, 0.95, (1.0 - uv.y) * 0.85 + w1 * 0.4));
  col = mix(col, c3, smoothstep(0.55, 1.0, w2) * 0.4 * uv.y);
  col = mix(col, c2, smoothstep(0.6, 1.0, w3) * 0.25);
  vec4 u = texture2D(ui, uv);
  col = mix(col, u.rgb, u.a);
  gl_FragColor = vec4(col * on, 1.0);
  #include <colorspace_fragment>
}`

// wallpaper: the wallpaper colour. Smoothly follows when it changes.
export default function Screen({ wallpaper, on = true, lid }) {
  const geo = useMemo(() => {
    const g = new THREE.ShapeGeometry(roundedRect(SCREEN_W, SCREEN_H, 0.04), 8)
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SCREEN_W + 0.5, p.getY(i) / SCREEN_H + 0.5)
    return g
  }, [])

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 640
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
          on: { value: on ? 1 : 0 },
          ui: { value: ui },
        },
        vertexShader: vert,
        fragmentShader: frag,
        toneMapped: false,
      }),
    [ui],
  )
  useEffect(() => () => mat.dispose(), [mat])

  const target = useRef(new THREE.Color(wallpaper))
  const onRef = useRef(on)
  const minute = useRef(-1)
  const tmp = useMemo(() => ({ a: new THREE.Color(), b: new THREE.Color('#2a0a3c'), w: new THREE.Color('#ffffff') }), [])
  target.current.set(wallpaper)
  onRef.current = on

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const u = mat.uniforms
    // colours follow the target with a smooth ease, so swapping looks like a cross-fade
    u.c1.value.lerp(target.current, 1 - Math.exp(-dt * 5))
    tmp.a.copy(u.c1.value).multiplyScalar(0.3).lerp(tmp.b, 0.45)
    u.c2.value.copy(tmp.a)
    u.c3.value.copy(u.c1.value).lerp(tmp.w, 0.55)
    // asleep when switched off or when the lid is nearly shut
    const awake = onRef.current && (!lid || lid.current.theta > 0.35)
    u.on.value += ((awake ? 1 : 0) - u.on.value) * (1 - Math.exp(-dt * 8))
    u.t.value = state.clock.elapsedTime
    const now = new Date()
    if (now.getMinutes() !== minute.current) {
      minute.current = now.getMinutes()
      drawDesktop(canvas.getContext('2d'), canvas.width, canvas.height, now)
      ui.needsUpdate = true
    }
  })

  return <mesh geometry={geo} material={mat} />
}
