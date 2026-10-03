import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const isSheet = () => window.matchMedia('(max-width: 768px)').matches

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', labelledBy = 'modal-title' }) {
  const panel = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const drag = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const target = panel.current?.querySelector('[data-autofocus]')
      // On touch devices, focusing a text field pops the keyboard over the form;
      // focus the dialog itself instead so screen readers still land inside it.
      const coarse = window.matchMedia('(pointer: coarse)').matches
      if (target && !(coarse && target.matches('input, textarea'))) target.focus()
      else panel.current?.focus({ preventScroll: true })
    }, 60)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.({ preventScroll: true })
    }
  }, [open])

  // Swipe-down-to-dismiss for the mobile bottom sheet (from the handle/header only,
  // so scrolling the form content is unaffected).
  const onTouchStart = (e) => {
    if (!isSheet() || panel.current.scrollTop > 0) return
    drag.current = { y: e.touches[0].clientY, dy: 0 }
    panel.current.style.transition = 'none'
  }
  const onTouchMove = (e) => {
    if (!drag.current) return
    drag.current.dy = Math.max(0, e.touches[0].clientY - drag.current.y)
    panel.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const onTouchEnd = () => {
    if (!drag.current) return
    const { dy } = drag.current
    drag.current = null
    const el = panel.current
    el.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
    if (dy > 110) {
      el.style.transform = 'translateY(100%)'
      setTimeout(() => closeRef.current(), 200)
    } else {
      el.style.transform = ''
    }
  }

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal glass modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panel} tabIndex={-1}>
        <div className="modal__drag" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
          <span className="modal__handle" aria-hidden="true" />
          <div className="modal__head">
            <div>
              <h2 id={labelledBy}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
