// Generates ~6 months of realistic, deterministic demo transactions ending today.

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const VARIABLE = [
  { category: 'food', perMonth: [9, 14], range: [8, 68], labels: ['Whole Foods Market', 'Trader Joe’s', 'Blue Bottle Coffee', 'Sushi Nakazawa', 'Chipotle', 'Farmers market', 'Thai Basil', 'Sweetgreen', 'Uber Eats', 'Corner bakery'] },
  { category: 'transport', perMonth: [4, 7], range: [6, 58], labels: ['Uber ride', 'Shell gas station', 'Metro card top-up', 'Lyft ride', 'Parking garage', 'Car wash'] },
  { category: 'shopping', perMonth: [2, 5], range: [18, 210], labels: ['Amazon order', 'Uniqlo', 'Apple Store', 'IKEA', 'Target', 'Nike', 'Muji'] },
  { category: 'entertainment', perMonth: [2, 4], range: [12, 95], labels: ['Cinema tickets', 'Concert tickets', 'Steam game', 'Bowling night', 'Museum entry', 'Comedy club'] },
  { category: 'health', perMonth: [1, 3], range: [15, 120], labels: ['Pharmacy', 'Dental check-up', 'Yoga class pack', 'Vitamins', 'Physio session'] },
  { category: 'other', perMonth: [0, 2], range: [10, 60], labels: ['Dry cleaning', 'Post office', 'Haircut', 'Charity donation'] },
]

const FIXED = [
  { category: 'housing', day: 1, amount: 1650, name: 'Monthly rent' },
  { category: 'utilities', day: 6, amount: [92, 148], name: 'Electricity & water' },
  { category: 'utilities', day: 9, amount: 59.99, name: 'Fiber internet' },
  { category: 'subscriptions', day: 12, amount: 15.49, name: 'Netflix' },
  { category: 'subscriptions', day: 14, amount: 10.99, name: 'Spotify Premium' },
  { category: 'subscriptions', day: 18, amount: 2.99, name: 'iCloud storage' },
  { category: 'health', day: 3, amount: 49, name: 'Gym membership' },
  { category: 'transport', day: 20, amount: 135, name: 'Car insurance' },
]

export function generateDemoData(today = new Date()) {
  const rand = mulberry32(20261003)
  const between = (a, b) => a + rand() * (b - a)
  const int = (a, b) => Math.floor(between(a, b + 1))
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const money = (n) => Math.round(n * 100) / 100

  const txs = []
  let id = 0
  const push = (date, t) => {
    if (date > today) return
    txs.push({ id: `demo-${++id}`, date: iso(date), createdAt: date.getTime(), ...t })
  }

  for (let m = 5; m >= 0; m--) {
    const first = new Date(today.getFullYear(), today.getMonth() - m, 1)
    const y = first.getFullYear()
    const mo = first.getMonth()
    const daysInMonth = new Date(y, mo + 1, 0).getDate()
    const day = (d) => new Date(y, mo, Math.min(d, daysInMonth))

    push(day(1), { type: 'income', category: 'salary', amount: 5400, name: 'Salary — Northwind Labs' })
    push(day(15), { type: 'income', category: 'salary', amount: 5400, name: 'Salary — Northwind Labs' })
    if (rand() > 0.3)
      push(day(int(8, 26)), { type: 'income', category: 'freelance', amount: money(between(450, 1900)), name: pick(['Brand identity project', 'Landing page build', 'UX audit for client', 'Mobile app consult']) })
    if (rand() > 0.5)
      push(day(int(2, 27)), { type: 'income', category: 'investments', amount: money(between(60, 420)), name: pick(['ETF dividend', 'Stock dividend', 'Savings interest']) })
    if (m === 2)
      push(day(22), { type: 'income', category: 'gifts', amount: 250, name: 'Birthday gift from family', description: 'From Grandma and Grandpa' })

    for (const f of FIXED) {
      const amount = Array.isArray(f.amount) ? money(between(...f.amount)) : f.amount
      push(day(f.day), { type: 'expense', category: f.category, amount, name: f.name })
    }

    for (const v of VARIABLE) {
      const count = int(...v.perMonth)
      for (let i = 0; i < count; i++) {
        push(day(int(1, daysInMonth)), { type: 'expense', category: v.category, amount: money(between(...v.range)), name: pick(v.labels) })
      }
    }

    if (m === 3) push(day(10), { type: 'expense', category: 'travel', amount: 742.8, name: 'Flights to Lisbon', description: 'Round trip, 2 passengers' })
    if (m === 3) push(day(17), { type: 'expense', category: 'travel', amount: 515, name: 'Hotel — Alfama, 4 nights', description: 'Booked with free cancellation' })
    if (m === 1) push(day(5), { type: 'expense', category: 'education', amount: 189, name: 'Online design course', description: 'Advanced prototyping, lifetime access' })
    if (m === 0) push(day(Math.max(1, today.getDate() - 2)), { type: 'expense', category: 'travel', amount: 236.4, name: 'Weekend train tickets' })
  }

  return txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
}
