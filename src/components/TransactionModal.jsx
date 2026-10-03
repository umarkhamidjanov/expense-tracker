import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { categoriesFor, slotVar } from '../data/categories'
import { CURRENCIES, toISODate } from '../utils/format'
import Modal from './Modal'

const blank = () => ({ type: 'expense', amount: '', category: 'food', description: '', date: toISODate() })

export default function TransactionModal() {
  const { editor, closeEditor, addTransaction, updateTransaction, settings } = useApp()
  const editing = editor?.tx
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!editor) return
    setErrors({})
    setForm(editing ? { ...editing, amount: String(editing.amount) } : blank())
  }, [editor, editing])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const setType = (type) => {
    const cats = categoriesFor(type)
    set({ type, category: cats.some((c) => c.id === form.category) ? form.category : cats[0].id })
  }

  const submit = (e) => {
    e.preventDefault()
    const amount = Number(String(form.amount).replace(',', '.'))
    const next = {}
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) next.amount = 'Enter an amount greater than 0'
    else if (amount > 10_000_000) next.amount = 'That amount looks too large'
    if (!form.date) next.date = 'Pick a date'
    if (form.description.length > 80) next.description = 'Keep it under 80 characters'
    setErrors(next)
    if (Object.keys(next).length) return

    const tx = {
      type: form.type,
      amount: Math.round(amount * 100) / 100,
      category: form.category,
      description: form.description.trim(),
      date: form.date,
    }
    if (editing) updateTransaction(editing.id, tx)
    else addTransaction(tx)
    closeEditor()
  }

  const symbol = (() => {
    const loc = CURRENCIES.find((c) => c.code === settings.currency)?.locale || 'en-US'
    return new Intl.NumberFormat(loc, { style: 'currency', currency: settings.currency }).formatToParts(0).find((p) => p.type === 'currency')?.value
  })()

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
              enterKeyHint="done"
              autoComplete="off"
              aria-label="Amount"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value.replace(/[^\d.,]/g, '') })}
              aria-invalid={!!errors.amount}
            />
          </div>
          {errors.amount && <span className="field__error">{errors.amount}</span>}
        </label>

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

        <div className="field-row">
          <label className="field">
            <span className="field__label">Description</span>
            <input
              className={`input ${errors.description ? 'has-error' : ''}`}
              placeholder={form.type === 'income' ? 'e.g. Monthly salary' : 'e.g. Groceries at Whole Foods'}
              value={form.description}
              maxLength={90}
              enterKeyHint="done"
              autoComplete="off"
              onChange={(e) => set({ description: e.target.value })}
            />
            {errors.description && <span className="field__error">{errors.description}</span>}
          </label>
          <label className="field field--date">
            <span className="field__label">Date</span>
            <input type="date" className={`input ${errors.date ? 'has-error' : ''}`} value={form.date} max="2100-12-31" onChange={(e) => set({ date: e.target.value })} />
            {errors.date && <span className="field__error">{errors.date}</span>}
          </label>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn-ghost" onClick={closeEditor}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {editing ? 'Save changes' : form.type === 'income' ? 'Add income' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
