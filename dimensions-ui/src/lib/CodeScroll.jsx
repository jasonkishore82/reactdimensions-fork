import { useEffect, useMemo, useRef } from 'react'

// Code (or a hex dump) that scrolls up steadily under a slow scan line, with
// syntax colouring and a line-number gutter. The line under the scan glows,
// and it loops seamlessly, so it works as a living background.
const SAMPLE = `import { useEffect, useRef } from 'react'

// a spring that settles toward its target
export function spring(x, v, target, k = 170, c = 16, dt = 1 / 60) {
  const a = k * (target - x) - c * v
  v += a * dt
  x += v * dt
  return [x, v]
}

export default function Tilt({ max = 14 }) {
  const el = useRef(null)
  useEffect(() => {
    let raf = 0
    const s = { x: 0, vx: 0, tx: 0 }
    const tick = () => {
      ;[s.x, s.vx] = spring(s.x, s.vx, s.tx)
      el.current.style.transform = \`rotateY(\${s.x}deg)\`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [max])
  return <div ref={el} className="card" />
}`

function highlight(line, c) {
  // tokenise in order: comments, strings, numbers, keywords
  const out = []
  let rest = line
  const rules = [
    [/^\s*\/\/.*/, c.comment],
    [/^(['"`])(?:\\.|(?!\1).)*\1/, c.string],
    [/^\b\d+(\.\d+)?\b/, c.number],
    [/^\b(import|from|export|default|function|const|let|return|new|if|else|for|while|true|false|null)\b/, c.keyword],
    [/^[A-Z][A-Za-z0-9]*/, c.type],
    [/^[a-z_$][\w$]*(?=\()/, c.fn],
    [/^[^\s'"`\w]+/, c.punct],
    [/^\s+/, null],
    [/^[\w$]+/, c.text],
  ]
  while (rest.length) {
    let hit = false
    for (const [re, col] of rules) {
      const m = rest.match(re)
      if (m && m[0].length) {
        out.push([m[0], col])
        rest = rest.slice(m[0].length)
        hit = true
        break
      }
    }
    if (!hit) {
      out.push([rest[0], c.text])
      rest = rest.slice(1)
    }
  }
  return out
}

function hexLines(src) {
  const bytes = new TextEncoder().encode(src)
  const lines = []
  for (let i = 0; i < bytes.length; i += 16) {
    const row = [...bytes.slice(i, i + 16)]
    const hex = row.map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47)
    const ascii = row.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
    lines.push(`${i.toString(16).padStart(8, '0')}  ${hex}  ${ascii}`)
  }
  return lines
}

export default function CodeScroll({
  mode = 'code',
  code = SAMPLE,
  speed = 22,
  accent = '#ff7b54',
  style,
}) {
  const track = useRef()
  const C = { comment: '#6b7280', string: '#a5d6a7', number: '#f9c97c', keyword: accent, type: '#7cc4fa', fn: '#c4a7ff', punct: '#8b95a5', text: '#e6e8ec' }
  const lines = useMemo(() => (mode === 'hex' ? hexLines(code) : String(code).split('\n')), [mode, code])

  useEffect(() => {
    const el = track.current
    let y = 0
    let raf = 0
    let last = 0
    const frame = (now) => {
      last ||= now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const half = el.scrollHeight / 2
      y = (y + speed * dt) % half
      el.style.transform = `translate3d(0, ${-y.toFixed(2)}px, 0)`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [speed, lines])

  const render = (copy) =>
    lines.map((l, i) => (
      <div key={`${copy}-${i}`} style={{ display: 'flex', gap: 16 }}>
        <span style={{ width: 28, textAlign: 'right', color: '#3d4452', flex: 'none' }}>{mode === 'hex' ? '' : i + 1}</span>
        <span>
          {mode === 'hex'
            ? [
                <span key="o" style={{ color: '#5c6370' }}>{l.slice(0, 8)}</span>,
                <span key="h" style={{ color: C.text }}>{l.slice(8, 59)}</span>,
                <span key="a" style={{ color: accent }}>{l.slice(59)}</span>,
              ]
            : highlight(l, C).map(([t, col], k) => (
                <span key={k} style={{ color: col ?? undefined }}>
                  {t}
                </span>
              ))}
        </span>
      </div>
    ))

  return (
    <div aria-label="Scrolling code" role="img" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0f1218', font: '13px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', whiteSpace: 'pre', ...style }}>
      <div ref={track} style={{ padding: '12px 18px', willChange: 'transform' }}>
        {render('a')}
        {render('b')}
      </div>
      {/* the scan band and the fades at the edges */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '46%', height: '1.65em', background: `linear-gradient(90deg, ${accent}00, ${accent}26 20%, ${accent}26 80%, ${accent}00)`, borderTop: `1px solid ${accent}44`, borderBottom: `1px solid ${accent}44`, pointerEvents: 'none', mixBlendMode: 'screen' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(#0f1218, transparent 18%, transparent 82%, #0f1218)', pointerEvents: 'none' }} />
    </div>
  )
}
