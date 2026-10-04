import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Root from '../Root'
import { createFakeAuth, createMemoryRepo } from './fakes'

export const ALICE = { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.com', password: 'correct-horse', metadata: { display_name: 'Alice Smith' } }

// Renders the full app (theme → auth → data) with fakes in place of Supabase.
export function renderRoot({ auth, repo, users = [ALICE], signedInAs = ALICE.email, transactions = [], profile, requireConfirmation } = {}) {
  const fakeAuth = auth ?? createFakeAuth({ users, signedInAs, requireConfirmation })
  const memoryRepo =
    repo ??
    createMemoryRepo({
      transactions: { [ALICE.id]: transactions },
      profiles: profile === null ? {} : { [ALICE.id]: { name: 'Alice Smith', currency: 'USD', openingBalance: 0, monthlyBudget: 0, ...profile } },
    })
  const user = userEvent.setup()
  const utils = render(<Root client={fakeAuth} repo={memoryRepo} setupError={null} />)
  return { user, auth: fakeAuth, repo: memoryRepo, ...utils }
}

export const money = (text) => (/[−-]/.test(text) ? -1 : 1) * Number(text.replace(/[^0-9.]/g, ''))

export const stat = (label) =>
  money(screen.getByText(label, { selector: '.stat-card__label' }).closest('.stat-card').querySelector('.stat-card__value').textContent)

export const waitForDashboard = () => screen.findByText('Total balance', { selector: '.stat-card__label' })

export const titles = () => [...document.querySelectorAll('.tx-row__title')].map((el) => el.textContent)

export const mobileNav = () => screen.getByRole('navigation', { name: 'Mobile navigation' })
