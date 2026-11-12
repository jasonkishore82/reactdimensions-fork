// A short plastic click for each quarter turn: a burst of band-passed noise,
// made in WebAudio so there is no sound file to ship.
let ctx

export function click(strength = 1) {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const len = Math.floor(ctx.sampleRate * 0.045)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 2000 + Math.random() * 700
    band.Q.value = 1.4
    const gain = ctx.createGain()
    gain.gain.value = 0.4 * Math.min(1, strength)
    src.connect(band).connect(gain).connect(ctx.destination)
    src.start()
  } catch {
    // no audio available: stay silent
  }
}
