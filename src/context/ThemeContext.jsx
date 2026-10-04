import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Theme is a per-device preference, so it stays in localStorage and is never synced.
export const THEME_KEY = 'lumen.theme'

function initialTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'dark' || t === 'light') return t
    // Carry over the theme chosen in the pre-accounts version (read-only).
    const legacy = JSON.parse(localStorage.getItem('lumen.settings') || 'null')
    if (legacy?.theme === 'dark' || legacy?.theme === 'light') return legacy.theme
  } catch {
    /* ignore */
  }
  return 'dark'
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0c14' : '#f4f5fb')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const setTheme = useCallback((t) => setThemeState(t === 'light' ? 'light' : 'dark'), [])
  const toggleTheme = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
