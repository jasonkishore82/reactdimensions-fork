import { useEffect, useRef } from 'react'

// A dot-matrix printer. Like a real 9-pin head, the print head carries one
// vertical column of pins: it sweeps across the paper and fires the pins it
// needs at each column, so a whole line of text prints in a single pass.
// It prints both ways (bidirectional, as fast printers did), dropping down a
// line between passes, and each dot lands a touch uneven, the way an inked
// ribbon leaves it. Separate lines with "|".
const SS = 4 // supersampling used when rasterising the text into pins

function rasterise(line, pins) {
  const c = document.createElement('canvas')
  const g = c.getContext('2d', { willReadFrequently: true })
  const font = `700 ${pins * SS * 0.95}px ui-monospace, Menlo, Consolas, monospace`
  g.font = font
  const w = Math.max(1, Math.ceil(g.measureText(line).width / SS)) + 1
  c.width = w * SS
  c.height = pins * SS
  g.font = font
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#000'
  g.fillText(line, 0, pins * SS * 0.78)
  const data = g.getImageData(0, 0, c.width, c.height).data
  const cols = []
  for (let x = 0; x < w; x++) {
    const col = []
    for (let y = 0; y < pins; y++) {
      let a = 0
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) a += data[((y * SS + dy) * c.width + x * SS + dx) * 4 + 3]
      col.push(a / (SS * SS * 255) > 0.38)
    }
    cols.push(col)
  }
  return cols
}

let actx
function buzz() {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const o = actx.createOscillator()
    o.type = 'square'
    o.frequency.value = 340
    const bp = actx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 2
    const g = actx.createGain()
    g.gain.value = 0
    o.connect(bp).connect(g).connect(actx.destination)
    o.start()
    return {
      set(on) {
        g.gain.setTargetAtTime(on ? 0.025 : 0, actx.currentTime, 0.01)
      },
      stop() {
        g.gain.setTargetAtTime(0, actx.currentTime, 0.02)
        o.stop(actx.currentTime + 0.2)
      },
    }
  } catch {
    return { set() {}, stop() {} }
  }
}

export default function DotMatrixText({
  text = 'DOT MATRIX|PRINTING...',
  pins = 12,
  speed = 90,
  color = '#262626',
  sound = false,
  style,
}) {
  const wrap = useRef()
  const canvas = useRef()

  useEffect(() => {
    const cv = canvas.current
    const fs = parseFloat(getComputedStyle(wrap.current).fontSize) || 32
    const lines = String(text).split('|').map((l) => rasterise(l, pins))
    const pitch = fs / pins // one dot per pin, so a line is about 1em tall
    const lineGap = pitch * 3
    const cols = Math.max(...lines.map((l) => l.length))
    const W = cols * pitch + pitch * 2
    const Hh = lines.length * (pins * pitch + lineGap) + pitch * 2
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = W * dpr
    cv.height = Hh * dpr
    cv.style.width = `${W}px`
    cv.style.height = `${Hh}px`
    const g = cv.getContext('2d')
    g.scale(dpr, dpr)

    const printed = [] // dots already on the paper
    let line = 0
    let col = 0
    let head = 0 // head x, in columns
    let raf = 0
    let last = 0
    let pause = 0.3
    const snd = sound ? buzz() : null

    const rowY = (l) => pitch + l * (pins * pitch + lineGap)
    const draw = () => {
      g.clearRect(0, 0, W, Hh)
      g.fillStyle = color
      for (const d of printed) {
        g.globalAlpha = d.a
        g.beginPath()
        g.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      if (line < lines.length) {
        // the head: a dark carriage with its column of pins
        const hx = pitch + head * pitch
        const y = rowY(line)
        g.fillStyle = 'rgba(40,40,44,0.85)'
        g.beginPath()
        g.roundRect(hx - pitch * 1.4, y - pitch * 1.2, pitch * 2.8, pins * pitch + pitch * 2.4, pitch * 0.6)
        g.fill()
        g.fillStyle = 'rgba(200,200,205,0.9)'
        for (let p = 0; p < pins; p++) g.fillRect(hx - pitch * 0.12, y + p * pitch + pitch * 0.3, pitch * 0.24, pitch * 0.4)
      }
    }

    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (line >= lines.length) {
        snd?.stop()
        draw()
        return
      }
      if (pause > 0) {
        pause -= dt
        snd?.set(false)
      } else {
        const L = lines[line]
        const forward = line % 2 === 0
        const target = forward ? L.length : -1
        head += (forward ? 1 : -1) * speed * dt
        snd?.set(true)
        // fire the pins for every column the head has crossed
        while (forward ? col < Math.min(L.length, Math.floor(head) + 1) : col > Math.max(-1, Math.ceil(head) - 1)) {
          if (col >= 0 && col < L.length) {
            L[col].forEach((on, p) => {
              if (on) printed.push({ x: pitch + col * pitch + (Math.random() - 0.5) * pitch * 0.12, y: rowY(line) + p * pitch + pitch / 2, r: pitch * (0.36 + Math.random() * 0.08), a: 0.72 + Math.random() * 0.28 })
            })
          }
          col += forward ? 1 : -1
        }
        if (forward ? head >= target : head <= target) {
          // line feed: the next pass runs the other way
          line++
          pause = 0.18
          if (line < lines.length) {
            const nf = line % 2 === 0
            col = nf ? 0 : lines[line].length - 1
            head = nf ? 0 : lines[line].length - 1
          }
        }
      }
      draw()
      raf = requestAnimationFrame(frame)
    }
    col = 0
    head = 0
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      snd?.stop()
    }
  }, [text, pins, speed, color, sound])

  return (
    <span ref={wrap} aria-label={String(text).split('|').join(' ')} style={{ display: 'inline-block', lineHeight: 0, ...style }}>
      <canvas ref={canvas} aria-hidden="true" />
    </span>
  )
}
