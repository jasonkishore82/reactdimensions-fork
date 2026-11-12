// Butterfly sound made in the browser, no audio files: a soft papery flutter
// on each wingbeat while it flies.

export function createButterflyAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.5
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.15)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  return {
    flutter(strength = 1) {
      if (ctx.state === 'suspended') ctx.resume()
      const t = ctx.currentTime
      const src = ctx.createBufferSource()
      src.buffer = buf
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 900 + Math.random() * 500
      f.Q.value = 0.9
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.05 * strength, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      src.connect(f).connect(g).connect(out)
      src.start(t, Math.random() * 0.05)
      src.stop(t + 0.1)
    },
    dispose() {
      ctx.close()
    },
  }
}
