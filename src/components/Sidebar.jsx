import { LayoutDashboard, ArrowLeftRight, ChartPie, Settings, X, Sparkles, LogOut } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { formatMoney } from '../utils/format'
import { totals } from '../utils/stats'

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analytics', icon: ChartPie },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ page, onNavigate, open, onClose }) {
  const { transactions, settings, user } = useApp()
  const { signOut } = useAuth()
  const { savings } = totals(transactions)
  const balance = settings.openingBalance + savings
  const initials = settings.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || (user.email || '?')[0].toUpperCase()

  return (
    <>
      <div className={`sidebar-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar glass ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar__brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M5 15l4-4.5 3 2.6L19 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Lumen</div>
            <div className="brand-sub">Personal finance</div>
          </div>
          <button className="icon-btn sidebar__close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <span className="sidebar__label">Menu</span>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'is-active' : ''}`}
              onClick={() => onNavigate(id)}
              aria-current={page === id ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__promo">
          <div className="promo-icon">
            <Sparkles size={16} />
          </div>
          <div className="promo-title">Net worth</div>
          <div className="promo-value">{formatMoney(balance, settings.currency)}</div>
          <div className="promo-sub">Across all accounts</div>
        </div>

        <div className="sidebar__user">
          <div className="avatar">{initials}</div>
          <div className="sidebar__user-text">
            <div className="user-name">{settings.name}</div>
            <div className="user-plan" title={user.email}>
              {user.email}
            </div>
          </div>
          <button className="icon-btn icon-btn--sm sidebar__signout" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>
    </>
  )
}
