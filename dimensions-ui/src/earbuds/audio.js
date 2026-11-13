// Earbuds sounds made in the browser, no audio files: the lid's magnetic snap
// as it shuts, a light tick at the open stop, the click of a bud seating on
// its pins, and a small plastic tap when a loose bud lands.

export function createEarbudsAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.08)
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
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    src.connect(f).connect(g).connect(out)
    src.start(t)
    src.stop(t + decay + 0.02)
  }
  return {
    snap(s = 1) {
      hit(1400, 3, 0.06, 0.5 * s)
      hit(300, 1.5, 0.08, 0.35 * s)
    },
    tick(s = 1) {
      hit(2600, 6, 0.03, 0.25 * s)
    },
    click() {
      hit(3200, 8, 0.03, 0.35)
    },
    tap(s = 1) {
      hit(2000, 4, 0.04, 0.3 * Math.min(1, s))
    },
    dispose() {
      ctx.close()
    },
  }
}
