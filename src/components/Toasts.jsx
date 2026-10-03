import { CircleCheck, CircleAlert, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass toast--${t.tone}`}>
          {t.tone === 'danger' ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
          <span>{t.message}</span>
          <button className="toast__close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
