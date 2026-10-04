import { describe, expect, it } from 'vitest'
import { act, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Root from '../Root'
import { isPrivilegedKey } from '../lib/supabase'
import { createFakeAuth, createMemoryRepo } from './fakes'
import { ALICE, renderRoot, titles, waitForDashboard } from './helpers'

const BOB = { id: '22222222-2222-4222-8222-222222222222', email: 'bob@example.com', password: 'bob-password-1' }
const signedOut = (extra = {}) => renderRoot({ signedInAs: null, users: [ALICE, BOB], ...extra })

async function fill(user, { email, password, name }) {
  if (name !== undefined) await user.type(screen.getByPlaceholderText('Alex Morgan'), name)
  if (email !== undefined) await user.type(screen.getByPlaceholderText('you@example.com'), email)
  if (password !== undefined) await user.type(screen.getByLabelText(/^(New )?[Pp]assword$/), password)
}

describe('Sign in', () => {
  it('shows the sign-in screen when signed out', async () => {
    signedOut()
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(screen.queryByText('Total balance')).toBeNull()
  })

  it('rejects a wrong password with a clear message', async () => {
    const { user } = signedOut()
    await screen.findByRole('heading', { name: 'Welcome back' })
    await fill(user, { email: ALICE.email, password: 'wrong-password' })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Incorrect email or password.')
  })

  it('validates the form before contacting the server', async () => {
    const { user, auth } = signedOut()
    await screen.findByRole('heading', { name: 'Welcome back' })
    await fill(user, { email: 'not-an-email' })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email address')).toBeTruthy()
    expect(screen.getByText('Enter your password')).toBeTruthy()
    expect(auth.calls).toHaveLength(0)
  })

  it("signs in and loads that user's data", async () => {
    const repo = createMemoryRepo({ transactions: { [ALICE.id]: [{ id: crypto.randomUUID(), type: 'expense', name: 'Alice coffee', amount: 4, category: 'food', date: '2026-10-01', description: '', createdAt: 1 }] } })
    const { user } = signedOut({ repo })
    await screen.findByRole('heading', { name: 'Welcome back' })
    await fill(user, { email: ALICE.email, password: ALICE.password })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitForDashboard()
    expect(titles()).toContain('Alice coffee')
  })

  it("tells unconfirmed users to confirm their email", async () => {
    const auth = createFakeAuth({ users: [{ ...ALICE, confirmed: false }] })
    const { user } = renderRoot({ auth })
    await screen.findByRole('heading', { name: 'Welcome back' })
    await fill(user, { email: ALICE.email, password: ALICE.password })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/confirm your email/)
  })
})

describe('Sign up', () => {
  it('asks new users to confirm their email when confirmation is required', async () => {
    const { user, auth } = signedOut({ requireConfirmation: true })
    await user.click(await screen.findByRole('tab', { name: 'Create account' }))
    await fill(user, { name: 'Carol', email: 'carol@example.com', password: 'carol-password' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeTruthy()
    expect(screen.getByText('carol@example.com')).toBeTruthy()
    const [, , options] = auth.calls.find((c) => c[0] === 'signUp')
    expect(options.data).toEqual({ display_name: 'Carol' })
    expect(options.emailRedirectTo).toBe(`${window.location.origin}/`)
    expect(screen.getByRole('button', { name: /Resend in \d+s/ }).disabled).toBe(true)
  })

  it('signs straight in when confirmation is off, with an empty account', async () => {
    const { user, repo, auth } = signedOut({ repo: createMemoryRepo() })
    await user.click(await screen.findByRole('tab', { name: 'Create account' }))
    await fill(user, { name: 'Dan', email: 'dan@example.com', password: 'dan-password' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitForDashboard()
    expect(screen.getByText('Welcome to Lumen')).toBeTruthy()
    expect(titles()).toHaveLength(0)
    const danId = auth.accounts.get('dan@example.com').id
    expect(repo.rowsFor(danId)).toHaveLength(0)
    expect(repo.profileFor(danId)).toMatchObject({ name: 'Dan', openingBalance: 0, monthlyBudget: 0 })
  })

  it('requires a password of at least 8 characters', async () => {
    const { user, auth } = signedOut()
    await user.click(await screen.findByRole('tab', { name: 'Create account' }))
    await fill(user, { email: 'eve@example.com', password: 'short' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Use at least 8 characters')).toBeTruthy()
    expect(auth.calls).toHaveLength(0)
  })

  it('explains when the email is already registered', async () => {
    const { user } = signedOut()
    await user.click(await screen.findByRole('tab', { name: 'Create account' }))
    await fill(user, { email: ALICE.email, password: 'another-password' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/already exists/)
  })
})

describe('Password reset', () => {
  it('sends a reset link that returns to the app in recovery mode', async () => {
    const { user, auth } = signedOut()
    await user.click(await screen.findByRole('button', { name: 'Forgot password?' }))
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy()
    await fill(user, { email: ALICE.email })
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeTruthy()
    const [, email, options] = auth.calls.find((c) => c[0] === 'resetPassword')
    expect(email).toBe(ALICE.email)
    expect(options.redirectTo).toBe(`${window.location.origin}/?recovery=1`)
  })

  it('lets the user choose a new password after opening the link', async () => {
    const { user, auth } = signedOut()
    await screen.findByRole('heading', { name: 'Welcome back' })
    act(() => auth.openRecoveryLink(ALICE.email))
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeTruthy()

    await user.type(screen.getByLabelText('New password'), 'brand-new-pass')
    await user.type(screen.getByLabelText('Confirm new password'), 'different-pass')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(screen.getByText("Passwords don't match")).toBeTruthy()

    await user.clear(screen.getByLabelText('Confirm new password'))
    await user.type(screen.getByLabelText('Confirm new password'), 'brand-new-pass')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitForDashboard()
    expect(auth.accounts.get(ALICE.email).password).toBe('brand-new-pass')
  })
})

describe('Session', () => {
  it('signs out on this device only and returns to the sign-in screen', async () => {
    const { user, auth } = renderRoot({ transactions: [] })
    await waitForDashboard()
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0])
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(auth.calls.find((c) => c[0] === 'signOut')[1]).toEqual({ scope: 'local' })
  })

  it('returns to sign-in if the session ends elsewhere', async () => {
    const { auth } = renderRoot({ transactions: [] })
    await waitForDashboard()
    act(() => auth.expireSession())
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy()
  })

  it("does not show the previous user's data after switching accounts", async () => {
    const repo = createMemoryRepo({
      transactions: {
        [ALICE.id]: [{ id: crypto.randomUUID(), type: 'expense', name: 'Alice only', amount: 1, category: 'food', date: '2026-10-01', description: '', createdAt: 1 }],
        [BOB.id]: [{ id: crypto.randomUUID(), type: 'expense', name: 'Bob only', amount: 2, category: 'food', date: '2026-10-01', description: '', createdAt: 1 }],
      },
    })
    const { user } = renderRoot({ repo, users: [ALICE, BOB] })
    await waitForDashboard()
    expect(titles()).toEqual(['Alice only'])
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0])
    await screen.findByRole('heading', { name: 'Welcome back' })
    await fill(user, { email: BOB.email, password: BOB.password })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitForDashboard()
    expect(titles()).toEqual(['Bob only'])
  })
})

describe('Email link errors and configuration', () => {
  it('shows an expired-link error from the URL and removes it from the address bar', async () => {
    window.history.replaceState(null, '', '/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired#/dashboard')
    signedOut()
    expect((await screen.findByRole('alert')).textContent).toMatch(/expired or was already used/)
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('#/dashboard')
    window.history.replaceState(null, '', '/')
  })

  it('shows setup instructions when Supabase is not configured, without touching local data', () => {
    localStorage.setItem('lumen.transactions', '[{"id":"demo-1"}]')
    render(<Root client={null} setupError="missing" />)
    expect(screen.getByText('Cloud storage isn’t configured')).toBeTruthy()
    expect(localStorage.getItem('lumen.transactions')).toBe('[{"id":"demo-1"}]')
  })

  it('refuses to run with a service-role key', () => {
    render(<Root client={null} setupError="privileged-key" />)
    expect(screen.getByText('Unsafe Supabase key')).toBeTruthy()
  })

  it('detects privileged keys', () => {
    const jwt = (role) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.y`
    expect(isPrivilegedKey(jwt('service_role'))).toBe(true)
    expect(isPrivilegedKey('sb_secret_abc123')).toBe(true)
    expect(isPrivilegedKey(jwt('anon'))).toBe(false)
    expect(isPrivilegedKey('sb_publishable_abc123')).toBe(false)
  })
})
