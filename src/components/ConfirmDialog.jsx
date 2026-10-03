import { TriangleAlert } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm" labelledBy="confirm-title">
      <div className="confirm">
        <div className="confirm__icon">
          <TriangleAlert size={22} />
        </div>
        <p>{message}</p>
      </div>
      <div className="modal__foot">
        <button className="btn btn-ghost" onClick={onCancel} data-autofocus>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
