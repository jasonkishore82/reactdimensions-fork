// Tape measure sounds made in the browser, no audio files: the ratchet buzz
// of the blade reeling in (one click per few centimetres, so it rises with
// speed), the thunk of the hook against the case, and the click of the lock.

export function createTapeAudio() {
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
    f.frequency.value = freq * (0.92 + Math.random() * 0.16)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.1)
    src.stop(t + decay * 4 + 0.02)
  }
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }
  return {
    ratchet() {
      wake()
      noise(3800, 5, 0.003, 0.12)
    },
    thunk(strength = 1) {
      wake()
      const s = Math.min(1, strength)
      noise(900, 1.4, 0.03, 0.45 * s)
      noise(4200, 3, 0.006, 0.25 * s)
    },
    lock() {
      wake()
      noise(2600, 4, 0.006, 0.3)
    },
    dispose() {
      ctx.close()
    },
  }
}
