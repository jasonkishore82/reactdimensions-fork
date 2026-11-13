// Hourglass sounds made in the browser, no audio files: the faint, steady
// hiss of sand running through the neck (band-passed noise), and the soft
// wooden knock of the base meeting the table after it's turned over.

export function createSandAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.8
  out.connect(ctx.destination)
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  // grainy noise: random clicks rather than smooth hiss
  for (let i = 0; i < len; i++) d[i] = Math.random() < 0.08 ? Math.random() * 2 - 1 : (Math.random() * 2 - 1) * 0.15
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 5200
  bp.Q.value = 0.7
  const hissGain = ctx.createGain()
  hissGain.gain.value = 0
  src.connect(bp).connect(hissGain).connect(out)
  src.start()
  let level = 0
  return {
    hiss(on) {
      const target = on ? 0.035 : 0
      if (target === level) return
      level = target
      if (ctx.state === 'suspended') ctx.resume()
      hissGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15)
    },
    knock() {
      if (ctx.state === 'suspended') ctx.resume()
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(180, t)
      o.frequency.exponentialRampToValueAtTime(90, t + 0.08)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 0.14)
    },
    dispose() {
      ctx.close()
    },
  }
}
