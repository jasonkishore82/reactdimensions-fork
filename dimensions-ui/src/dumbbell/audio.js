// Dumbbell sounds, made in WebAudio so there are no files to ship:
//  thud   rubber landing on the floor: a low, dead thump (heavier = lower)
//  clunk  rubber head on rubber head, or on the steel handle: a shorter knock
let ctx

function audio() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noise(c, secs, shape) {
  const len = Math.floor(c.sampleRate * secs)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, shape)
  const src = c.createBufferSource()
  src.buffer = buf
  return src
}

export function thud(loud = 0.5, kg = 10) {
  try {
    const c = audio()
    const t = c.currentTime
    const out = c.createGain()
    out.gain.value = Math.min(1, loud) * 0.6
    out.connect(c.destination)
    const f = 95 * Math.pow(10 / kg, 0.25)
    const o = c.createOscillator()
    o.frequency.setValueAtTime(f * 1.6, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(1, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.25)
    const n = noise(c, 0.06, 3)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const ng = c.createGain()
    ng.gain.value = 0.5
    n.connect(lp).connect(ng).connect(out)
    n.start(t)
  } catch {
    // no audio available
  }
}

export function clunk(loud = 0.5) {
  try {
    const c = audio()
    const t = c.currentTime
    const out = c.createGain()
    out.gain.value = Math.min(1, loud) * 0.45
    out.connect(c.destination)
    for (const [f, a, d] of [[240, 1, 0.09], [610, 0.4, 0.05], [1450, 0.18, 0.03]]) {
      const o = c.createOscillator()
      o.frequency.value = f * (0.95 + Math.random() * 0.1)
      const g = c.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(a, t + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + d + 0.03)
    }
    const n = noise(c, 0.025, 4)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    const ng = c.createGain()
    ng.gain.value = 0.25
    n.connect(bp).connect(ng).connect(out)
    n.start(t)
  } catch {
    // no audio available
  }
}
