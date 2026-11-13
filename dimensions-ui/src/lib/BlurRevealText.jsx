import { useEffect, useRef, useState } from 'react'

// Words come into focus one at a time: each starts soft, faint and a touch
// low, then sharpens into place, like a lens pulling focus across the line.
export default function BlurRevealText({
  text = 'Words resolve out of the blur, one at a time.',
  stagger = 120,
  duration = 900,
  blur = 12,
  rise = 0.25,
  trigger = 'mount',
  style,
}) {
  const [shown, setShown] = useState(trigger !== 'mount')
  const raf = useRef(0)

  const play = () => {
    cancelAnimationFrame(raf.current)
    setShown(false)
    // two frames, so the hidden state is painted before the transition starts
    raf.current = requestAnimationFrame(() => (raf.current = requestAnimationFrame(() => setShown(true))))
  }

  useEffect(() => {
    if (trigger === 'mount') play()
    else setShown(true)
    return () => cancelAnimationFrame(raf.current)
  }, [text, stagger, duration, blur, rise, trigger])

  const words = String(text).split(/(\s+)/)
  let w = 0
  return (
    <span aria-label={text} onPointerEnter={trigger === 'hover' ? play : undefined} style={style}>
      {words.map((word, i) => {
        if (/^\s+$/.test(word) || !word) return word
        const delay = w++ * stagger
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              filter: shown ? 'blur(0px)' : `blur(${blur}px)`,
              opacity: shown ? 1 : 0,
              transform: shown ? 'none' : `translateY(${rise}em)`,
              transition: shown
                ? `filter ${duration}ms cubic-bezier(.2,.7,.2,1) ${delay}ms, opacity ${duration * 0.7}ms ease ${delay}ms, transform ${duration}ms cubic-bezier(.2,.7,.2,1) ${delay}ms`
                : 'none',
            }}
          >
            {word}
          </span>
        )
      })}
    </span>
  )
}
