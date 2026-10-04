import { useEffect, useState } from 'react'
import { CloudUpload, CircleAlert, LoaderCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getImportState, readLocalData, setImportState } from '../data/localData'
import Modal from './Modal'

function Option({ checked, onChange, title, detail, disabled }) {
  return (
    <label className={`import-option ${checked ? 'is-checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span>
        <span className="import-option__title">{title}</span>
        <span className="import-option__detail">{detail}</span>
      </span>
    </label>
  )
}

export function ImportDialog({ open, onClose, local }) {
  const { importLocal } = useApp()
  const [pick, setPick] = useState({ own: true, sample: false, settings: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setPick({ own: local.own.length > 0, sample: false, settings: !!local.settings })
      setError(null)
    }
  }, [open, local])

  const nothing = !(pick.own && local.own.length) && !(pick.sample && local.sample.length) && !(pick.settings && local.settings)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await importLocal({
      own: pick.own ? local.own : [],
      sample: pick.sample ? local.sample : [],
      settings: pick.settings ? local.settings : null,
    })
    setBusy(false)
    if (res.ok) onClose(true)
    else setError(res.error)
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose(false)} title="Import data from this browser" subtitle="Copy what you saved here before signing in into your account." labelledBy="import-title" size="sm">
      <div className="import-body">
        <div className="import-hero">
          <CloudUpload size={22} />
        </div>
        <div className="import-options">
          {local.own.length > 0 && (
            <Option checked={pick.own} onChange={(v) => setPick((p) => ({ ...p, own: v }))} title={`Your transactions (${local.own.length})`} detail="Transactions you added or imported yourself" disabled={busy} />
          )}
          {local.sample.length > 0 && (
            <Option checked={pick.sample} onChange={(v) => setPick((p) => ({ ...p, sample: v }))} title={`Sample transactions (${local.sample.length})`} detail="Demo data the app created; marked as sample so you can remove it later" disabled={busy} />
          )}
          {local.settings && (
            <Option checked={pick.settings} onChange={(v) => setPick((p) => ({ ...p, settings: v }))} title="Settings" detail="Name, currency, opening balance and monthly budget" disabled={busy} />
          )}
        </div>
        <p className="import-note">Nothing is removed from this browser. You can delete the local copy later from Settings.</p>
        {error && (
          <div className="auth-alert auth-alert--error" role="alert">
            <CircleAlert size={17} /> <span>{error}</span>
          </div>
        )}
      </div>
      <div className="modal__foot">
        <button type="button" className="btn btn-ghost" onClick={() => onClose(false)} disabled={busy}>
          Not now
        </button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || nothing}>
          {busy && <LoaderCircle size={16} className="spin" />}
          {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
    </Modal>
  )
}

// Offers the import once per account on this device, after the account data has loaded.
export default function ImportPrompt() {
  const { status, user } = useApp()
  const [local, setLocal] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (status !== 'ready' || local) return
    const data = readLocalData(user.id)
    setLocal(data)
    if ((data.hasData || data.settings) && !getImportState(user.id)) setOpen(true)
  }, [status, local, user.id])

  if (!local) return null
  return (
    <ImportDialog
      open={open}
      local={local}
      onClose={(imported) => {
        if (!imported) setImportState(user.id, 'dismissed')
        setOpen(false)
      }}
    />
  )
}
