import * as THREE from 'three'

// A rounded rectangle with "squircle" corners (a superellipse), like a phone.
// Points run anticlockwise. n = 2 is a circular corner; larger is squarer.
export function outline(w, h, r, n = 3.2, seg = 14) {
  const pts = []
  const corners = [
    [w / 2 - r, h / 2 - r, 0],
    [-(w / 2 - r), h / 2 - r, 90],
    [-(w / 2 - r), -(h / 2 - r), 180],
    [w / 2 - r, -(h / 2 - r), 270],
  ]
  const sp = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e)
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const t = THREE.MathUtils.degToRad(a0 + (i / seg) * 90)
      pts.push([cx + r * sp(Math.cos(t), 2 / n), cy + r * sp(Math.sin(t), 2 / n)])
    }
  }
  return pts
}

export function shapeOf(pts, holes = []) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  for (const hole of holes) {
    const p = new THREE.Path()
    hole.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)))
    p.closePath()
    s.holes.push(p)
  }
  return s
}
