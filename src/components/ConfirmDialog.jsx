import { TriangleAlert, Sparkles } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel, tone = 'danger', busy = false }) {
  const primary = tone === 'primary'
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm" labelledBy="confirm-title">
      <div className="confirm">
        <div className={`confirm__icon ${primary ? 'confirm__icon--primary' : ''}`}>{primary ? <Sparkles size={22} /> : <TriangleAlert size={22} />}</div>
        <p>{message}</p>
      </div>
      <div className="modal__foot">
        <button className="btn btn-ghost" onClick={onCancel} data-autofocus disabled={busy}>
          Cancel
        </button>
        <button className={`btn ${primary ? 'btn-primary' : 'btn-danger'}`} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
