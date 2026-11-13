// The physics of the strings, kept apart from the drawing. SI units in here
// (metres, newtons, kilograms) unless a name says otherwise.
//
// A string fixed at both ends sounds at  f = (1 / 2L) * sqrt(T / mu)
//   L  vibrating length (saddle to nut, or saddle to the fret it is pressed on)
//   T  tension, set by how far the tuner has wound the string
//   mu mass per metre, fixed by the gauge
//
// Winding the post by an angle d(theta) pulls in r * d(theta) of string, which
// stretches it, and the tension rises by  dT = (E * A / Ltot) * r * d(theta)
// (Hooke's law over the whole stretched length, nut to post included). The
// tuner is an 18:1 worm drive, so one full turn of the key turns the post 20°.
//
// Plucked at a fraction b of its length and let go, the string's shape is a
// triangle, which is the sum of the string's modes n = 1, 2, 3...:
//   y_n = (2h / (n² π² b (1 - b))) sin(n π b)
// so plucking near the bridge (small b) keeps the high modes strong (bright),
// plucking at the middle loses every even mode (hollow). Wound steel is a
// little stiff, so mode n sits slightly sharp of n f: f_n = n f sqrt(1 + B n²).

export const SCALE = 0.645 // m, nut to saddle (25.4")
export const GEAR_RATIO = 18
export const POST_RADIUS = 0.0029 // m, the post plus the first wrap of string
const STEEL_E = 200e9 // Pa
const KGF = 9.80665
const INCH = 0.0254

// low E to high e, a light-gauge phosphor bronze set
export const STRINGS = [
  { name: 'E', octave: 2, freq: 82.41, gauge: 0.053, core: 0.019, tensionKg: 12.1, wound: true, B: 0.00004 },
  { name: 'A', octave: 2, freq: 110.0, gauge: 0.042, core: 0.017, tensionKg: 13.1, wound: true, B: 0.00005 },
  { name: 'D', octave: 3, freq: 146.83, gauge: 0.032, core: 0.015, tensionKg: 13.9, wound: true, B: 0.00007 },
  { name: 'G', octave: 3, freq: 196.0, gauge: 0.024, core: 0.012, tensionKg: 13.6, wound: true, B: 0.0001 },
  { name: 'B', octave: 3, freq: 246.94, gauge: 0.016, core: 0.016, tensionKg: 10.6, wound: false, B: 0.00025 },
  { name: 'e', octave: 4, freq: 329.63, gauge: 0.012, core: 0.012, tensionKg: 10.6, wound: false, B: 0.0003 },
].map((s, i) => {
  const T0 = s.tensionKg * KGF
  const area = Math.PI * ((s.core * INCH) / 2) ** 2
  return {
    ...s,
    index: i,
    T0,
    mu: T0 / (2 * SCALE * s.freq) ** 2, // kg/m, from the set's published tension at pitch
    EA: STEEL_E * area, // N per unit strain
    radius: (s.gauge * INCH) / 2,
  }
})

// nut-to-post lengths differ by post; this is the stretched length in total
export const TOTAL_LENGTH = [0.73, 0.75, 0.77, 0.77, 0.75, 0.73]

// tension added per radian of the tuner key (not the post)
export const springPerKeyRad = (i) => (STRINGS[i].EA / TOTAL_LENGTH[i]) * POST_RADIUS / GEAR_RATIO

export function tensionAt(i, keyAngle) {
  return Math.max(STRINGS[i].T0 * 0.04, STRINGS[i].T0 + springPerKeyRad(i) * keyAngle)
}

// the key angle that puts a string `cents` off pitch
export function keyAngleFor(i, cents) {
  const ratio = 2 ** ((2 * cents) / 1200) // tension goes as frequency squared
  return (STRINGS[i].T0 * (ratio - 1)) / springPerKeyRad(i)
}

// pressing a string down onto a fret stretches it a little more (the classic
// "fretting sharp"): the deflection d over the two spans a (to nut) and b (to
// saddle) lengthens it by about d²/2 (1/a + 1/b)
export function fretStretchTension(i, fret, deflection) {
  if (fret <= 0) return 0
  const a = SCALE * (1 - 2 ** (-fret / 12))
  const b = SCALE - a
  const stretch = (deflection * deflection) / 2 * (1 / a + 1 / b)
  return (STRINGS[i].EA / TOTAL_LENGTH[i]) * stretch
}

export function frequency(i, T, fret = 0) {
  const L = SCALE * 2 ** (-Math.max(0, fret) / 12)
  return Math.sqrt(T / STRINGS[i].mu) / (2 * L)
}

// mode amplitudes of a string plucked at fraction b, height h
export function pluckModes(b, h, count) {
  const out = new Float32Array(count)
  const k = (2 * h) / (Math.PI * Math.PI * b * (1 - b))
  for (let n = 1; n <= count; n++) out[n - 1] = (k / (n * n)) * Math.sin(n * Math.PI * b)
  return out
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

// nearest note and how many cents off it a frequency is
export function noteOf(f) {
  const midi = 69 + 12 * Math.log2(f / 440)
  const near = Math.round(midi)
  return { name: NAMES[((near % 12) + 12) % 12], octave: Math.floor(near / 12) - 1, cents: (midi - near) * 100 }
}

export const centsBetween = (f, ref) => 1200 * Math.log2(f / ref)

// chord shapes, low E to high e: fret number, 0 open, -1 muted
export const CHORDS = {
  Open: [0, 0, 0, 0, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  G: [3, 2, 0, 0, 0, 3],
  C: [-1, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  Am: [-1, 0, 2, 2, 1, 0],
  E: [0, 2, 2, 1, 0, 0],
  A: [-1, 0, 2, 2, 2, 0],
  Dm: [-1, -1, 0, 2, 3, 1],
}
