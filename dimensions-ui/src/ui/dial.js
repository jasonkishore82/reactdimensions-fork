import { useRef } from 'react'

// Shared behaviour for knobs, dials and faders: drag to change (up/right
// increases), arrow keys / Page keys / Home / End, and the ARIA slider
// attributes. Spread the returned props on the control element.
//
//   const props = useDial({ value, onChange, min: 0, max: 100, label: 'Volume' })
//   <div {...props} />
//
// `axis` is 'y' for knobs (drag up/down) or 'x' for horizontal faders, where
// `track` (a ref to the track element) maps the pointer position directly.
export function useDial({ value, onChange, min = 0, max = 100, step = 1, label, valueText, axis = 'y', track, sensitivity = 0.6, disabled = false }) {
  const start = useRef(null)
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step))

  const fromTrack = (e) => {
    const r = track.current.getBoundingClientRect()
    const f = axis === 'x' ? (e.clientX - r.left) / r.width : (r.bottom - e.clientY) / r.height
    onChange(clamp(min + f * (max - min)))
  }

  return {
    role: 'slider',
    tabIndex: disabled ? -1 : 0,
    'aria-label': label,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': value,
    'aria-valuetext': valueText,
    'aria-disabled': disabled || undefined,
    onPointerDown: (e) => {
      if (disabled) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus({ preventScroll: true })
      if (track) fromTrack(e)
      else start.current = { x: e.clientX, y: e.clientY, v: value }
    },
    onPointerMove: (e) => {
      if (disabled || !e.buttons) return
      if (track) return fromTrack(e)
      if (!start.current) return
      const d = (start.current.y - e.clientY + (e.clientX - start.current.x)) * sensitivity * ((max - min) / 100)
      onChange(clamp(start.current.v + d))
    },
    onPointerUp: () => { start.current = null },
    onKeyDown: (e) => {
      if (disabled) return
      const big = (max - min) / 10
      const next = { ArrowUp: value + step, ArrowRight: value + step, ArrowDown: value - step, ArrowLeft: value - step, PageUp: value + big, PageDown: value - big, Home: min, End: max }[e.key]
      if (next === undefined) return
      e.preventDefault()
      onChange(clamp(next))
    },
    style: { touchAction: 'none', cursor: disabled ? 'default' : axis === 'x' ? 'ew-resize' : 'ns-resize' },
  }
}
