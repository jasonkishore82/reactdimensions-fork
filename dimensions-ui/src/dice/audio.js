// Dice sounds made in the browser, no audio files: a hard clack when two dice
// hit each other, and a softer knock when a die lands on the tray or hits a
// wall. Louder for harder hits.

export function createDiceAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.1)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const hit = (freq, q, decay, gain) => {
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq * (0.9 + Math.random() * 0.2)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.04)
    src.stop(t + decay + 0.02)
  }
  return {
    clack(strength = 1) {
      hit(2600, 6, 0.06, 0.35 * Math.min(1, strength))
    },
    knock(strength = 1) {
      hit(700, 2, 0.08, 0.4 * Math.min(1, strength))
    },
    dispose() {
      ctx.close()
    },
  }
}
