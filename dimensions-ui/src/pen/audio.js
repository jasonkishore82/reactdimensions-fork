// Fountain-pen sounds made in the browser, no audio files: resin knocking on
// a desk, the cap seating, the soft rasp of the thread, the piston knob's
// ticks and a drip of ink.

export function createPenAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.4)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const noise = (freq, q, decay, gain, at = 0, type = 'bandpass') => {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * (0.9 + Math.random() * 0.2)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.2)
    src.stop(t + decay * 4 + 0.02)
  }
  const tone = (freq, decay, gain, at = 0, bend = 1) => {
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(freq * bend, t + decay)
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
    // resin on paper over a wooden desk; strength 0..1
    knock(strength = 1) {
      wake()
      const s = Math.min(1, Math.max(0.08, strength))
      noise(1100, 1.4, 0.012, 0.55 * s)
      noise(2600, 2, 0.006, 0.25 * s, 0.002)
      tone(260 + Math.random() * 60, 0.05, 0.18 * s)
    },
    // the cap seating on its thread, or pushed onto the end
    click() {
      wake()
      noise(3800, 3, 0.006, 0.45)
      tone(2400, 0.03, 0.06)
    },
    // a quick run of tiny rasps while the cap turns
    thread() {
      wake()
      for (let i = 0; i < 9; i++) noise(5200, 4, 0.004, 0.08, i * 0.075)
    },
    // the piston knob turning past a notch
    tick() {
      wake()
      noise(6200, 5, 0.003, 0.12)
    },
    drip() {
      wake()
      tone(900 + Math.random() * 300, 0.06, 0.05, 0, 1.8)
    },
    dispose() {
      ctx.close()
    },
  }
}
