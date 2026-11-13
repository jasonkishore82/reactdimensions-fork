// Guitar sound, made in WebAudio so there are no files to ship. It is driven
// by the same string model as the picture (strings.js):
//
//   pluck  one voice per string: a bank of sine partials at the string's
//          (slightly stretched) harmonics, with the amplitudes a triangle
//          pluck at that point gives, times n for the force each mode puts
//          on the bridge. High partials die faster. A re-pluck damps the
//          old note on that string; retuning or fretting slides the pitch.
//   mute   a muted string: the same partials, choked within ~50 ms
//   knock  a knuckle on the body: the air and top resonances, briefly
//
// Everything runs through the "body": peaks at the air (Helmholtz) resonance
// near 100 Hz and the top's first modes, then a small synthetic room.
import { STRINGS } from './strings.js'

let ctx
let bus

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    bus = makeBody(ctx)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function makeBody(c) {
  const input = c.createGain()
  let node = input
  for (const [type, f, q, gain] of [
    ['peaking', 102, 4, 7],
    ['peaking', 196, 3, 4],
    ['peaking', 395, 2.5, 2.5],
    ['peaking', 2400, 1, -3],
    ['highshelf', 5200, 0.7, -8],
  ]) {
    const b = c.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    b.gain.value = gain
    node.connect(b)
    node = b
  }
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 3
  node.connect(comp)
  // a short, soft room
  const len = Math.floor(c.sampleRate * 1.4)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5)
  }
  const verb = c.createConvolver()
  verb.buffer = ir
  const wet = c.createGain()
  wet.gain.value = 0.16
  const master = c.createGain()
  master.gain.value = 0.55
  comp.connect(master)
  comp.connect(verb).connect(wet).connect(master)
  master.connect(c.destination)
  return input
}

const voices = new Array(6).fill(null)

function release(i, when = 0.02) {
  const v = voices[i]
  if (!v) return
  voices[i] = null
  const t = ctx.currentTime
  v.out.gain.cancelScheduledValues(t)
  v.out.gain.setValueAtTime(v.out.gain.value, t)
  v.out.gain.setTargetAtTime(0, t, when)
  for (const p of v.partials) p.osc.stop(t + when * 8)
}

// pluck string i at frequency f; b = pluck point as a fraction of the
// vibrating length from the saddle; loud 0..1
export function pluck(i, f, b, loud = 0.7, muted = false) {
  try {
    const c = audio()
    release(i, 0.008)
    const s = STRINGS[i]
    const t = c.currentTime + 0.002
    const out = c.createGain()
    out.gain.value = 0.07 * Math.min(1.2, loud) * (s.wound ? 1 : 1.25)
    out.connect(bus)
    const partials = []
    let sum = 0
    const amps = []
    for (let n = 1; n <= 30; n++) {
      const fn = n * f * Math.sqrt(1 + s.B * n * n)
      if (fn > 9000) break
      const a = Math.sin(n * Math.PI * b) / n // bridge force from a triangle pluck
      amps.push([n, fn, a])
      sum += Math.abs(a)
    }
    for (const [n, fn, a] of amps) {
      if (Math.abs(a) < 0.002) continue
      const osc = c.createOscillator()
      osc.frequency.value = fn
      const g = c.createGain()
      const peak = (a / sum) * 3
      // brighter, harder plucks keep more of the top end
      const rate = muted ? 20 + fn * 0.01 : 0.28 + fn * 0.00055 * (1.4 - loud * 0.5)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.0025)
      g.gain.setTargetAtTime(0, t + 0.0025, 1 / rate)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + Math.min(14, 6 / rate))
      partials.push({ osc, n })
    }
    // the pick leaving the string: a tick of filtered noise
    const len = Math.floor(c.sampleRate * 0.012)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 4)
    const src = c.createBufferSource()
    src.buffer = buf
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2500 + loud * 2000
    bp.Q.value = 1.2
    const ng = c.createGain()
    ng.gain.value = 0.05 * loud
    src.connect(bp).connect(ng).connect(bus)
    src.start(t)
    if (!muted) voices[i] = { out, partials, B: s.B }
  } catch {
    // no audio available
  }
}

// slide a ringing string to a new frequency (a tuner turned, a fret pressed)
export function retune(i, f) {
  const v = voices[i]
  if (!v || !ctx) return
  const t = ctx.currentTime
  for (const p of v.partials) p.osc.frequency.setTargetAtTime(p.n * f * Math.sqrt(1 + v.B * p.n * p.n), t, 0.012)
}

// a finger landing on or leaving a string stops it ringing
export function damp(i) {
  if (ctx) release(i, 0.03)
}

export function knock(loud = 0.7) {
  try {
    const c = audio()
    const t = c.currentTime
    const out = c.createGain()
    out.gain.value = 0.35 * loud
    out.connect(bus)
    for (const [f, a, d] of [[100, 1, 0.22], [198, 0.6, 0.14], [410, 0.35, 0.08], [780, 0.2, 0.04]]) {
      const o = c.createOscillator()
      o.frequency.value = f * (0.97 + Math.random() * 0.06)
      const g = c.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(a, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + d + 0.05)
    }
    const len = Math.floor(c.sampleRate * 0.03)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const dd = buf.getChannelData(0)
    for (let k = 0; k < len; k++) dd[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 5)
    const src = c.createBufferSource()
    src.buffer = buf
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    const ng = c.createGain()
    ng.gain.value = 0.5
    src.connect(lp).connect(ng).connect(out)
    src.start(t)
  } catch {
    // no audio available
  }
}

// the faint ratchet of a worm gear turning
export function click(loud = 0.3) {
  try {
    const c = audio()
    const len = Math.floor(c.sampleRate * 0.006)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 8)
    const src = c.createBufferSource()
    src.buffer = buf
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3500
    const g = c.createGain()
    g.gain.value = loud * 0.25
    src.connect(hp).connect(g).connect(c.destination)
    src.start()
  } catch {
    // no audio available
  }
}
