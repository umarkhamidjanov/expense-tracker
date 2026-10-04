import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { generateDemoData } from '../data/demoData'
import { inMonth, totals } from '../utils/stats'
import { ALICE, mobileNav, money, renderRoot, stat, titles, waitForDashboard } from './helpers'

const TODAY = new Date(2026, 9, 3, 12)
const PROFILE = { openingBalance: 8420, monthlyBudget: 4200 }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
})
afterEach(() => vi.useRealTimers())

// A signed-in user whose account already holds the demo dataset.
async function renderWithData() {
  const ctx = renderRoot({ transactions: generateDemoData(TODAY), profile: PROFILE })
  await waitForDashboard()
  return ctx
}

const budgetSpent = () => money(document.querySelector('.budget__spent').textContent)
const donutTotal = () => money(document.querySelector('.donut__value').textContent)
const dialog = () => screen.getByRole('dialog')

async function addTransaction(user, { type = 'expense', amount, name, category, description }) {
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))
  const d = dialog()
  if (type === 'income') await user.click(within(d).getByRole('radio', { name: /Income/ }))
  await user.type(within(d).getByPlaceholderText('0.00'), String(amount))
  await user.type(within(d).getByPlaceholderText(/^e\.g\./), name)
  if (category) await user.click(within(d).getByRole('radio', { name: category }))
  if (description) await user.type(within(d).getByPlaceholderText(/Add a note/), description)
  await user.click(within(d).getByRole('button', { name: type === 'income' ? 'Add income' : 'Add expense' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

describe('Dashboard', () => {
  it('shows totals computed from the account data', async () => {
    await renderWithData()
    const all = totals(generateDemoData(TODAY))
    const month = totals(inMonth(generateDemoData(TODAY), '2026-10'))
    expect(stat('Total balance')).toBeCloseTo(PROFILE.openingBalance + all.savings, 2)
    expect(stat('Total income')).toBeCloseTo(month.income, 2)
    expect(stat('Total expenses')).toBeCloseTo(month.expense, 2)
    expect(stat('Savings')).toBeCloseTo(month.savings, 2)
    expect(budgetSpent()).toBeCloseTo(month.expense, 2)
    expect(titles()).toHaveLength(6)
    expect(screen.getByRole('heading', { name: /Alice/ })).toBeTruthy()
  })
})

describe('AI Spending Assistant', () => {
  it('shows automatic insights on the dashboard', async () => {
    await renderWithData()
    const card = screen.getByRole('region', { name: /AI Spending Assistant/ })
    expect(within(card).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('answers questions in the Ask AI chat from the account data', async () => {
    const { user } = await renderWithData()
    const card = screen.getByRole('region', { name: /AI Spending Assistant/ })
    await user.click(within(card).getByRole('button', { name: /Ask AI/ }))
    await user.click(within(card).getByRole('button', { name: 'What did I spend the most on?' }))
    expect(await within(card).findByText(/your biggest category is/, {}, { timeout: 2000 })).toBeTruthy()

    await user.type(within(card).getByRole('textbox', { name: /Ask a question/ }), 'How much did I spend on food?')
    await user.click(within(card).getByRole('button', { name: 'Send' }))
    expect(await within(card).findByText(/on Food & Dining so far this month/, {}, { timeout: 2000 })).toBeTruthy()
  })

  it('sends typed messages to the AI with the user’s session and spending summary', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ reply: 'Hi Alice! Housing is your biggest cost.\n- Review subscriptions monthly' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { user } = await renderWithData()
    const card = screen.getByRole('region', { name: /AI Spending Assistant/ })
    await user.click(within(card).getByRole('button', { name: /Ask AI/ }))

    // The suggested questions still answer instantly, locally, without calling the server.
    await user.click(within(card).getByRole('button', { name: 'What did I spend the most on?' }))
    expect(await within(card).findByText(/your biggest category is/, {}, { timeout: 2000 })).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.type(within(card).getByRole('textbox', { name: /Ask a question/ }), 'Hi, how are you?')
    await user.click(within(card).getByRole('button', { name: 'Send' }))
    expect(await within(card).findByText(/Hi Alice! Housing is your biggest cost/)).toBeTruthy()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/chat')
    expect(init.headers.Authorization).toBe(`Bearer token-${ALICE.id}`)
    const body = JSON.parse(init.body)
    expect(body.message).toBe('Hi, how are you?')
    expect(body.summary).toContain('Currency: USD')
    expect(body.summary).toContain('By category this month')
    expect(body.summary).toContain('Monthly budget: $4,200.00')
    // Earlier messages (including the instant answer) go along as context.
    expect(body.history.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(body.history[1].text).toContain('your biggest category is')
    vi.unstubAllGlobals()
  })

  it('falls back to the local answer when the AI is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'not_configured' }), { status: 503 })))
    const { user } = await renderWithData()
    const card = screen.getByRole('region', { name: /AI Spending Assistant/ })
    await user.click(within(card).getByRole('button', { name: /Ask AI/ }))
    await user.type(within(card).getByRole('textbox', { name: /Ask a question/ }), 'How much did I spend on food?')
    await user.click(within(card).getByRole('button', { name: 'Send' }))
    expect(await within(card).findByText(/The AI is unavailable right now/)).toBeTruthy()
    expect(within(card).getByText(/on Food & Dining so far this month/)).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('is hidden for an empty account', async () => {
    renderRoot({ transactions: [] })
    await waitForDashboard()
    expect(screen.queryByRole('region', { name: /AI Spending Assistant/ })).toBeNull()
  })
})

describe('Add transaction', () => {
  it('opens a form with every field', async () => {
    const { user } = await renderWithData()
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    const d = dialog()
    expect(within(d).getByRole('heading', { name: 'New transaction' })).toBeTruthy()
    expect(within(d).getByRole('radio', { name: /Expense/ })).toBeTruthy()
    expect(within(d).getByRole('radio', { name: /Income/ })).toBeTruthy()
    expect(within(d).getByPlaceholderText('0.00')).toBeTruthy()
    expect(within(d).getByPlaceholderText(/^e\.g\./)).toBeTruthy()
    expect(within(d).getAllByRole('radio').length).toBeGreaterThan(5)
    expect(d.querySelector('input[type="date"]').value).toBe('2026-10-03')
    expect(within(d).getByText('optional')).toBeTruthy()
  })

  it('validates required fields and saves nothing', async () => {
    const { user, repo } = await renderWithData()
    const before = repo.rowsFor(ALICE.id).length
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Add expense' }))
    expect(screen.getByText('Enter an amount greater than 0')).toBeTruthy()
    expect(screen.getByText('Give this transaction a name')).toBeTruthy()
    expect(repo.rowsFor(ALICE.id)).toHaveLength(before)
    expect(repo.calls).not.toContain('insert')
  })

  it('adds an expense, saves it to the account and updates every dashboard figure', async () => {
    const { user, repo } = await renderWithData()
    const b = { balance: stat('Total balance'), income: stat('Total income'), expense: stat('Total expenses'), savings: stat('Savings'), budget: budgetSpent(), donut: donutTotal() }

    await addTransaction(user, { amount: '123.45', name: 'Team dinner', category: 'Entertainment', description: 'With friends' })

    expect(screen.getByText('Expense added')).toBeTruthy()
    expect(stat('Total expenses')).toBeCloseTo(b.expense + 123.45, 2)
    expect(stat('Total balance')).toBeCloseTo(b.balance - 123.45, 2)
    expect(stat('Savings')).toBeCloseTo(b.savings - 123.45, 2)
    expect(stat('Total income')).toBeCloseTo(b.income, 2)
    expect(budgetSpent()).toBeCloseTo(b.budget + 123.45, 2)
    expect(donutTotal()).toBeCloseTo(b.donut + 123.45, 2)
    const entertainment = [...document.querySelectorAll('.breakdown__item')].find((li) => li.textContent.includes('Entertainment'))
    expect(money(entertainment.querySelector('.breakdown__value').textContent)).toBeCloseTo(123.45, 2)
    expect(titles()[0]).toBe('Team dinner')
    expect(document.querySelector('.tx-row__note').textContent).toBe('With friends')
    expect(repo.rowsFor(ALICE.id).find((t) => t.name === 'Team dinner')).toMatchObject({ type: 'expense', amount: 123.45, category: 'entertainment', description: 'With friends', date: '2026-10-03', isSample: false })
  })

  it('adds income', async () => {
    const { user } = await renderWithData()
    const income = stat('Total income')
    const balance = stat('Total balance')
    await addTransaction(user, { type: 'income', amount: '1000', name: 'Bonus', category: 'Freelance' })
    expect(stat('Total income')).toBeCloseTo(income + 1000, 2)
    expect(stat('Total balance')).toBeCloseTo(balance + 1000, 2)
    expect(screen.getByText('Income added')).toBeTruthy()
  })
})

describe('Edit and delete', () => {
  it('edits a transaction from its row', async () => {
    const { user, repo } = await renderWithData()
    await addTransaction(user, { amount: '50', name: 'Groceries', category: 'Food & Dining', description: 'Weekly shop' })
    const expense = stat('Total expenses')

    await user.click(screen.getByRole('button', { name: 'Edit Groceries' }))
    const d = dialog()
    expect(within(d).getByRole('heading', { name: 'Edit transaction' })).toBeTruthy()
    const amount = within(d).getByPlaceholderText('0.00')
    expect(amount.value).toBe('50')
    expect(within(d).getByDisplayValue('Weekly shop')).toBeTruthy()
    await user.clear(amount)
    await user.type(amount, '80')
    const name = within(d).getByDisplayValue('Groceries')
    await user.clear(name)
    await user.type(name, 'Big grocery run')
    await user.click(within(d).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(stat('Total expenses')).toBeCloseTo(expense + 30, 2)
    expect(titles()).toContain('Big grocery run')
    expect(repo.rowsFor(ALICE.id).find((t) => t.name === 'Big grocery run').amount).toBe(80)
  })

  it('deletes from the edit form after confirming, and Undo restores it', async () => {
    const { user, repo } = await renderWithData()
    await addTransaction(user, { type: 'income', amount: '500', name: 'Side gig', category: 'Freelance' })
    const income = stat('Total income')

    await user.click(screen.getByRole('button', { name: 'Edit Side gig' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Delete transaction' }))
    expect(within(dialog()).getByText('Delete this transaction?')).toBeTruthy()
    await user.click(within(dialog()).getByRole('button', { name: 'Keep' }))
    expect(within(dialog()).getByRole('button', { name: 'Delete transaction' })).toBeTruthy()

    await user.click(within(dialog()).getByRole('button', { name: 'Delete transaction' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }))
    expect(stat('Total income')).toBeCloseTo(income - 500, 2)
    await waitFor(() => expect(repo.rowsFor(ALICE.id).some((t) => t.name === 'Side gig')).toBe(false))

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(stat('Total income')).toBeCloseTo(income, 2)
    await waitFor(() => expect(repo.rowsFor(ALICE.id).some((t) => t.name === 'Side gig')).toBe(true))
    expect(await screen.findByText('Transaction restored')).toBeTruthy()
  })

  it('deletes from the row trash button via the confirm dialog', async () => {
    const { user, repo } = await renderWithData()
    await addTransaction(user, { amount: '12', name: 'Parking', category: 'Transport' })
    await user.click(screen.getByRole('button', { name: 'Delete Parking' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete transaction?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(titles()).not.toContain('Parking')
    await waitFor(() => expect(repo.rowsFor(ALICE.id).some((t) => t.name === 'Parking')).toBe(false))
  })
})

describe('Navigation, search and settings', () => {
  it('switches pages from the mobile bottom navigation', async () => {
    const { user } = await renderWithData()
    await user.click(within(mobileNav()).getByRole('button', { name: 'Analytics' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeTruthy()
    expect(screen.getByText('Monthly statistics')).toBeTruthy()
    expect(within(mobileNav()).getByRole('button', { name: 'Analytics' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
  })

  it('searches transactions by name and by description', async () => {
    const { user } = await renderWithData()
    await addTransaction(user, { amount: '20', name: 'Bookshop', category: 'Shopping', description: 'Gift for ZQX' })
    await user.click(within(mobileNav()).getByRole('button', { name: 'Transactions' }))
    const search = screen.getByRole('textbox', { name: 'Search transactions' })
    await user.type(search, 'zqx')
    await waitFor(() => expect(titles()).toEqual(['Bookshop']))
    await user.clear(search)
    await user.type(search, 'bookshop')
    await waitFor(() => expect(titles()).toEqual(['Bookshop']))
  })

  it('keeps the theme on this device only', async () => {
    const { user, repo } = await renderWithData()
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('lumen.theme')).toBe('light')
    expect(repo.profileFor(ALICE.id)).not.toHaveProperty('theme')
  })

  it('supports Uzbekistani som across adding, editing, Dashboard, Analytics and the AI assistant', async () => {
    const { user, repo } = await renderWithData()
    const plain = (el) => el.textContent.replace(/\s/g, ' ')
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    const select = screen.getByRole('combobox', { name: 'Currency' })
    expect(within(select).getByRole('option', { name: 'UZS — Uzbekistani Som (soʻm)' })).toBeTruthy()
    await user.selectOptions(select, 'UZS')
    await waitFor(() => expect(repo.profileFor(ALICE.id).currency).toBe('UZS'))

    // Add a large so'm expense (above the 10,000,000 cap that applies to other currencies).
    await user.click(within(mobileNav()).getByRole('button', { name: 'Dashboard' }))
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    let d = dialog()
    expect(d.querySelector('.amount-input__symbol').textContent).toBe('UZS')
    await user.type(within(d).getByPlaceholderText('0'), '12500000')
    await user.type(within(d).getByPlaceholderText(/^e\.g\./), 'Monthly rent UZ')
    await user.click(within(d).getByRole('radio', { name: 'Housing' }))
    await user.click(within(d).getByRole('button', { name: 'Add expense' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.rowsFor(ALICE.id).find((t) => t.name === 'Monthly rent UZ').amount).toBe(12_500_000)
    const row = screen.getByText('Monthly rent UZ').closest('.tx-row')
    expect(plain(row.querySelector('.tx-row__amount'))).toBe('−UZS 12,500,000')

    // Edit it.
    await user.click(screen.getByRole('button', { name: 'Edit Monthly rent UZ' }))
    d = dialog()
    const amount = within(d).getByPlaceholderText('0')
    await user.clear(amount)
    await user.type(amount, '9800000')
    await user.click(within(d).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(repo.rowsFor(ALICE.id).find((t) => t.name === 'Monthly rent UZ').amount).toBe(9_800_000)

    // Dashboard figures and the AI assistant use so'm.
    const balance = screen.getByText('Total balance', { selector: '.stat-card__label' }).closest('.stat-card')
    expect(plain(balance)).toMatch(/UZS \d/)
    expect(plain(screen.getByRole('region', { name: /AI Spending Assistant/ }))).toMatch(/UZS \d/)
    expect(document.body.textContent).not.toMatch(/\$\d/)

    // Analytics too.
    await user.click(within(mobileNav()).getByRole('button', { name: 'Analytics' }))
    expect(plain(document.querySelector('.kpi__value'))).toMatch(/^UZS \d/)
    expect(document.body.textContent).not.toMatch(/\$\d/)
  })

  it('still caps other currencies at 10,000,000 per transaction', async () => {
    const { user } = await renderWithData()
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    const d = dialog()
    await user.type(within(d).getByPlaceholderText('0.00'), '12500000')
    await user.type(within(d).getByPlaceholderText(/^e\.g\./), 'Too big')
    await user.click(within(d).getByRole('button', { name: 'Add expense' }))
    expect(within(d).getByText('That amount looks too large')).toBeTruthy()
  })

  it('saves the currency to the account and re-formats amounts immediately', async () => {
    const { user, repo } = await renderWithData()
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Currency' }), 'EUR')
    await waitFor(() => expect(repo.profileFor(ALICE.id).currency).toBe('EUR'))
    await user.click(within(mobileNav()).getByRole('button', { name: 'Dashboard' }))
    expect(screen.getByText('Total balance', { selector: '.stat-card__label' }).closest('.stat-card').textContent).toContain('€')
  })
})
