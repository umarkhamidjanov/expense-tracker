import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Check, Trash, TriangleAlert, CircleAlert, LoaderCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { categoriesFor, slotVar } from '../data/categories'
import { currencyDecimals, currencySymbol, maxAmount, toISODate } from '../utils/format'
import Modal from './Modal'

const NAME_MAX = 60
const DESC_MAX = 200

const blank = () => ({ type: 'expense', name: '', amount: '', category: 'food', description: '', date: toISODate() })

export default function TransactionModal() {
  const { editor, closeEditor, addTransaction, updateTransaction, deleteTransaction, transactions, settings } = useApp()
  const editing = editor?.tx
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    if (!editor) return
    setErrors({})
    setConfirmDelete(false)
    setSaving(false)
    setSubmitError(null)
    setForm(
      editing
        ? { ...blank(), ...editing, name: editing.name ?? '', description: editing.description ?? '', amount: String(editing.amount) }
        : blank(),
    )
  }, [editor, editing])

  // Names used before for this type, most recent first, for quick re-entry.
  const suggestions = useMemo(() => {
    const seen = new Set()
    for (const t of transactions) {
      if (t.type === form.type && t.name && !seen.has(t.name)) seen.add(t.name)
      if (seen.size >= 40) break
    }
    return [...seen]
  }, [transactions, form.type])

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    const keys = Object.keys(patch)
    if (keys.some((k) => errors[k])) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))))
  }

  const setType = (type) => {
    const cats = categoriesFor(type)
    set({ type, category: cats.some((c) => c.id === form.category) ? form.category : cats[0].id })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    const amount = Number(String(form.amount).replace(',', '.'))
    const name = form.name.trim()
    const next = {}
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) next.amount = 'Enter an amount greater than 0'
    else if (amount > maxAmount(settings.currency)) next.amount = 'That amount looks too large'
    if (!name) next.name = 'Give this transaction a name'
    else if (name.length > NAME_MAX) next.name = `Keep it under ${NAME_MAX} characters`
    if (!form.date) next.date = 'Pick a date'
    if (form.description.length > DESC_MAX) next.description = `Keep it under ${DESC_MAX} characters`
    setErrors(next)
    if (Object.keys(next).length) {
      // Bring the first invalid field into view (matters inside the scrolling mobile sheet).
      requestAnimationFrame(() => document.querySelector('.tx-form [aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      return
    }

    const tx = {
      type: form.type,
      name,
      amount: Math.round(amount * 100) / 100,
      category: form.category,
      date: form.date,
      description: form.description.trim(),
    }
    setSaving(true)
    setSubmitError(null)
    const res = editing ? await updateTransaction(editing.id, tx) : await addTransaction(tx)
    setSaving(false)
    // On failure keep the form open with the user's input and explain what happened.
    if (res.ok) closeEditor()
    else setSubmitError(res.error)
  }

  const remove = () => {
    deleteTransaction(editing.id)
    closeEditor()
  }

  const symbol = currencySymbol(settings.currency)

  return (
    <Modal
      open={!!editor}
      onClose={closeEditor}
      title={editing ? 'Edit transaction' : 'New transaction'}
      subtitle={editing ? 'Update the details below.' : 'Record income or an expense.'}
      labelledBy="tx-modal-title"
    >
      <form className="tx-form" onSubmit={submit} noValidate>
        <div className={`segmented segmented--${form.type}`} role="radiogroup" aria-label="Transaction type">
          <span className="segmented__pill" aria-hidden="true" />
          <button type="button" role="radio" aria-checked={form.type === 'expense'} className={form.type === 'expense' ? 'is-active' : ''} onClick={() => setType('expense')}>
            <TrendingDown size={16} /> Expense
          </button>
          <button type="button" role="radio" aria-checked={form.type === 'income'} className={form.type === 'income' ? 'is-active' : ''} onClick={() => setType('income')}>
            <TrendingUp size={16} /> Income
          </button>
        </div>

        <label className="field">
          <span className="field__label">Amount</span>
          <div className={`amount-input ${errors.amount ? 'has-error' : ''}`}>
            <span className="amount-input__symbol">{symbol}</span>
            <input
              data-autofocus
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              placeholder={currencyDecimals(settings.currency) ? '0.00' : '0'}
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value.replace(/[^\d.,]/g, '') })}
              aria-invalid={!!errors.amount}
            />
          </div>
          {errors.amount && <span className="field__error">{errors.amount}</span>}
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Name</span>
            <input
              name="tx-name"
              className={`input ${errors.name ? 'has-error' : ''}`}
              placeholder={form.type === 'income' ? 'e.g. Monthly salary' : 'e.g. Weekly groceries'}
              value={form.name}
              maxLength={NAME_MAX}
              list="tx-name-suggestions"
              enterKeyHint="next"
              autoComplete="off"
              aria-invalid={!!errors.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <datalist id="tx-name-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {errors.name && <span className="field__error">{errors.name}</span>}
          </label>
          <label className="field field--date">
            <span className="field__label">Date</span>
            <input
              type="date"
              className={`input ${errors.date ? 'has-error' : ''}`}
              value={form.date}
              max="2100-12-31"
              aria-invalid={!!errors.date}
              onChange={(e) => set({ date: e.target.value })}
            />
            {errors.date && <span className="field__error">{errors.date}</span>}
          </label>
        </div>

        <div className="field">
          <span className="field__label" id="cat-label">Category</span>
          <div className="cat-grid" role="radiogroup" aria-labelledby="cat-label">
            {categoriesFor(form.type).map((c) => {
              const Icon = c.icon
              const active = form.category === c.id
              return (
                <button
                  type="button"
                  key={c.id}
                  role="radio"
                  aria-checked={active}
                  className={`cat-option ${active ? 'is-active' : ''}`}
                  style={{ '--cat': slotVar(c.slot) }}
                  onClick={() => set({ category: c.id })}
                >
                  <span className="cat-option__icon">
                    <Icon size={18} />
                  </span>
                  <span className="cat-option__name">{c.name}</span>
                  {active && (
                    <span className="cat-option__check">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <label className="field">
          <span className="field__label field__label--split">
            <span>
              Description <span className="field__optional">optional</span>
            </span>
            <span className={`field__count ${form.description.length > DESC_MAX - 20 ? 'is-near' : ''}`}>
              {form.description.length}/{DESC_MAX}
            </span>
          </span>
          <textarea
            className={`input textarea ${errors.description ? 'has-error' : ''}`}
            placeholder="Add a note, e.g. who it was with or what it was for"
            rows={2}
            value={form.description}
            maxLength={DESC_MAX}
            aria-invalid={!!errors.description}
            onChange={(e) => set({ description: e.target.value })}
          />
          {errors.description && <span className="field__error">{errors.description}</span>}
        </label>

        {submitError && (
          <div className="form-error" role="alert">
            <CircleAlert size={17} />
            <span>{submitError}</span>
          </div>
        )}

        {confirmDelete ? (
          <div className="modal__foot modal__foot--confirm" role="alertdialog" aria-label="Confirm delete">
            <span className="foot-confirm__text">
              <TriangleAlert size={17} /> Delete this transaction?
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
            <button type="button" className="btn btn-danger" onClick={remove}>
              Delete
            </button>
          </div>
        ) : (
          <div className="modal__foot">
            {editing && (
              <button type="button" className="btn btn-danger-ghost foot-delete" onClick={() => setConfirmDelete(true)} aria-label="Delete transaction" disabled={saving}>
                <Trash size={16} />
                <span className="foot-delete__label">Delete</span>
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={closeEditor} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <LoaderCircle size={16} className="spin" />}
              {saving ? 'Saving…' : editing ? 'Save changes' : form.type === 'income' ? 'Add income' : 'Add expense'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}
