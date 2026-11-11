import { useEffect, useRef, useState } from 'react'

// Scrambles through random characters before locking each letter in,
// left to right. Plays on mount, or every time it's hovered.
export default function DecodeText({
  text = 'REACT DIMENSIONS',
  speed = 40,
  scrambles = 6,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/',
  trigger = 'mount',
  style,
}) {
  const [out, setOut] = useState(trigger === 'mount' ? '' : text)
  const timer = useRef(0)

  const play = () => {
    clearInterval(timer.current)
    let frame = 0
    const totalFrames = text.length + scrambles
    timer.current = setInterval(() => {
      frame++
      const next = [...text]
        .map((c, i) => {
          if (c === ' ') return ' '
          if (i < frame - scrambles) return c
          if (i > frame) return ''
          return charset[Math.floor(Math.random() * charset.length)]
        })
        .join('')
      setOut(next)
      if (frame >= totalFrames) {
        clearInterval(timer.current)
        setOut(text)
      }
    }, speed)
  }

  useEffect(() => {
    if (trigger === 'mount') play()
    else setOut(text)
    return () => clearInterval(timer.current)
  }, [text, speed, scrambles, trigger])

  return (
    <span
      aria-label={text}
      onPointerEnter={trigger === 'hover' ? play : undefined}
      style={{ font: '500 1em/1.1 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', whiteSpace: 'pre', ...style }}
    >
      <span aria-hidden="true">{out.padEnd(text.length, ' ')}</span>
    </span>
  )
}
