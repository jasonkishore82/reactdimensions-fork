import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Key layout, in units of one key pitch. Each row lists [label, width].
const PITCH = 0.335
const GAP = 0.03
const ROWS = [
  // function row: shorter keys
  { h: 0.66, keys: [['esc', 1.4], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, 1]), ['⏻', 1.1]] },
  { keys: [...'`1234567890-='.split('').map((c) => [c, 1]), ['del', 2]] },
  { keys: [['tab', 1.5], ...'QWERTYUIOP[]'.split('').map((c) => [c, 1]), ['\\', 1.5]] },
  { keys: [['caps', 1.75], ...'ASDFGHJKL;\''.split('').map((c) => [c, 1]), ['return', 2.25]] },
  { keys: [['shift', 2.25], ...'ZXCVBNM,./'.split('').map((c) => [c, 1]), ['shift', 2.75]] },
  { keys: [['fn', 1], ['ctrl', 1], ['alt', 1], ['super', 1.25], ['', 6], ['super', 1.25], ['alt', 1], ['◀ ▶', 1.5]] },
]
const TOTAL_UNITS = 15
export const KB_W = TOTAL_UNITS * PITCH
const DEPTHS = ROWS.map((r) => (r.h ?? 1) * PITCH)
export const KB_D = DEPTHS.reduce((a, b) => a + b, 0)
// Keycaps stand this far above the deck (about 2 mm); the closed lid clears them.
export const KEY_H = 0.04

// Every key, positioned relative to the middle of the keyboard.
export function layout() {
  const out = []
  let z = -KB_D / 2
  ROWS.forEach((row, ri) => {
    const d = DEPTHS[ri]
    let x = -KB_W / 2
    for (const [label, w] of row.keys) {
      const width = w * PITCH
      out.push({ label, x: x + width / 2, z: z + d / 2, w: width - GAP, d: d - GAP, row: ri })
      x += width
    }
    z += d
  })
  return out
}

const luminance = (c) => {
  const k = new THREE.Color(c)
  return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b
}

// Printed legends, drawn once onto a transparent sheet that sits on the keys.
function legendTexture(keys, color) {
  const PX = 520 // pixels per unit
  const W = Math.round(KB_W * PX)
  const H = Math.round(KB_D * PX)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const k of keys) {
    if (!k.label) continue
    const cx = (k.x + KB_W / 2) * PX
    const cy = (k.z + KB_D / 2) * PX
    const small = k.label.length > 1
    g.font = `500 ${(k.row === 0 ? 0.075 : small ? 0.08 : 0.115) * PX}px "IBM Plex Mono", Menlo, monospace`
    // longer words sit at the bottom-left of the key, like a real keyboard
    if (small && k.w > PITCH * 1.4 && k.row > 0) {
      g.textAlign = k.x < 0 ? 'left' : 'right'
      g.fillText(k.label, k.x < 0 ? cx - k.w * PX * 0.38 : cx + k.w * PX * 0.38, cy + k.d * PX * 0.2)
      g.textAlign = 'center'
    } else g.fillText(k.label, cx, cy)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// keyMat: the key material (its colour is animated by the parent). legendColor: printed letters.
export default function Keyboard({ y, keyMat, legendColor = '#ffffff' }) {
  const keys = useMemo(layout, [])
  const mesh = useRef()
  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.2), [])
  useEffect(() => () => geo.dispose(), [geo])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    keys.forEach((k, i) => {
      m.compose(new THREE.Vector3(k.x, KEY_H / 2, k.z), new THREE.Quaternion(), new THREE.Vector3(k.w, KEY_H, k.d))
      mesh.current.setMatrixAt(i, m)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [keys])

  const legends = useMemo(() => legendTexture(keys, '#ffffff'), [keys])
  useEffect(() => () => legends.dispose(), [legends])

  return (
    <group position={[0, y, 0]}>
      <instancedMesh ref={mesh} args={[geo, undefined, keys.length]} castShadow receiveShadow>
        {keyMat}
      </instancedMesh>
      {/* legends: the sheet's colour is set from the parent so it can follow the key colour */}
      <mesh position={[0, KEY_H + 0.0025, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[KB_W, KB_D]} />
        <meshBasicMaterial map={legends} color={legendColor} transparent depthWrite={false} toneMapped={false} opacity={0.75} />
      </mesh>
    </group>
  )
}
export { luminance }
