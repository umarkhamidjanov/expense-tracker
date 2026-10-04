import { afterEach, describe, expect, it, vi } from 'vitest'
import { CURRENCIES, currencyDecimals, currencySymbol, formatDate, formatMoney, lastNMonths, maxAmount, monthKey, monthLabel, parseISODate, pctChange, toISODate } from '../utils/format'

afterEach(() => vi.useRealTimers())

describe('formatMoney', () => {
  it('formats standard currency with two decimals', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
    expect(formatMoney(-20, 'USD')).toBe('-$20.00')
  })
  it('uses zero decimals for JPY', () => {
    expect(formatMoney(1234.56, 'JPY')).toMatch(/^[￥¥]1,235$/)
  })
  it('supports compact notation for chart axes', () => {
    expect(formatMoney(10500, 'USD', { compact: true })).toBe('$10.5K')
  })
  it('formats Uzbekistani som by its code, with no decimals', () => {
    const plain = (s) => s.replace(/\s/g, ' ')
    expect(plain(formatMoney(1234567.5, 'UZS'))).toBe('UZS 1,234,568')
    expect(plain(formatMoney(12500000, 'UZS', { compact: true }))).toBe('UZS 12.5M')
    expect(currencySymbol('UZS')).toBe('UZS')
    expect(currencySymbol('USD')).toBe('$')
    expect(currencyDecimals('UZS')).toBe(0)
    expect(currencyDecimals('USD')).toBe(2)
    expect(maxAmount('UZS')).toBe(9_999_999_999)
    expect(maxAmount('USD')).toBe(10_000_000)
    expect(CURRENCIES.map((c) => c.code)).toEqual(['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'UZS'])
  })
  it('treats missing values as zero', () => {
    expect(formatMoney(undefined, 'USD')).toBe('$0.00')
  })
})

describe('dates', () => {
  it('round-trips ISO dates in local time', () => {
    const d = parseISODate('2026-02-28')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 1, 28])
    expect(toISODate(d)).toBe('2026-02-28')
  })
  it('extracts month keys and labels', () => {
    expect(monthKey('2026-10-03')).toBe('2026-10')
    expect(monthLabel('2026-10')).toBe('Oct')
    expect(monthLabel('2026-10', 'long')).toBe('October 2026')
  })
  it('lists the last N months across a year boundary', () => {
    expect(lastNMonths(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01'])
  })
  it('formats relative dates', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 3, 12))
    expect(formatDate('2026-10-03', 'relative')).toBe('Today')
    expect(formatDate('2026-10-02', 'relative')).toBe('Yesterday')
    expect(formatDate('2026-09-29', 'relative')).toBe('Tuesday')
    expect(formatDate('2026-08-14', 'relative')).toBe('Aug 14')
    expect(formatDate('2025-08-14', 'relative')).toBe('Aug 14, 2025')
  })
})

describe('pctChange', () => {
  it('computes percentage change', () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(50, 100)).toBe(-50)
  })
  it('returns null when there is no baseline', () => {
    expect(pctChange(100, 0)).toBeNull()
  })
})
