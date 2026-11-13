import { useEffect, useRef, useState } from 'react'

// A thermal receipt printer. The paper feeds up out of the slot a line at a
// time; each line darkens in place as the heated print head passes over it
// (thermal paper has no ink: the heat turns the coating black). Fresh paper
// keeps the curl of its roll, so the free end leans back. When it's done the
// paper is torn off against the serrated edge and drops away. Lines are
// separated with "|"; a line "Name $1.00" is spread to both edges.
let actx
function whirr(ms) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
    const len = Math.floor((actx.sampleRate * ms) / 1000)
    const buf = actx.createBuffer(1, len, actx.sampleRate)
    const d = buf.getChannelData(0)
    // stepper motor: a buzz of little pulses
    for (let i = 0; i < len; i++) d[i] = (i % 90 < 6 ? 1 : 0) * (Math.random() * 0.6 + 0.4) * (1 - i / len) * 0.5
    const src = actx.createBufferSource()
    src.buffer = buf
    const g = actx.createGain()
    g.gain.value = 0.06
    src.connect(g).connect(actx.destination)
    src.start()
  } catch {
    // no audio available
  }
}

const DEFAULT = 'REACT DIMENSIONS|12 Motion Lane|--------------------------------|Flip-dot sign $24.00|Nixie tubes x6 $68.50|Rubber stamp $9.90|Spring (extra) $1.20|--------------------------------|TOTAL $103.60|CARD **** 4417|================================|Thank you, come again'

export default function ReceiptPrinter({
  text = DEFAULT,
  speed = 140,
  paper = '#fbfaf6',
  sound = false,
  style,
}) {
  const lines = String(text).split('|')
  const [shown, setShown] = useState(0) // lines printed so far
  const [torn, setTorn] = useState(false)
  const slip = useRef()

  useEffect(() => {
    setShown(0)
    setTorn(false)
    let i = 0
    let alive = true
    const timers = []
    const next = () => {
      if (!alive) return
      if (i < lines.length) {
        i++
        setShown(i)
        if (sound) whirr(speed * 0.8)
        timers.push(setTimeout(next, speed))
      } else {
        // feed a little blank paper past the cutter, then tear
        timers.push(
          setTimeout(() => {
            if (!alive) return
            setTorn(true)
          }, 1400),
        )
      }
    }
    timers.push(setTimeout(next, 500))
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [text, speed, sound])

  const row = (l, i) => {
    const m = /^(.*\S)\s+(\S*\d\S*)$/.exec(l)
    const fresh = i === shown - 1
    const content = /^[-=]+$/.test(l) ? (
      <span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap' }}>{l}</span>
    ) : m && !/^[A-Z ]+$/.test(l) ? (
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{m[1]}</span>
        <span>{m[2]}</span>
      </span>
    ) : (
      <span style={{ display: 'block', textAlign: 'center', fontWeight: i === 0 ? 800 : 500 }}>{l}</span>
    )
    return (
      <div key={i} style={{ height: '1.5em', lineHeight: '1.5em', animation: fresh ? `rd-rp-burn ${speed}ms linear both` : undefined }}>
        {content}
      </div>
    )
  }

  const zig = 'polygon(0 0, 100% 0, 100% calc(100% - 6px), ' + Array.from({ length: 25 }, (_, k) => `${100 - (k + 0.5) * 4}% ${k % 2 ? 'calc(100% - 6px)' : '100%'}`).join(', ') + ', 0 calc(100% - 6px))'

  return (
    <div role="img" aria-label={lines.join('. ')} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(#e7e3dc, #d3cdc2)', ...style }}>
      <style>{'@keyframes rd-rp-burn { from { color: transparent; text-shadow: none } 50% { color: rgba(30,30,32,.35) } to { color: #1e1e20 } }'}</style>
      {/* the paper: it hangs from the slot and grows downward as it feeds */}
      <div
        ref={slip}
        style={{
          position: 'absolute',
          left: '50%',
          top: 'calc(14% + 28px)',
          width: 'min(330px, 78%)',
          transform: torn ? 'translate(-50%, 140%) rotate(8deg)' : 'translateX(-50%)',
          transition: torn ? 'transform 900ms cubic-bezier(.5,0,.8,.4)' : 'none',
          transformOrigin: '50% 0',
          perspective: 600,
        }}
      >
        <div
          style={{
            background: `linear-gradient(${paper}, ${paper} 70%, color-mix(in srgb, ${paper} 90%, #8a8070))`,
            padding: '10px 16px 22px',
            font: "500 12px/1 'Courier New', ui-monospace, Menlo, monospace",
            color: '#1e1e20',
            clipPath: zig,
            // the roll's curl: the free end leans back away from you
            transform: `rotateX(${Math.min(22, shown * 1.6)}deg)`,
            transformOrigin: '50% 0',
            boxShadow: '0 6px 14px rgba(0,0,0,.15)',
            transition: 'transform 300ms',
            minHeight: 24,
          }}
        >
          {lines.slice(0, shown).map(row)}
          <div style={{ height: torn ? 0 : '1.5em' }} />
        </div>
      </div>
      {/* the printer */}
      <div style={{ position: 'absolute', left: '50%', top: '4%', width: 'min(400px, 92%)', height: 'calc(10% + 30px)', transform: 'translateX(-50%)', borderRadius: '14px 14px 6px 6px', background: 'linear-gradient(#45484e, #24262a)', boxShadow: '0 8px 18px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.15)' }}>
        <div style={{ position: 'absolute', right: 18, top: 12, width: 8, height: 8, borderRadius: '50%', background: shown && !torn ? '#5cff7a' : '#2f6b3a', boxShadow: shown && !torn ? '0 0 8px #5cff7a' : 'none' }} />
        {/* the slot with its serrated tear bar */}
        <div style={{ position: 'absolute', left: '8%', right: '8%', bottom: 4, height: 10, borderRadius: 3, background: '#0e0f11' }} />
        <div style={{ position: 'absolute', left: '7%', right: '7%', bottom: -2, height: 6, background: 'repeating-linear-gradient(90deg, #9da2a8 0 4px, #6f7379 4px 8px)', clipPath: 'polygon(0 0, 100% 0, 100% 40%, ' + Array.from({ length: 60 }, (_, k) => `${100 - (k + 0.5) * (100 / 60)}% ${k % 2 ? '40%' : '100%'}`).join(', ') + ', 0 40%)' }} />
      </div>
    </div>
  )
}
