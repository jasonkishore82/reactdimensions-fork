import * as THREE from 'three'

// Canvas textures for the lorry: number plate, corrugated trailer sides with a
// company banner, the plain rear doors, cotton cartons and the yard floor.

function canvasTexture(w, h, draw) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function plateTexture(text, { bg = '#ffffff', fg = '#111111' } = {}) {
  return canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#222'
    g.fillRect(0, 0, w, h)
    g.fillStyle = bg
    g.beginPath()
    g.roundRect(10, 10, w - 20, h - 20, 22)
    g.fill()
    g.strokeStyle = fg
    g.lineWidth = 6
    g.beginPath()
    g.roundRect(24, 24, w - 48, h - 48, 14)
    g.stroke()
    g.fillStyle = fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = 150
    g.font = `800 ${size}px "Arial Black", Arial, sans-serif`
    while (g.measureText(text).width > w - 110 && size > 40) {
      size -= 6
      g.font = `800 ${size}px "Arial Black", Arial, sans-serif`
    }
    g.fillText(text, w / 2, h / 2 + 6)
  })
}

export function corrugatedTexture({ base = '#e9e9e4', banner, bannerBg, w = 2048, h = 512, ribs = 120 }) {
  // ribs are a little darker than the panel, whatever colour it is
  const rib = '#' + new THREE.Color(base).multiplyScalar(0.88).getHexString()
  return canvasTexture(w, h, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < ribs; i++) {
      g.fillStyle = rib
      g.fillRect((i * w) / ribs, 0, w / ribs / 2, h)
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.fillRect((i * w) / ribs + w / ribs / 2, 0, 2, h)
    }
    // soft road grime towards the bottom
    const gr = g.createLinearGradient(0, 0, 0, h)
    gr.addColorStop(0, 'rgba(0,0,0,0)')
    gr.addColorStop(1, 'rgba(60,50,40,0.28)')
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
    if (banner) {
      g.fillStyle = bannerBg || '#c8392b'
      g.fillRect(w * 0.12, h * 0.3, w * 0.76, h * 0.34)
      g.fillStyle = '#ffffff'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      let size = h * 0.2
      g.font = `bold ${size}px Arial, sans-serif`
      while (g.measureText(banner).width > w * 0.7 && size > 20) {
        size -= 4
        g.font = `bold ${size}px Arial, sans-serif`
      }
      g.fillText(banner, w / 2, h * 0.47)
    }
    // red and white conspicuity tape along the bottom
    for (let x = 0; x < w; x += 40) {
      g.fillStyle = (x / 40) % 2 ? '#d11a1a' : '#f4f4f4'
      g.fillRect(x, h - 38, 40, 14)
    }
  })
}

export function cartonTexture() {
  return canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#b98b5a'
    g.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 6) {
      g.fillStyle = x % 12 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.05)'
      g.fillRect(x, 0, 3, h)
    }
    g.fillStyle = 'rgba(70,45,20,0.55)'
    g.fillRect(0, h * 0.46, w, 3)
    g.fillStyle = 'rgba(214,190,130,0.9)'
    g.fillRect(w * 0.44, 0, w * 0.12, h)
    g.fillStyle = '#f4efe4'
    g.fillRect(w * 0.08, h * 0.12, w * 0.32, h * 0.3)
    g.fillStyle = '#1b1b1b'
    g.font = 'bold 26px Arial'
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('COTTON', w * 0.1, h * 0.2)
    g.fillText('FIBRE', w * 0.1, h * 0.31)
    g.font = '15px Arial'
    g.fillText('TEXTILE GRADE', w * 0.1, h * 0.39)
    g.strokeStyle = '#2b2b2b'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(w * 0.76, h * 0.78)
    g.lineTo(w * 0.76, h * 0.55)
    g.moveTo(w * 0.7, h * 0.62)
    g.lineTo(w * 0.76, h * 0.54)
    g.lineTo(w * 0.82, h * 0.62)
    g.stroke()
    g.font = 'bold 14px Arial'
    g.textAlign = 'center'
    g.fillStyle = '#2b2b2b'
    g.fillText('KEEP DRY', w * 0.76, h * 0.88)
  })
}

// Concrete yard slabs, one 4 m slab per tile, with a faint joint between them.
export function yardTexture() {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c7c2'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i++) {
      const v = 180 + Math.random() * 40
      g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.25)`
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
    g.fillStyle = 'rgba(70,70,70,0.35)'
    g.fillRect(0, 0, w, 2)
    g.fillRect(0, 0, 2, h)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
