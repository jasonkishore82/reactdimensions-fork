// Vinyl sound made in the browser: a slow lo-fi chord loop plus surface noise
// and crackle. Pitch and tempo follow the platter speed, so spin-up, spin-down
// and scratching bend the sound the way a real record does.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)
// Am9, Fmaj9, Cmaj9, G6: the notes of each chord
const CHORDS = [
  [57, 60, 64, 67, 71],
  [53, 57, 60, 64, 67],
  [48, 52, 55, 59, 62],
  [55, 59, 62, 64, 67],
]
const BASS = [45, 41, 48, 43]

export function createVinylAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.value = 0
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 3600
  tone.Q.value = 0.4
  tone.connect(master)
  master.connect(ctx.destination)

  // Surface noise: hiss with random pops, looped.
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.00045) {
      const a = (Math.random() < 0.15 ? 0.7 : 0.18) * (Math.random() < 0.5 ? -1 : 1)
      for (let k = 0; k < 40 && i + k < len; k++) d[i + k] += a * Math.exp(-k / 6)
    }
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  noise.loop = true
  const nf = ctx.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.value = 3800
  nf.Q.value = 0.35
  const ng = ctx.createGain()
  ng.gain.value = 0.9
  noise.connect(nf).connect(ng).connect(master)
  noise.start()

  // One control for the pitch of everything that is still sounding.
  const cents = ctx.createConstantSource()
  cents.offset.value = 0
  cents.start()

  let pitch = 1
  let running = false
  let timer = 0
  let next = 0
  let step = 0
  let volume = 0.7
  let level = 0

  const voice = (freq, t, dur, gain, type, attack) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = 0
    cents.connect(o.detune)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(tone)
    o.start(t)
    o.stop(t + dur + 0.05)
    o.onended = () => {
      try {
        cents.disconnect(o.detune)
      } catch {}
    }
  }

  const schedule = () => {
    // Eighth notes at ~72 bpm, slowed or quickened by the record speed.
    while (next < ctx.currentTime + 0.25) {
      const eighth = 60 / 72 / 2 / Math.max(pitch, 0.25)
      const bar = Math.floor(step / 8) % 4
      const pos = step % 8
      const chord = CHORDS[bar]
      if (pos === 0) {
        for (const n of chord.slice(0, 4)) voice(midi(n), next, eighth * 7.5, 0.05, 'triangle', 0.25)
        voice(midi(BASS[bar]), next, eighth * 3.2, 0.14, 'sine', 0.02)
      }
      if (pos === 4) voice(midi(BASS[bar] + 7), next, eighth * 2.5, 0.09, 'sine', 0.02)
      if (pos % 2 === 1 || Math.random() < 0.35) {
        const n = chord[Math.floor(Math.random() * chord.length)] + 12
        voice(midi(n), next, eighth * 2.2, 0.06, 'triangle', 0.006)
      }
      next += eighth
      step++
    }
  }

  return {
    start() {
      ctx.resume()
      if (running) return
      running = true
      next = ctx.currentTime + 0.05
      timer = setInterval(schedule, 60)
    },
    stop() {
      running = false
      clearInterval(timer)
    },
    // pitch: 1 = normal speed. gain: 0..1 (needle down and spinning).
    set(p, gain) {
      const t = ctx.currentTime
      pitch = Math.min(Math.max(p, 0.05), 2.5)
      cents.offset.setTargetAtTime(1200 * Math.log2(pitch), t, 0.06)
      noise.playbackRate.setTargetAtTime(pitch, t, 0.06)
      level = gain
      master.gain.setTargetAtTime(level * volume * 0.55, t, 0.08)
    },
    setVolume(v) {
      volume = v
      master.gain.setTargetAtTime(level * volume * 0.55, ctx.currentTime, 0.05)
    },
    dispose() {
      running = false
      clearInterval(timer)
      try {
        noise.stop()
        cents.stop()
      } catch {}
      ctx.close()
    },
  }
}
