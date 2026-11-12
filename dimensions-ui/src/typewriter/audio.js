// Typewriter sounds made in the browser, no audio files: the clack of a
// typebar hitting the platen, a softer space bar, the margin bell, and the
// ratchet-and-zip of a carriage return.

export function createTypewriterAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.75
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.6)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const noise = (freq, q, decay, gain, at = 0, type = 'bandpass') => {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * (0.93 + Math.random() * 0.14)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.3)
    src.stop(t + decay * 4 + 0.02)
  }
  const tone = (freq, decay, gain, at = 0) => {
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.02)
  }

  const wake = () => { if (ctx.state === 'suspended') ctx.resume() }
  return {
    strike() {
      wake()
      noise(2200, 1.2, 0.03, 0.55) // the slug on the platen
      noise(700, 0.9, 0.05, 0.35, 0.004) // the frame answering
      noise(4200, 3, 0.008, 0.18, 0.05) // escapement tick
    },
    space() { wake(); noise(900, 0.8, 0.04, 0.3); noise(4200, 3, 0.008, 0.15, 0.03) },
    bell() { wake(); tone(2093, 1.4, 0.22); tone(5230, 0.5, 0.06); tone(2093 * 2.76, 0.3, 0.04) },
    ret() {
      wake()
      noise(3000, 2, 0.01, 0.3) // line-space pawl
      noise(1500, 1.5, 0.012, 0.25, 0.05)
      for (let i = 0; i < 14; i++) noise(3600, 4, 0.004, 0.12, 0.09 + i * 0.016) // ratchet
      noise(600, 0.7, 0.06, 0.3, 0.33) // carriage hits the stop
    },
    dispose() { ctx.close() },
  }
}
