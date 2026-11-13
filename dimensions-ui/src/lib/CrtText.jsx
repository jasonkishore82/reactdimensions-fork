import { useEffect, useId, useMemo, useRef, useState } from 'react'

// Text on an old CRT monitor: phosphor glow, horizontal scanlines, a faint
// rolling refresh bar, a little flicker, and the bulge of the curved glass.
// The bulge is a real barrel distortion: a displacement map pushes each
// pixel outward from the centre by more the further it is from the middle,
// the same r(1 + k r^2) curve a lens uses.
function barrelMap(size = 256, k = 0.18) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const img = g.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1
      const ny = (y / (size - 1)) * 2 - 1
      const r2 = nx * nx + ny * ny
      // where this pixel should sample from, as an offset in [-1, 1]
      const dx = -nx * k * r2
      const dy = -ny * k * r2
      const i = (y * size + x) * 4
      img.data[i] = Math.round(128 + dx * 127)
      img.data[i + 1] = Math.round(128 + dy * 127)
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return c.toDataURL()
}

export default function CrtText({
  text = 'SYSTEM READY|> LOADING DIMENSIONS..._',
  color = '#62ff9b',
  curve = 0.18,
  flicker = 0.5,
  style,
}) {
  const id = useId().replace(/:/g, '')
  const map = useMemo(() => barrelMap(256, curve), [curve])
  const screen = useRef()
  const [size, setSize] = useState([800, 450])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize([e.contentRect.width, e.contentRect.height]))
    ro.observe(screen.current)
    return () => ro.disconnect()
  }, [])

  const lines = String(text).split('|')
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#1a1917', ...style }}>
      <style>{`
        @keyframes rd-crt-roll { from { transform: translateY(-30%) } to { transform: translateY(130%) } }
        @keyframes rd-crt-flick { 0%,100% { opacity: 1 } 48% { opacity: ${1 - 0.06 * flicker} } 50% { opacity: ${1 - 0.14 * flicker} } 52% { opacity: 1 } }
        @keyframes rd-crt-caret { 50% { opacity: 0 } }
      `}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id={`barrel-${id}`} x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feImage href={map} x="0" y="0" width={size[0]} height={size[1]} preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={Math.min(size[0], size[1]) * 0.9} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {/* the bezel */}
      <div style={{ width: 'min(90%, 760px)', aspectRatio: '4 / 3', maxHeight: '88%', padding: '3.2%', borderRadius: '6%', background: 'linear-gradient(160deg, #3a3833, #24231f)', boxShadow: '0 20px 50px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.08)' }}>
        <div
          ref={screen}
          role="img"
          aria-label={lines.join(' ')}
          style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '9% / 11%', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 45%, #10241a, #050a07 75%)', boxShadow: 'inset 0 0 40px rgba(0,0,0,.9)' }}
        >
          <div style={{ position: 'absolute', inset: 0, filter: `url(#barrel-${id})`, animation: `rd-crt-flick ${3.7 / Math.max(0.1, flicker)}s infinite` }}>
            <div
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 9%', color, font: '700 clamp(16px, 4.2vw, 40px)/1.4 ui-monospace, "Courier New", monospace', letterSpacing: '0.04em', textShadow: `0 0 2px ${color}, 0 0 8px ${color}aa, 0 0 22px ${color}55` }}
            >
              {lines.map((l, i) => (
                <div key={i}>
                  {l.endsWith('_') ? (
                    <>
                      {l.slice(0, -1)}
                      <span style={{ animation: 'rd-crt-caret 1s steps(1) infinite' }}>_</span>
                    </>
                  ) : (
                    l
                  )}
                </div>
              ))}
            </div>
            {/* scanlines */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(rgba(0,0,0,.42) 0 1px, transparent 1px 3px)' }} />
          </div>
          {/* the slow refresh bar rolling down */}
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '35%', background: `linear-gradient(transparent, ${color}10, transparent)`, animation: 'rd-crt-roll 6s linear infinite' }} />
          {/* glass reflection and vignette */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.07), transparent 40%), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,.55))' }} />
        </div>
      </div>
    </div>
  )
}
