import { useState } from 'react'

// Words that turn into Braille, Morse or binary when you hover them, letter
// by letter in a quick wave, and turn back when you leave. The encodings are
// real: six-dot Braille cells, International Morse, and 8-bit ASCII.
const BRAILLE = {
  a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚', k: '⠅', l: '⠇', m: '⠍',
  n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞', u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵',
  '1': '⠼⠁', '2': '⠼⠃', '3': '⠼⠉', '4': '⠼⠙', '5': '⠼⠑', '6': '⠼⠋', '7': '⠼⠛', '8': '⠼⠓', '9': '⠼⠊', '0': '⠼⠚',
  '.': '⠲', ',': '⠂', '?': '⠦', '!': '⠖', "'": '⠄', '-': '⠤',
}
const MORSE = {
  a: '·−', b: '−···', c: '−·−·', d: '−··', e: '·', f: '··−·', g: '−−·', h: '····', i: '··', j: '·−−−', k: '−·−', l: '·−··', m: '−−',
  n: '−·', o: '−−−', p: '·−−·', q: '−−·−', r: '·−·', s: '···', t: '−', u: '··−', v: '···−', w: '·−−', x: '−··−', y: '−·−−', z: '−−··',
  '1': '·−−−−', '2': '··−−−', '3': '···−−', '4': '····−', '5': '·····', '6': '−····', '7': '−−···', '8': '−−−··', '9': '−−−−·', '0': '−−−−−',
  '.': '·−·−·−', ',': '−−··−−', '?': '··−−··', '!': '−·−·−−',
}
const encode = (c, mode) => {
  const k = c.toLowerCase()
  if (mode === 'braille') return BRAILLE[k] ?? c
  if (mode === 'morse') return MORSE[k] ?? c
  return c.charCodeAt(0).toString(2).padStart(8, '0')
}

function Word({ word, mode, accent }) {
  const [on, setOn] = useState(false)
  return (
    <span
      onPointerEnter={() => setOn(true)}
      onPointerLeave={() => setOn(false)}
      onClick={() => setOn((v) => !v)}
      style={{ display: 'inline-flex', alignItems: 'baseline', cursor: 'default', borderRadius: '0.12em', padding: '0 0.04em', background: on ? `${accent}14` : 'transparent', transition: 'background .2s' }}
    >
      {[...word].map((c, i) => (
        <span key={i} style={{ display: 'inline-grid', justifyItems: 'center' }}>
          {/* both stacked in one cell: the cell takes the wider one's width
              only while encoded, so the line reflows smoothly */}
          <span
            style={{
              gridArea: '1 / 1',
              transition: `opacity .18s ${i * 35}ms, transform .18s ${i * 35}ms`,
              opacity: on ? 0 : 1,
              transform: on ? 'translateY(-0.3em)' : 'none',
            }}
          >
            {c}
          </span>
          <span
            aria-hidden="true"
            style={{
              gridArea: '1 / 1',
              font: mode === 'braille' ? 'inherit' : '600 0.42em/2.4 ui-monospace, Menlo, monospace',
              letterSpacing: mode === 'binary' ? '0.02em' : '0.08em',
              color: accent,
              whiteSpace: 'nowrap',
              transition: `opacity .18s ${i * 35}ms, transform .18s ${i * 35}ms, max-width .25s ${i * 35}ms`,
              opacity: on ? 1 : 0,
              transform: on ? 'none' : 'translateY(0.3em)',
              maxWidth: on ? '10em' : 0,
              overflow: 'hidden',
            }}
          >
            {encode(c, mode)}
          </span>
        </span>
      ))}
    </span>
  )
}

export default function EncodeText({
  text = 'Hover any word to encode it',
  mode = 'braille',
  accent = '#ff4d1a',
  style,
}) {
  const parts = String(text).split(/(\s+)/)
  return (
    <span aria-label={text} style={{ display: 'inline-block', ...style }}>
      {parts.map((p, i) => (/^\s+$/.test(p) || !p ? p : <Word key={`${i}-${p}-${mode}`} word={p} mode={mode} accent={accent} />))}
    </span>
  )
}
