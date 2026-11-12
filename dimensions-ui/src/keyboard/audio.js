// Switch sounds made in the browser from short bursts of filtered noise, no
// audio files. Each switch type has its own press and release:
// - linear:  a low, round "thock" and an almost silent release
// - tactile: a firmer thock with a faint tick from the bump
// - clicky:  a bright double click on the way down and a click on the way up
// Wide keys (space, shift, enter) sound lower and add a little stabiliser rattle.

const PROFILES = {
  linear: { down: [[900, 0.8, 0.045, 0.5, 0]], up: [[1100, 0.8, 0.018, 0.08, 0]] },
  tactile: { down: [[1500, 1, 0.035, 0.45, 0], [2600, 3, 0.008, 0.12, 0.004]], up: [[1800, 1, 0.02, 0.15, 0]] },
  clicky: { down: [[3800, 2.5, 0.012, 0.5, 0], [4200, 3, 0.01, 0.35, 0.008], [1200, 1, 0.03, 0.25, 0.012]], up: [[3200, 2.5, 0.01, 0.3, 0]] },
}

export function createSwitchAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.12)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  // one burst: noise through a band-pass, with a fast exponential decay
  const burst = (freq, q, decay, gain, delay) => {
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = 0.9 + Math.random() * 0.2
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq * (0.92 + Math.random() * 0.16)
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(bp).connect(g).connect(out)
    src.start(t)
    src.stop(t + decay * 4 + 0.02)
  }

  return {
    play(type = 'tactile', phase = 'down', wide = false) {
      if (ctx.state === 'suspended') ctx.resume()
      const p = PROFILES[type] || PROFILES.tactile
      for (const [f, q, dec, g, del] of p[phase]) burst(wide ? f * 0.7 : f, q, wide ? dec * 1.3 : dec, g, del)
      if (wide) burst(2400, 4, 0.01, phase === 'down' ? 0.08 : 0.05, 0.014)
    },
    dispose() { ctx.close() },
  }
}
