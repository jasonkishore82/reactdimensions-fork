import { useEffect, useState } from 'react'

// True while the element is on screen and the browser tab is visible. Use it
// to pause timers, animation loops and CSS animations nobody can see.
export function useOnScreen(ref) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    let inView = true
    const update = () => setOn(inView && document.visibilityState !== 'hidden')
    const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update() })
    io.observe(el)
    document.addEventListener('visibilitychange', update)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [ref])
  return on
}

// True when the viewer has asked the OS to reduce motion.
export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setReduce(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduce
}
