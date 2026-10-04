import { useDeferredValue, useMemo, useState } from 'react'
import { Search, X, Funnel, RotateCcw, Download } from 'lucide-react'
import { useApp } from '../context/AppContext'
import TransactionList from '../components/TransactionList'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategory } from '../data/categories'
import { formatMoney, monthKey, monthLabel } from '../utils/format'
import { totals } from '../utils/stats'
import { exportCSV } from '../utils/csv'

const DEFAULTS = { query: '', type: 'all', category: 'all', month: 'all', sort: 'newest' }

export default function Transactions() {
  const { transactions, settings } = useApp()
  const [f, setF] = useState(DEFAULTS)
  const query = useDeferredValue(f.query)
  const set = (patch) => setF((s) => ({ ...s, ...patch }))
  const cur = settings.currency

  const months = useMemo(() => [...new Set(transactions.map((t) => monthKey(t.date)))].sort().reverse(), [transactions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = transactions.filter((t) => {
      if (f.type !== 'all' && t.type !== f.type) return false
      if (f.category !== 'all' && t.category !== f.category) return false
      if (f.month !== 'all' && monthKey(t.date) !== f.month) return false
      if (q) {
        const hay = `${t.name || ''} ${t.description || ''} ${getCategory(t.category).name} ${t.amount}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (f.sort === 'oldest') out = [...out].reverse()
    else if (f.sort === 'highest') out = [...out].sort((a, b) => b.amount - a.amount)
    else if (f.sort === 'lowest') out = [...out].sort((a, b) => a.amount - b.amount)
    return out
  }, [transactions, query, f.type, f.category, f.month, f.sort])

  const sum = totals(filtered)
  const dirty = JSON.stringify(f) !== JSON.stringify(DEFAULTS)
  const grouped = f.sort === 'newest' || f.sort === 'oldest'

  const catOptions = f.type === 'income' ? INCOME_CATEGORIES : f.type === 'expense' ? EXPENSE_CATEGORIES : null

  return (
    <div className="page">
      <section className="card toolbar fade-up">
        <div className="search">
          <Search size={18} className="search__icon" />
          <input placeholder="Search by name, note, category or amount…" value={f.query} onChange={(e) => set({ query: e.target.value })} aria-label="Search transactions" />
          {f.query && (
            <button className="search__clear" onClick={() => set({ query: '' })} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="toolbar__filters">
          <div className="tabs tabs--sm" role="tablist" aria-label="Type">
            {['all', 'income', 'expense'].map((t) => (
              <button key={t} role="tab" aria-selected={f.type === t} className={f.type === t ? 'is-active' : ''} onClick={() => set({ type: t, category: 'all' })}>
                {t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expenses'}
              </button>
            ))}
          </div>

          <label className="select">
            <Funnel size={15} />
            <select value={f.category} onChange={(e) => set({ category: e.target.value })} aria-label="Category">
              <option value="all">All categories</option>
              {catOptions ? (
                catOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              ) : (
                <>
                  <optgroup label="Expenses">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Income">
                    {INCOME_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </label>

          <label className="select">
            <select value={f.month} onChange={(e) => set({ month: e.target.value })} aria-label="Month">
              <option value="all">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m, 'long')}
                </option>
              ))}
            </select>
          </label>

          <label className="select">
            <select value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
            </select>
          </label>

          {dirty && (
            <button className="btn btn-ghost btn-sm" onClick={() => setF(DEFAULTS)}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
          <button className="btn btn-ghost btn-sm toolbar__export" onClick={() => exportCSV(filtered)} disabled={!filtered.length}>
            <Download size={14} /> Export
          </button>
        </div>
      </section>

      <div className="summary-strip fade-up" style={{ animationDelay: '60ms' }}>
        <div className="summary-chip">
          <span className="muted">Results</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="summary-chip">
          <span className="muted">Income</span>
          <strong className="text-income">+{formatMoney(sum.income, cur)}</strong>
        </div>
        <div className="summary-chip">
          <span className="muted">Expenses</span>
          <strong className="text-expense">{'−'}{formatMoney(sum.expense, cur)}</strong>
        </div>
        <div className="summary-chip">
          <span className="muted">Net</span>
          <strong>
            {sum.savings >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(sum.savings), cur)}
          </strong>
        </div>
      </div>

      <section className="card fade-up" style={{ animationDelay: '120ms' }}>
        <TransactionList
          items={filtered}
          grouped={grouped}
          emptyTitle={transactions.length ? 'No matching transactions' : 'No transactions yet'}
          emptyText={transactions.length ? 'Try adjusting your search or filters.' : 'Use “Add transaction” to record your first one.'}
        />
      </section>
    </div>
  )
}
