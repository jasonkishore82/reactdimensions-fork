import { useEffect, useRef } from 'react'

// A flip-dot destination sign in its housing. Every dot is a small disc on
// an axle, matt black on one face and fluorescent lime on the other. A pulse
// through the coil behind it turns it over, so to change the message the
// board sweeps across column by column and each disc that needs to change
// flips: edge-on halfway (it narrows to a sliver), then snaps flat against
// its stop with a little rebound. Discs already showing the right face stay
// put. Separate messages with "|"; click the sign to skip ahead.
const SS = 6 // supersampling when rasterising text into dots

// Rasterise a line of text into columns of on/off dots, letter by letter,
// with one clear column between letters as a real sign's font has.
function rasterise(line, rows) {
  const c = document.createElement('canvas')
  const g = c.getContext('2d', { willReadFrequently: true })
  const size = rows * SS * 0.98
  const font = `700 ${size}px "Arial Rounded MT Bold", "Varela Round", "Trebuchet MS", "Segoe UI", Arial, sans-serif`
  g.font = font
  const chars = [...line]
  const gap = SS * 1.2
  const widths = chars.map((ch) => (ch === ' ' ? size * 0.32 : g.measureText(ch).width))
  const total = widths.reduce((a, b) => a + b + gap, 0)
  c.width = Math.max(SS, Math.ceil(total / SS) * SS)
  c.height = rows * SS
  g.font = font
  g.textBaseline = 'alphabetic'
  let x = 0
  chars.forEach((ch, i) => {
    g.fillText(ch, x, rows * SS * 0.76)
    x += widths[i] + gap
  })
  const data = g.getImageData(0, 0, c.width, c.height).data
  const w = c.width / SS
  const cols = []
  for (let cx = 0; cx < w; cx++) {
    const col = []
    for (let y = 0; y < rows; y++) {
      // weight the middle of the cell, so strokes come out one clean dot wide
      let a = 0
      let n = 0
      for (let dy = 1; dy < SS - 1; dy++) {
        for (let dx = 1; dx < SS - 1; dx++) {
          a += data[((y * SS + dy) * c.width + cx * SS + dx) * 4 + 3]
          n++
        }
      }
      col.push(a / (n * 255) > 0.3)
    }
    cols.push(col)
  }
  while (cols.length && !cols[0].some(Boolean)) cols.shift()
  while (cols.length && !cols[cols.length - 1].some(Boolean)) cols.pop()
  return cols
}

let actx
function clatter(n) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const len = Math.floor(actx.sampleRate * 0.03)
    const buf = actx.createBuffer(1, len, actx.sampleRate)
    const d = buf.getChannelData(0)
    // a handful of tiny ticks, one per disc, smeared over a few ms
    for (let k = 0; k < Math.min(8, n); k++) {
      const at = Math.floor(Math.random() * len * 0.7)
      for (let i = 0; i < 90 && at + i < len; i++) d[at + i] += (Math.random() * 2 - 1) * (1 - i / 90) ** 2
    }
    const src = actx.createBufferSource()
    src.buffer = buf
    const hp = actx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const g = actx.createGain()
    g.gain.value = 0.05
    src.connect(hp).connect(g).connect(actx.destination)
    src.start()
  } catch {
    // no audio available
  }
}

export default function FlipDotSign({
  text = 'Flipdots|Route 24 Central|Not in service',
  rows = 16,
  hold = 3.5,
  sweep = 30,
  dot = '#c6f02a',
  housing = '#2b2d30',
  sound = false,
  style,
}) {
  const wrap = useRef()
  const cvs = useRef()

  useEffect(() => {
    const el = wrap.current
    const cv = cvs.current
    const g = cv.getContext('2d')
    const msgs = String(text)
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!msgs.length) msgs.push(' ')
    const maps = msgs.map((m) => rasterise(m, rows))
    const cols = Math.max(rows * 3, ...maps.map((m) => m.length)) + 4
    // every disc: current angle (0 = black face, PI = lit face), its target,
    // when its flip starts and how long it takes
    const dots = Array.from({ length: cols * rows }, () => ({ a: 0, from: 0, to: 0, t0: -1, dur: 0 }))
    let msg = -1
    let nextAt = 0
    let now0 = 0
    let raf = 0
    let dpr = 1
    let cell = 10
    let soundCols = []
    let dirty = true
    // the rim of a lit disc, a shade darker than its face (canvas gradients
    // can't take color-mix, so darken the hex directly)
    const hex = /^#[0-9a-f]{6}$/i.test(dot) ? dot : '#c6f02a'
    const shade = `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.68)).join(',')})`

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = cv.clientWidth
      cell = w / cols
      const h = cell * rows
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      cv.style.height = `${h}px`
      dirty = true
    }

    const show = (i, t) => {
      msg = i % maps.length
      const map = maps[msg]
      const off = Math.floor((cols - map.length) / 2)
      soundCols = []
      for (let x = 0; x < cols; x++) {
        let any = 0
        for (let y = 0; y < rows; y++) {
          const d = dots[y * cols + x]
          const want = map[x - off]?.[y] ? Math.PI : 0
          if (d.to === want) continue
          any++
          d.from = d.a
          d.to = want
          // the sweep reaches this column, plus a little coil jitter
          d.t0 = t + (x * 1000) / sweep + Math.random() * 18
          d.dur = 70 + Math.random() * 30
        }
        if (any) soundCols.push({ at: t + (x * 1000) / sweep, n: any })
      }
      nextAt = t + (cols * 1000) / sweep + hold * 1000
    }

    const disc = (cx, cy, r, d) => {
      // the recess each disc sits in
      g.fillStyle = '#050505'
      g.beginPath()
      g.arc(cx, cy, r * 1.12, 0, Math.PI * 2)
      g.fill()
      // the disc turns on a vertical axle: its width is |cos a|
      const c = Math.cos(d.a)
      const lit = c < 0
      const rx = Math.max(0.5, r * Math.abs(c))
      if (lit) {
        // fluorescent paint throws a little light round itself
        g.globalAlpha = 0.28 * Math.abs(c)
        g.fillStyle = dot
        g.beginPath()
        g.arc(cx, cy, r * 1.45, 0, Math.PI * 2)
        g.fill()
        g.globalAlpha = 1
        const gr = g.createRadialGradient(cx - rx * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
        gr.addColorStop(0, '#ffffff')
        gr.addColorStop(0.3, dot)
        gr.addColorStop(1, shade)
        g.fillStyle = gr
      } else {
        const gr = g.createRadialGradient(cx - rx * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
        gr.addColorStop(0, '#3a3d3a')
        gr.addColorStop(1, '#1a1c1a')
        g.fillStyle = gr
      }
      g.beginPath()
      g.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2)
      g.fill()
    }

    const draw = (t) => {
      let busy = false
      for (const d of dots) {
        if (d.t0 < 0 || t < d.t0) {
          if (d.t0 >= 0) busy = true
          continue
        }
        busy = true
        const p = Math.min(1, (t - d.t0) / d.dur)
        // the coil kicks it over, then it rebounds off the stop and settles
        d.a = d.from + (d.to - d.from) * p * p * (3 - 2 * p)
        if (p >= 1) {
          const since = t - d.t0 - d.dur
          d.a = d.to + Math.sin(since / 9) * Math.exp(-since / 25) * 0.25 * (d.to ? -1 : 1)
          if (since > 140) {
            d.a = d.to
            d.t0 = -1
          }
        }
      }
      if (!busy && !dirty) return
      dirty = busy
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.fillStyle = '#0b0c0b'
      g.fillRect(0, 0, cv.width, cv.height)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const r = cell * 0.4
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) disc(cell * (x + 0.5), cell * (y + 0.5), r, dots[y * cols + x])
      }
    }

    const frame = (now) => {
      now0 ||= now
      const t = now - now0
      if (msg < 0) show(0, t + 300)
      else if (t >= nextAt && maps.length > 1) show(msg + 1, t)
      if (sound) while (soundCols.length && soundCols[0].at <= t) clatter(soundCols.shift().n)
      draw(t)
      raf = requestAnimationFrame(frame)
    }

    const click = () => {
      if (maps.length > 1) show(msg + 1, performance.now() - now0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    el.addEventListener('click', click)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('click', click)
    }
  }, [text, rows, hold, sweep, dot, sound])

  // screws along the top and bottom rails of the housing
  const screws = Array.from({ length: 7 }, (_, i) => `${6 + i * 14.66}%`)
  const screw = (left, top) => (
    <span
      key={`${left}-${top}`}
      style={{ position: 'absolute', left, top, width: 7, height: 7, marginLeft: -3.5, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #9a9ea4, #45484c 70%)', boxShadow: '0 1px 1px rgba(0,0,0,.6)' }}
    />
  )
  return (
    <div
      ref={wrap}
      role="img"
      aria-label={String(text).split('|').join(', ')}
      style={{ position: 'relative', width: '100%', padding: '22px 30px', boxSizing: 'border-box', cursor: 'pointer', ...style }}
    >
      {/* mounting brackets either side */}
      {['left', 'right'].map((side) => (
        <span key={side} aria-hidden="true" style={{ position: 'absolute', [side]: 0, top: '22%', bottom: '22%', width: 18, borderRadius: 3, background: `linear-gradient(90deg, #1a1b1d, ${housing}, #1a1b1d)`, boxShadow: '0 2px 4px rgba(0,0,0,.4)' }} />
      ))}
      {/* the housing: a bevelled metal frame round the dot panel */}
      <div style={{ position: 'relative', padding: '18px 16px', borderRadius: 6, background: `linear-gradient(${housing}, color-mix(in srgb, ${housing} 60%, #000))`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.6), 0 12px 28px rgba(0,0,0,.35), 0 2px 4px rgba(0,0,0,.4)' }}>
        <span aria-hidden="true">
          {screws.map((l) => screw(l, 6))}
          {screws.map((l) => screw(l, 'calc(100% - 13px)'))}
        </span>
        <div style={{ padding: 4, borderRadius: 2, background: '#0b0c0b', boxShadow: 'inset 0 2px 6px rgba(0,0,0,.9), 0 0 0 1px rgba(0,0,0,.7), 0 1px 0 1px rgba(255,255,255,.06)' }}>
          <canvas ref={cvs} style={{ display: 'block', width: '100%' }} />
        </div>
      </div>
    </div>
  )
}
