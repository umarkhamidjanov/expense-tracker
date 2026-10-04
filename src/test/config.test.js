import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn(() => ({ auth: {} }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

async function loadWith(env) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  return import('../lib/supabase')
}

afterEach(() => {
  vi.unstubAllEnvs()
  createClient.mockClear()
})

describe('Supabase client configuration', () => {
  it('uses the PKCE flow with a persisted, auto-refreshing session', async () => {
    const mod = await loadWith({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_123', VITE_SUPABASE_ANON_KEY: '' })
    expect(mod.configError).toBeNull()
    expect(createClient).toHaveBeenCalledWith('https://abc.supabase.co', 'sb_publishable_123', {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  })

  it('accepts the legacy anon key name', async () => {
    const mod = await loadWith({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: 'anon-key' })
    expect(mod.configError).toBeNull()
    expect(createClient.mock.calls[0][1]).toBe('anon-key')
  })

  it('does not create a client when configuration is missing', async () => {
    const mod = await loadWith({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '' })
    expect(mod.configError).toBe('missing')
    expect(mod.supabase).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('refuses a service-role / secret key', async () => {
    const mod = await loadWith({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_danger', VITE_SUPABASE_ANON_KEY: '' })
    expect(mod.configError).toBe('privileged-key')
    expect(mod.supabase).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })
})
