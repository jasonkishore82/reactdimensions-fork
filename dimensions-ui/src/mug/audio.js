// Mug sounds, made in WebAudio so there are no files to ship:
//  pour   a stream into the mug: noise through the resonance of the air column
//         above the liquid. That column is a tube closed at the liquid, so it
//         rings at f = c / 4L: as the mug fills, L shrinks and the pitch rises,
//         which is how you can hear a mug getting full.
//  clink  glazed ceramic knocking: a few bright inharmonic partials
//  drip   a drop landing on the table
let ctx

function audio() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noiseLoop(c) {
  const len = c.sampleRate * 2
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

// returns { set(airCm, onTable), stop() }
export function startPour() {
  try {
    const c = audio()
    const src = noiseLoop(c)
    const body = c.createBiquadFilter()
    body.type = 'bandpass'
    body.Q.value = 9
    const air = c.createBiquadFilter()
    air.type = 'bandpass'
    air.frequency.value = 900
    air.Q.value = 0.7
    const g = c.createGain()
    g.gain.value = 0
    const ga = c.createGain()
    ga.gain.value = 0.05
    src.connect(body).connect(g)
    src.connect(air).connect(ga).connect(g)
    g.connect(c.destination)
    src.start()
    g.gain.setTargetAtTime(0.45, c.currentTime, 0.05)
    return {
      set(airCm, onTable) {
        const f = onTable ? 700 : Math.min(7000, 34300 / (4 * Math.max(0.8, airCm + 0.6))) // end correction ~0.6 r
        body.frequency.setTargetAtTime(f, c.currentTime, 0.03)
        ga.gain.setTargetAtTime(onTable ? 0.5 : 0.05, c.currentTime, 0.05)
      },
      stop() {
        g.gain.setTargetAtTime(0, c.currentTime, 0.06)
        src.stop(c.currentTime + 0.5)
      },
    }
  } catch {
    return { set() {}, stop() {} }
  }
}

export function clink(loud = 0.5) {
  try {
    const c = audio()
    const t = c.currentTime
    const out = c.createGain()
    out.gain.value = 0.12 * Math.min(1, loud)
    out.connect(c.destination)
    for (const [f, a, d] of [[1870, 1, 0.35], [3240, 0.5, 0.22], [5110, 0.3, 0.12]]) {
      const o = c.createOscillator()
      o.frequency.value = f * (0.98 + Math.random() * 0.04)
      const g = c.createGain()
      g.gain.setValueAtTime(a, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + d + 0.05)
    }
  } catch {
    // no audio available
  }
}

export function drip(loud = 0.3) {
  try {
    const c = audio()
    const t = c.currentTime
    const o = c.createOscillator()
    o.frequency.setValueAtTime(900 + Math.random() * 500, t)
    o.frequency.exponentialRampToValueAtTime(260, t + 0.05)
    const g = c.createGain()
    g.gain.setValueAtTime(0.06 * loud, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + 0.09)
  } catch {
    // no audio available
  }
}

export function sip() {
  try {
    const c = audio()
    const t = c.currentTime
    const src = noiseLoop(c)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1400, t)
    bp.frequency.linearRampToValueAtTime(2600, t + 0.35)
    bp.Q.value = 3
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.08, t + 0.05)
    g.gain.linearRampToValueAtTime(0, t + 0.4)
    src.connect(bp).connect(g).connect(c.destination)
    src.start(t)
    src.stop(t + 0.45)
  } catch {
    // no audio available
  }
}
