import { useRef, useState } from 'react'

// Colour swatches for a product, with a selection ring that slides to the
// chosen one and a label naming it. Arrow keys move the selection.
// `options` is "Name:#hex, Name:#hex, ..." or an array of { name, color }.
export default function SwatchPicker({
  options = 'Ember:#ff4d1a, Cobalt:#1a7bff, Moss:#4f7a3a, Bone:#e9e4d8, Graphite:#2b2d31',
  value,
  defaultIndex = 0,
  onChange,
  size = 28,
  gap = 12,
  shape = 'circle',
  showLabel = true,
  label = 'Colour',
  style,
}) {
  const list = Array.isArray(options)
    ? options
    : options
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [name, color] = s.includes(':') ? s.split(':').map((x) => x.trim()) : [s, s]
          return { name, color }
        })

  const [own, setOwn] = useState(defaultIndex)
  const found = value != null ? list.findIndex((o) => o.name === value || o.color === value) : -1
  const index = Math.min(found >= 0 ? found : own, Math.max(list.length - 1, 0))
  const buttons = useRef([])

  const pick = (i) => {
    setOwn(i)
    onChange?.(list[i], i)
  }

  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    let next = step != null ? (index + step + list.length) % list.length : null
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = list.length - 1
    if (next == null) return
    e.preventDefault()
    pick(next)
    buttons.current[next]?.focus()
  }

  const radius = shape === 'circle' ? '50%' : `${Math.round(size * 0.22)}px`
  const pad = 4 // gap between swatch and ring

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10, color: 'inherit', ...style }}>
      {showLabel && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', font: '500 13px/1 system-ui, sans-serif' }}>
          <span style={{ opacity: 0.6 }}>{label}</span>
          <span aria-live="polite">{list[index]?.name}</span>
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        style={{ position: 'relative', display: 'flex', gap, padding: pad + 2 }}
      >
        {list.length > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 2,
              top: 2,
              width: size + pad * 2,
              height: size + pad * 2,
              borderRadius: shape === 'circle' ? '50%' : `${Math.round(size * 0.22) + pad}px`,
              border: '1.5px solid currentColor',
              transform: `translateX(${index * (size + gap)}px)`,
              transition: 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              pointerEvents: 'none',
            }}
          />
        )}
        {list.map((o, i) => (
          <button
            key={`${o.name}-${i}`}
            ref={(el) => (buttons.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={i === index}
            aria-label={o.name}
            title={o.name}
            tabIndex={i === index ? 0 : -1}
            onClick={() => pick(i)}
            style={{
              width: size,
              height: size,
              padding: 0,
              border: 0,
              borderRadius: radius,
              background: o.color,
              boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.35), inset 0 -6px 10px rgba(0,0,0,0.18)',
              cursor: 'pointer',
              transform: i === index ? 'scale(1)' : 'scale(0.9)',
              transition: 'transform 200ms ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
