// The thud of a shoe landing, made in WebAudio so there are no files to
// ship: a burst of low-passed noise with a quick decay.
let ctx

export function thud(loud = 1) {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const len = Math.floor(ctx.sampleRate * 0.12)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 260
    low.Q.value = 0.9
    const g = ctx.createGain()
    g.gain.value = 0.9 * Math.max(0, Math.min(1, loud))
    src.connect(low).connect(g).connect(ctx.destination)
    src.start()
  } catch {
    // no audio available
  }
}
