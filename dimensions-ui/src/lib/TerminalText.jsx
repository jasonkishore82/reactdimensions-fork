import { useEffect, useRef, useState } from 'react'

// A terminal session that plays itself: the prompt appears, a command is
// typed out key by key, then its output streams in (a progress bar that
// fills, lines that arrive in bursts), and the next command follows. The
// cursor is a solid block that blinks while it waits.
const SCRIPTS = {
  install: [
    { cmd: 'npm install react-dimensions' },
    { out: 'added 1 package, audited 214 packages in 2s', bar: 'fetching' },
    { out: 'found 0 vulnerabilities', tone: 'ok' },
    { cmd: 'npm run dev' },
    { out: '  VITE v5.4.11  ready in 312 ms' },
    { out: '  ➜  Local:   http://localhost:5173/', tone: 'accent' },
  ],
  git: [
    { cmd: 'git status' },
    { out: 'On branch main' },
    { out: 'Changes to be committed:' },
    { out: '  modified:   src/lib/TerminalText.jsx', tone: 'ok' },
    { cmd: 'git push' },
    { out: 'Writing objects', bar: 'objects' },
    { out: '   6606ed0..7a05c66  main -> main', tone: 'accent' },
  ],
  deploy: [
    { cmd: 'deploy --prod' },
    { out: 'Building', bar: 'build' },
    { out: '✓ 214 modules transformed', tone: 'ok' },
    { out: 'Uploading', bar: 'upload' },
    { out: '✓ Live at https://reactdimensions.site', tone: 'accent' },
  ],
}

export default function TerminalText({
  script = 'install',
  prompt = '~/site $',
  speed = 55,
  loop = true,
  accent = '#7ee787',
  style,
}) {
  const [lines, setLines] = useState([])
  const [typing, setTyping] = useState(null)
  const [idle, setIdle] = useState(true)
  const body = useRef()
  const timers = useRef([])

  useEffect(() => {
    let alive = true
    const wait = (ms) => new Promise((r) => timers.current.push(setTimeout(r, ms)))
    const steps = SCRIPTS[script] ?? SCRIPTS.install
    const run = async () => {
      while (alive) {
        setLines([])
        for (const s of steps) {
          if (!alive) return
          if (s.cmd) {
            setIdle(true)
            await wait(500)
            setIdle(false)
            for (let i = 1; i <= s.cmd.length && alive; i++) {
              setTyping(s.cmd.slice(0, i))
              await wait(speed * (0.5 + Math.random()))
            }
            await wait(220)
            setTyping(null)
            setLines((l) => [...l, { kind: 'cmd', text: s.cmd }])
            await wait(260)
          } else if (s.bar) {
            const key = Math.random()
            for (let p = 0; p <= 100 && alive; p += 4 + Math.random() * 9) {
              const filled = Math.round(Math.min(100, p) / 5)
              const bar = `${s.out.padEnd(16)} [${'#'.repeat(filled)}${'.'.repeat(20 - filled)}] ${String(Math.round(Math.min(100, p))).padStart(3)}%`
              setLines((l) => [...l.filter((x) => x.key !== key), { kind: 'out', text: bar, key }])
              await wait(60 + Math.random() * 90)
            }
            setLines((l) => [...l.filter((x) => x.key !== key), { kind: 'out', text: `${s.out.padEnd(16)} [${'#'.repeat(20)}] 100%`, key }])
          } else {
            await wait(80 + Math.random() * 260)
            setLines((l) => [...l, { kind: 'out', text: s.out, tone: s.tone }])
          }
        }
        setIdle(true)
        if (!loop) return
        await wait(3200)
      }
    }
    run()
    return () => {
      alive = false
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [script, speed, loop])

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight
  }, [lines, typing])

  const tone = (t) => (t === 'ok' ? '#9be9a8' : t === 'accent' ? accent : '#c9d1d9')
  return (
    <div style={{ width: 'min(92%, 640px)', borderRadius: 12, overflow: 'hidden', background: '#0d1117', boxShadow: '0 24px 60px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.06)', font: '13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', ...style }}>
      <style>{`@keyframes rd-term-blink { 50% { opacity: 0 } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', background: '#161b22', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: 8, color: '#8b949e', fontSize: 12 }}>zsh</span>
      </div>
      <div ref={body} role="log" aria-live="polite" style={{ height: 260, overflow: 'hidden', padding: '12px 14px', color: '#c9d1d9', whiteSpace: 'pre' }}>
        {lines.map((l, i) =>
          l.kind === 'cmd' ? (
            <div key={i}>
              <span style={{ color: accent }}>{prompt}</span> {l.text}
            </div>
          ) : (
            <div key={l.key ?? i} style={{ color: tone(l.tone) }}>
              {l.text}
            </div>
          ),
        )}
        <div>
          <span style={{ color: accent }}>{prompt}</span> {typing ?? ''}
          <span aria-hidden="true" style={{ display: 'inline-block', width: '0.6em', height: '1.15em', verticalAlign: '-0.2em', background: '#c9d1d9', animation: idle ? 'rd-term-blink 1s steps(1) infinite' : 'none' }} />
        </div>
      </div>
    </div>
  )
}
