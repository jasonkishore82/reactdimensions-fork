// Button sounds, made in WebAudio so there are no files to ship: a short
// band-passed noise tap; `pitch` sets how bright (small buttons click higher).
let ctx

export function click(pitch = 1, loud = 1) {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const len = Math.floor(ctx.sampleRate * 0.03)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 7)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1400 * pitch
    band.Q.value = 2.5
    const g = ctx.createGain()
    g.gain.value = 0.35 * Math.min(1, loud)
    src.connect(band).connect(g).connect(ctx.destination)
    src.start()
  } catch {
    // no audio available
  }
}
