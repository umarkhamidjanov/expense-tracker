// Cloud data access. Everything that knows about Supabase tables lives here, so the rest
// of the app works with plain transaction / settings objects.
//
// Repository interface (also implemented by the in-memory test repository):
//   listTransactions(userId)            -> Transaction[]
//   insertTransactions(userId, txs)     -> void   (idempotent on id)
//   updateTransaction(userId, id, patch) -> void
//   deleteTransactions(userId, filter)  -> void   filter: { id } | { sample: true } | {}
//   getProfile(userId)                  -> Profile | null
//   saveProfile(userId, patch)          -> void   (upsert)

const PAGE = 1000 // PostgREST's default max rows per request
const CHUNK = 500

export function toRow(tx, userId) {
  return {
    id: tx.id,
    user_id: userId,
    type: tx.type,
    name: tx.name,
    amount: tx.amount,
    category: tx.category,
    date: tx.date,
    description: tx.description || '',
    is_sample: !!tx.isSample,
    created_at: new Date(Number.isFinite(tx.createdAt) ? tx.createdAt : Date.now()).toISOString(),
  }
}

export function fromRow(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    amount: Number(row.amount),
    category: row.category,
    date: row.date,
    description: row.description || '',
    isSample: !!row.is_sample,
    createdAt: Date.parse(row.created_at),
  }
}

const PATCH_COLUMNS = { type: 'type', name: 'name', amount: 'amount', category: 'category', date: 'date', description: 'description' }

export function toPatch(patch) {
  const out = {}
  for (const [k, col] of Object.entries(PATCH_COLUMNS)) if (k in patch) out[col] = patch[k]
  return out
}

export function profileFromRow(row) {
  return {
    name: row.display_name || '',
    currency: row.currency || 'USD',
    openingBalance: Number(row.opening_balance) || 0,
    monthlyBudget: Number(row.monthly_budget) || 0,
  }
}

const PROFILE_COLUMNS = { name: 'display_name', currency: 'currency', openingBalance: 'opening_balance', monthlyBudget: 'monthly_budget' }

export function profileToRow(patch) {
  const out = {}
  for (const [k, col] of Object.entries(PROFILE_COLUMNS)) if (k in patch) out[col] = patch[k]
  return out
}

function check({ error }) {
  if (error) throw error
}

export function createSupabaseRepository(client) {
  return {
    async listTransactions(userId) {
      const rows = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...data)
        if (data.length < PAGE) break
      }
      return rows.map(fromRow)
    },

    async insertTransactions(userId, txs) {
      for (let i = 0; i < txs.length; i += CHUNK) {
        check(
          await client
            .from('transactions')
            .upsert(txs.slice(i, i + CHUNK).map((t) => toRow(t, userId)), { onConflict: 'id', ignoreDuplicates: true }),
        )
      }
    },

    // Scoped to the user as well as the id: defense in depth on top of Row Level Security.
    async updateTransaction(userId, id, patch) {
      check(await client.from('transactions').update(toPatch(patch)).eq('user_id', userId).eq('id', id))
    },

    async deleteTransactions(userId, filter = {}) {
      let q = client.from('transactions').delete().eq('user_id', userId)
      if (filter.id) q = q.eq('id', filter.id)
      if (filter.sample) q = q.eq('is_sample', true)
      check(await q)
    },

    async getProfile(userId) {
      const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (error) throw error
      return data ? profileFromRow(data) : null
    },

    async saveProfile(userId, patch) {
      check(await client.from('profiles').upsert({ id: userId, ...profileToRow(patch) }, { onConflict: 'id' }))
    },
  }
}

// Turns network / auth / database errors into something a person can act on.
export function friendlyError(error, action = 'save') {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return `You're offline. Connect to the internet to ${action}.`
  }
  const msg = String(error?.message || error || '')
  if (/JWT|token|not authenticated|session/i.test(msg) || error?.status === 401) return 'Your session has expired. Please sign in again.'
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) return `Couldn't reach the server. Check your connection and try again.`
  if (/row-level security|permission denied/i.test(msg)) return `You don't have permission to ${action} this.`
  if (/violates check constraint/i.test(msg)) return 'Some of the details are invalid. Please check them and try again.'
  return `Couldn't ${action}. Please try again.`
}
