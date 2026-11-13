import { useEffect, useId, useRef, useState } from 'react'

// Punched paper tape. Each character is one row across the tape, its 8-bit
// code punched as holes (a hole is a 1), with the small sprocket hole that
// the feed wheel pulls on running between bits 3 and 4. The tape runs right
// to left past an optical reader: a lamp shines up through the holes, and as
// each row crosses the read head its character is decoded and appears on the
// display below. The tape loops, so the message keeps coming round.
export default function PunchedTape({
  text = 'HELLO, WORLD',
  speed = 70,
  tape = '#f1e3b8',
  light = '#ffd36b',
  style,
}) {
  const id = useId().replace(/:/g, '')
  const box = useRef()
  const strip = useRef()
  const [out, setOut] = useState('')
  const codes = [...String(text)].map((c) => c.charCodeAt(0) & 255)
  const lead = 6 // blank rows (sprocket only) before the message
  const rowsAll = [...Array(lead).fill(0), ...codes, ...Array(lead).fill(0)]
  const P = 18 // px per row

  useEffect(() => {
    setOut('')
    let raf = 0
    let t0 = 0
    let lastRow = -1
    let shown = ''
    const loop = rowsAll.length * P
    const frame = (now) => {
      t0 ||= now
      const t = (now - t0) / 1000
      const W = box.current?.clientWidth || 600
      const head = W * 0.5
      // distance travelled; the tape enters from the right edge
      const d = (t * speed) % (loop + W)
      const x = W - d
      if (strip.current) strip.current.style.transform = `translateX(${x.toFixed(1)}px)`
      // which row is over the read head
      const row = Math.floor((head - x) / P)
      if (row !== lastRow) {
        lastRow = row
        if (row === 0) shown = ''
        const k = row - lead
        if (k >= 0 && k < codes.length) {
          shown = String(text).slice(0, k + 1)
          setOut(shown)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [text, speed])

  // tape is drawn as an SVG: 8 data channels + the sprocket track
  const H = 9 * 14 + 18
  const yOf = (bit) => 16 + (bit < 3 ? bit : bit + 1) * 14 // sprocket sits at slot 3
  return (
    <div ref={box} role="img" aria-label={text} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(#26272b, #18191c)', ...style }}>
      <div style={{ position: 'absolute', left: 0, top: '22%', width: '100%', height: H }}>
        {/* the lamp under the reader, seen through the holes */}
        <div style={{ position: 'absolute', left: 'calc(50% - 7px)', top: -6, width: 14, height: H + 12, background: `radial-gradient(closest-side, ${light}, ${light}00)`, filter: 'blur(2px)' }} />
        <svg ref={strip} width={rowsAll.length * P} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', willChange: 'transform', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.4))' }}>
          <defs>
            <mask id={`holes-${id}`}>
              <rect width={rowsAll.length * P} height={H} fill="#fff" />
              {rowsAll.map((code, r) => (
                <g key={r}>
                  <circle cx={r * P + P / 2} cy={16 + 3 * 14} r="2.6" fill="#000" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (code >> b) & 1 ? <circle key={b} cx={r * P + P / 2} cy={yOf(b)} r="5" fill="#000" /> : null)}
                </g>
              ))}
            </mask>
            <linearGradient id={`shade-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity=".12" />
              <stop offset=".1" stopColor="#000" stopOpacity="0" />
              <stop offset=".9" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".18" />
            </linearGradient>
          </defs>
          <g mask={`url(#holes-${id})`}>
            <rect width={rowsAll.length * P} height={H} fill={tape} />
            <rect width={rowsAll.length * P} height={H} fill={`url(#shade-${id})`} />
          </g>
        </svg>
        {/* light coming up through the holes as they pass the head */}
        <div style={{ position: 'absolute', left: 'calc(50% - 1px)', top: -14, width: 2, height: H + 28, background: light, boxShadow: `0 0 12px 3px ${light}`, opacity: 0.85 }} />
        <div style={{ position: 'absolute', left: 'calc(50% - 22px)', top: -26, width: 44, height: 14, borderRadius: 4, background: 'linear-gradient(#55585e, #2c2e33)' }} />
        <div style={{ position: 'absolute', left: 'calc(50% - 22px)', top: H + 12, width: 44, height: 14, borderRadius: 4, background: 'linear-gradient(#2c2e33, #55585e)' }} />
      </div>
      {/* the decoded output */}
      <div style={{ position: 'absolute', left: '50%', bottom: '14%', transform: 'translateX(-50%)', minWidth: '60%', padding: '10px 18px', borderRadius: 6, background: '#0b0d0b', boxShadow: 'inset 0 2px 6px rgba(0,0,0,.8)', font: '600 clamp(18px, 3.2vw, 30px)/1.2 ui-monospace, Menlo, Consolas, monospace', color: '#9dff9a', textShadow: '0 0 8px rgba(120,255,120,.6)', whiteSpace: 'pre', textAlign: 'left' }}>
        {out}
        <span style={{ opacity: 0.7, animation: 'rd-pt-cur 1s steps(1) infinite' }}>▋</span>
        <style>{'@keyframes rd-pt-cur { 50% { opacity: 0 } }'}</style>
      </div>
    </div>
  )
}
