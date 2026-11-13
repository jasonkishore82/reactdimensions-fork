// Dart sounds made in the browser, no audio files: the soft whoosh of a
// throw, the dull "thunk" of a steel point driving into packed sisal, the
// bright metallic tick of a bounce-out off the wire, and the clatter of a
// dart hitting the floor.

export function createDartAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.8
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.4)
  const noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const burst = (type, freq, q, dur, gain, attack = 0.002) => {
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    const n = ctx.createBufferSource()
    n.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(f).connect(g).connect(out)
    n.start(t)
    n.stop(t + dur + 0.02)
  }
  const tone = (f0, f1, dur, gain) => {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
  return {
    whoosh() {
      burst('bandpass', 900, 0.8, 0.22, 0.05, 0.08)
    },
    thunk(s = 1) {
      burst('lowpass', 900, 0.7, 0.07, 0.6 * s)
      tone(160, 90, 0.08, 0.35 * s)
    },
    tick() {
      tone(4200, 3600, 0.06, 0.15)
      burst('highpass', 5000, 0.7, 0.03, 0.2)
    },
    clatter() {
      for (let k = 0; k < 3; k++) setTimeout(() => tone(2600 + Math.random() * 1200, 2000, 0.05, 0.08), k * 70)
    },
    dispose() {
      ctx.close()
    },
  }
}
