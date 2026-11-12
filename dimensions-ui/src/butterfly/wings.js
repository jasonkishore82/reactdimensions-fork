import * as THREE from 'three'

// Wing outlines and painted patterns. Each wing is drawn for the RIGHT side in
// its own plane: x runs along the body (+x towards the head), z runs out from
// the body, and the root (where it hinges on the thorax) is near (0, 0). The
// left wings are mirror images.

export const SPECIES = ['monarch', 'morpho', 'swallowtail', 'peacock', 'cabbage white', 'glasswing']

// control points, smoothed into a closed outline
const FORE = [
  [0.2, 0.0], [0.42, 0.45], [0.66, 1.0], [0.66, 1.3], [0.42, 1.44], [0.08, 1.3], [-0.2, 0.95], [-0.24, 0.45], [-0.08, 0.04],
]
const HIND = [
  [0.06, 0.02], [-0.02, 0.5], [-0.2, 0.98], [-0.55, 1.08], [-0.9, 0.82], [-1.02, 0.5], [-0.82, 0.22], [-0.4, 0.03],
]
const HIND_TAILED = [
  [0.06, 0.02], [-0.02, 0.5], [-0.2, 0.98], [-0.55, 1.08], [-0.86, 0.86], [-1.0, 0.66], [-1.42, 0.62], [-1.0, 0.48], [-0.82, 0.22], [-0.4, 0.03],
]

function smoothOutline(ctrl, n = 120) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, z, 0)), true, 'centripetal')
  return curve.getPoints(n).slice(0, n).map((p) => [p.x, p.y])
}

export function outlines(species) {
  return { fore: smoothOutline(FORE), hind: smoothOutline(species === 'swallowtail' ? HIND_TAILED : HIND) }
}

// A flat wing in the x/z plane (y up), with UVs filling 0..1 over its bounds.
export function wingGeometry(outline) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ShapeGeometry(shape, 1)
  const b = bounds(outline)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getY(i)
    uv.setXY(i, (x - b.minX) / (b.maxX - b.minX), (z - b.minZ) / (b.maxZ - b.minZ))
    pos.setXYZ(i, x, 0, z) // lay it flat: shape y becomes z
  }
  g.computeVertexNormals()
  return g
}

function bounds(pts) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of pts) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  return { minX, maxX, minZ, maxZ }
}

// Paint one wing. Coordinates are mapped from wing space to the canvas the same
// way the UVs are, so the pattern lands on the shape exactly.
export function wingTexture(outline, kind, species) {
  const S = 1024
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const b = bounds(outline)
  const P = (x, z) => [((x - b.minX) / (b.maxX - b.minX)) * S, ((b.maxZ - z) / (b.maxZ - b.minZ)) * S]
  const k = S / (b.maxX - b.minX) // canvas pixels per unit, roughly
  const path = () => {
    g.beginPath()
    outline.forEach(([x, z], i) => {
      const [px, py] = P(x, z)
      i ? g.lineTo(px, py) : g.moveTo(px, py)
    })
    g.closePath()
  }
  const root = kind === 'fore' ? [0.0, 0.05] : [-0.1, 0.05]
  const inset = (i, t) => {
    const [x, z] = outline[i]
    return [x + (root[0] - x) * t, z + (root[1] - z) * t]
  }
  const dot = (x, z, r, col) => {
    const [px, py] = P(x, z)
    g.fillStyle = col
    g.beginPath()
    g.arc(px, py, r * k, 0, Math.PI * 2)
    g.fill()
  }
  const veins = (col, w, every = 8) => {
    g.strokeStyle = col
    g.lineWidth = w * k
    g.lineCap = 'round'
    const [rx, rz] = P(...root)
    for (let i = 0; i < outline.length; i += every) {
      const [px, py] = P(...outline[i])
      g.beginPath()
      g.moveTo(rx, rz)
      g.quadraticCurveTo((rx + px) / 2 + (py - rz) * 0.06, (rz + py) / 2 - (px - rx) * 0.06, px, py)
      g.stroke()
    }
  }
  const border = (col, w) => {
    path()
    g.strokeStyle = col
    g.lineWidth = w * k
    g.lineJoin = 'round'
    g.stroke()
  }

  g.clearRect(0, 0, S, S)
  g.save()
  path()
  g.clip()
  const [rx, ry] = P(...root)

  if (species === 'monarch') {
    g.fillStyle = '#ee7d17'
    g.fillRect(0, 0, S, S)
    const sh = g.createRadialGradient(rx, ry, 0, rx, ry, S)
    sh.addColorStop(0, 'rgba(120,40,0,0.35)')
    sh.addColorStop(0.5, 'rgba(0,0,0,0)')
    g.fillStyle = sh
    g.fillRect(0, 0, S, S)
    veins('#141210', 0.035)
    border('#141210', 0.2)
    if (kind === 'fore') {
      // the black wing tip with its orange and white spots
      const [ax, az] = P(0.5, 1.32)
      g.fillStyle = '#141210'
      g.beginPath()
      g.ellipse(ax, az, 0.36 * k, 0.26 * k, -0.6, 0, Math.PI * 2)
      g.fill()
      ;[[0.48, 1.18, '#f6a35a'], [0.36, 1.25, '#fff'], [0.55, 1.05, '#f6a35a'], [0.28, 1.35, '#fff']].forEach(([x, z, col]) => dot(x, z, 0.035, col))
    }
    for (let i = 0; i < outline.length; i += 4) {
      const [x, z] = inset(i, 0.05)
      dot(x, z, 0.022, '#fbfaf2')
    }
  } else if (species === 'morpho') {
    const grd = g.createRadialGradient(rx, ry, 0, rx, ry, S * 0.95)
    grd.addColorStop(0, '#071a5e')
    grd.addColorStop(0.35, '#1666ff')
    grd.addColorStop(0.7, '#3fc4ff')
    grd.addColorStop(1, '#0a2f8a')
    g.fillStyle = grd
    g.fillRect(0, 0, S, S)
    veins('rgba(5,20,70,0.55)', 0.02)
    border('#0b0d14', 0.3)
    if (kind === 'fore') [[0.42, 1.3], [0.55, 1.18], [0.3, 1.36]].forEach(([x, z]) => dot(x, z, 0.03, '#e8f2ff'))
  } else if (species === 'swallowtail') {
    g.fillStyle = '#f6d43a'
    g.fillRect(0, 0, S, S)
    g.strokeStyle = '#151515'
    g.lineCap = 'butt'
    if (kind === 'fore') {
      // black tiger stripes running out from the leading edge
      ;[0.55, 0.32, 0.1, -0.1].forEach((x, i) => {
        const [a, aa] = P(x + 0.12, 1.45)
        const [b2, bb] = P(x - 0.12, 0.1 + i * 0.05)
        g.lineWidth = (0.09 - i * 0.012) * k
        g.beginPath()
        g.moveTo(a, aa)
        g.lineTo(b2, bb)
        g.stroke()
      })
    }
    veins('#151515', 0.03)
    border('#151515', 0.3)
    for (let i = 2; i < outline.length; i += 6) {
      const [x, z] = inset(i, 0.07)
      dot(x, z, 0.03, '#f6d43a')
    }
    if (kind === 'hind') {
      for (let i = 30; i < 90; i += 9) {
        const [x, z] = inset(i, 0.17)
        dot(x, z, 0.03, '#3a6fd8')
      }
      dot(-0.92, 0.42, 0.075, '#f07a1a')
      dot(-0.92, 0.42, 0.035, '#151515')
    }
  } else if (species === 'peacock') {
    const grd = g.createRadialGradient(rx, ry, 0, rx, ry, S)
    grd.addColorStop(0, '#4a1810')
    grd.addColorStop(0.35, '#a62a1c')
    grd.addColorStop(1, '#7a1e14')
    g.fillStyle = grd
    g.fillRect(0, 0, S, S)
    veins('rgba(40,10,5,0.4)', 0.02)
    border('#2a1410', 0.12)
    const eye = (x, z, r) => {
      dot(x, z, r, '#f2d8a0')
      dot(x, z, r * 0.82, '#1a1416')
      dot(x, z, r * 0.6, '#2f5fae')
      dot(x - r * 0.25, z + r * 0.15, r * 0.18, '#e8f0ff')
    }
    if (kind === 'fore') {
      eye(0.42, 1.18, 0.2)
      dot(0.1, 1.28, 0.07, '#f2d8a0')
    } else eye(-0.55, 0.75, 0.24)
  } else if (species === 'cabbage white') {
    g.fillStyle = '#f4f2e8'
    g.fillRect(0, 0, S, S)
    const sh = g.createRadialGradient(rx, ry, 0, rx, ry, S * 0.5)
    sh.addColorStop(0, 'rgba(90,95,90,0.45)')
    sh.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = sh
    g.fillRect(0, 0, S, S)
    veins('rgba(120,120,110,0.25)', 0.012)
    if (kind === 'fore') {
      const [ax, az] = P(0.55, 1.36)
      g.fillStyle = '#5b5d5c'
      g.beginPath()
      g.ellipse(ax, az, 0.3 * k, 0.16 * k, -0.6, 0, Math.PI * 2)
      g.fill()
      dot(0.22, 0.95, 0.06, '#2a2b2b')
    }
  } else {
    // glasswing: clear panels framed in brown, a white bar near the tip
    g.fillStyle = 'rgba(255,255,255,0.12)'
    g.fillRect(0, 0, S, S)
    veins('rgba(70,40,25,0.85)', 0.018)
    border('#4a2a18', 0.16)
    if (kind === 'fore') {
      const [a, aa] = P(0.62, 1.12)
      const [b2, bb] = P(0.28, 1.36)
      g.strokeStyle = 'rgba(255,255,255,0.95)'
      g.lineWidth = 0.08 * k
      g.beginPath()
      g.moveTo(a, aa)
      g.lineTo(b2, bb)
      g.stroke()
    }
  }
  g.restore()

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
