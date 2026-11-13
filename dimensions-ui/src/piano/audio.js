// A small piano voice in WebAudio, so there are no samples to ship. Notes
// start when a hammer hits its string and stop when the damper lands back on
// it, so the pedals and the action decide how long things ring, not this file.
let ctx = null
let master = null
const voices = new Map()

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0.32
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    master.connect(comp).connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// How strong each partial is. Low strings are mostly overtones: their
// fundamental is weak (and below what small speakers can play anyway), so the
// bass gets many partials with the energy in the 2nd-6th.
function partials(midi) {
  const bass = Math.max(0, Math.min(1, (52 - midi) / 30))
  const n = midi < 40 ? 14 : midi < 60 ? 9 : 6
  const out = []
  for (let k = 1; k <= n; k++) {
    const treble = 1 / Math.pow(k, 1.6)
    const low = (k === 1 ? 0.35 : 1) / (1 + Math.abs(k - 4) * 0.28)
    out.push([k, treble * (1 - bass) + low * bass * 0.75])
  }
  return out
}

export function strike(midi, velocity = 90, { soft = false } = {}) {
  let c
  try {
    c = ensure()
  } catch {
    return
  }
  release(midi, 0.03)
  const f = 440 * Math.pow(2, (midi - 69) / 12)
  const v = velocity / 127
  const amp = Math.pow(v, 1.6) * (soft ? 0.7 : 1) * (midi < 40 ? 1.35 : 1)
  const now = c.currentTime
  // high notes die away much faster than low ones
  const decay = Math.max(0.6, 7 - (midi - 21) * 0.075)
  const B = 0.00012 * Math.pow(2, (midi - 21) / 24) // inharmonicity

  const out = c.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(amp, now + 0.004)
  out.gain.setTargetAtTime(amp * 0.35, now + 0.004, decay * 0.12)
  out.gain.setTargetAtTime(0.0001, now + 0.3, decay)
  const pan = c.createStereoPanner ? c.createStereoPanner() : null
  if (pan) pan.pan.value = Math.max(-0.6, Math.min(0.6, (midi - 64) / 50))
  // harder blows are brighter; the soft pedal takes the edge off
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  // never so low that the bass loses the overtones you actually hear
  tone.frequency.value = Math.min(14000, Math.max(900 + v * 1800, f * (2.5 + v * 9)) * (soft ? 0.6 : 1))
  tone.connect(out)
  if (pan) out.connect(pan).connect(master)
  else out.connect(master)

  const oscs = partials(midi).map(([n, level]) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.frequency.value = f * n * Math.sqrt(1 + B * n * n)
    g.gain.value = level * (n === 1 ? 1 : 0.6 + v * 0.6)
    o.connect(g).connect(tone)
    o.start(now)
    return o
  })
  // the felt hitting the string: a short thump of filtered noise
  const len = Math.floor(c.sampleRate * 0.03)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4)
  const thump = c.createBufferSource()
  thump.buffer = buf
  const tf = c.createBiquadFilter()
  tf.type = 'bandpass'
  tf.frequency.value = Math.min(4000, Math.max(500, f * 2))
  const tg = c.createGain()
  tg.gain.value = amp * 0.25
  thump.connect(tf).connect(tg).connect(out)
  thump.start(now)

  oscs.forEach((o) => o.stop(now + decay * 7 + 0.5))
  voices.set(midi, { out, oscs })
}

// a damper landing on the string
export function release(midi, fade = 0.07) {
  const v = voices.get(midi)
  if (!v || !ctx) return
  voices.delete(midi)
  const now = ctx.currentTime
  v.out.gain.cancelScheduledValues(now)
  v.out.gain.setTargetAtTime(0, now, fade)
  v.oscs.forEach((o) => {
    // each already has a far-off stop scheduled; some browsers refuse a second one
    try {
      o.stop(now + fade * 8 + 0.05)
    } catch {
      o.disconnect()
    }
  })
}

// the lid coming down
export function thud(loud = 1) {
  try {
    const c = ensure()
    const len = Math.floor(c.sampleRate * 0.25)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
    const s = c.createBufferSource()
    s.buffer = buf
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 180
    const g = c.createGain()
    g.gain.value = 1.4 * loud
    s.connect(f).connect(g).connect(master)
    s.start()
  } catch {
    // no audio
  }
}
