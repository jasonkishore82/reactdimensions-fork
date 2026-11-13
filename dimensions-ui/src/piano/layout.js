// Dimensions of the grand, in centimetres. x runs bass (left) -> treble,
// y is up from the floor, the keyboard's front edge is at z = 0 and the case
// runs back towards -z. "Depth" below means distance back from the keys (-z).

export const FIRST_NOTE = 21 // A0
export const LAST_NOTE = 108 // C8
export const WHITE_W = 2.35
const BLACK_PCS = new Set([1, 3, 6, 8, 10])
const BLACK_SHIFT = { 1: -0.25, 3: 0.25, 6: -0.3, 8: 0, 10: 0.3 }
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const noteName = (n) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`

function buildKeys() {
  const keys = []
  let whites = 0
  for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
    const pc = midi % 12
    if (BLACK_PCS.has(pc)) keys.push({ midi, black: true, x: whites * WHITE_W + BLACK_SHIFT[pc] * WHITE_W * 0.4 })
    else keys.push({ midi, black: false, x: whites * WHITE_W + WHITE_W / 2 }), whites++
  }
  const width = whites * WHITE_W
  keys.forEach((k, i) => {
    k.x -= width / 2
    k.i = i
  })
  return { keys, width }
}
export const { keys: KEYS, width: KEYBOARD_WIDTH } = buildKeys()

export const KEY_Y = 72 // top of the white keys
export const WHITE_LEN = 15
export const BLACK_LEN = 9.5
export const CHEEK = 7.5 // the blocks at each end of the keyboard
export const HALF = KEYBOARD_WIDTH / 2 + CHEEK // half the case's width
export const CASE_FRONT = 17 // depth where the rim starts, behind the fallboard
export const TAIL = 178 // depth of the tail
export const RIM_BOTTOM = 60
export const RIM_TOP = 92

// The case outline seen from above, as [x, depth] points: the straight
// spine on the bass side, the long bentside curving round to the tail.
// `t` insets it (for the inner rim, the plate...).
export function outlinePoints(t = 0, front = CASE_FRONT + t) {
  const X = HALF - t
  const pts = [[-X, front], [X, front], [X, 62]]
  // bentside: a cubic from the end of the treble side round to the tail
  const P = [[X, 62], [X, 140 - t], [42 - t, 166 - t], [-X + 6, TAIL - t]]
  for (let i = 1; i <= 48; i++) {
    const s = i / 48
    const a = (1 - s) ** 3
    const b = 3 * (1 - s) ** 2 * s
    const c = 3 * (1 - s) * s * s
    const d = s ** 3
    pts.push([a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]])
  }
  // round the tail corner into the spine
  pts.push([-X + 1.5, TAIL - t - 0.6], [-X, TAIL - t - 3])
  return pts
}

// how far back the inside of the case reaches at x (where strings can end)
const INNER = outlinePoints(2.6).slice(2)
export function innerDepth(x) {
  let best = CASE_FRONT
  for (let i = 0; i < INNER.length - 1; i++) {
    const [x0, d0] = INNER[i]
    const [x1, d1] = INNER[i + 1]
    if ((x0 - x) * (x1 - x) <= 0 && x0 !== x1) best = Math.max(best, d0 + ((x - x0) / (x1 - x0)) * (d1 - d0))
  }
  return best
}

// The action, front to back: hammers strike just behind the front bridge,
// dampers sit on the strings a little further back.
export const STRING_Y = 80
export const PIN_DEPTH = 24 // tuning pins
export const HAMMER_DEPTH = 34
export const DAMPER_DEPTH = 40
export const DAMPER_TOP = 90 // keys above this midi note have no dampers

// One to three strings per note, the bass ones copper-wound.
export const STRINGS = []
for (const k of KEYS) {
  const n = k.midi <= 32 ? 1 : k.midi <= 48 ? 2 : 3
  const x = k.x * 0.94
  const back = innerDepth(x) - 7
  for (let j = 0; j < n; j++) {
    STRINGS.push({
      note: k.i,
      x: x + (j - (n - 1) / 2) * 0.24,
      front: PIN_DEPTH + 1 + (j % 2) * 1.2,
      back,
      thick: k.midi <= 32 ? 0.26 - (k.midi - 21) * 0.006 : k.midi <= 48 ? 0.15 : 0.1,
      wound: k.midi <= 40,
    })
  }
}
