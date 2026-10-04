import { useLayoutEffect, useRef } from 'react'

// Shrinks its text (down to `min` × the normal size) only when it would overflow its box,
// e.g. long amounts like "UZS 78,535,000" in a narrow card. Text that fits is untouched.
export default function FitText({ children, min = 0.6 }) {
  const ref = useRef(null)
  const fit = useRef(() => {})

  fit.current = () => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box) return
    el.style.fontSize = ''
    let scale = 1
    // Fractional widths, so text that overflows by part of a pixel still counts as too wide.
    const avail = box.getBoundingClientRect().width - (parseFloat(getComputedStyle(box).paddingLeft) || 0) - (parseFloat(getComputedStyle(box).paddingRight) || 0)
    while (el.getBoundingClientRect().width > avail && scale > min) {
      scale = Math.round((scale - 0.04) * 100) / 100
      el.style.fontSize = `${scale}em`
    }
  }

  // Re-check after every render...
  useLayoutEffect(() => fit.current())
  // ...and whenever the box or the text changes size. Watching the text itself catches
  // changes made inside child components (e.g. a counting-up number) and late font loads.
  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!box || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fit.current())
    ro.observe(box)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <span ref={ref} className="fit-text">
      {children}
    </span>
  )
}
