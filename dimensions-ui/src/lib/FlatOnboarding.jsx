import { useEffect, useState } from 'react'

// Flat UI onboarding: each step is two flat colours (a background and one
// accent) with a large flat illustration, a wide pill button, progress dots
// where the current step stretches into a pill, and a skip link.

const STEPS = [
  { title: 'Build habits that stick', text: 'Pick a few small goals and check them off every day.', bg: '#ffe4d6', accent: '#c2410c', art: 'calendar' },
  { title: 'Watch your progress grow', text: 'Simple charts show your streaks week by week.', bg: '#d8f3e6', accent: '#0b7a4c', art: 'chart' },
  { title: 'Never miss a day', text: 'Gentle reminders arrive right when you need them.', bg: '#e1e5ff', accent: '#3442d4', art: 'bell' },
]

function Art({ kind, accent, bg }) {
  const dark = `color-mix(in srgb, ${accent}, black 25%)`
  const light = `color-mix(in srgb, ${accent} 30%, ${bg})`
  if (kind === 'calendar') {
    return (
      <svg viewBox="0 0 200 160" aria-hidden="true">
        <circle cx="100" cy="84" r="70" fill={light} />
        <rect x="45" y="38" width="110" height="96" rx="10" fill="#fff" />
        <rect x="45" y="38" width="110" height="26" rx="10" fill={accent} />
        <rect x="45" y="54" width="110" height="10" fill={accent} />
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((c) => {
            const done = r * 4 + c < 6
            return <circle key={`${r}${c}`} cx={64 + c * 24} cy={82 + r * 20} r="7" fill={done ? accent : light} />
          }),
        )}
        <rect x="68" y="30" width="8" height="18" rx="4" fill={dark} />
        <rect x="124" y="30" width="8" height="18" rx="4" fill={dark} />
      </svg>
    )
  }
  if (kind === 'chart') {
    return (
      <svg viewBox="0 0 200 160" aria-hidden="true">
        <circle cx="100" cy="84" r="70" fill={light} />
        <rect x="40" y="132" width="120" height="6" rx="3" fill={dark} />
        {[30, 48, 40, 66, 84].map((h, i) => (
          <rect key={i} x={50 + i * 22} y={132 - h} width="14" height={h} rx="3" fill={i === 4 ? accent : '#fff'} />
        ))}
        <circle cx="149" cy="36" r="14" fill={accent} />
        <path d="M143 36l4 4 8-9" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true">
      <circle cx="100" cy="84" r="70" fill={light} />
      <path d="M100 34c-22 0-36 16-36 38v26l-10 14h92l-10-14V72c0-22-14-38-36-38z" fill={accent} />
      <circle cx="100" cy="122" r="11" fill={dark} />
      <rect x="94" y="24" width="12" height="14" rx="6" fill={dark} />
      <circle cx="140" cy="46" r="12" fill="#fff" />
      <text x="140" y="51" textAnchor="middle" fontSize="14" fontWeight="800" fill={accent} fontFamily="system-ui, sans-serif">3</text>
    </svg>
  )
}

export default function FlatOnboarding({ autoplay = false, interval = 3, buttonShape = 'pill', style }) {
  const [step, setStep] = useState(0)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  useEffect(() => {
    if (!autoplay) return
    const id = setInterval(() => setStep((i) => (i + 1) % STEPS.length), interval * 1000)
    return () => clearInterval(id)
  }, [autoplay, interval])

  return (
    <div className="fo" style={{ '--bg': s.bg, '--accent': s.accent, '--btn-r': buttonShape === 'pill' ? '999px' : '8px', ...style }}>
      <style>{`
        .fo { container-type: size; position: relative; width: 100%; height: 100%; background: var(--bg); color: #1b1b1f; font: 400 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; transition: background 400ms ease; overflow: hidden; display: grid; place-items: center; }
        .fo * { box-sizing: border-box; }
        .fo button { font: inherit; cursor: pointer; border: 0; }
        .fo-skip { position: absolute; top: 14px; right: 18px; background: none; color: #1b1b1f; text-decoration: underline; text-underline-offset: 3px; font-weight: 700; padding: 6px; }
        .fo-col { width: min(360px, 100% - 40px); display: flex; flex-direction: column; align-items: center; text-align: center; gap: min(14px, 2.6cqh); }
        .fo-art { width: min(220px, 38cqh * 1.25); aspect-ratio: 200 / 160; }
        .fo-art svg { width: 100%; height: 100%; display: block; }
        .fo h2 { margin: 0; font-size: clamp(18px, 5cqh, 24px); font-weight: 800; letter-spacing: -0.01em; }
        .fo p { margin: 0; color: #4a4a55; max-width: 30ch; }
        .fo-dots { display: flex; gap: 6px; }
        .fo-dot { width: 8px; height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 30%, var(--bg)); padding: 0; transition: width 250ms ease, background 250ms; }
        .fo-dot[aria-current='step'] { width: 26px; background: var(--accent); }
        .fo-next { width: 100%; background: var(--accent); color: #fff; font-weight: 700; font-size: 15px; padding: 13px; border-radius: var(--btn-r); transition: background 120ms; }
        .fo-next:hover { background: color-mix(in srgb, var(--accent), black 15%); }
        .fo-link { background: none; color: #4a4a55; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; padding: 2px; }
      `}</style>

      <button className="fo-skip" onClick={() => setStep(STEPS.length - 1)}>Skip</button>

      <div className="fo-col">
        <div className="fo-art"><Art kind={s.art} accent={s.accent} bg={s.bg} /></div>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="fo-dots">
          {STEPS.map((_, i) => (
            <button key={i} className="fo-dot" aria-label={`Step ${i + 1}`} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)} />
          ))}
        </div>
        <button className="fo-next" onClick={() => setStep(last ? 0 : step + 1)}>{last ? 'Get started' : 'Next'}</button>
        <button className="fo-link">I already have an account</button>
      </div>
    </div>
  )
}
