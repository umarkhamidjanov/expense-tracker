export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', label: 'Euro', locale: 'de-DE' },
  { code: 'GBP', label: 'British Pound', locale: 'en-GB' },
  { code: 'JPY', label: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'INR', label: 'Indian Rupee', locale: 'en-IN' },
  { code: 'CAD', label: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', label: 'Australian Dollar', locale: 'en-AU' },
  // Shown by its code ("UZS 1,250,000"): browsers ship different Uzbek locale data (Chrome has
  // none), so a fixed English format is the only way to look the same everywhere.
  { code: 'UZS', label: 'Uzbekistani Som (soʻm)', locale: 'en-US', display: 'code' },
]

// Currencies shown without decimals (yen has no minor unit; tiyin aren't used in practice).
const ZERO_DECIMAL = new Set(['JPY', 'UZS'])
export const currencyDecimals = (currency) => (ZERO_DECIMAL.has(currency) ? 0 : 2)

// Largest amount a single transaction may have. UZS amounts are large (about 12,500 soʻm
// to the dollar), so it gets a higher cap; the database column allows up to 9,999,999,999.99.
export const maxAmount = (currency) => (currency === 'UZS' ? 9_999_999_999 : 10_000_000)

const cache = new Map()
function formatter(currency, compact) {
  const key = `${currency}|${compact}`
  if (!cache.has(key)) {
    const info = CURRENCIES.find((c) => c.code === currency)
    const locale = info?.locale || 'en-US'
    cache.set(
      key,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: info?.display || 'symbol',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : currencyDecimals(currency),
        minimumFractionDigits: compact ? 0 : currencyDecimals(currency),
      }),
    )
  }
  return cache.get(key)
}

// The currency sign as the app displays it ("$", "€", "UZS"), e.g. for the amount field.
export function currencySymbol(currency) {
  return formatter(currency, false).formatToParts(0).find((p) => p.type === 'currency')?.value || currency
}

export function formatMoney(value, currency = 'USD', { compact = false } = {}) {
  return formatter(currency, compact).format(value || 0)
}

const pad = (n) => String(n).padStart(2, '0')

export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function monthKey(s) {
  return s.slice(0, 7)
}

export function monthLabel(key, style = 'short') {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' })
}

export function lastNMonths(n, from = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }
  return out
}

export function formatDate(s, style = 'medium') {
  const d = parseISODate(s)
  if (style === 'relative') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.round((today - d) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function pctChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
