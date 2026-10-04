import { describe, expect, it } from 'vitest'
import { answerQuestion, getInsights } from '../utils/assistant'

const TODAY = new Date(2026, 9, 4, 12) // Oct 4
let n = 0
const tx = (date, category, amount, name = category, type = 'expense') => ({ id: `t${++n}`, type, name, amount, category, date, description: '', createdAt: n })

// Jul–Sep: the same steady pattern in the first days of each month.
const history = ['2026-07', '2026-08', '2026-09'].flatMap((m) => [
  tx(`${m}-01`, 'housing', 1500, 'Rent'),
  tx(`${m}-02`, 'food', 20, 'Groceries'),
  tx(`${m}-03`, 'transport', 15, 'Metro'),
  tx(`${m}-01`, 'salary', 5000, 'Salary', 'income'),
  tx(`${m}-12`, 'subscriptions', 15.49, 'Netflix'),
])

// October so far: food far above usual, new shopping spend.
const october = [
  tx('2026-10-01', 'housing', 1500, 'Rent'),
  tx('2026-10-02', 'food', 64, 'Sushi Nakazawa'),
  tx('2026-10-03', 'food', 41, 'Uber Eats'),
  tx('2026-10-04', 'food', 30, 'Groceries'),
  tx('2026-10-03', 'transport', 15, 'Metro'),
  tx('2026-10-02', 'shopping', 200, 'Amazon order'),
  tx('2026-10-01', 'salary', 5000, 'Salary', 'income'),
  tx('2026-10-20', 'food', 999, 'Future-dated dinner'), // after today: ignored
]
const data = [...history, ...october]

describe('getInsights', () => {
  const insights = getInsights(data, 'USD', TODAY)

  it('flags total spending that is higher than the same days last month', () => {
    const total = insights.find((i) => i.id === 'total-up')
    expect(total.title).toBe('Spending is up 21% vs last month')
    expect(total.text).toContain('$1,850.00 so far (Oct 1–4)')
    expect(total.text).toContain('$1,535.00')
  })

  it('flags unusually high food spending with a personalized tip', () => {
    const food = insights.find((i) => i.category === 'food')
    expect(food.title).toBe('You spent significantly more on Food & Dining this month')
    expect(food.text).toContain('$135.00 so far (Oct 1–4), 6.8× your usual $20.00 for these days')
    expect(food.text).toContain('Sushi Nakazawa ($64.00)')
    expect(food.text).toContain('cooking at home more often')
    expect(food.text).not.toContain('Future-dated')
  })

  it('flags new spending in a category with no recent history', () => {
    expect(insights.find((i) => i.category === 'shopping').text).toContain('with almost no Shopping spending in recent months')
  })

  it('does not flag categories at their usual level', () => {
    expect(insights.some((i) => i.category === 'transport' || i.category === 'housing')).toBe(false)
  })

  it('reports good news when nothing is unusual', () => {
    const steady = [...history, tx('2026-10-01', 'housing', 1500, 'Rent'), tx('2026-10-02', 'food', 22, 'Groceries'), tx('2026-10-03', 'transport', 15, 'Metro')]
    const [only] = getInsights(steady, 'USD', TODAY)
    expect(only).toMatchObject({ id: 'on-track', tone: 'good' })
    expect(only.text).toContain('Housing')
  })

  it('handles an account with no expenses', () => {
    expect(getInsights([], 'USD', TODAY)[0].id).toBe('empty')
  })

  it('uses the chosen currency', () => {
    expect(getInsights(data, 'EUR', TODAY)[0].text).toContain('€')
  })
})

describe('answerQuestion', () => {
  const ask = (q) => answerQuestion(q, data, 'USD', TODAY)

  it('answers "Where can I save money?" with flexible categories and an estimate', () => {
    const a = ask('Where can I save money?')
    expect(a.text).toMatch(/save about \$70\.00/) // 20% of food 135 + shopping 200 + transport 15
    expect(a.bullets[0]).toMatch(/^(Food & Dining|Shopping)/)
    expect(a.bullets.join(' ')).not.toContain('Housing')
    expect(a.bullets.at(-1)).toContain('Subscriptions cost you $15.49 last month')
  })

  it('answers "What did I spend the most on?"', () => {
    const a = ask('What did I spend the most on?')
    expect(a.text).toContain('biggest category is Housing')
    expect(a.bullets[0]).toBe('1. Housing: $1,500.00 (81%)')
    expect(a.bullets.at(-1)).toBe('Biggest single purchase: Rent, $1,500.00')
  })

  it('answers "Why are my expenses high this month?" with the drivers', () => {
    const a = ask('Why are my expenses high this month?')
    expect(a.text).toContain('21% more than the $1,535.00')
    expect(a.bullets[0]).toBe('Shopping: $200.00 vs usual $0.00 (+$200.00)')
    expect(a.bullets[1]).toBe('Food & Dining: $135.00 vs usual $20.00 (+$115.00)')
    expect(a.bullets.at(-1)).toBe('Largest flexible expense: Amazon order, $200.00 (Shopping)')
  })

  it('answers questions about a specific category', () => {
    const a = ask('How much did I spend on restaurants?')
    expect(a.text).toContain('$135.00 on Food & Dining so far this month (3 transactions)')
    expect(a.text).toContain('575% more than usual')
    expect(a.bullets[0]).toBe('Sushi Nakazawa: $64.00')
  })

  it('answers budget and summary questions', () => {
    expect(ask('Am I on track with my budget?').text).toContain('At your current pace')
    expect(ask('Give me a summary').bullets).toContain('Net: $3,150.00')
  })

  it('explains what it can do for unrelated questions', () => {
    expect(ask('What is the weather?').text).toMatch(/I can answer questions about your own spending/)
    expect(ask('Did I use my credit card?').text).toMatch(/I can answer questions about your own spending/)
  })

  it('handles an account with no expenses', () => {
    expect(answerQuestion('Where can I save money?', [], 'USD', TODAY).text).toMatch(/don’t see any expenses yet/)
  })
})
