// Stamp sounds made in the browser, no audio files: the dull knock of a
// hardwood block with rubber under it meeting paper on a desk, and the
// lighter tap of setting it down.

export function createStampAudio() {
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
    f.frequency.value = freq * (0.92 + Math.random() * 0.16)
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
    o.frequency.setValueAtTime(freq * 1.25, t)
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.02)
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
    // the stamp coming down: a padded thump, the desk answering
    thump(strength = 1) {
      wake()
      const s = Math.min(1, strength)
      noise(320, 0.9, 0.035, 0.55 * s, 0, 'lowpass')
      tone(150, 0.12, 0.22 * s)
      noise(2400, 0.8, 0.012, 0.08 * s) // the paper
    },
    // set down gently
    tap(strength = 1) {
      wake()
      const s = Math.min(1, strength)
      noise(700, 1.2, 0.015, 0.25 * s)
      tone(210, 0.06, 0.06 * s)
    },
    dispose() {
      ctx.close()
    },
  }
}
