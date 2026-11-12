import { useState } from 'react'

// Minimal checkout, following Baymard's must-haves: guest checkout first,
// one step per screen with a single forward button, as few fields as
// possible, errors next to the field, and the total always in view. A thin
// step indicator shows where you are; "Back" is a quiet text link.

const STEPS = ['Details', 'Shipping', 'Payment']
const ITEMS = [['Linen shirt', 'Oat · M', 68], ['Canvas tote', 'Natural', 24]]
const SHIPPING = [['Standard', '3–5 days', 0], ['Express', 'Next day', 9]]

const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
const fmtExp = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }

export default function MinCheckout({ currency = '€', style }) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ email: '', name: '', address: '', postcode: '', ship: 0, card: '', exp: '', cvc: '' })
  const [err, setErr] = useState({})
  const [done, setDone] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: k === 'card' ? fmtCard(e.target.value) : k === 'exp' ? fmtExp(e.target.value) : e.target.value }); setErr({ ...err, [k]: undefined }) }

  const subtotal = ITEMS.reduce((a, i) => a + i[2], 0)
  const total = subtotal + SHIPPING[f.ship][2]

  const check = () => {
    const e = {}
    if (step === 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter an email like name@example.com'
    if (step === 1) {
      if (!f.name.trim()) e.name = 'Enter your full name'
      if (!f.address.trim()) e.address = 'Enter a street address'
      if (f.postcode.trim().length < 4) e.postcode = 'Enter a postcode'
    }
    if (step === 2) {
      if (f.card.replace(/\s/g, '').length < 16) e.card = 'Card number should be 16 digits'
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.exp)) e.exp = 'Use MM/YY'
      if (!/^\d{3,4}$/.test(f.cvc)) e.cvc = '3 or 4 digits'
    }
    setErr(e)
    return !Object.keys(e).length
  }
  const next = (e) => { e.preventDefault(); if (!check()) return; if (step < 2) setStep(step + 1); else setDone(true) }

  const Field = ({ k, label, type = 'text', auto, inputMode, half }) => (
    <label className={`mc-field${half ? ' half' : ''}`}>
      <span>{label}</span>
      <input type={type} value={f[k]} onChange={set(k)} autoComplete={auto} inputMode={inputMode} aria-invalid={!!err[k]} aria-describedby={err[k] ? `mc-e-${k}` : undefined} />
      {err[k] && <small id={`mc-e-${k}`} role="alert">{err[k]}</small>}
    </label>
  )

  return (
    <div className="mc-wrap" style={style}>
      <style>{`
        .mc-wrap { container-type: inline-size; width: 100%; height: 100%; overflow: auto; background: #fff; color: #111; font: 400 15px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; display: grid; grid-template-columns: 1fr 300px; }
        :where(.mc-wrap) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
        .mc-wrap > * { min-width: 0; }
        .mc-main { padding: 36px 40px; display: flex; flex-direction: column; align-items: center; }
        .mc-inner { width: 100%; max-width: 380px; }
        .mc-steps { display: flex; gap: 8px; margin-bottom: 28px; }
        .mc-steps li { flex: 1; list-style: none; font-size: 12px; color: #6b6b6b; }
        .mc-steps li::before { content: ''; display: block; height: 2px; background: #e5e5e5; margin-bottom: 8px; }
        .mc-steps li.on { color: #111; }
        .mc-steps li.on::before { background: #111; }
        .mc-steps ol { display: contents; }
        .mc-inner h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
        .mc-inner > p { margin: 0 0 20px; color: #6b6b6b; font-size: 14px; }
        .mc-form { display: flex; flex-wrap: wrap; gap: 14px; }
        .mc-field { flex: 1 1 100%; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #444; }
        .mc-field.half { flex: 1 1 40%; }
        .mc-field input { background: #fff; border: 1px solid #d4d4d4; border-radius: 8px; padding: 11px 12px; font: inherit; font-size: 15px; color: #111; outline: none; }
        .mc-field input:focus { border-color: #111; box-shadow: 0 0 0 1px #111; }
        .mc-field input[aria-invalid='true'] { border-color: #b42318; }
        .mc-field small { color: #b42318; }
        .mc-opt { flex: 1 1 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border: 1px solid #d4d4d4; border-radius: 8px; cursor: pointer; }
        .mc-opt:has(input:checked) { border-color: #111; box-shadow: 0 0 0 1px #111; }
        .mc-opt input { accent-color: #111; margin-right: 10px; }
        .mc-opt small { display: block; color: #6b6b6b; }
        .mc-go { flex: 1 1 100%; margin-top: 6px; padding: 14px; border-radius: 8px; background: #111; color: #fff; font-weight: 600; }
        .mc-wrap .mc-go { color: #fff; }
        .mc-back { flex: 1 1 100%; text-align: center; color: #555; font-size: 14px; text-decoration: underline; text-underline-offset: 3px; }
        .mc-note { flex: 1 1 100%; font-size: 13px; color: #6b6b6b; text-align: center; }
        .mc-sum { background: #f7f7f6; padding: 36px 28px; border-left: 1px solid #ececea; }
        .mc-sum h2 { margin: 0 0 18px; font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #555; }
        .mc-line { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; font-size: 14px; }
        .mc-line small { display: block; color: #6b6b6b; }
        .mc-total { border-top: 1px solid #e2e2e0; margin-top: 10px; padding-top: 14px; font-weight: 600; font-size: 16px; }
        .mc-done { text-align: center; padding-top: 40px; }
        .mc-done svg { margin-bottom: 12px; }
        @container (max-width: 640px) { .mc-wrap { grid-template-columns: 1fr; } .mc-sum { order: -1; border-left: 0; border-bottom: 1px solid #ececea; padding: 16px 20px; } .mc-sum .mc-line:not(.mc-total) { display: none; } .mc-sum h2 { display: none; } .mc-total { border: 0; margin: 0; padding: 0; } .mc-main { padding: 24px 20px; } }
      `}</style>

      <main className="mc-main">
        <div className="mc-inner">
          {done ? (
            <div className="mc-done" role="status">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>
              <h1>Order placed</h1>
              <p style={{ color: '#6b6b6b' }}>A receipt is on its way to {f.email}.</p>
            </div>
          ) : (
            <>
              <ol className="mc-steps" aria-label="Checkout progress">
                {STEPS.map((s, i) => <li key={s} className={i <= step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}>{s}</li>)}
              </ol>
              <h1>{['Your email', 'Where should we send it?', 'Payment'][step]}</h1>
              <p>{['Checking out as a guest. No account needed.', 'We only ship to the address on this step.', `You’ll pay ${currency}${total} today.`][step]}</p>
              <form className="mc-form" onSubmit={next} noValidate>
                {step === 0 && Field({ k: 'email', label: 'Email', type: 'email', auto: 'email' })}
                {step === 1 && (
                  <>
                    {Field({ k: 'name', label: 'Full name', auto: 'name' })}
                    {Field({ k: 'address', label: 'Address', auto: 'street-address' })}
                    {Field({ k: 'postcode', label: 'Postcode', auto: 'postal-code', half: true })}
                    {SHIPPING.map(([n, d, p], i) => (
                      <label key={n} className="mc-opt">
                        <span><input type="radio" name="ship" checked={f.ship === i} onChange={() => setF({ ...f, ship: i })} />{n}<small>{d}</small></span>
                        <span>{p ? `${currency}${p}` : 'Free'}</span>
                      </label>
                    ))}
                  </>
                )}
                {step === 2 && (
                  <>
                    {Field({ k: 'card', label: 'Card number', auto: 'cc-number', inputMode: 'numeric' })}
                    {Field({ k: 'exp', label: 'Expiry (MM/YY)', auto: 'cc-exp', inputMode: 'numeric', half: true })}
                    {Field({ k: 'cvc', label: 'Security code', auto: 'cc-csc', inputMode: 'numeric', half: true })}
                  </>
                )}
                <button type="submit" className="mc-go">{step < 2 ? 'Continue' : `Pay ${currency}${total}`}</button>
                {step > 0 && <button type="button" className="mc-back" onClick={() => { setStep(step - 1); setErr({}) }}>Back</button>}
                {step === 2 && <p className="mc-note">Demo only. No real payment is taken.</p>}
              </form>
            </>
          )}
        </div>
      </main>

      <aside className="mc-sum" aria-label="Order summary">
        <h2>Summary</h2>
        {ITEMS.map(([n, v, p]) => <div key={n} className="mc-line"><span>{n}<small>{v}</small></span><span>{currency}{p}</span></div>)}
        <div className="mc-line"><span>Shipping</span><span>{SHIPPING[f.ship][2] ? `${currency}${SHIPPING[f.ship][2]}` : 'Free'}</span></div>
        <div className="mc-line mc-total"><span>Total</span><span>{currency}{total}</span></div>
      </aside>
    </div>
  )
}
