import * as THREE from 'three'

// Every face of the book is drawn on a canvas: the cover, the endpapers and
// each page. Page and cover canvases share the book's proportions.
export const PAGE_W = 3
export const PAGE_H = 4.2
const CW = 720
const CH = Math.round((CW * PAGE_H) / PAGE_W)

const DISPLAY = "'Cinzel', 'Trajan Pro', Georgia, serif"
const SERIF = "'Cormorant Garamond', Garamond, Georgia, serif"

export const FONTS_TO_LOAD = ['700 40px Cinzel', '400 40px Cinzel', '500 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"','italic 500 40px "Cormorant Garamond"', '700 40px "Cormorant Garamond"']

// ---------- colour helpers ----------
const shade = (hex, amt) => {
  const c = new THREE.Color(hex)
  const t = amt < 0 ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 1, 1)
  return '#' + c.lerp(t, Math.abs(amt)).getHexString()
}
function foil(ctx, color, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, CW, y1)
  g.addColorStop(0, shade(color, -0.35))
  g.addColorStop(0.3, shade(color, 0.45))
  g.addColorStop(0.5, color)
  g.addColorStop(0.64, shade(color, 0.6))
  g.addColorStop(0.8, color)
  g.addColorStop(1, shade(color, -0.35))
  return g
}

// Fine random speckle, so paper and leather are not flat colour. One noise
// tile is made per tint and repeated, which is far quicker than drawing dots.
const grainTiles = {}
function grainTile(r, g, b, light) {
  const key = `${r},${g},${b},${light}`
  if (grainTiles[key]) return grainTiles[key]
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(256, 256)
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < img.data.length; i += 4) {
    const up = light && rnd() > 0.5
    img.data[i] = up ? 255 : r
    img.data[i + 1] = up ? 255 : g
    img.data[i + 2] = up ? 255 : b
    img.data[i + 3] = rnd() * rnd() * 70
  }
  ctx.putImageData(img, 0, 0)
  return (grainTiles[key] = c)
}
function grain(ctx, w, h, strength, light = false, rgb = [60, 40, 20]) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, strength * 6)
  ctx.fillStyle = ctx.createPattern(grainTile(...rgb, light), 'repeat')
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

// ---------- ornaments, pulled from the menu book ----------
// A kolam-style rosette of eight petals.
export function drawEmblem(ctx, cx, cy, r, color) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(r / 60, r / 60)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.arc(0, 0, 56, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([1.5, 3])
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.arc(0, 0, 51, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  for (let i = 0; i < 8; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI) / 4)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.bezierCurveTo(11, -22, 9, -38, 0, -46)
    ctx.bezierCurveTo(-9, -38, -11, -22, 0, -8)
    ctx.stroke()
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(0, -16)
    ctx.lineTo(0, -38)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, -49, 1.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.rotate(Math.PI / 8)
    ctx.beginPath()
    ctx.moveTo(0, -10)
    ctx.bezierCurveTo(5, -17, 4, -24, 0, -28)
    ctx.bezierCurveTo(-4, -24, -5, -17, 0, -10)
    ctx.fill()
    ctx.restore()
  }
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// A thin rule with a diamond in the middle.
export function drawFlourish(ctx, cx, cy, w, color) {
  ctx.save()
  ctx.translate(cx - w / 2, cy - (w * 7) / 200)
  ctx.scale(w / 200, w / 200)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(2, 7)
  ctx.lineTo(78, 7)
  ctx.moveTo(122, 7)
  ctx.lineTo(198, 7)
  ctx.stroke()
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(100, 1)
  ctx.lineTo(106, 7)
  ctx.lineTo(100, 13)
  ctx.lineTo(94, 7)
  ctx.closePath()
  ctx.stroke()
  for (const [x, r] of [[100, 1.6], [84, 1.4], [116, 1.4]]) {
    ctx.beginPath()
    ctx.arc(x, 7, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// The logo: the emblem, the title's initials in a ring, or an uploaded image.
function drawLogo(ctx, kind, img, title, cx, cy, r, color) {
  if (kind === 'emblem') drawEmblem(ctx, cx, cy, r, color)
  else if (kind === 'monogram') {
    const initials = title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('')
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = r * 0.05
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = r * 0.018
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.font = `700 ${r * (initials.length > 1 ? 0.78 : 1)}px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials || '·', cx, cy + r * 0.06)
    ctx.restore()
  } else if (kind === 'image' && img?.complete && img.naturalWidth) {
    const s = Math.min((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight)
    const w = img.naturalWidth * s
    const h = img.naturalHeight * s
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  }
}

// ---------- text layout ----------
function wrap(ctx, text, maxW) {
  const lines = []
  for (const para of String(text).split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line)
        line = word
      } else line = test
    }
    lines.push(line)
  }
  return lines
}

// Shrinks a font size until the text fits the width.
function fit(ctx, text, weight, family, size, maxW) {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxW) break
    s -= 2
  } while (s > 12)
  return s
}

function spaced(ctx, text, x, y, spacing) {
  // canvas letterSpacing is not everywhere yet, so space letters by hand
  const chars = [...text]
  const total = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * (chars.length - 1)
  let cx = x - total / 2
  ctx.textAlign = 'left'
  for (const c of chars) {
    ctx.fillText(c, cx, y)
    cx += ctx.measureText(c).width + spacing
  }
  ctx.textAlign = 'center'
}

// Faces are laid out in CW x CH units but drawn at 1.5 times that size: the
// serif type has hairline strokes, and at the lower size they blur into the
// paper once the page is seen at an angle. (Twice would be sharper still, but
// every page holds its own texture, and that quadruples the GPU memory.)
const RES = 1.5
function canvas() {
  const c = document.createElement('canvas')
  c.width = CW * RES
  c.height = CH * RES
  c.getContext('2d').scale(RES, RES)
  return c
}

function texture(c, anisotropy) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = anisotropy
  return t
}

// ---------- faces ----------
export function coverTexture(o, side, anisotropy) {
  const c = canvas()
  const ctx = c.getContext('2d')
  // leather: base colour, a soft light from the top left, a dark vignette
  ctx.fillStyle = o.coverColor
  ctx.fillRect(0, 0, CW, CH)
  const glow = ctx.createRadialGradient(CW * 0.3, CH * 0.2, 0, CW * 0.3, CH * 0.2, CW * 0.9)
  glow.addColorStop(0, 'rgba(255,200,170,0.14)')
  glow.addColorStop(1, 'rgba(255,200,170,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CW, CH)
  grain(ctx, CW, CH, 0.18, true, [0, 0, 0])
  const vig = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.35, CW / 2, CH / 2, CH * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, CW, CH)
  // the crease where the cover bends at the spine
  const hingeX = side === 'front' ? 0 : CW
  const hinge = ctx.createLinearGradient(hingeX, 0, side === 'front' ? 46 : CW - 46, 0)
  hinge.addColorStop(0, 'rgba(0,0,0,0.45)')
  hinge.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  hinge.addColorStop(0.75, 'rgba(0,0,0,0.3)')
  hinge.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = hinge
  ctx.fillRect(0, 0, CW, CH)

  // gold frame: a heavy rule and a fine inner one
  const gold = foil(ctx, o.foilColor, 0, CH)
  ctx.strokeStyle = gold
  ctx.lineWidth = 5
  ctx.strokeRect(46, 46, CW - 92, CH - 92)
  ctx.lineWidth = 1.6
  ctx.strokeRect(62, 62, CW - 124, CH - 124)

  ctx.fillStyle = gold
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2
  if (side === 'front') {
    const hasLogo = o.logo !== 'none'
    const logoY = CH * 0.3
    if (hasLogo) drawLogo(ctx, o.logo, o.logoImg, o.title, CW / 2, logoY, 118, gold)
    let y = hasLogo ? logoY + 210 : CH * 0.42
    ctx.font = `700 92px ${DISPLAY}`
    const titleLines = wrap(ctx, o.title.toUpperCase(), CW - 190).slice(0, 3)
    const size = Math.min(...titleLines.map((l) => fit(ctx, l, 700, DISPLAY, 92, CW - 190)))
    ctx.font = `700 ${size}px ${DISPLAY}`
    for (const l of titleLines) {
      ctx.fillText(l, CW / 2, y)
      y += size * 1.12
    }
    if (o.subtitle) {
      ctx.font = `400 ${fit(ctx, o.subtitle.toUpperCase(), 400, DISPLAY, 27, CW - 260)}px ${DISPLAY}`
      spaced(ctx, o.subtitle.toUpperCase(), CW / 2, y + 8, 7)
      y += 60
    }
    drawFlourish(ctx, CW / 2, y + 14, 300, gold)
  } else {
    if (o.logo !== 'none') drawLogo(ctx, o.logo, o.logoImg, o.title, CW / 2, CH * 0.44, 82, gold)
    ctx.font = `700 34px ${DISPLAY}`
    spaced(ctx, o.title.toUpperCase(), CW / 2, CH * 0.44 + 150, 6)
    drawFlourish(ctx, CW / 2, CH * 0.44 + 190, 220, gold)
  }
  return texture(c, anisotropy)
}

// The decorated paper glued inside the covers.
export function endpaperTexture(o, side, anisotropy) {
  const c = canvas()
  const ctx = c.getContext('2d')
  ctx.fillStyle = shade(o.coverColor, 0.18)
  ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = o.foilColor
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 1.5
  const step = 44
  for (let i = -CH; i < CW + CH; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + CH, CH)
    ctx.moveTo(i, CH)
    ctx.lineTo(i + CH, 0)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.5
  ctx.fillStyle = o.foilColor
  for (let x = 0; x <= CW + step; x += step)
    for (let y = 0; y <= CH + step; y += step) {
      ctx.beginPath()
      ctx.arc(x, y + step / 2, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  ctx.globalAlpha = 1
  grain(ctx, CW, CH, 0.08)
  // shade towards the spine
  const sx = side === 'left' ? CW : 0
  const g = ctx.createLinearGradient(sx, 0, side === 'left' ? CW - 120 : 120, 0)
  g.addColorStop(0, 'rgba(20,8,0,0.45)')
  g.addColorStop(1, 'rgba(20,8,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CW, CH)
  return texture(c, anisotropy)
}

// Splits the content into pages at lines that are just "---".
export function splitPages(content) {
  return String(content)
    .replace(/\r/g, '')
    .split(/\n\s*---\s*\n/)
    .map((p) => p.trim())
}

function paper(ctx, o, side) {
  ctx.fillStyle = o.paperColor
  ctx.fillRect(0, 0, CW, CH)
  grain(ctx, CW, CH, 0.12)
  const vig = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.45, CW / 2, CH / 2, CH * 0.72)
  vig.addColorStop(0, 'rgba(150,110,50,0)')
  vig.addColorStop(1, 'rgba(150,110,50,0.16)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, CW, CH)
  // shadow running into the gutter
  const right = side === 'right' // the spine is on the left of a right-hand page
  const g = ctx.createLinearGradient(right ? 0 : CW, 0, right ? CW * 0.16 : CW * 0.84, 0)
  g.addColorStop(0, 'rgba(40,20,5,0.32)')
  g.addColorStop(0.3, 'rgba(40,20,5,0.1)')
  g.addColorStop(1, 'rgba(40,20,5,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CW, CH)
}

// The first page: logo, title and subtitle.
export function titlePageTexture(o, anisotropy) {
  const c = canvas()
  const ctx = c.getContext('2d')
  paper(ctx, o, 'right')
  ctx.fillStyle = o.inkColor
  ctx.textAlign = 'center'
  const hasLogo = o.logo !== 'none'
  if (hasLogo) drawLogo(ctx, o.logo, o.logoImg, o.title, CW / 2, CH * 0.3, 92, o.accentColor)
  let y = hasLogo ? CH * 0.3 + 175 : CH * 0.4
  const size = fit(ctx, o.title, 700, DISPLAY, 70, CW - 160)
  ctx.font = `700 ${size}px ${DISPLAY}`
  ctx.fillText(o.title, CW / 2, y)
  if (o.subtitle) {
    ctx.font = `italic 500 34px ${SERIF}`
    ctx.fillStyle = o.accentColor
    ctx.fillText(o.subtitle, CW / 2, y + 52)
    y += 52
  }
  drawFlourish(ctx, CW / 2, y + 44, 240, o.accentColor)
  return texture(c, anisotropy)
}

// A price written with any currency sign ($12.99, ₹280, €9) is shown in the
// book's chosen currency. Plain numbers, like page numbers on a contents
// page, are left alone. Letter codes (AED, CHF) get a space before the amount.
const PRICE = /^(?:[$€£¥₹¤]|[A-Z]{1,3}\$?)\s?(\d[\d.,]*)$/
function withCurrency(value, currency) {
  const m = currency ? value.match(PRICE) : null
  if (!m) return value
  return /[A-Za-z]$/.test(currency) ? `${currency} ${m[1]}` : `${currency}${m[1]}`
}

// A content page. A line starting with "# " is a heading; "Name | Price" sets
// the two parts apart with a dotted leader, like a menu or a contents list.
export function contentPageTexture(o, text, number, side, anisotropy) {
  const c = canvas()
  const ctx = c.getContext('2d')
  paper(ctx, o, side)
  const left = side === 'right' ? 92 : 70
  const right = CW - (side === 'right' ? 70 : 92)
  const width = right - left

  // running head and folio
  ctx.fillStyle = o.inkColor
  ctx.globalAlpha = 0.8
  ctx.font = `700 19px ${DISPLAY}`
  ctx.textAlign = 'center'
  spaced(ctx, (o.subtitle ? `${o.title} · ${o.subtitle}` : o.title).toUpperCase(), (left + right) / 2, 64, 3)
  ctx.globalAlpha = 0.75
  ctx.font = `500 24px ${SERIF}`
  ctx.fillText(String(number), (left + right) / 2, CH - 46)
  ctx.globalAlpha = 1

  let y = 128
  const bottom = CH - 96
  ctx.textBaseline = 'alphabetic'
  for (const raw of String(text || '').split('\n')) {
    if (y > bottom) break
    const line = raw.trimEnd()
    if (!line.trim()) {
      y += 18
      continue
    }
    if (line.startsWith('# ')) {
      const head = line.slice(2)
      if (y > 140) y += 18
      ctx.fillStyle = o.accentColor
      ctx.textAlign = 'center'
      const s = fit(ctx, head, 700, SERIF, 52, width)
      ctx.font = `700 ${s}px ${SERIF}`
      ctx.fillText(head, (left + right) / 2, y + 30)
      drawFlourish(ctx, (left + right) / 2, y + 58, 180, o.accentColor)
      y += 92
      continue
    }
    if (line.startsWith('> ')) {
      // a note, in italics under a heading
      ctx.fillStyle = o.inkColor
      ctx.globalAlpha = 0.85
      ctx.textAlign = 'center'
      ctx.font = `italic 500 28px ${SERIF}`
      for (const l of wrap(ctx, line.slice(2), width)) {
        ctx.fillText(l, (left + right) / 2, y + 4)
        y += 33
      }
      ctx.globalAlpha = 1
      y += 8
      continue
    }
    const bar = line.indexOf('|')
    ctx.fillStyle = o.inkColor
    ctx.font = `700 31px ${SERIF}`
    if (bar > -1) {
      const name = line.slice(0, bar).trim()
      const value = withCurrency(line.slice(bar + 1).trim(), o.currency)
      ctx.textAlign = 'left'
      const vw = ctx.measureText(value).width
      let shown = name
      while (ctx.measureText(shown).width > width - vw - 40 && shown.length > 1) shown = shown.slice(0, -1)
      if (shown !== name) shown = shown.trimEnd() + '…'
      ctx.fillText(shown, left, y + 24)
      ctx.textAlign = 'right'
      ctx.fillText(value, right, y + 24)
      // dotted leader between the two
      const from = left + ctx.measureText(shown).width + 12
      const to = right - vw - 12
      ctx.globalAlpha = 0.5
      for (let x = from; x < to; x += 10) ctx.fillRect(x, y + 21, 2.5, 2.5)
      ctx.globalAlpha = 1
      y += 43
      continue
    }
    ctx.textAlign = 'left'
    for (const l of wrap(ctx, line, width)) {
      if (y > bottom) break
      ctx.fillText(l, left, y + 24)
      y += 41
    }
  }
  return texture(c, anisotropy)
}

// Page edges: fine horizontal lines, like the stacked sheets of a real book.
export function edgeTexture(paperColor) {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = shade(paperColor, -0.04)
  ctx.fillRect(0, 0, 16, 256)
  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = `rgba(90,60,30,${0.08 + ((y * 7919) % 13) / 100})`
    ctx.fillRect(0, y, 16, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
