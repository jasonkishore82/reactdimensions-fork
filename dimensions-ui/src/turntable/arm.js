// Plan-view layout of the deck, in scene units (1 unit is roughly an inch).
// The deck lies in the x/z plane: +x is right, -z is "up" the page.
export const PLINTH = { w: 9, d: 6, t: 0.4, r: 0.5 }
export const CENTER = { x: -0.47, z: -0.1 } // platter and spindle
export const PIVOT = { x: 3.24, z: -1.76 } // tonearm bearing
export const PUCK = { x: -3.57, z: -2.2 }
export const KNOB = { x: -3.7, z: 2.23 }
export const POWER = { x: 3.76, z: 2.22 }
export const REC_R = 2.78 // 12 inch record
export const LABEL_R = 0.94
export const GROOVE_OUT = 2.68 // first groove
export const GROOVE_IN = 1.08 // run-out

// Arm, in its own frame: the pivot is the origin and the arm points along +z.
// The tube bows out and ends in a headshell turned in towards the record.
export const ARM_PATH = [
  [0, 0.1],
  [0, 0.8],
  [-0.12, 1.6],
  [-0.45, 2.4],
  [-0.85, 2.95],
  [-1.05, 3.3],
]
export const HEADSHELL_YAW = 0.42
const NEEDLE = { x: -0.92, z: 3.62 } // stylus tip, arm frame

// Stylus position in the world for an arm angle theta (rotation about y).
export function needleXZ(theta, out = { x: 0, z: 0 }) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  out.x = PIVOT.x + NEEDLE.x * c + NEEDLE.z * s
  out.z = PIVOT.z - NEEDLE.x * s + NEEDLE.z * c
  return out
}

const tmp = { x: 0, z: 0 }
export function needleRadius(theta) {
  needleXZ(theta, tmp)
  return Math.hypot(tmp.x - CENTER.x, tmp.z - CENTER.z)
}

// Arm angle that puts the stylus at radius r from the spindle. Over this
// range the radius grows with theta, so a bisection finds it.
const LO = -0.85
const HI = 0.6
export function thetaForRadius(r) {
  let lo = LO
  let hi = HI
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (needleRadius(mid) > r) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

export const PARK_R = 3.8 // resting position, clear of the record

// Angle from the pivot to a world point, minus the stylus's own angle, gives
// the arm angle that points the stylus at that point.
export function thetaTowards(x, z) {
  return Math.atan2(x - PIVOT.x, z - PIVOT.z) - Math.atan2(NEEDLE.x, NEEDLE.z)
}
