import { CircleAlert, CloudOff, LoaderCircle, RefreshCw, Settings2 } from 'lucide-react'
import useOnlineStatus from '../hooks/useOnlineStatus'

export function Splash({ label = 'Loading…' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="brand-mark splash__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M5 15l4-4.5 3 2.6L19 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <LoaderCircle size={20} className="spin splash__spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your data">
      <div className="skeleton skeleton--title" />
      <div className="stats-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card skeleton-card">
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--value" />
            <div className="skeleton skeleton--line skeleton--short" />
          </div>
        ))}
      </div>
      <div className="grid grid--main">
        <div className="card skeleton-card skeleton-card--tall">
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--block" />
        </div>
        <div className="card skeleton-card skeleton-card--tall">
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--circle" />
        </div>
      </div>
    </div>
  )
}

export function LoadError({ message, onRetry }) {
  return (
    <div className="page">
      <div className="card state-card" role="alert">
        <div className="state-card__icon state-card__icon--danger">
          <CircleAlert size={26} />
        </div>
        <h2>We couldn't load your data</h2>
        <p className="muted">{message}</p>
        <button className="btn btn-primary" onClick={() => onRetry()}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    </div>
  )
}

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-banner" role="status">
      <CloudOff size={16} />
      <span>You're offline. You can browse your data, but changes can't be saved until you reconnect.</span>
    </div>
  )
}

export function SetupRequired({ reason }) {
  return (
    <div className="auth-page">
      <main className="auth-card glass">
        <div className="state-card__icon">
          <Settings2 size={26} />
        </div>
        <h1 className="setup-title">{reason === 'privileged-key' ? 'Unsafe Supabase key' : 'Cloud storage isn’t configured'}</h1>
        {reason === 'privileged-key' ? (
          <p className="muted">
            The configured key is a <strong>service-role / secret key</strong>, which bypasses Row Level Security and must never be used in a browser app. Replace it with your project's
            publishable (anon) key.
          </p>
        ) : (
          <p className="muted">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (or <code>VITE_SUPABASE_ANON_KEY</code>) and rebuild. See the README for setup steps.
          </p>
        )}
        <p className="muted setup-note">Any data saved in this browser by the previous version is untouched.</p>
      </main>
    </div>
  )
}
