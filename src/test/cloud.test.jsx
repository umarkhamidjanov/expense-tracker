import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within, waitFor } from '@testing-library/react'
import { ALICE, mobileNav, renderRoot, stat, titles, waitForDashboard } from './helpers'
import { createMemoryRepo } from './fakes'

const TODAY = new Date(2026, 9, 3, 12)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

const tx = (over) => ({ id: crypto.randomUUID(), type: 'expense', name: 'Lunch', amount: 12, category: 'food', date: '2026-10-02', description: '', isSample: false, createdAt: 1, ...over })

// Data saved by the pre-accounts version of the app.
const LEGACY_TXS = [
  { id: 'demo-1', type: 'income', category: 'salary', amount: 5400, name: 'Salary', description: '', date: '2026-10-01', createdAt: 1 },
  { id: 'demo-2', type: 'expense', category: 'housing', amount: 1650, name: 'Monthly rent', description: '', date: '2026-10-01', createdAt: 2 },
  { id: '9b2c5d1e-7f3a-4c2b-9e8d-1a2b3c4d5e6f', type: 'expense', category: 'food', amount: 23.5, name: 'Farmers market', description: 'Veg box', date: '2026-10-02', createdAt: 3 },
  { id: 'tx-legacy-x', type: 'expense', category: 'transport', amount: 9, description: 'Old format bus fare', date: '2026-10-02', createdAt: 4 },
]
const LEGACY_SETTINGS = { theme: 'light', currency: 'GBP', name: 'Alex Morgan', openingBalance: 1200, monthlyBudget: 900 }

function seedLegacy() {
  localStorage.setItem('lumen.transactions', JSON.stringify(LEGACY_TXS))
  localStorage.setItem('lumen.settings', JSON.stringify(LEGACY_SETTINGS))
  return { tx: localStorage.getItem('lumen.transactions'), settings: localStorage.getItem('lumen.settings') }
}

describe('Loading and errors', () => {
  it('shows a loading skeleton until the account data arrives', async () => {
    const { repo } = renderRoot({ transactions: [tx()] })
    const release = repo.hold()
    expect(await screen.findByLabelText('Loading your data')).toBeTruthy()
    await act(async () => release())
    await waitForDashboard()
    expect(screen.queryByLabelText('Loading your data')).toBeNull()
  })

  it('shows an error with a working retry when loading fails', async () => {
    const { user, repo } = renderRoot({ transactions: [tx({ name: 'Coffee' })] })
    repo.failing.add('list')
    expect(await screen.findByText("We couldn't load your data")).toBeTruthy()
    expect(screen.getByText(/Couldn't reach the server/)).toBeTruthy()
    repo.failing.delete('list')
    await user.click(screen.getByRole('button', { name: /Try again/ }))
    await waitForDashboard()
    expect(titles()).toContain('Coffee')
  })
})

describe('New accounts', () => {
  it('start empty, with no demo data, and offer to load sample data', async () => {
    const { user, repo } = renderRoot({ transactions: [] })
    await waitForDashboard()
    expect(repo.rowsFor(ALICE.id)).toHaveLength(0)
    expect(screen.getByText('Welcome to Lumen')).toBeTruthy()
    expect(stat('Total balance')).toBe(0)
    expect(screen.getByText('Set a monthly budget to track your spending against it.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Load sample data/ }))
    await waitFor(() => expect(repo.rowsFor(ALICE.id).length).toBeGreaterThan(100))
    expect(repo.rowsFor(ALICE.id).every((t) => t.isSample)).toBe(true)
    expect(screen.queryByText('Welcome to Lumen')).toBeNull()
    expect(document.querySelector('.sample-tag')?.textContent).toBe('Sample')
    expect(await screen.findByText(/Loaded \d+ sample transactions/)).toBeTruthy()
  })

  it('can remove sample data without touching real transactions', async () => {
    const { user, repo } = renderRoot({ transactions: [tx({ name: 'Real one' }), tx({ name: 'Sample one', isSample: true })] })
    await waitForDashboard()
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Remove sample data/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(repo.rowsFor(ALICE.id).map((t) => t.name)).toEqual(['Real one']))
  })

  it('creates the profile if the sign-up trigger did not', async () => {
    const { repo } = renderRoot({ transactions: [], profile: null })
    await waitForDashboard()
    expect(repo.profileFor(ALICE.id)).toMatchObject({ name: 'Alice Smith', currency: 'USD', openingBalance: 0, monthlyBudget: 0 })
  })
})

describe('Saving states and failures', () => {
  it('keeps the form open with the input and shows an error when saving fails', async () => {
    const { user, repo } = renderRoot({ transactions: [tx()] })
    await waitForDashboard()
    repo.failing.add('insert')
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    const d = screen.getByRole('dialog')
    await user.type(within(d).getByPlaceholderText('0.00'), '42')
    await user.type(within(d).getByPlaceholderText(/^e\.g\./), 'Concert')
    await user.click(within(d).getByRole('button', { name: 'Add expense' }))

    expect(await within(d).findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/Couldn't reach the server/))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(within(d).getByDisplayValue('Concert')).toBeTruthy()
    expect(titles()).not.toContain('Concert')

    repo.failing.delete('insert')
    await user.click(within(d).getByRole('button', { name: 'Add expense' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(titles()).toContain('Concert')
  })

  it('shows "Saving…" while a save is in flight', async () => {
    const { user, repo } = renderRoot({ transactions: [tx()] })
    await waitForDashboard()
    let release
    const original = repo.insertTransactions
    repo.insertTransactions = async (...args) => {
      await new Promise((r) => (release = r))
      return original(...args)
    }
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    const d = screen.getByRole('dialog')
    await user.type(within(d).getByPlaceholderText('0.00'), '5')
    await user.type(within(d).getByPlaceholderText(/^e\.g\./), 'Tea')
    await user.click(within(d).getByRole('button', { name: 'Add expense' }))
    expect(within(d).getByRole('button', { name: 'Saving…' }).disabled).toBe(true)
    expect(document.querySelector('.saving-pill.is-visible')).toBeTruthy()
    await act(async () => release())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.querySelector('.saving-pill.is-visible')).toBeNull()
  })

  it('rolls back a delete the server rejects', async () => {
    const { user, repo } = renderRoot({ transactions: [tx({ name: 'Keep me' })] })
    await waitForDashboard()
    repo.failing.add('delete')
    await user.click(screen.getByRole('button', { name: 'Delete Keep me' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Delete transaction?' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/Couldn't reach the server/)).toBeTruthy()
    expect(titles()).toContain('Keep me')
    expect(repo.rowsFor(ALICE.id)).toHaveLength(1)
  })

  it('reverts a setting the server rejects', async () => {
    const { user, repo } = renderRoot({ transactions: [] })
    await waitForDashboard()
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    repo.failing.add('profile')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Currency' }), 'JPY')
    expect(await screen.findByText(/Couldn't reach the server/)).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Currency' }).value).toBe('USD')
  })

  it('saves the display name on blur, not on every keystroke', async () => {
    const { user, repo } = renderRoot({ transactions: [] })
    await waitForDashboard()
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    const input = screen.getByRole('textbox', { name: 'Display name' })
    const before = repo.calls.filter((c) => c === 'profile').length
    await user.clear(input)
    await user.type(input, 'Ali')
    expect(repo.calls.filter((c) => c === 'profile').length).toBe(before)
    await user.tab()
    await waitFor(() => expect(repo.profileFor(ALICE.id).name).toBe('Ali'))
  })

  it('warns when the device goes offline and explains failed saves', async () => {
    renderRoot({ transactions: [] })
    await waitForDashboard()
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    act(() => window.dispatchEvent(new Event('offline')))
    expect(await screen.findByText(/You're offline/)).toBeTruthy()
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    act(() => window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(screen.queryByText(/You're offline/)).toBeNull())
  })
})

describe('Importing data saved before accounts', () => {
  it('offers the import once; imports own transactions and settings without touching local data', async () => {
    const original = seedLegacy()
    const { user, repo } = renderRoot({ transactions: [] })
    const d = await screen.findByRole('dialog', { name: 'Import data from this browser' })
    const own = within(d).getByRole('checkbox', { name: /Your transactions \(2\)/ })
    const sample = within(d).getByRole('checkbox', { name: /Sample transactions \(2\)/ })
    const settings = within(d).getByRole('checkbox', { name: /Settings/ })
    expect([own.checked, sample.checked, settings.checked]).toEqual([true, false, true])

    await user.click(within(d).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const rows = repo.rowsFor(ALICE.id)
    expect(rows.map((t) => t.name).sort()).toEqual(['Farmers market', 'Old format bus fare'])
    expect(rows.every((t) => /^[0-9a-f-]{36}$/.test(t.id) && !t.isSample)).toBe(true)
    expect(rows.find((t) => t.name === 'Farmers market').id).toBe('9b2c5d1e-7f3a-4c2b-9e8d-1a2b3c4d5e6f')
    expect(repo.profileFor(ALICE.id)).toMatchObject({ currency: 'GBP', name: 'Alex Morgan', openingBalance: 1200, monthlyBudget: 900 })
    expect(await screen.findByText('Imported 2 transactions')).toBeTruthy()

    // Local data is untouched, byte for byte.
    expect(localStorage.getItem('lumen.transactions')).toBe(original.tx)
    expect(localStorage.getItem('lumen.settings')).toBe(original.settings)
    expect(localStorage.getItem(`lumen.import.${ALICE.id}`)).toBe('imported')
  })

  it('can include sample data, which is labeled as sample', async () => {
    seedLegacy()
    const { user, repo } = renderRoot({ transactions: [] })
    const d = await screen.findByRole('dialog', { name: 'Import data from this browser' })
    await user.click(within(d).getByRole('checkbox', { name: /Sample transactions/ }))
    await user.click(within(d).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(repo.rowsFor(ALICE.id)).toHaveLength(4))
    expect(repo.rowsFor(ALICE.id).filter((t) => t.isSample).map((t) => t.name).sort()).toEqual(['Monthly rent', 'Salary'])
  })

  it('"Not now" keeps local data, stops asking, and leaves import available in Settings', async () => {
    const original = seedLegacy()
    const { user, repo, unmount } = renderRoot({ transactions: [] })
    const d = await screen.findByRole('dialog', { name: 'Import data from this browser' })
    await user.click(within(d).getByRole('button', { name: 'Not now' }))
    expect(repo.rowsFor(ALICE.id)).toHaveLength(0)
    expect(localStorage.getItem('lumen.transactions')).toBe(original.tx)
    unmount()

    const second = renderRoot({ repo })
    await waitForDashboard()
    expect(screen.queryByRole('dialog')).toBeNull()

    await second.user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    expect(screen.getByText(/Data saved here before you signed in: 4 transactions and settings/)).toBeTruthy()
    await second.user.click(screen.getByRole('button', { name: /Import…/ }))
    await second.user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(repo.rowsFor(ALICE.id)).toHaveLength(2))
  })

  it('shows an error and keeps the dialog open if the import fails', async () => {
    seedLegacy()
    const { user, repo } = renderRoot({ transactions: [] })
    const d = await screen.findByRole('dialog', { name: 'Import data from this browser' })
    repo.failing.add('insert')
    await user.click(within(d).getByRole('button', { name: 'Import' }))
    expect(await within(d).findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Import data from this browser' })).toBeTruthy()
    expect(localStorage.getItem(`lumen.import.${ALICE.id}`)).toBeNull()
  })

  it('deletes the local copy only after explicit confirmation, keeping the theme', async () => {
    const original = seedLegacy()
    localStorage.setItem(`lumen.import.${ALICE.id}`, 'imported')
    const { user } = renderRoot({ transactions: [] })
    await waitForDashboard()
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))

    await user.click(screen.getByRole('button', { name: /Delete local copy/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(localStorage.getItem('lumen.transactions')).toBe(original.tx)

    await user.click(screen.getByRole('button', { name: /Delete local copy/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete local copy' }))
    expect(localStorage.getItem('lumen.transactions')).toBeNull()
    expect(localStorage.getItem('lumen.settings')).toBeNull()
    expect(localStorage.getItem('lumen.theme')).toBe('light')
    expect(screen.queryByText(/Data saved here before you signed in/)).toBeNull()
  })

  it('never writes to the old local data during normal use', async () => {
    const original = seedLegacy()
    localStorage.setItem(`lumen.import.${ALICE.id}`, 'dismissed')
    const { user } = renderRoot({ transactions: [tx()] })
    await waitForDashboard()
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    const d = screen.getByRole('dialog')
    await user.type(within(d).getByPlaceholderText('0.00'), '3')
    await user.type(within(d).getByPlaceholderText(/^e\.g\./), 'Snack')
    await user.click(within(d).getByRole('button', { name: 'Add expense' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: /Switch to (dark|light) theme/ }))
    expect(localStorage.getItem('lumen.transactions')).toBe(original.tx)
    expect(localStorage.getItem('lumen.settings')).toBe(original.settings)
  })

  it("never offers one account's imported local data to another account on the same browser", async () => {
    const original = seedLegacy()
    const BOB = { id: '22222222-2222-4222-8222-222222222222', email: 'bob@example.com', password: 'bob-password-1' }
    const repo = createMemoryRepo({ profiles: { [ALICE.id]: { name: 'Alice Smith', currency: 'USD', openingBalance: 0, monthlyBudget: 0 } } })
    const { user } = renderRoot({ repo, users: [ALICE, BOB] })

    // Alice imports her old local data.
    const d = await screen.findByRole('dialog', { name: 'Import data from this browser' })
    await user.click(within(d).getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(repo.rowsFor(ALICE.id)).toHaveLength(2))
    expect(localStorage.getItem('lumen.local.owner')).toBe(ALICE.id)

    // Bob signs in on the same browser.
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0])
    await screen.findByRole('heading', { name: 'Welcome back' })
    await user.type(screen.getByPlaceholderText('you@example.com'), BOB.email)
    await user.type(screen.getByLabelText('Password'), BOB.password)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitForDashboard()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Welcome to Lumen')).toBeTruthy()
    expect(titles()).toHaveLength(0)
    expect(repo.rowsFor(BOB.id)).toHaveLength(0)
    await user.click(within(mobileNav()).getByRole('button', { name: 'Settings' }))
    expect(screen.queryByText(/Data saved here before you signed in/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete local copy/ })).toBeNull()
    // Alice's local copy is still intact for her.
    expect(localStorage.getItem('lumen.transactions')).toBe(original.tx)
  })

  it('carries the old theme preference over to this device', async () => {
    seedLegacy()
    localStorage.setItem(`lumen.import.${ALICE.id}`, 'dismissed')
    renderRoot({ transactions: [] })
    await waitForDashboard()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('lumen.theme')).toBe('light')
  })
})
