import { getCategory } from '../data/categories'

export function exportCSV(txs, filename = 'lumen-transactions.csv') {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [
    ['Date', 'Type', 'Name', 'Category', 'Description', 'Amount'],
    ...txs.map((t) => [t.date, t.type, t.name, getCategory(t.category).name, t.description, (t.type === 'income' ? 1 : -1) * t.amount]),
  ]
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
