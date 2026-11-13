import { useEffect, useRef, useState } from 'react'

// Types text out like a person at a keyboard: the delay between keys varies,
// spaces take a beat longer, and commas and full stops get a real pause. The
// caret stays solid while typing and blinks while it waits. Separate phrases
// with "|" and turn on loop to type, hold, delete and move to the next one.
const CSS = `
@keyframes rd-tw-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }
.rd-tw-caret { display: inline-block; width: 0.08em; height: 1em; margin-left: 0.04em; vertical-align: -0.12em; background: currentColor; border-radius: 0.02em }
.rd-tw-caret.idle { animation: rd-tw-blink 1.05s steps(1) infinite }
`

// how long a key takes after typing character c
function keyDelay(c, speed, jitter) {
  // the sum of two uniforms: a soft bell around 1, like human key timing
  const r = (Math.random() + Math.random() - 1) * jitter
  let d = speed * (1 + r)
  if (c === ' ') d *= 1.4
  else if (c === ',' || c === ';' || c === ':') d *= 4
  else if (c === '.' || c === '!' || c === '?') d *= 7
  return Math.max(12, d)
}

export default function TypewriterText({
  text = 'Design it.|Build it.|Ship it.',
  speed = 70,
  jitter = 0.6,
  hold = 1.6,
  loop = true,
  caret = true,
  style,
}) {
  const phrases = String(text).split('|')
  const [out, setOut] = useState('')
  const [idle, setIdle] = useState(true)
  const timer = useRef(0)

  useEffect(() => {
    let alive = true
    let p = 0 // which phrase
    let n = 0 // characters shown
    let deleting = false
    const wait = (ms, fn) => (timer.current = setTimeout(() => alive && fn(), ms))

    const tick = () => {
      const phrase = phrases[p] ?? ''
      if (!deleting) {
        if (n < phrase.length) {
          n++
          setIdle(false)
          setOut(phrase.slice(0, n))
          wait(keyDelay(phrase[n - 1], speed, jitter), tick)
        } else {
          setIdle(true)
          if (loop || p < phrases.length - 1) {
            deleting = true
            wait(hold * 1000, tick)
          }
        }
      } else if (n > 0) {
        // deleting is quicker and steadier than typing
        n--
        setIdle(false)
        setOut(phrase.slice(0, n))
        wait(speed * 0.4, tick)
      } else {
        deleting = false
        p = (p + 1) % phrases.length
        setIdle(true)
        wait(speed * 5, tick)
      }
    }

    setOut('')
    setIdle(true)
    wait(400, tick)
    return () => {
      alive = false
      clearTimeout(timer.current)
    }
  }, [text, speed, jitter, hold, loop])

  return (
    <span aria-label={phrases.join(' ')} style={{ whiteSpace: 'pre', ...style }}>
      <style>{CSS}</style>
      <span aria-hidden="true">{out}</span>
      {caret && <span aria-hidden="true" className={`rd-tw-caret${idle ? ' idle' : ''}`} />}
    </span>
  )
}
