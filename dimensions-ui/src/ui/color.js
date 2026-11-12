// Colour helpers for readable text on any user-picked colour (WCAG contrast).

const rgb = (hex) => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

const luminance = (c) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrast = (a, b) => {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// A shade of `fg` that reads at 4.5:1 or better on `bg`: darkened on light
// backgrounds, lightened on dark ones. Returns an rgb() string.
export function readableOn(fg, bg, target = 4.6) {
  const back = rgb(bg)
  const toward = luminance(back) > 0.35 ? [0, 0, 0] : [255, 255, 255]
  let c = rgb(fg)
  const ratio = () => {
    const [x, y] = [luminance(c), luminance(back)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  for (let i = 0; i < 24 && ratio() < target; i++) c = c.map((v, k) => Math.round(v + (toward[k] - v) * 0.12))
  return `rgb(${c.join(', ')})`
}

// Black or white, whichever reads better on `bg` (for text on a filled accent).
export const textOn = (bg) => (contrast('#000000', bg) >= contrast('#ffffff', bg) ? '#111111' : '#ffffff')
