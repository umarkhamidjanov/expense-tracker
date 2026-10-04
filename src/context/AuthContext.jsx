import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

// Where Supabase sends people back to after email links (confirm sign-up, reset password).
const appUrl = () => `${window.location.origin}${window.location.pathname}`

// Supabase reports failed email links (e.g. expired) as URL parameters. Read and remove them.
function takeUrlError() {
  const search = new URLSearchParams(window.location.search)
  const hash = window.location.hash.startsWith('#/') ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1))
  const description = search.get('error_description') || hash.get('error_description')
  const code = search.get('error_code') || hash.get('error_code')
  if (!description && !code) return null
  const url = new URL(window.location.href)
  for (const k of ['error', 'error_code', 'error_description']) url.searchParams.delete(k)
  if (!window.location.hash.startsWith('#/')) url.hash = ''
  window.history.replaceState(window.history.state, '', url.toString())
  if (code === 'otp_expired') return 'That email link has expired or was already used. Please request a new one.'
  return description.replace(/\+/g, ' ')
}

function takeRecoveryParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('recovery')) return false
  url.searchParams.delete('recovery')
  window.history.replaceState(window.history.state, '', url.toString())
  return true
}

export function authErrorMessage(error) {
  if (!error) return null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return "You're offline. Connect to the internet and try again."
  const code = error.code || ''
  const msg = String(error.message || error)
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Incorrect email or password.'
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Please confirm your email address first. Check your inbox for the confirmation link.'
  if (code === 'user_already_exists' || /already registered|already exists/i.test(msg)) return 'An account with this email already exists. Try signing in instead.'
  if (code === 'weak_password' || /password should|weak password/i.test(msg)) return msg
  if (code === 'same_password') return 'Your new password must be different from your current one.'
  if (/rate limit|too many/i.test(msg) || error.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'Please enter a valid email address.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Couldn't reach the server. Check your connection and try again."
  return msg || 'Something went wrong. Please try again.'
}

export function AuthProvider({ client, children }) {
  const [state, setState] = useState({ status: 'loading', session: null, recovery: false, urlError: null })

  useEffect(() => {
    let active = true
    const urlError = takeUrlError()
    const recoveryParam = takeRecoveryParam()

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return
      // Only set state here: Supabase advises against awaiting its calls inside this callback.
      setState((s) => ({
        ...s,
        status: 'ready',
        session,
        recovery: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : s.recovery,
      }))
    })

    client.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return
      setState((s) => ({
        ...s,
        status: 'ready',
        session,
        recovery: s.recovery || (recoveryParam && !!session),
        urlError: urlError || (error ? authErrorMessage(error) : null),
      }))
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const signIn = useCallback(async (email, password) => {
    const { error } = await client.auth.signInWithPassword({ email, password })
    return { error: authErrorMessage(error) }
  }, [client])

  const signUp = useCallback(async (email, password, displayName) => {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: appUrl() },
    })
    if (error) return { error: authErrorMessage(error) }
    return { needsConfirmation: !data.session }
  }, [client])

  const resendConfirmation = useCallback(async (email) => {
    const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl() } })
    return { error: authErrorMessage(error) }
  }, [client])

  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}?recovery=1` })
    return { error: authErrorMessage(error) }
  }, [client])

  const updatePassword = useCallback(async (password) => {
    const { error } = await client.auth.updateUser({ password })
    if (!error) setState((s) => ({ ...s, recovery: false }))
    return { error: authErrorMessage(error) }
  }, [client])

  // Signs out this device only; other devices stay signed in.
  const signOut = useCallback(async () => {
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) setState((s) => ({ ...s, session: null }))
  }, [client])

  const dismissUrlError = useCallback(() => setState((s) => ({ ...s, urlError: null })), [])

  const value = useMemo(
    () => ({
      status: state.status,
      session: state.session,
      user: state.session?.user ?? null,
      recovery: state.recovery,
      urlError: state.urlError,
      signIn,
      signUp,
      resendConfirmation,
      sendPasswordReset,
      updatePassword,
      signOut,
      dismissUrlError,
    }),
    [state, signIn, signUp, resendConfirmation, sendPasswordReset, updatePassword, signOut, dismissUrlError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
