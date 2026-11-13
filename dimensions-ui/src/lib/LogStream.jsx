import { useEffect, useRef, useState } from 'react'

// A live log: timestamped lines arrive at irregular intervals (in bursts,
// like real traffic), coloured by level, and the view keeps itself pinned to
// the newest line. Scroll up to read back and it stops following; a "jump to
// latest" pill brings you back down.
const MESSAGES = [
  ['info', 'GET /library/mug 200 in 38ms'],
  ['info', 'GET /previews/mug.jpg 200 in 4ms (cache)'],
  ['debug', 'spring settled after 0.42s (k=170 c=16)'],
  ['info', 'POST /api/favourites 201 in 61ms'],
  ['warn', 'slow frame: 41ms in useFrame (shadow pass)'],
  ['info', 'websocket: client connected (4 open)'],
  ['debug', 'physics: 12 contacts, 8 iterations, residual 0.003'],
  ['error', 'GET /library/teleporter 404 in 2ms'],
  ['info', 'build: 214 modules transformed in 1.9s'],
  ['warn', 'texture 4096x4096 exceeds budget, downscaling'],
  ['info', 'GET /library/neon-text 200 in 29ms'],
  ['debug', 'cache hit ratio 0.93 over 1m'],
]
const LEVELS = { info: '#58a6ff', debug: '#8b949e', warn: '#e3b341', error: '#f85149' }

const stamp = (d) => d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0')

export default function LogStream({ rate = 2.5, maxLines = 200, style }) {
  const [lines, setLines] = useState([])
  const [follow, setFollow] = useState(true)
  const box = useRef()
  const n = useRef(0)

  useEffect(() => {
    let id = 0
    const next = () => {
      // bursts: usually one line, sometimes a quick run of several
      const burst = Math.random() < 0.25 ? 2 + Math.floor(Math.random() * 4) : 1
      const add = []
      for (let i = 0; i < burst; i++) {
        const [lvl, msg] = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
        add.push({ id: n.current++, t: new Date(), lvl, msg })
      }
      setLines((l) => [...l, ...add].slice(-maxLines))
      // exponential gaps between arrivals, like a Poisson process
      id = setTimeout(next, (-Math.log(Math.random() || 1e-6) / rate) * 1000)
    }
    next()
    return () => clearTimeout(id)
  }, [rate, maxLines])

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [lines, follow])

  const onScroll = () => {
    const el = box.current
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
  }

  return (
    <div style={{ position: 'relative', width: 'min(94%, 720px)', borderRadius: 12, overflow: 'hidden', background: '#0d1117', boxShadow: '0 24px 60px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.06)', ...style }}>
      <style>{`@keyframes rd-log-in { from { background: rgba(88,166,255,.14) } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: '#161b22', borderBottom: '1px solid rgba(255,255,255,.06)', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', color: '#8b949e' }}>
        <span>LOGS · production</span>
        <span style={{ color: follow ? '#7ee787' : '#e3b341' }}>● {follow ? 'LIVE' : 'PAUSED'}</span>
      </div>
      <div ref={box} onScroll={onScroll} role="log" aria-live="off" style={{ height: 270, overflowY: 'auto', padding: '8px 0', font: '12.5px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', scrollbarWidth: 'thin', scrollbarColor: '#30363d transparent' }}>
        {lines.map((l) => (
          <div key={l.id} style={{ display: 'flex', gap: 12, padding: '0 14px', whiteSpace: 'nowrap', animation: 'rd-log-in .8s ease-out' }}>
            <span style={{ color: '#6e7681' }}>{stamp(l.t)}</span>
            <span style={{ width: 44, color: LEVELS[l.lvl], fontWeight: 700 }}>{l.lvl.toUpperCase()}</span>
            <span style={{ color: l.lvl === 'error' ? '#ffa198' : '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.msg}</span>
          </div>
        ))}
      </div>
      {!follow && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', padding: '7px 12px', borderRadius: 999, border: 0, background: '#58a6ff', color: '#0d1117', font: '600 11px/1 ui-monospace, Menlo, monospace', cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,.4)' }}
        >
          ↓ Jump to latest
        </button>
      )}
    </div>
  )
}
