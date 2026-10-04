import { describe, expect, it } from 'vitest'
import { byCategory, dailySeries, foldForChart, inMonth, monthlySeries, samePeriodLabel, throughDay, totals } from '../utils/stats'

const tx = (date, type, category, amount) => ({ id: `${date}-${category}-${amount}`, date, type, category, amount, name: category })

const sample = [
  tx('2026-10-01', 'income', 'salary', 5000),
  tx('2026-10-01', 'expense', 'housing', 1500),
  tx('2026-10-02', 'expense', 'food', 40.1),
  tx('2026-10-02', 'expense', 'food', 9.9),
  tx('2026-10-15', 'expense', 'subscriptions', 15),
  tx('2026-10-20', 'expense', 'education', 35),
  tx('2026-09-03', 'expense', 'food', 100),
  tx('2026-09-25', 'income', 'freelance', 800),
]

describe('totals', () => {
  it('sums income, expenses, savings and savings rate', () => {
    const t = totals(sample)
    expect(t.income).toBe(5800)
    expect(t.expense).toBeCloseTo(1700)
    expect(t.savings).toBeCloseTo(4100)
    expect(t.savingsRate).toBeCloseTo((4100 / 5800) * 100)
    expect(t.count).toBe(8)
  })
  it('handles an empty list', () => {
    expect(totals([])).toEqual({ income: 0, expense: 0, savings: 0, savingsRate: 0, count: 0 })
  })
})

describe('month helpers', () => {
  it('filters to a month', () => {
    expect(inMonth(sample, '2026-09')).toHaveLength(2)
  })
  it('keeps transactions through a day of the month', () => {
    expect(throughDay(inMonth(sample, '2026-10'), 2)).toHaveLength(4)
  })
  it('labels the comparison period', () => {
    expect(samePeriodLabel('2026-09', 3, 30)).toBe('vs. Sep 1–3')
    expect(samePeriodLabel('2026-09', 1, 30)).toBe('vs. Sep 1')
    expect(samePeriodLabel('2026-09', 30, 30)).toBe('vs. prior month')
  })
})

describe('monthlySeries', () => {
  it('aggregates income, expense and net per month, including empty months', () => {
    const s = monthlySeries(sample, ['2026-08', '2026-09', '2026-10'])
    expect(s.map((r) => r.key)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(s[0]).toMatchObject({ income: 0, expense: 0, net: 0 })
    expect(s[1]).toMatchObject({ label: 'Sep', income: 800, expense: 100, net: 700 })
    expect(s[2]).toMatchObject({ income: 5000, expense: 1600, net: 3400 })
  })
})

describe('byCategory', () => {
  const rows = byCategory(inMonth(sample, '2026-10'))
  it('sorts categories by spend, descending', () => {
    expect(rows.map((r) => r.id)).toEqual(['housing', 'food', 'education', 'subscriptions'])
  })
  it('rounds values and computes shares that add up to 100%', () => {
    expect(rows.find((r) => r.id === 'food').value).toBe(50)
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(100)
  })
  it('ignores income when grouping expenses', () => {
    expect(rows.some((r) => r.id === 'salary')).toBe(false)
  })
})

describe('foldForChart', () => {
  it('merges categories without a color slot into a single "Other" slice', () => {
    const folded = foldForChart(byCategory(inMonth(sample, '2026-10')))
    expect(folded.map((r) => r.name)).toEqual(['Housing', 'Food & Dining', 'Other'])
    const other = folded.at(-1)
    expect(other.value).toBe(50)
    expect(other.members).toEqual(['Education', 'Subscriptions'])
  })
  it('adds no "Other" slice when every category has a slot', () => {
    expect(foldForChart(byCategory([tx('2026-10-01', 'expense', 'food', 5)])).map((r) => r.name)).toEqual(['Food & Dining'])
  })
})

describe('dailySeries', () => {
  it('returns one row per day with expenses summed', () => {
    const d = dailySeries(sample, '2026-10')
    expect(d).toHaveLength(31)
    expect(d[1]).toEqual({ day: 2, expense: 50 })
    expect(d[2].expense).toBe(0)
  })
  it('handles February', () => {
    expect(dailySeries([], '2026-02')).toHaveLength(28)
  })
})
