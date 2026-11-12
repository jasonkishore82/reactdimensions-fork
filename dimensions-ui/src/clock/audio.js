// Alarm clock sounds made in the browser, no audio files: the tick and tock of
// the escapement, and each strike of the hammer on a bell (a struck bell rings
// at a few inharmonic partials that die away at different rates).

export function createClockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.6
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.2)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const noise = (freq, q, decay, gain) => {
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t)
    src.stop(t + decay * 4 + 0.02)
  }
  const tone = (freq, decay, gain) => {
    const t = ctx.currentTime
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
    tick(tock) {
      wake()
      noise(tock ? 2600 : 3400, 4, 0.006, 0.22)
    },
    // one strike of the hammer; the two bells are tuned a little apart
    bell(right) {
      wake()
      const f = right ? 2090 : 1940
      tone(f, 0.55, 0.11)
      tone(f * 2.76, 0.3, 0.05)
      tone(f * 5.4, 0.16, 0.03)
      noise(6000, 3, 0.004, 0.12)
    },
    dispose() {
      ctx.close()
    },
  }
}
