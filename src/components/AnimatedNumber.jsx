import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../utils/format'

const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function AnimatedNumber({ value, currency, duration = 900 }) {
  // With reduced motion there's no count-up, so start at the real value (no flash of 0).
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))
  const current = useRef(prefersReducedMotion() ? value : 0)

  useEffect(() => {
    const reduce = prefersReducedMotion()
    const begin = current.current
    if (reduce || begin === value) {
      current.current = value
      setDisplay(value)
      return
    }
    const start = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 4)
      current.current = begin + (value - begin) * eased
      setDisplay(current.current)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{formatMoney(display, currency)}</>
}
