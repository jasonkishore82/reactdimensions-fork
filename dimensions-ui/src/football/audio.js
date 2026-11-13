// Football sounds made in the browser, no audio files. A leather ball is a
// pressurised shell, so a bounce is a short low "thump": a quick drop in
// pitch from the air inside ringing for an instant, plus the slap of leather
// on the floor. A kick is a sharper, louder pop. Louder for harder hits.

export function createBallAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.8
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.12)
  const noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const thump = (f0, f1, decay, gain, slap) => {
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.02)
    const n = ctx.createBufferSource()
    n.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = slap
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(gain * 0.6, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    n.connect(f).connect(ng).connect(out)
    n.start(t)
    n.stop(t + 0.06)
  }
  return {
    bounce(strength = 1, kind = 'floor') {
      const s = Math.min(1, strength)
      thump(kind === 'floor' ? 150 : 190, 70, 0.12, 0.5 * s, 1400)
    },
    kick(strength = 1) {
      const s = Math.min(1, strength)
      thump(220, 90, 0.09, 0.8 * s, 3200)
    },
    dispose() {
      ctx.close()
    },
  }
}
