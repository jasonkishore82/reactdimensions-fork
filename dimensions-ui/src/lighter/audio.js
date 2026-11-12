// Lighter sounds made in the browser, no audio files: the bright ting of the
// lid flipping open, the duller clack of it shutting, the rasp of the flint
// wheel, and the soft whoomph of the wick catching.

export function createLighterAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.8)
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
    src.start(t, Math.random() * 0.4)
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

  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }
  return {
    // the lid hits its stop: a thin case rings like a little bell
    open(strength = 1) {
      wake()
      const s = Math.min(1, strength)
      noise(5200, 2, 0.01, 0.25 * s)
      tone(3150, 0.32, 0.12 * s)
      tone(4720, 0.2, 0.07 * s)
      tone(6980, 0.12, 0.04 * s)
    },
    // the lid lands on the case: lower, shorter
    close(strength = 1) {
      wake()
      const s = Math.min(1, strength)
      noise(1100, 1.2, 0.02, 0.4 * s)
      tone(2380, 0.12, 0.06 * s)
    },
    // the flint wheel: a rasp with a few crackles
    strike() {
      wake()
      noise(3200, 1.4, 0.03, 0.4)
      for (let i = 0; i < 6; i++) noise(6000, 6, 0.004, 0.18, 0.01 + Math.random() * 0.08)
    },
    // the wick catching
    ignite() {
      wake()
      noise(380, 0.8, 0.09, 0.35, 0.02, 'lowpass')
    },
    dispose() {
      ctx.close()
    },
  }
}
