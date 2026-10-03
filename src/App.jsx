import { useEffect, useState } from 'react'
import Sidebar, { NAV } from './components/Sidebar'
import Topbar from './components/Topbar'
import TransactionModal from './components/TransactionModal'
import Toasts from './components/Toasts'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

const PAGES = {
  dashboard: { component: Dashboard, title: 'Dashboard', subtitle: 'Your financial overview' },
  transactions: { component: Transactions, title: 'Transactions', subtitle: 'Search, filter and manage your activity' },
  analytics: { component: Analytics, title: 'Analytics', subtitle: 'Understand where your money goes' },
  settings: { component: Settings, title: 'Settings', subtitle: 'Preferences and data' },
}

const fromHash = () => {
  const id = window.location.hash.replace('#/', '')
  return PAGES[id] ? id : 'dashboard'
}

export default function App() {
  const [page, setPage] = useState(fromHash)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onHash = () => setPage(fromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${PAGES[page].title} · Lumen`
  }, [page])

  // Off-canvas drawer: lock page scroll, close on Escape, and close if the
  // viewport grows past the drawer breakpoint (e.g. rotating a tablet).
  useEffect(() => {
    if (!menuOpen) return
    const mq = window.matchMedia('(min-width: 1025px)')
    const close = () => setMenuOpen(false)
    const onKey = (e) => e.key === 'Escape' && close()
    const onChange = (e) => e.matches && close()
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onChange)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onChange)
    }
  }, [menuOpen])

  const navigate = (id) => {
    if (id !== page) {
      window.location.hash = `/${id}`
      window.scrollTo({ top: 0 })
    }
    setMenuOpen(false)
  }

  const { component: Page, title, subtitle } = PAGES[page]

  return (
    <div className="app">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb--1" />
        <span className="orb orb--2" />
        <span className="orb orb--3" />
      </div>

      <Sidebar page={page} onNavigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="main">
        <Topbar title={title} subtitle={subtitle} onMenu={() => setMenuOpen(true)} />
        {/* key re-mounts the page so entrance animations replay on navigation */}
        <Page key={page} onNavigate={navigate} />
      </main>

      <nav className="bottom-nav glass" aria-label="Mobile navigation">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} className={page === id ? 'is-active' : ''} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <TransactionModal />
      <Toasts />
    </div>
  )
}
