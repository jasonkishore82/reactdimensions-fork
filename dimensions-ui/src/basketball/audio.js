// Basketball sounds made in the browser, no audio files. The familiar
// bounce is the pressurised rubber shell ringing: a short hollow "boong"
// with a low body and a ringing overtone that drops in pitch as the ball
// leaves the floor, on top of the sharp slap of rubber on the boards.
// A hand slap is mostly the slap. Louder for harder hits.

export function createBallAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.8
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.1)
  const noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const tone = (f0, f1, decay, gain, t) => {
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
  }
  const slap = (gain, t, freq = 2200) => {
    const n = ctx.createBufferSource()
    n.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = 0.9
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    n.connect(f).connect(g).connect(out)
    n.start(t)
    n.stop(t + 0.05)
  }
  return {
    bounce(strength = 1, kind = 'floor') {
      if (ctx.state === 'suspended') ctx.resume()
      const s = Math.min(1, strength)
      const t = ctx.currentTime
      tone(kind === 'floor' ? 210 : 260, 150, 0.18, 0.45 * s, t)
      tone(kind === 'floor' ? 640 : 760, 520, 0.12, 0.16 * s, t)
      slap(0.5 * s, t, 1800)
    },
    slap(strength = 1) {
      if (ctx.state === 'suspended') ctx.resume()
      slap(0.5 * Math.min(1, strength), ctx.currentTime, 3000)
    },
    dispose() {
      ctx.close()
    },
  }
}
