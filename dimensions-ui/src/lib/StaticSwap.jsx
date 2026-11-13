import { useEffect, useRef, useState } from 'react'

// Words that change channel: every few seconds the word dissolves into a
// burst of TV static (noise clipped to the shapes of the letters, with a few
// horizontal tears), and the next word tunes in out of it. Separate words
// with "|".
export default function StaticSwap({
  words = 'Signal|Static|Noise|Tuned',
  interval = 2.2,
  burst = 260,
  color = '#1c1a16',
  style,
}) {
  const list = String(words).split('|').map((w) => w.trim()).filter(Boolean)
  const [i, setI] = useState(0)
  const [noisy, setNoisy] = useState(false)
  const cv = useRef()
  const word = useRef()

  useEffect(() => {
    let a = 0
    let b = 0
    const id = setInterval(() => {
      setNoisy(true)
      a = setTimeout(() => setI((n) => (n + 1) % list.length), burst / 2)
      b = setTimeout(() => setNoisy(false), burst)
    }, interval * 1000)
    return () => {
      clearInterval(id)
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [words, interval, burst])

  // draw the static, frame by frame, while the burst lasts
  useEffect(() => {
    if (!noisy) return
    const c = cv.current
    const el = word.current
    const r = el.getBoundingClientRect()
    const w = Math.ceil(r.width / 3)
    const h = Math.ceil(r.height / 3)
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    const img = g.createImageData(w, h)
    const cs = getComputedStyle(el)
    const fs = parseFloat(cs.fontSize) / 3
    const font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`
    const label = el.textContent
    let raf = 0
    const frame = () => {
      for (let k = 0; k < img.data.length; k += 4) {
        const v = Math.random() * 255
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v
        img.data[k + 3] = 255
      }
      g.putImageData(img, 0, 0)
      // tears: a few rows shifted sideways
      for (let n = 0; n < 3; n++) {
        const y = Math.floor(Math.random() * h)
        const hh = 1 + Math.floor(Math.random() * 3)
        g.drawImage(c, 0, y, w, hh, (Math.random() - 0.5) * w * 0.3, y, w, hh)
      }
      // keep the static only where the letters are
      g.globalCompositeOperation = 'destination-in'
      g.font = font
      g.textBaseline = 'middle'
      g.fillText(label, 0, h / 2)
      g.globalCompositeOperation = 'source-over'
      el.style.transform = `translateX(${((Math.random() - 0.5) * 0.06).toFixed(3)}em)`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.style.transform = ''
    }
  }, [noisy, i])

  return (
    <span aria-live="polite" style={{ position: 'relative', display: 'inline-block', color, ...style }}>
      <span ref={word} style={{ display: 'inline-block', opacity: noisy ? 0.12 : 1, transition: 'opacity .05s' }}>
        {list[i] ?? ''}
      </span>
      {noisy && (
        <canvas
          ref={cv}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
            opacity: 0.95,
          }}
        />
      )}
    </span>
  )
}
