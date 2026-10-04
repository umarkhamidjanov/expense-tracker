import { describe, expect, it } from 'vitest'
import { createSupabaseRepository, friendlyError, fromRow, toRow } from '../data/repository'
import { claimLocalData, deleteLocalData, prepareForImport, readLocalData, settingsForImport } from '../data/localData'

// A stand-in for the Supabase client that records each query's method chain.
function fakeClient(respond = () => ({ data: [], error: null })) {
  const queries = []
  return {
    queries,
    from(table) {
      const q = { table, ops: [] }
      queries.push(q)
      const builder = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === 'then') return (resolve, reject) => Promise.resolve(respond(q)).then(resolve, reject)
            return (...args) => {
              q.ops.push([prop, ...args])
              return builder
            }
          },
        },
      )
      return builder
    },
  }
}

const op = (q, name) => q.ops.find(([n]) => n === name)
const row = (i) => ({ id: `id-${i}`, user_id: 'u1', type: 'expense', name: `T${i}`, amount: '12.50', category: 'food', date: '2026-10-01', description: null, is_sample: false, created_at: '2026-10-01T10:00:00.000Z' })

describe('row mapping', () => {
  it('converts database rows to app transactions', () => {
    expect(fromRow({ ...row(1), is_sample: true })).toEqual({ id: 'id-1', type: 'expense', name: 'T1', amount: 12.5, category: 'food', date: '2026-10-01', description: '', isSample: true, createdAt: Date.parse('2026-10-01T10:00:00.000Z') })
  })
  it('converts app transactions to rows owned by the user', () => {
    const r = toRow({ id: 'x', type: 'income', name: 'Pay', amount: 100, category: 'salary', date: '2026-10-01', createdAt: 0 }, 'u1')
    expect(r).toEqual({ id: 'x', user_id: 'u1', type: 'income', name: 'Pay', amount: 100, category: 'salary', date: '2026-10-01', description: '', is_sample: false, created_at: '1970-01-01T00:00:00.000Z' })
  })
})

describe('createSupabaseRepository', () => {
  it("lists only the user's transactions, newest first, across multiple pages", async () => {
    let call = 0
    const client = fakeClient(() => ({ data: call++ === 0 ? Array.from({ length: 1000 }, (_, i) => row(i)) : [row(1000), row(1001)], error: null }))
    const txs = await createSupabaseRepository(client).listTransactions('u1')
    expect(txs).toHaveLength(1002)
    expect(txs[0].amount).toBe(12.5)
    const [first, second] = client.queries
    expect(op(first, 'eq')).toEqual(['eq', 'user_id', 'u1'])
    expect(first.ops.filter(([n]) => n === 'order').map(([, col, o]) => [col, o.ascending])).toEqual([['date', false], ['created_at', false], ['id', true]])
    expect(op(first, 'range')).toEqual(['range', 0, 999])
    expect(op(second, 'range')).toEqual(['range', 1000, 1999])
  })

  it('inserts in chunks with an idempotent upsert on id', async () => {
    const client = fakeClient(() => ({ error: null }))
    const txs = Array.from({ length: 1200 }, (_, i) => ({ id: `t${i}`, type: 'expense', name: 'x', amount: 1, category: 'food', date: '2026-10-01', createdAt: 1 }))
    await createSupabaseRepository(client).insertTransactions('u1', txs)
    expect(client.queries).toHaveLength(3)
    const [name, rows, options] = op(client.queries[0], 'upsert')
    expect(name).toBe('upsert')
    expect(rows).toHaveLength(500)
    expect(rows[0].user_id).toBe('u1')
    expect(options).toEqual({ onConflict: 'id', ignoreDuplicates: true })
  })

  it('scopes updates to the user and only sends editable columns', async () => {
    const client = fakeClient(() => ({ error: null }))
    await createSupabaseRepository(client).updateTransaction('u1', 't1', { name: 'New', amount: 5, id: 'hack', userId: 'other', user_id: 'other', isSample: true })
    const q = client.queries[0]
    expect(op(q, 'update')[1]).toEqual({ name: 'New', amount: 5 })
    expect(q.ops.filter(([n]) => n === 'eq').map(([, c, v]) => `${c}=${v}`)).toEqual(['user_id=u1', 'id=t1'])
  })

  it('scopes deletes to the user, by id or by sample flag', async () => {
    const client = fakeClient(() => ({ error: null }))
    const repo = createSupabaseRepository(client)
    await repo.deleteTransactions('u1', { id: 't1' })
    await repo.deleteTransactions('u1', { sample: true })
    await repo.deleteTransactions('u1')
    const eqs = client.queries.map((q) => q.ops.filter(([n]) => n === 'eq').map(([, c, v]) => `${c}=${v}`))
    expect(eqs).toEqual([['user_id=u1', 'id=t1'], ['user_id=u1', 'is_sample=true'], ['user_id=u1']])
  })

  it('reads and upserts the profile with database column names', async () => {
    const client = fakeClient((q) => (op(q, 'maybeSingle') ? { data: { id: 'u1', display_name: 'Al', currency: 'EUR', opening_balance: '10.00', monthly_budget: '0.00' }, error: null } : { error: null }))
    const repo = createSupabaseRepository(client)
    expect(await repo.getProfile('u1')).toEqual({ name: 'Al', currency: 'EUR', openingBalance: 10, monthlyBudget: 0 })
    await repo.saveProfile('u1', { name: 'Bo', monthlyBudget: 500, theme: 'light' })
    expect(op(client.queries[1], 'upsert').slice(1)).toEqual([{ id: 'u1', display_name: 'Bo', monthly_budget: 500 }, { onConflict: 'id' }])
  })

  it('throws database errors so callers can roll back', async () => {
    const client = fakeClient(() => ({ error: { message: 'new row violates row-level security policy' } }))
    await expect(createSupabaseRepository(client).updateTransaction('u1', 't', { name: 'x' })).rejects.toMatchObject({ message: expect.stringMatching(/row-level/) })
  })
})

describe('friendlyError', () => {
  it('turns technical errors into actionable messages', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/Couldn't reach the server/)
    expect(friendlyError({ message: 'JWT expired' })).toMatch(/session has expired/)
    expect(friendlyError({ message: 'new row violates row-level security policy' })).toMatch(/permission/)
    expect(friendlyError({ message: 'violates check constraint "transactions_amount_check"' })).toMatch(/invalid/)
    expect(friendlyError({ message: 'weird' }, 'save this')).toBe("Couldn't save this. Please try again.")
  })
})

describe('local data import helpers', () => {
  it('reads old saves, separating own transactions from sample data and skipping invalid rows', () => {
    localStorage.setItem(
      'lumen.transactions',
      JSON.stringify([
        { id: 'demo-1', type: 'expense', amount: 5, date: '2026-10-01', name: 'Sample' },
        { id: 'abc', type: 'expense', amount: 7, date: '2026-10-02', description: 'Legacy title' },
        { id: 'bad', type: 'expense', amount: -1, date: '2026-10-02', name: 'Invalid' },
      ]),
    )
    const local = readLocalData()
    expect(local.sample.map((t) => t.name)).toEqual(['Sample'])
    expect(local.own.map((t) => t.name)).toEqual(['Legacy title'])
    expect(local.transactions).toHaveLength(2)
  })

  it('hides local data claimed by another account and refuses to delete it for them', () => {
    localStorage.setItem('lumen.transactions', JSON.stringify([{ id: 'abc', type: 'expense', amount: 7, date: '2026-10-02', name: 'Mine' }]))
    claimLocalData('alice')
    claimLocalData('bob') // a later claim never replaces the owner
    expect(readLocalData('alice').own.map((t) => t.name)).toEqual(['Mine'])
    expect(readLocalData('bob')).toMatchObject({ hasData: false, transactions: [], settings: null, claimedByOther: true })
    expect(deleteLocalData('bob')).toBe(false)
    expect(localStorage.getItem('lumen.transactions')).not.toBeNull()
    expect(deleteLocalData('alice')).toBe(true)
    expect(localStorage.getItem('lumen.transactions')).toBeNull()
    expect(localStorage.getItem('lumen.local.owner')).toBeNull()
  })

  it('tolerates corrupt local storage', () => {
    localStorage.setItem('lumen.transactions', '{not json')
    expect(readLocalData()).toMatchObject({ hasData: false, transactions: [] })
  })

  it('keeps UUIDs (so re-imports do not duplicate) and replaces other ids', () => {
    const uuid = '9b2c5d1e-7f3a-4c2b-9e8d-1a2b3c4d5e6f'
    const [kept, replaced] = prepareForImport([
      { id: uuid, type: 'expense', name: 'A', amount: 1.239, category: 'food', date: '2026-10-01' },
      { id: 'demo-4', type: 'expense', name: '', amount: 2, date: '2026-10-01' },
    ], { sample: true })
    expect(kept.id).toBe(uuid)
    expect(kept.amount).toBe(1.24)
    expect(replaced.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(replaced).toMatchObject({ name: 'Transaction', category: 'other', isSample: true })
  })

  it('imports only valid settings and never the theme', () => {
    expect(settingsForImport({ theme: 'light', currency: 'GBP', name: '  Al  ', openingBalance: '50', monthlyBudget: -5 })).toEqual({ currency: 'GBP', name: 'Al', openingBalance: 50 })
    expect(settingsForImport({ theme: 'dark' })).toBeNull()
  })
})
