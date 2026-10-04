import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// Supabase now issues "publishable" keys; older projects use the "anon" key. Either is safe
// in the browser because every table is protected by Row Level Security.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// Refuse to run with a privileged key. A service-role / secret key bypasses Row Level
// Security and must never be shipped to browsers.
export function isPrivilegedKey(k) {
  if (!k) return false
  if (k.startsWith('sb_secret_')) return true
  try {
    const payload = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

export const configError = !url || !key ? 'missing' : isPrivilegedKey(key) ? 'privileged-key' : null

export const supabase = configError
  ? null
  : createClient(url, key, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
