import { useEffect, useState } from 'react'
import { Eye, EyeOff, Mail, Sun, Moon, CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

const COPY = {
  signin: { title: 'Welcome back', sub: 'Sign in to see your finances on any device.', cta: 'Sign in' },
  signup: { title: 'Create your account', sub: 'Your transactions sync securely across devices.', cta: 'Create account' },
  reset: { title: 'Reset your password', sub: "Enter your email and we'll send you a reset link.", cta: 'Send reset link' },
  'update-password': { title: 'Choose a new password', sub: 'Enter a new password for your account.', cta: 'Update password' },
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, placeholder = '••••••••' }) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-input">
      <input
        id={id}
        className={`input ${invalid ? 'has-error' : ''}`}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
      />
      <button type="button" className="password-input__toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

export default function AuthScreen({ initialMode = 'signin' }) {
  const auth = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(auth.urlError)
  const [fieldErrors, setFieldErrors] = useState({})
  const [sent, setSent] = useState(null) // { kind: 'confirm' | 'reset', email }
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (auth.urlError) auth.dismissUrlError()
  }, [auth])

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const switchMode = (m) => {
    setMode(m)
    setError(null)
    setFieldErrors({})
    setPassword('')
    setConfirm('')
  }

  const validate = () => {
    const f = {}
    if (mode !== 'update-password' && !EMAIL.test(email.trim())) f.email = 'Enter a valid email address'
    if (mode === 'signin' && !password) f.password = 'Enter your password'
    if ((mode === 'signup' || mode === 'update-password') && password.length < MIN_PASSWORD) f.password = `Use at least ${MIN_PASSWORD} characters`
    if (mode === 'update-password' && confirm !== password) f.confirm = "Passwords don't match"
    if (mode === 'signup' && name.trim().length > 40) f.name = 'Keep it under 40 characters'
    setFieldErrors(f)
    return !Object.keys(f).length
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setBusy(true)
    const addr = email.trim()
    let res
    if (mode === 'signin') res = await auth.signIn(addr, password)
    else if (mode === 'signup') {
      res = await auth.signUp(addr, password, name.trim())
      if (!res.error && res.needsConfirmation) {
        setSent({ kind: 'confirm', email: addr })
        setCooldown(30)
      }
    } else if (mode === 'reset') {
      res = await auth.sendPasswordReset(addr)
      if (!res.error) {
        setSent({ kind: 'reset', email: addr })
        setCooldown(30)
      }
    } else res = await auth.updatePassword(password)
    setBusy(false)
    if (res?.error) setError(res.error)
  }

  const resend = async () => {
    setBusy(true)
    const res = sent.kind === 'confirm' ? await auth.resendConfirmation(sent.email) : await auth.sendPasswordReset(sent.email)
    setBusy(false)
    if (res.error) setError(res.error)
    else setCooldown(30)
  }

  const copy = COPY[mode]

  return (
    <div className="auth-page">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb--1" />
        <span className="orb orb--2" />
        <span className="orb orb--3" />
      </div>

      <button className="icon-btn auth-theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
        {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <main className="auth-card glass fade-up">
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M5 15l4-4.5 3 2.6L19 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="brand-name">Lumen</div>
        </div>

        {sent ? (
          <div className="auth-sent" role="status">
            <div className="auth-sent__icon">
              <Mail size={24} />
            </div>
            <h1>Check your email</h1>
            <p>
              {sent.kind === 'confirm' ? 'We sent a confirmation link to ' : "If an account exists for "}
              <strong>{sent.email}</strong>
              {sent.kind === 'confirm'
                ? '. Open it on this device to finish creating your account.'
                : ", we've sent a link to reset your password. Open it on this device."}
            </p>
            {error && (
              <div className="auth-alert auth-alert--error" role="alert">
                <CircleAlert size={17} /> <span>{error}</span>
              </div>
            )}
            <button className="btn btn-ghost auth-wide" onClick={resend} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
            </button>
            <button
              className="auth-link"
              onClick={() => {
                setSent(null)
                switchMode('signin')
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="auth-head">
              <h1>{copy.title}</h1>
              <p>{copy.sub}</p>
            </div>

            {(mode === 'signin' || mode === 'signup') && (
              <div className="tabs auth-tabs" role="tablist" aria-label="Account">
                <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-active' : ''} onClick={() => switchMode('signin')}>
                  Sign in
                </button>
                <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => switchMode('signup')}>
                  Create account
                </button>
              </div>
            )}

            {error && (
              <div className="auth-alert auth-alert--error" role="alert">
                <CircleAlert size={17} /> <span>{error}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={submit} noValidate>
              {mode === 'signup' && (
                <label className="field">
                  <span className="field__label">
                    Name <span className="field__optional">optional</span>
                  </span>
                  <input className={`input ${fieldErrors.name ? 'has-error' : ''}`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Alex Morgan" maxLength={40} />
                  {fieldErrors.name && <span className="field__error">{fieldErrors.name}</span>}
                </label>
              )}

              {mode !== 'update-password' && (
                <label className="field">
                  <span className="field__label">Email</span>
                  <input
                    className={`input ${fieldErrors.email ? 'has-error' : ''}`}
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={!!fieldErrors.email || undefined}
                  />
                  {fieldErrors.email && <span className="field__error">{fieldErrors.email}</span>}
                </label>
              )}

              {mode !== 'reset' && (
                <div className="field">
                  <span className="field__label field__label--split">
                    <label htmlFor="auth-password">{mode === 'update-password' ? 'New password' : 'Password'}</label>
                    {mode === 'signin' && (
                      <button type="button" className="auth-link auth-link--inline" onClick={() => switchMode('reset')}>
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <PasswordInput
                    id="auth-password"
                    value={password}
                    onChange={setPassword}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    invalid={!!fieldErrors.password}
                  />
                  {fieldErrors.password ? (
                    <span className="field__error">{fieldErrors.password}</span>
                  ) : (
                    mode !== 'signin' && <span className="field__hint">At least {MIN_PASSWORD} characters</span>
                  )}
                </div>
              )}

              {mode === 'update-password' && (
                <div className="field">
                  <label className="field__label" htmlFor="auth-confirm">
                    Confirm new password
                  </label>
                  <PasswordInput id="auth-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={!!fieldErrors.confirm} />
                  {fieldErrors.confirm && <span className="field__error">{fieldErrors.confirm}</span>}
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-wide auth-submit" disabled={busy}>
                {busy && <LoaderCircle size={17} className="spin" />}
                {busy ? 'Please wait…' : copy.cta}
              </button>
            </form>

            {mode === 'reset' && (
              <button className="auth-link" onClick={() => switchMode('signin')}>
                Back to sign in
              </button>
            )}
            {mode === 'update-password' && (
              <button className="auth-link" onClick={auth.signOut}>
                Cancel and sign out
              </button>
            )}
          </>
        )}

        <p className="auth-foot">
          <ShieldCheck size={14} /> Your data is private to your account.
        </p>
      </main>
    </div>
  )
}
