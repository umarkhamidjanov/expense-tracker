import { useState } from 'react'
import { Pencil, Trash, Inbox } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getCategory } from '../data/categories'
import { formatDate, formatMoney } from '../utils/format'
import CategoryIcon from './CategoryIcon'
import ConfirmDialog from './ConfirmDialog'

export function TransactionRow({ tx, currency, onEdit, onDelete, style }) {
  const cat = getCategory(tx.category)
  const income = tx.type === 'income'
  return (
    <li className="tx-row" style={style}>
      <CategoryIcon id={tx.category} />
      <div className="tx-row__main">
        <div className="tx-row__title">{tx.name || cat.name}</div>
        {tx.description && (
          <div className="tx-row__note" title={tx.description}>
            {tx.description}
          </div>
        )}
        <div className="tx-row__meta">
          {tx.isSample && <span className="sample-tag">Sample</span>}
          <span>{cat.name}</span>
          <span className="sep" aria-hidden="true">•</span>
          <span>{formatDate(tx.date, 'relative')}</span>
        </div>
      </div>
      <div className={`tx-row__amount ${income ? 'is-income' : ''}`}>
        {income ? '+' : '−'}
        {formatMoney(tx.amount, currency)}
      </div>
      <div className="tx-row__actions">
        <button className="icon-btn icon-btn--sm" onClick={() => onEdit(tx)} aria-label={`Edit ${tx.name || cat.name}`} title="Edit">
          <Pencil size={15} />
        </button>
        <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => onDelete(tx)} aria-label={`Delete ${tx.name || cat.name}`} title="Delete">
          <Trash size={15} />
        </button>
      </div>
    </li>
  )
}

export default function TransactionList({ items, emptyTitle = 'No transactions yet', emptyText = 'Add your first transaction to get started.', grouped = false }) {
  const { settings, openEditor, deleteTransaction } = useApp()
  const [pending, setPending] = useState(null)

  if (!items.length) {
    return (
      <div className="empty">
        <div className="empty__icon">
          <Inbox size={26} />
        </div>
        <div className="empty__title">{emptyTitle}</div>
        <div className="empty__text">{emptyText}</div>
      </div>
    )
  }

  const rowProps = { currency: settings.currency, onEdit: openEditor, onDelete: setPending }

  let content
  if (grouped) {
    const groups = []
    for (const tx of items) {
      const last = groups[groups.length - 1]
      if (last && last.date === tx.date) last.items.push(tx)
      else groups.push({ date: tx.date, items: [tx] })
    }
    let i = 0
    content = groups.map((g) => {
      const net = g.items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
      return (
        <section key={g.date} className="tx-group">
          <header className="tx-group__head">
            <span>{formatDate(g.date, 'relative')}</span>
            <span className="tabular">
              {net >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(net), settings.currency)}
            </span>
          </header>
          <ul className="tx-list">
            {g.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} {...rowProps} style={{ animationDelay: `${Math.min(i++, 12) * 25}ms` }} />
            ))}
          </ul>
        </section>
      )
    })
  } else {
    content = (
      <ul className="tx-list">
        {items.map((tx, i) => (
          <TransactionRow key={tx.id} tx={tx} {...rowProps} style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </ul>
    )
  }

  return (
    <>
      {content}
      <ConfirmDialog
        open={!!pending}
        title="Delete transaction?"
        message={pending ? `“${pending.name || getCategory(pending.category).name}” for ${formatMoney(pending.amount, settings.currency)} will be removed. You can undo this right after.` : ''}
        confirmLabel="Delete"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          deleteTransaction(pending.id)
          setPending(null)
        }}
      />
    </>
  )
}
