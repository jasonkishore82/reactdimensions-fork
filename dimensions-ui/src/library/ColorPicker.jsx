import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// The library's colour control: a swatch that opens a picker popover with a
// saturation/brightness square, a hue strip, an eyedropper (where the browser
// has one), HEX / RGB / HSL fields and the colours you used recently.

// ---- colour maths (all channels 0..1 unless noted) ----
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))

function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')

function rgbToHsv(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }
  return [h, max ? d / max : 0, max]
}
function hsvToRgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5) * 255, f(3) * 255, f(1) * 255]
}
function rgbToHsl(r, g, b) {
  const [h, s, v] = rgbToHsv(r, g, b)
  const l = v * (1 - s / 2)
  return [h, l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l]
}
function hslToRgb(h, s, l) {
  const v = l + s * Math.min(l, 1 - l)
  return hsvToRgb(h, v ? 2 * (1 - l / v) : 0, v)
}

// ---- recent colours, shared by every colour control ----
const RECENT_KEY = 'rd-recent-colors'
function loadRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter((c) => hexToRgb(c)).slice(0, 10) : []
  } catch {
    return []
  }
}
function pushRecent(hex) {
  try {
    const next = [hex, ...loadRecent().filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 10)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // storage blocked: recents just won't persist
  }
}

// drag helper: calls fn(x01, y01) on press and while dragging
function useDrag(ref, fn) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  return (e) => {
    const el = ref.current
    if (!el) return
    e.preventDefault()
    const at = (ev) => {
      const r = el.getBoundingClientRect()
      fnRef.current(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height))
    }
    at(e)
    el.setPointerCapture?.(e.pointerId)
    const move = (ev) => at(ev)
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
}

function Field({ label, value, onCommit, width = 46, max }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    if (max == null) return onCommit(text)
    const n = Number(text)
    if (Number.isFinite(n)) onCommit(clamp(Math.round(n), 0, max))
    else setText(String(value))
  }
  return (
    <label className="cp-field" style={{ width }}>
      <input
        value={text}
        inputMode={max == null ? 'text' : 'numeric'}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit()
            e.currentTarget.blur()
          }
          if (max != null && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault()
            const n = clamp(Math.round(Number(text) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1), 0, max)
            setText(String(n))
            onCommit(n)
          }
        }}
      />
      <span>{label}</span>
    </label>
  )
}

const MODES = ['hex', 'rgb', 'hsl']

export default function ColorPicker({ id, name, value, onChange }) {
  const [open, setOpen] = useState(false)
  // hsv is the picker's own state, so hue survives greys and black
  const [hsv, setHsv] = useState(() => rgbToHsv(...(hexToRgb(value) ?? [0, 0, 0])))
  const [mode, setMode] = useState(() => {
    try {
      return MODES.includes(localStorage.getItem('rd-color-mode')) ? localStorage.getItem('rd-color-mode') : 'hex'
    } catch {
      return 'hex'
    }
  })
  const [recent, setRecent] = useState([])
  const [pos, setPos] = useState(null)
  const btn = useRef()
  const pop = useRef()
  const sv = useRef()
  const hue = useRef()
  const startValue = useRef(value)

  // follow outside changes (presets, reset) without losing the hue of greys
  useEffect(() => {
    const rgb = hexToRgb(value)
    if (!rgb) return
    if (rgbToHex(...hsvToRgb(...hsv)).toLowerCase() === String(value).toLowerCase()) return
    const next = rgbToHsv(...rgb)
    if (next[1] === 0 || next[2] === 0) next[0] = hsv[0]
    setHsv(next)
  }, [value])

  const emit = (h, s, v) => {
    setHsv([h, s, v])
    onChange(rgbToHex(...hsvToRgb(h, s, v)))
  }
  const setHex = (hex) => {
    const rgb = hexToRgb(hex)
    if (!rgb) return
    const next = rgbToHsv(...rgb)
    if (next[1] === 0 || next[2] === 0) next[0] = hsv[0]
    setHsv(next)
    onChange(rgbToHex(...rgb))
  }

  const close = (commit = true) => {
    setOpen(false)
    if (commit && String(value).toLowerCase() !== String(startValue.current).toLowerCase()) pushRecent(value)
    btn.current?.focus()
  }
  const toggle = () => {
    if (open) return close()
    startValue.current = value
    setRecent(loadRecent())
    setOpen(true)
  }

  // place the popover under the swatch, or above it when there's no room,
  // kept inside the window
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const b = btn.current.getBoundingClientRect()
      const W = 264
      const H = pop.current?.offsetHeight || 360
      const left = clamp(b.right - W, 8, window.innerWidth - W - 8)
      const below = b.bottom + 8 + H < window.innerHeight
      setPos({ left, top: below ? b.bottom + 8 : Math.max(8, b.top - 8 - H) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // click outside or Esc closes it (Esc puts the colour back)
  useEffect(() => {
    if (!open) return
    const down = (e) => {
      if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) close()
    }
    const key = (e) => {
      if (e.key === 'Escape') {
        onChange(startValue.current)
        close(false)
      }
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('keydown', key)
    }
  }, [open, value])

  const [h, s, v] = hsv
  const rgb = hsvToRgb(h, s, v).map(Math.round)
  const hex = rgbToHex(...rgb)
  const hsl = rgbToHsl(...rgb)

  const dragSV = useDrag(sv, (x, y) => emit(h, x, 1 - y))
  const dragHue = useDrag(hue, (x) => emit(x * 360, s, v))

  const svKey = (e) => {
    const step = e.shiftKey ? 0.1 : 0.01
    const m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
    if (!m) return
    e.preventDefault()
    emit(h, clamp(s + m[0]), clamp(v + m[1]))
  }
  const hueKey = (e) => {
    const step = e.shiftKey ? 10 : 1
    const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key]
    if (d == null) return
    e.preventDefault()
    emit((h + d + 360) % 360, s, v)
  }

  const canDrop = typeof window !== 'undefined' && 'EyeDropper' in window
  const eyedrop = async () => {
    try {
      const r = await new window.EyeDropper().open()
      setHex(r.sRGBHex)
    } catch {
      // cancelled
    }
  }
  const cycleMode = () => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]
    setMode(next)
    try {
      localStorage.setItem('rd-color-mode', next)
    } catch {
      // not persisted
    }
  }

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className="ctl ctl-color"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${name}: ${value}`}
        onClick={toggle}
      >
        <span className="ctl-name">{name}</span>
        <span className="ctl-color-val">{value}</span>
        <span className="cp-swatch" style={{ background: value }} />
      </button>

      {open && (
        <div
          ref={pop}
          className="cp-pop"
          role="dialog"
          aria-label={`Pick ${name}`}
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
        >
          <div
            ref={sv}
            className="cp-sv"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
            onPointerDown={dragSV}
            onKeyDown={svKey}
            tabIndex={0}
            role="slider"
            aria-label="Saturation and brightness"
            aria-valuetext={`saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`}
          >
            <span className="cp-thumb" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hex }} />
          </div>

          <div className="cp-row">
            {canDrop && (
              <button type="button" className="cp-icon" onClick={eyedrop} aria-label="Pick a colour from the screen" title="Eyedropper">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 22 1-1h3l9-9" />
                  <path d="M3 21v-3l9-9" />
                  <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
                </svg>
              </button>
            )}
            <span className="cp-preview" aria-hidden="true">
              <span style={{ background: startValue.current }} />
              <span style={{ background: hex }} />
            </span>
            <div
              ref={hue}
              className="cp-hue"
              onPointerDown={dragHue}
              onKeyDown={hueKey}
              tabIndex={0}
              role="slider"
              aria-label="Hue"
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(h)}
            >
              <span className="cp-thumb" style={{ left: `${(h / 360) * 100}%`, top: '50%', background: `hsl(${h} 100% 50%)` }} />
            </div>
          </div>

          <div className="cp-fields">
            {mode === 'hex' && <Field label="HEX" value={hex.toUpperCase()} width={158} onCommit={setHex} />}
            {mode === 'rgb' &&
              ['R', 'G', 'B'].map((l, i) => (
                <Field
                  key={l}
                  label={l}
                  value={rgb[i]}
                  max={255}
                  onCommit={(n) => {
                    const next = [...rgb]
                    next[i] = n
                    setHex(rgbToHex(...next))
                  }}
                />
              ))}
            {mode === 'hsl' &&
              ['H', 'S', 'L'].map((l, i) => (
                <Field
                  key={l}
                  label={l}
                  value={i === 0 ? Math.round(hsl[0]) : Math.round(hsl[i] * 100)}
                  max={i === 0 ? 360 : 100}
                  onCommit={(n) => {
                    const next = [hsl[0], hsl[1], hsl[2]]
                    next[i] = i === 0 ? n : n / 100
                    const out = hslToRgb(...next)
                    setHex(rgbToHex(...out))
                    if (i === 0) setHsv((p) => [n % 360, p[1], p[2]])
                  }}
                />
              ))}
            <button type="button" className="cp-mode" onClick={cycleMode} aria-label={`Showing ${mode.toUpperCase()}, switch format`} title="Switch format">
              {mode.toUpperCase()}
              <svg viewBox="0 0 10 14" width="8" height="11" fill="currentColor" aria-hidden="true">
                <path d="M5 0 9.5 5h-9zM5 14 .5 9h9z" />
              </svg>
            </button>
          </div>

          {recent.length > 0 && (
            <div className="cp-recent">
              <span>Recent</span>
              <div>
                {recent.map((c) => (
                  <button key={c} type="button" style={{ background: c }} aria-label={`Use ${c}`} title={c} onClick={() => setHex(c)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
