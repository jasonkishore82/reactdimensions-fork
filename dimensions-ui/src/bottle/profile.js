import * as THREE from 'three'

// Side profile of the glass, [radius, height]. Units are roughly inches: the
// bottle is about 8.4 tall and 2.5 wide, like a 1 litre swing-top bottle.
export const HEIGHT = 8.38
export const LIP_Y = 8.38
export const NECK_Y = 7.2 // where the wire clamp sits

// Outer surface, bottom to top: a pushed-in base, straight sides, a long soft
// shoulder, a tall neck and a rounded lip.
const OUTER = [
  [0.0, 0.34],
  [0.55, 0.3],
  [0.95, 0.16],
  [1.14, 0.05],
  [1.23, 0.16],
  [1.26, 0.5],
  [1.26, 3.7],
  [1.22, 4.5],
  [1.08, 5.3],
  [0.88, 6.0],
  [0.7, 6.55],
  [0.6, 6.95],
  [0.57, 7.5],
  [0.57, 7.85],
  [0.62, 8.05],
  [0.62, 8.28],
  [0.58, 8.38],
]
const WALL = 0.085

// Wall thickness grows towards the base, like real glass.
function wall(y) {
  return WALL + Math.max(0, 0.5 - y) * 0.5
}

function sample(pts, n) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal')
  return curve.getPoints(n).map((p) => [Math.max(p.x, 0), p.y])
}

// A smoothed outer curve, used for the lathe and to place droplets.
export const outerCurve = sample(OUTER, 150)

export function radiusAt(y) {
  let best = outerCurve[0]
  for (const p of outerCurve) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p
  return best[0]
}

// A closed shell: outer wall going up, over the lip, and the inner wall coming
// back down to the floor of the bottle. Normals face outwards everywhere.
export function glassGeometry() {
  const outer = outerCurve.filter((p) => p[0] > 0.001 || p[1] < 0.5)
  const inner = []
  for (let i = outer.length - 1; i >= 0; i--) {
    const [r, y] = outer[i]
    if (y < 0.5) continue
    const iy = y > 8.2 ? Math.min(y, 8.3) : y
    inner.push([Math.max(r - wall(iy), 0), y > 8.3 ? 8.3 : y + (y < 0.9 ? 0.0 : 0)])
  }
  // floor of the inside: thick base
  inner.push([0.0, 0.62])
  const pts = [...outer, ...inner].map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, 96)
  g.computeVertexNormals()
  return g
}
