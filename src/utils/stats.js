import { getCategory } from '../data/categories'
import { monthKey, monthLabel, parseISODate } from './format'

export function totals(txs) {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  const savings = income - expense
  return { income, expense, savings, savingsRate: income ? (savings / income) * 100 : 0, count: txs.length }
}

export function inMonth(txs, key) {
  return txs.filter((t) => monthKey(t.date) === key)
}

// Keeps transactions dated on or before the given day of their month, so a
// partial current month can be compared like-for-like with the prior month.
export function throughDay(txs, day) {
  return txs.filter((t) => Number(t.date.slice(8, 10)) <= day)
}

export function samePeriodLabel(prevKey, day, daysInPrev) {
  if (day >= daysInPrev) return 'vs. prior month'
  return `vs. ${monthLabel(prevKey)} 1${day > 1 ? `–${day}` : ''}`
}

export function monthlySeries(txs, keys) {
  const map = Object.fromEntries(keys.map((k) => [k, { key: k, label: monthLabel(k), income: 0, expense: 0 }]))
  for (const t of txs) {
    const row = map[monthKey(t.date)]
    if (!row) continue
    row[t.type === 'income' ? 'income' : 'expense'] += t.amount
  }
  return keys.map((k) => {
    const r = map[k]
    return { ...r, income: round(r.income), expense: round(r.expense), net: round(r.income - r.expense) }
  })
}

export function byCategory(txs, type = 'expense') {
  const map = {}
  let total = 0
  for (const t of txs) {
    if (t.type !== type) continue
    map[t.category] = (map[t.category] || 0) + t.amount
    total += t.amount
  }
  return Object.entries(map)
    .map(([id, value]) => {
      const c = getCategory(id)
      return { id, name: c.name, icon: c.icon, slot: c.slot, value: round(value), share: total ? (value / total) * 100 : 0 }
    })
    .sort((a, b) => b.value - a.value)
}

// Categories without a fixed color slot are merged into a single "Other" slice.
export function foldForChart(rows) {
  const kept = rows.filter((r) => r.slot)
  const rest = rows.filter((r) => !r.slot)
  if (!rest.length) return kept
  const value = rest.reduce((s, r) => s + r.value, 0)
  const share = rest.reduce((s, r) => s + r.share, 0)
  return [...kept, { id: '__other', name: 'Other', slot: null, value: round(value), share, members: rest.map((r) => r.name) }]
}

export function dailySeries(txs, key) {
  const [y, m] = key.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const rows = Array.from({ length: days }, (_, i) => ({ day: i + 1, expense: 0 }))
  for (const t of txs) {
    if (t.type !== 'expense' || monthKey(t.date) !== key) continue
    rows[parseISODate(t.date).getDate() - 1].expense += t.amount
  }
  return rows.map((r) => ({ ...r, expense: round(r.expense) }))
}

export function round(n) {
  return Math.round(n * 100) / 100
}
