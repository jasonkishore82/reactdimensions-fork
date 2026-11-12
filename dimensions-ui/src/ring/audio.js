// Ring sounds, made in WebAudio so there are no files to ship:
//  tick   a tiny metallic tap as the rim rolls on the table (rises with speed)
//  chime  the band ringing out: a few inharmonic partials, like struck metal
let ctx

function audio() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function tick(rate = 1, loud = 0.5) {
  try {
    const c = audio()
    const len = Math.floor(c.sampleRate * 0.018)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
    const src = c.createBufferSource()
    src.buffer = buf
    const band = c.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = Math.min(9000, 2600 + rate * 60)
    band.Q.value = 6
    const g = c.createGain()
    g.gain.value = 0.5 * Math.min(1, loud)
    src.connect(band).connect(g).connect(c.destination)
    src.start()
  } catch {
    // no audio available
  }
}

export function chime(loud = 1) {
  try {
    const c = audio()
    const t = c.currentTime
    const out = c.createGain()
    out.gain.value = 0.12 * Math.min(1, loud)
    out.connect(c.destination)
    for (const [f, a, decay] of [[2310, 1, 1.1], [3980, 0.6, 0.7], [6170, 0.35, 0.45], [8420, 0.2, 0.3]]) {
      const o = c.createOscillator()
      o.frequency.value = f * (0.99 + Math.random() * 0.02)
      const g = c.createGain()
      g.gain.setValueAtTime(a, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + decay + 0.05)
    }
  } catch {
    // no audio available
  }
}
