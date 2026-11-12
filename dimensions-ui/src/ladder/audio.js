// Ladder sounds made in the browser, no audio files: a hollow wooden knock when
// it hits the floor or the wall, louder for harder hits, and a short tin clank
// when the paint can drops.

export function createLadderAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.8
  out.connect(ctx.destination)
  const wake = () => ctx.state === 'suspended' && ctx.resume()
  const tone = (freq, decay, gain, type = 'sine') => {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.02)
  }
  return {
    knock(strength = 1) {
      wake()
      const s = Math.min(1, strength)
      tone(170, 0.18, 0.5 * s)
      tone(420, 0.07, 0.2 * s, 'triangle')
    },
    clank() {
      wake()
      tone(900, 0.25, 0.15, 'square')
      tone(1350, 0.2, 0.1, 'triangle')
    },
    dispose() {
      ctx.close()
    },
  }
}
