import { useEffect, useRef, useState } from 'react'

// A flipbook. Each page holds one frame of a little animation of the word,
// drawn by hand: the letters hop one after another and land with a squash.
// Your thumb lets the pages go one at a time, so each page bends up off the
// stack and flips over to show the next frame underneath. Run fast enough,
// the frames read as motion. Hold the pointer down to riffle faster.
const FRAMES = 24

// pose of letter i on frame f: a hop that travels along the word
function pose(i, f, n) {
  const phase = (f / FRAMES) * (n + 4) - i
  if (phase < 0 || phase > 2) return { y: 0, sx: 1, sy: 1, r: 0 }
  if (phase < 0.25) {
    // crouch before the jump
    const k = phase / 0.25
    return { y: 0, sx: 1 + 0.18 * k, sy: 1 - 0.22 * k, r: 0 }
  }
  if (phase < 1.65) {
    const k = (phase - 0.25) / 1.4
    return { y: -Math.sin(k * Math.PI) * 0.9, sx: 0.92, sy: 1.1, r: (k - 0.5) * -14 }
  }
  // land with a squash
  const k = (phase - 1.65) / 0.35
  return { y: 0, sx: 1 + 0.22 * (1 - k), sy: 1 - 0.25 * (1 - k), r: 0 }
}

function Frame({ text, f, ink, accent }) {
  const chars = [...text]
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '22%', font: "700 1em/1 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', sans-serif", color: ink }}>
      {chars.map((ch, i) => {
        const p = pose(i, f, chars.length)
        return (
          <span key={i} style={{ display: 'inline-block', transformOrigin: '50% 100%', transform: `translateY(${p.y}em) rotate(${p.r}deg) scale(${p.sx}, ${p.sy})`, color: i % 3 === 1 ? accent : ink, whiteSpace: 'pre' }}>
            {ch}
          </span>
        )
      })}
      {/* the hand-drawn ground line and page number */}
      <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: '20%', height: '0.03em', background: ink, opacity: 0.35, borderRadius: 2 }} />
      <div style={{ position: 'absolute', right: '6%', bottom: '5%', font: '500 0.16em/1 ui-monospace, Menlo, monospace', opacity: 0.4 }}>{f + 1}</div>
    </div>
  )
}

export default function FlipbookText({
  text = 'HOP',
  fps = 12,
  paper = '#fbf8f1',
  ink = '#26262a',
  accent = '#ff4d1a',
  style,
}) {
  const [f, setF] = useState(0)
  const fast = useRef(false)
  const flip = useRef()

  useEffect(() => {
    let alive = true
    let timer = 0
    const tick = () => {
      if (!alive) return
      const rate = fast.current ? fps * 2 : fps
      // the page curls up and over, revealing the next frame
      flip.current?.animate(
        [
          { transform: 'rotateY(0deg)', filter: 'brightness(1)' },
          { transform: 'rotateY(-90deg)', filter: 'brightness(.75)' },
          { transform: 'rotateY(-178deg)', filter: 'brightness(.9)' },
        ],
        { duration: 1000 / rate, easing: 'ease-in' },
      )
      setF((x) => (x + 1) % FRAMES)
      timer = setTimeout(tick, 1000 / rate)
    }
    timer = setTimeout(tick, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [fps])

  const page = { position: 'absolute', inset: 0, background: paper, borderRadius: '0 0.08em 0.08em 0', boxShadow: 'inset 0.12em 0 0.2em rgba(0,0,0,.08)' }
  return (
    <div
      role="img"
      aria-label={text}
      onPointerDown={() => (fast.current = true)}
      onPointerUp={() => (fast.current = false)}
      onPointerLeave={() => (fast.current = false)}
      style={{ position: 'relative', width: '6.4em', height: '4em', perspective: '12em', cursor: 'pointer', userSelect: 'none', ...style }}
    >
      {/* the stack of pages below, seen at the edge */}
      {[6, 5, 4, 3, 2, 1].map((k) => (
        <div key={k} style={{ ...page, transform: `translate(${k * 0.018}em, ${k * 0.03}em)`, filter: `brightness(${1 - k * 0.025})`, boxShadow: '0 0.02em 0.02em rgba(0,0,0,.12)' }} />
      ))}
      {/* the page now showing */}
      <div style={page}>
        <Frame text={text} f={f} ink={ink} accent={accent} />
      </div>
      {/* the page just let go, flipping away with the previous frame */}
      <div ref={flip} style={{ ...page, transformOrigin: '0 50%', transform: 'rotateY(-178deg)', backfaceVisibility: 'hidden' }}>
        <Frame text={text} f={(f + FRAMES - 1) % FRAMES} ink={ink} accent={accent} />
      </div>
      {/* the binding */}
      <div style={{ position: 'absolute', left: '-0.12em', top: '-0.04em', bottom: '-0.1em', width: '0.18em', borderRadius: '0.06em', background: 'linear-gradient(90deg, #2a2a2e, #55555c)' }} />
    </div>
  )
}
