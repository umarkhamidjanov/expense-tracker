// Spending assistant: a local, rule-based analysis of the user's transactions.
// Everything is computed in the browser from existing data; nothing is sent anywhere.
import { getCategory } from '../data/categories'
import { formatMoney, lastNMonths, monthLabel, toISODate } from './format'
import { inMonth, throughDay, totals } from './stats'

const TIPS = {
  food: 'Try reducing restaurant/delivery spending and cooking at home more often.',
  shopping: 'Try a 48-hour wait before non-essential purchases, and unsubscribe from store promo emails.',
  transport: 'Batch errands into fewer trips and compare ride-hailing with public transport or a monthly pass.',
  entertainment: 'Set a monthly fun budget and look for free or discounted events.',
  subscriptions: 'Review your subscriptions and cancel the ones you rarely use.',
  travel: 'Book further ahead and set a trip budget before you go.',
}
const GENERIC_TIP = 'Look through these purchases and see which ones were essential.'

// Categories people can usually cut back on (rent, utilities etc. are fixed).
const FLEXIBLE = ['food', 'shopping', 'transport', 'entertainment', 'subscriptions', 'travel', 'other']

// How much above "usual" counts as unusually high. The amount thresholds are in dollar-sized
// units; UZS amounts are about 12,500× larger, so they're scaled to match.
const HIGH_RATIO = 1.3
const MIN_EXCESS = 25
const NEW_CATEGORY_MIN = 50
const AMOUNT_SCALE = { UZS: 12_500 }
const scaleFor = (currency) => AMOUNT_SCALE[currency] || 1

const KEYWORDS = {
  food: ['food', 'dining', 'restaurant', 'eat', 'grocer', 'coffee', 'delivery', 'lunch', 'dinner', 'takeout', 'takeaway'],
  shopping: ['shopping', 'shop', 'amazon', 'clothes', 'clothing'],
  transport: ['transport', 'uber', 'lyft', 'taxi', 'gas', 'fuel', 'petrol', 'car', 'commute', 'metro', 'parking', 'train', 'bus'],
  entertainment: ['entertainment', 'movie', 'cinema', 'concert', 'game', 'fun', 'netflix night'],
  subscriptions: ['subscription', 'netflix', 'spotify', 'icloud'],
  housing: ['rent', 'housing', 'mortgage'],
  utilities: ['utilit', 'electric', 'water bill', 'internet'],
  health: ['health', 'gym', 'pharmacy', 'doctor', 'dental'],
  travel: ['travel', 'flight', 'hotel', 'trip', 'holiday', 'vacation'],
  education: ['education', 'course', 'class', 'tuition'],
}

const sum = (list) => list.reduce((s, t) => s + t.amount, 0)
const byCat = (list) => list.reduce((m, t) => ((m[t.category] = (m[t.category] || 0) + t.amount), m), {})
const catName = (id) => getCategory(id).name
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null)

// Everything the insights and answers need, computed once.
export function analyze(transactions, today = new Date(), currency = 'USD') {
  const todayISO = toISODate(today)
  const day = today.getDate()
  const [m3, m2, m1, cur] = lastNMonths(4, today)
  const past = transactions.filter((t) => t.date <= todayISO)
  const expenses = past.filter((t) => t.type === 'expense')

  const mtd = inMonth(expenses, cur)
  const lastSame = throughDay(inMonth(expenses, m1), day)
  // "Usual" = average of the same days in recent months that have any data.
  const history = [m1, m2, m3].filter((k) => inMonth(expenses, k).length).map((k) => throughDay(inMonth(expenses, k), day))
  const usual = {}
  for (const list of history) for (const [c, v] of Object.entries(byCat(list))) usual[c] = (usual[c] || 0) + v / history.length

  const current = byCat(mtd)
  const categories = Object.keys({ ...current, ...usual }).map((id) => {
    const spent = current[id] || 0
    const base = usual[id] || 0
    const items = mtd.filter((t) => t.category === id).sort((a, b) => b.amount - a.amount)
    const k = scaleFor(currency)
    const high = history.length > 0 && spent - base >= MIN_EXCESS * k && (base > 0 ? spent >= base * HIGH_RATIO : spent >= NEW_CATEGORY_MIN * k)
    return { id, name: catName(id), spent, usual: base, excess: spent - base, items, high, flexible: FLEXIBLE.includes(id) }
  })

  const monthIncome = totals(inMonth(past, cur)).income
  return {
    today,
    day,
    cur,
    prev: m1,
    hasHistory: history.length > 0,
    mtd,
    mtdTotal: sum(mtd),
    lastSameTotal: sum(lastSame),
    lastFullTotal: sum(inMonth(expenses, m1)),
    usualTotal: history.length ? history.reduce((s, l) => s + sum(l), 0) / history.length : 0,
    monthIncome,
    categories: categories.sort((a, b) => b.spent - a.spent),
    expenses,
  }
}

const period = (a) => `${monthLabel(a.cur)} 1${a.day > 1 ? `–${a.day}` : ''}`
const topItems = (items, cur, n = 2) =>
  items
    .slice(0, n)
    .map((t) => `${t.name} (${formatMoney(t.amount, cur)})`)
    .join(', ')

// Short dashboard insights, most important first.
export function getInsights(transactions, currency = 'USD', today = new Date()) {
  const a = analyze(transactions, today, currency)
  const money = (v) => formatMoney(v, currency)
  const insights = []

  if (!a.expenses.length) {
    return [{ id: 'empty', tone: 'info', title: 'Nothing to analyze yet', text: 'Add a few expenses and I’ll start spotting patterns in your spending.' }]
  }

  // Total spending vs the same days last month.
  const change = pct(a.mtdTotal, a.lastSameTotal)
  if (change !== null && change >= 10) {
    const drivers = a.categories
      .filter((c) => c.spent - (c.usual || 0) > 0)
      .sort((x, y) => y.excess - x.excess)
      .slice(0, 2)
      .map((c) => c.name)
    insights.push({
      id: 'total-up',
      tone: 'warn',
      title: `Spending is up ${change}% vs last month`,
      text: `You’ve spent ${money(a.mtdTotal)} so far (${period(a)}), compared with ${money(a.lastSameTotal)} over the same days last month.${drivers.length ? ` Most of the increase is in ${drivers.join(' and ')}.` : ''}`,
    })
  } else if (change !== null && change <= -10) {
    insights.push({
      id: 'total-down',
      tone: 'good',
      title: `Spending is down ${Math.abs(change)}% vs last month`,
      text: `You’ve spent ${money(a.mtdTotal)} so far (${period(a)}), compared with ${money(a.lastSameTotal)} over the same days last month. Nice work.`,
    })
  }

  // Categories that are unusually high, focusing on everyday spending first.
  const high = a.categories.filter((c) => c.high).sort((x, y) => Number(y.flexible) - Number(x.flexible) || y.excess - x.excess)
  for (const c of high.slice(0, 3)) {
    const times = c.usual > 0 ? `${(c.spent / c.usual).toFixed(1)}× your usual ${money(c.usual)} for these days` : `with almost no ${c.name} spending in recent months`
    insights.push({
      id: `high-${c.id}`,
      tone: 'warn',
      category: c.id,
      title: `You spent significantly more on ${c.name} this month`,
      text: `${money(c.spent)} so far (${period(a)}), ${times}.${c.items.length ? ` Biggest: ${topItems(c.items, currency)}.` : ''} ${TIPS[c.id] || GENERIC_TIP}`,
    })
  }

  if (!insights.length) {
    const top = a.categories.find((c) => c.spent > 0)
    insights.push({
      id: 'on-track',
      tone: 'good',
      title: 'Your spending looks on track',
      text: a.hasHistory
        ? `No category is unusually high compared with your recent months.${top ? ` Your biggest category so far is ${top.name} at ${money(top.spent)}.` : ''}`
        : 'Once you have a month or two of history, I’ll compare your spending against your usual pattern.',
    })
  }
  return insights
}

export const SUGGESTED_QUESTIONS = ['Where can I save money?', 'What did I spend the most on?', 'Why are my expenses high this month?']

// Keywords match whole words plus common endings ("restaurants", "groceries", "shopping"),
// never part of another word (so "weather" isn't "eat" and "card" isn't "car").
function detectCategory(q) {
  for (const [id, words] of Object.entries(KEYWORDS)) if (words.some((w) => new RegExp('\\b' + w + '(s|es|ies|ing|ping|ped|ity|y)?\\b').test(q))) return id
  return null
}

// Answers a free-text question from the user's own transactions. Returns { text, bullets }.
export function answerQuestion(question, transactions, currency = 'USD', today = new Date()) {
  const q = question.toLowerCase().trim()
  const a = analyze(transactions, today, currency)
  const money = (v) => formatMoney(v, currency)

  if (!a.expenses.length) {
    return { text: 'I don’t see any expenses yet. Add some transactions (or load the sample data in Settings) and ask me again.', bullets: [] }
  }

  const spent = a.categories.filter((c) => c.spent > 0)
  const category = detectCategory(q)

  // A specific category, e.g. "How much did I spend on food?"
  if (category && !/save|cut|reduce/.test(q)) {
    const c = a.categories.find((x) => x.id === category)
    const name = catName(category)
    if (!c || c.spent === 0) {
      const last = a.expenses.filter((t) => t.category === category && t.date.startsWith(a.prev))
      return { text: `You haven’t spent anything on ${name} so far this month.${last.length ? ` Last month it was ${money(sum(last))}.` : ''}`, bullets: [] }
    }
    const bullets = c.items.slice(0, 3).map((t) => `${t.name}: ${money(t.amount)}`)
    const compare = c.usual > 0 ? ` That’s ${c.spent >= c.usual ? `${pct(c.spent, c.usual)}% more` : `${Math.abs(pct(c.spent, c.usual))}% less`} than usual for the first ${a.day} days.` : ''
    return { text: `You’ve spent ${money(c.spent)} on ${name} so far this month (${c.items.length} transaction${c.items.length === 1 ? '' : 's'}).${compare}${c.high ? ` ${TIPS[category] || GENERIC_TIP}` : ''}`, bullets }
  }

  // "Why are my expenses high?"
  if (/why|high|increase|more than|went up|so much/.test(q)) {
    const change = pct(a.mtdTotal, a.lastSameTotal)
    const risers = a.categories.filter((c) => c.excess > 0).sort((x, y) => y.excess - x.excess).slice(0, 3)
    const big = a.mtd.filter((t) => FLEXIBLE.includes(t.category)).sort((x, y) => y.amount - x.amount)[0]
    const bullets = risers.map((c) => `${c.name}: ${money(c.spent)} vs usual ${money(c.usual)} (+${money(c.excess)})`)
    if (big) bullets.push(`Largest flexible expense: ${big.name}, ${money(big.amount)} (${catName(big.category)})`)
    const lead =
      change === null
        ? `You’ve spent ${money(a.mtdTotal)} so far this month.`
        : change > 0
          ? `You’ve spent ${money(a.mtdTotal)} so far (${period(a)}), ${change}% more than the ${money(a.lastSameTotal)} you’d spent by this point last month.`
          : `Actually, your spending is ${change === 0 ? 'the same as' : `${Math.abs(change)}% lower than`} the same days last month (${money(a.mtdTotal)} vs ${money(a.lastSameTotal)}).`
    return { text: `${lead}${risers.length ? ' Here’s what’s driving it:' : ''}`, bullets }
  }

  // "Where can I save money?"
  if (/save|saving|cut|reduce|cheaper|spend less|lower/.test(q)) {
    const flexible = spent.filter((c) => c.flexible).sort((x, y) => (y.high - x.high) || y.spent - x.spent).slice(0, 3)
    if (!flexible.length) return { text: 'Most of your spending this month is fixed costs like rent and bills, so there isn’t much to trim right now.', bullets: [] }
    const potential = flexible.reduce((s, c) => s + c.spent * 0.2, 0)
    const bullets = flexible.map((c) => `${c.name} (${money(c.spent)} so far${c.high ? ', higher than usual' : ''}): ${TIPS[c.id] || GENERIC_TIP}`)
    const subs = a.expenses.filter((t) => t.category === 'subscriptions' && t.date.startsWith(a.prev))
    if (subs.length) bullets.push(`Subscriptions cost you ${money(sum(subs))} last month. Cancelling one you don’t use is an easy win.`)
    return { text: `Your best opportunities are in flexible spending. Cutting these by 20% would save about ${money(potential)} so far this month:`, bullets }
  }

  // "What did I spend the most on?"
  if (/most|biggest|largest|top|highest|main/.test(q)) {
    const top = spent.slice(0, 3)
    const big = [...a.mtd].sort((x, y) => y.amount - x.amount)[0]
    const bullets = top.map((c, i) => `${i + 1}. ${c.name}: ${money(c.spent)} (${Math.round((c.spent / a.mtdTotal) * 100)}%)`)
    if (big) bullets.push(`Biggest single purchase: ${big.name}, ${money(big.amount)}`)
    return { text: top.length ? `So far this month your biggest category is ${top[0].name}. Your top categories:` : 'No spending yet this month.', bullets }
  }

  // Budget questions
  if (/budget|limit|on track/.test(q)) {
    const daysInMonth = new Date(a.today.getFullYear(), a.today.getMonth() + 1, 0).getDate()
    const projected = (a.mtdTotal / a.day) * daysInMonth
    return { text: `At your current pace you’ll spend about ${money(projected)} this month (${money(a.mtdTotal)} in the first ${a.day} days). Last month you spent ${money(a.lastFullTotal)} in total.`, bullets: [] }
  }

  // Summary
  if (/summary|overview|how am i|how's|how is|doing|this month/.test(q)) {
    const bullets = [`Spent: ${money(a.mtdTotal)}`, `Income: ${money(a.monthIncome)}`, `Net: ${money(a.monthIncome - a.mtdTotal)}`]
    if (spent[0]) bullets.push(`Top category: ${spent[0].name} (${money(spent[0].spent)})`)
    return { text: `Here’s your month so far (${period(a)}):`, bullets }
  }

  return {
    text: 'I can answer questions about your own spending. Try asking where you can save money, what you spent the most on, why your expenses are high, or about a category like food or transport.',
    bullets: [],
  }
}

