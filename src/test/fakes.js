// Test doubles: an in-memory repository (same interface as the Supabase repository) and a
// fake Supabase auth client.

const networkError = () => Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' })

export function createMemoryRepo({ transactions = {}, profiles = {} } = {}) {
  // transactions: { [userId]: Transaction[] }
  const rows = new Map()
  for (const [userId, list] of Object.entries(transactions)) for (const t of list) rows.set(t.id, { ...t, userId })
  const profileRows = new Map(Object.entries(profiles))
  let gate = null

  const repo = {
    failing: new Set(), // operation names that should fail: list | insert | update | delete | profile
    calls: [],
    rowsFor: (userId) => [...rows.values()].filter((r) => r.userId === userId).map(({ userId: _u, ...t }) => t),
    profileFor: (userId) => profileRows.get(userId),
    // Holds listTransactions until release() is called (to observe loading states).
    hold() {
      let release
      gate = new Promise((r) => (release = r))
      return () => {
        gate = null
        release()
      }
    },
    async _op(name) {
      repo.calls.push(name)
      await Promise.resolve()
      if (repo.failing.has(name)) throw networkError()
    },
    async listTransactions(userId) {
      if (gate) await gate
      await repo._op('list')
      return repo.rowsFor(userId)
    },
    async insertTransactions(userId, txs) {
      await repo._op('insert')
      for (const t of txs) if (!rows.has(t.id)) rows.set(t.id, { ...t, userId })
    },
    async updateTransaction(userId, id, patch) {
      await repo._op('update')
      const r = rows.get(id)
      if (r && r.userId === userId) rows.set(id, { ...r, ...patch })
    },
    async deleteTransactions(userId, filter = {}) {
      await repo._op('delete')
      for (const [id, r] of rows) {
        if (r.userId !== userId) continue
        if (filter.id && id !== filter.id) continue
        if (filter.sample && !r.isSample) continue
        rows.delete(id)
      }
    },
    async getProfile(userId) {
      await repo._op('profile')
      return profileRows.get(userId) ?? null
    },
    async saveProfile(userId, patch) {
      await repo._op('profile')
      profileRows.set(userId, { ...(profileRows.get(userId) || {}), ...patch })
    },
  }
  return repo
}

export function createFakeAuth({ users = [], signedInAs = null, requireConfirmation = false } = {}) {
  const accounts = new Map(users.map((u) => [u.email, { ...u, confirmed: u.confirmed ?? true }]))
  const listeners = new Set()
  const calls = []
  const sessionFor = (acct) => ({ access_token: `token-${acct.id}`, user: { id: acct.id, email: acct.email, user_metadata: acct.metadata || {} } })
  let current = signedInAs ? sessionFor(accounts.get(signedInAs)) : null
  const emit = (event, session) => {
    current = session
    for (const cb of listeners) cb(event, session)
  }
  const err = (code, message, status = 400) => ({ data: { user: null, session: null }, error: { code, message, status } })

  const auth = {
    onAuthStateChange(cb) {
      listeners.add(cb)
      queueMicrotask(() => cb('INITIAL_SESSION', current))
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    },
    async getSession() {
      return { data: { session: current }, error: null }
    },
    async signInWithPassword({ email, password }) {
      calls.push(['signIn', email])
      const a = accounts.get(email)
      if (!a || a.password !== password) return err('invalid_credentials', 'Invalid login credentials')
      if (!a.confirmed) return err('email_not_confirmed', 'Email not confirmed')
      const s = sessionFor(a)
      emit('SIGNED_IN', s)
      return { data: { session: s, user: s.user }, error: null }
    },
    async signUp({ email, password, options }) {
      calls.push(['signUp', email, options])
      if (accounts.has(email)) return err('user_already_exists', 'User already registered', 422)
      const a = { id: crypto.randomUUID(), email, password, metadata: options?.data || {}, confirmed: !requireConfirmation }
      accounts.set(email, a)
      if (requireConfirmation) return { data: { user: { id: a.id, email }, session: null }, error: null }
      const s = sessionFor(a)
      emit('SIGNED_IN', s)
      return { data: { user: s.user, session: s }, error: null }
    },
    async resend(args) {
      calls.push(['resend', args])
      return { data: {}, error: null }
    },
    async resetPasswordForEmail(email, options) {
      calls.push(['resetPassword', email, options])
      return { data: {}, error: null }
    },
    async updateUser({ password }) {
      calls.push(['updateUser'])
      if (!current) return err('session_missing', 'Auth session missing!', 401)
      const a = [...accounts.values()].find((x) => x.id === current.user.id)
      if (a.password === password) return err('same_password', 'New password should be different from the old password.', 422)
      a.password = password
      emit('USER_UPDATED', current)
      return { data: { user: current.user }, error: null }
    },
    async signOut(options) {
      calls.push(['signOut', options])
      emit('SIGNED_OUT', null)
      return { error: null }
    },
  }

  return {
    auth,
    calls,
    // Simulates opening a password-reset link (PKCE exchange already done).
    openRecoveryLink(email) {
      emit('PASSWORD_RECOVERY', sessionFor(accounts.get(email)))
    },
    // Simulates the session ending elsewhere (e.g. refresh token revoked).
    expireSession() {
      emit('SIGNED_OUT', null)
    },
    accounts,
  }
}
