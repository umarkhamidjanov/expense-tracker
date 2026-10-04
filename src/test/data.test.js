import { describe, expect, it, vi } from 'vitest'
import { generateDemoData } from '../data/demoData'
import { migrate } from '../data/migrate'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoriesFor, getCategory } from '../data/categories'
import { exportCSV } from '../utils/csv'
import { toISODate } from '../utils/format'

describe('generateDemoData', () => {
  const today = new Date(2026, 9, 3)
  const data = generateDemoData(today)

  it('is deterministic for the same date', () => {
    expect(generateDemoData(today)).toEqual(data)
  })
  it('covers six months and never dates past today', () => {
    const months = new Set(data.map((t) => t.date.slice(0, 7)))
    expect(months.size).toBe(6)
    expect(data.every((t) => t.date <= toISODate(today))).toBe(true)
  })
  it('produces valid, named transactions with positive amounts', () => {
    const ids = new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => c.id))
    for (const t of data) {
      expect(['income', 'expense']).toContain(t.type)
      expect(ids.has(t.category)).toBe(true)
      expect(categoriesFor(t.type).some((c) => c.id === t.category)).toBe(true)
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.amount).toBeGreaterThan(0)
    }
    expect(new Set(data.map((t) => t.id)).size).toBe(data.length)
  })
  it('is sorted newest first', () => {
    const dates = data.map((t) => t.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})

describe('migrate', () => {
  it('moves a legacy description into name and clears the note', () => {
    expect(migrate([{ id: 'a', description: 'Lunch', amount: 5 }])).toEqual([{ id: 'a', name: 'Lunch', description: '', amount: 5 }])
  })
  it('leaves current-format transactions untouched', () => {
    const t = { id: 'b', name: 'Rent', description: 'Paid early' }
    expect(migrate([t])[0]).toBe(t)
  })
  it('falls back to demo data for corrupt storage', () => {
    expect(migrate({ nope: true }).length).toBeGreaterThan(50)
  })
})

describe('categories', () => {
  it('falls back to "Other" for unknown ids', () => {
    expect(getCategory('does-not-exist').id).toBe('other')
  })
})

describe('exportCSV', () => {
  it('writes a quoted CSV with signed amounts', async () => {
    let blob
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => ((blob = b), 'blob:test'))
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    exportCSV([
      { date: '2026-10-01', type: 'income', name: 'Pay', category: 'salary', description: '', amount: 100 },
      { date: '2026-10-02', type: 'expense', name: 'Dinner "out"', category: 'food', description: 'with, friends', amount: 25.5 },
    ])

    const lines = (await blob.text()).split('\n')
    expect(lines[0]).toBe('"Date","Type","Name","Category","Description","Amount"')
    expect(lines[1]).toBe('"2026-10-01","income","Pay","Salary","","100"')
    expect(lines[2]).toBe('"2026-10-02","expense","Dinner ""out""","Food & Dining","with, friends","-25.5"')
  })
})
