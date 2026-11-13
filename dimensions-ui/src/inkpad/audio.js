// Ink pad sounds made in the browser, no audio files: the snap of the latch
// letting go, the hollow clack of the plastic lid landing, the click of the
// latch catching, and the soft pat of something pressing into wet felt.

export function createInkPadAudio() {
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
    // the latch tongue springing off its catch
    release() {
      wake()
      noise(3800, 3, 0.008, 0.35)
      tone(1900, 0.05, 0.05)
    },
    // the lid landing on the base: hollow, plasticky
    close(strength = 1) {
      wake()
      const s = Math.min(1, strength)
      noise(900, 1.1, 0.025, 0.45 * s)
      tone(420, 0.09, 0.08 * s)
    },
    // the hook dropping behind the catch
    latch() {
      wake()
      noise(4600, 4, 0.006, 0.4, 0.015)
    },
    // the lid reaching its stop at the hinge
    stop(strength = 1) {
      wake()
      noise(1500, 1.5, 0.012, 0.2 * Math.min(1, strength))
    },
    // a press into soaked felt
    press(strength = 1) {
      wake()
      noise(260, 0.7, 0.05, 0.4 * strength, 0, 'lowpass')
      noise(1800, 0.6, 0.02, 0.05 * strength)
    },
    dispose() {
      ctx.close()
    },
  }
}
