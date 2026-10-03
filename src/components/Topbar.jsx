import { Menu, Plus, Sun, Moon, Bell } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function Topbar({ title, subtitle, onMenu }) {
  const { settings, toggleTheme, openEditor } = useApp()
  const dark = settings.theme === 'dark'

  return (
    <header className="topbar">
      <button className="icon-btn topbar__menu" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="topbar__titles">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="topbar__actions">
        <button className="icon-btn hide-sm" aria-label="Notifications" title="No new notifications">
          <Bell size={18} />
          <span className="dot" />
        </button>
        <button
          className="icon-btn theme-toggle"
          onClick={toggleTheme}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          <span className={`theme-icon ${dark ? 'is-dark' : ''}`}>
            <Sun size={18} className="sun" />
            <Moon size={18} className="moon" />
          </span>
        </button>
        <button className="btn btn-primary" onClick={() => openEditor()}>
          <Plus size={18} strokeWidth={2.5} />
          <span className="hide-xs">Add transaction</span>
        </button>
      </div>
    </header>
  )
}
