import { createElement, useEffect, useId, useState } from 'react'

// Liquid glass lens: bends whatever is behind an element, like thick glass.
//
// How it works: we draw a displacement map for the element's rounded shape
// (red/green pixels say how far to shift the backdrop near each edge), then
// use it in an SVG feDisplacementMap applied with `backdrop-filter: url(#id)`.
// Only Chromium browsers apply SVG filters to the backdrop, so everywhere
// else the element falls back to a plain frosted blur.

const canRefract = () => typeof navigator !== 'undefined' && !!navigator.userAgentData

// Displacement map for a rounded rectangle (a circle when radius >= half the
// size). `depth` is how far in from the edge the bending reaches. With
// `magnify`, the whole shape zooms in instead, like a magnifying glass.
export function lensMap(w, h, radius, depth, magnify = false) {
  const W = Math.max(2, Math.round(w))
  const H = Math.max(2, Math.round(h))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const hw = W / 2, hh = H / 2
  const r = Math.min(radius, hw, hh)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - hw, py = y + 0.5 - hh
      const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r)
      const inside = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r)
      let dx = 0, dy = 0
      if (magnify) {
        if (inside > 0) { dx = -px / hw; dy = -py / hh } // sample nearer the centre
      } else if (inside < depth) {
        let nx, ny
        if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = qx / l; ny = qy / l } else if (qx > qy) { nx = 1; ny = 0 } else { nx = 0; ny = 1 }
        nx *= Math.sign(px) || 1
        ny *= Math.sign(py) || 1
        const t = 1 - Math.max(0, inside) / depth
        const s = t * t
        dx = -nx * s // sample from further in, so the edge magnifies
        dy = -ny * s
      }
      const i = (y * W + x) * 4
      img.data[i] = 128 + dx * 127
      img.data[i + 1] = 128 + dy * 127
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

// Hook: give it a ref to the glass element. Returns the <svg> filter to
// render anywhere in the component, plus the backdrop style for the element.
export function useLens(ref, { radius = 24, depth = 18, strength = 60, soften = 0.6, fallbackBlur = 14, tint = 160, zoom = 0 } = {}) {
  const id = `lens${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [refract] = useState(canRefract)
  const [size, setSize] = useState(null)
  const [map, setMap] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight)
      setSize((s) => (s && s[0] === w && s[1] === h ? s : [w, h]))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  useEffect(() => {
    if (refract && size && size[0] > 1 && size[1] > 1) setMap(lensMap(size[0], size[1], radius, depth, zoom > 1))
  }, [refract, size, radius, depth, zoom])

  const on = refract && map && size
  // for a magnifier, the scale that gives the requested zoom at the rim
  const scale = zoom > 1 && size ? Math.min(size[0], size[1]) * (1 - 1 / zoom) : strength
  const filter = on
    ? createElement(
        'svg',
        { width: 0, height: 0, style: { position: 'absolute' }, 'aria-hidden': true },
        createElement(
          'filter',
          { id, x: 0, y: 0, width: size[0], height: size[1], filterUnits: 'userSpaceOnUse', colorInterpolationFilters: 'sRGB' },
          createElement('feImage', { href: map, x: 0, y: 0, width: size[0], height: size[1], preserveAspectRatio: 'none', result: 'map' }),
          createElement('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' }),
          createElement('feGaussianBlur', { in: 'bent', stdDeviation: soften }),
        ),
      )
    : null
  const backdrop = on ? `url(#${id}) saturate(${tint}%)` : `blur(${fallbackBlur}px) saturate(${tint}%)`
  return { filter, style: { backdropFilter: backdrop, WebkitBackdropFilter: backdrop }, refracting: !!on }
}

// Moves a specular highlight to follow the pointer: spread the returned
// handlers on the glass element and use var(--gx) / var(--gy) in its CSS.
export function specular(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`)
  e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`)
}
