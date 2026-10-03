import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { generateDemoData } from '../data/demoData'

const TX_KEY = 'lumen.transactions'
const SETTINGS_KEY = 'lumen.settings'

const DEFAULT_SETTINGS = {
  theme: 'dark',
  currency: 'USD',
  name: 'Alex Morgan',
  openingBalance: 8420,
  monthlyBudget: 4200,
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback()
  } catch {
    return fallback()
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable (private mode / quota) — keep working in memory */
  }
}

const sortTxs = (txs) =>
  [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)))

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`)

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [transactions, setTransactions] = useState(() => load(TX_KEY, () => generateDemoData()))
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, () => ({})) }))
  const [toasts, setToasts] = useState([])
  const [editor, setEditor] = useState(null) // null | { tx?: Transaction }
  const toastId = useRef(0)

  useEffect(() => save(TX_KEY, transactions), [transactions])
  useEffect(() => {
    save(SETTINGS_KEY, settings)
    document.documentElement.dataset.theme = settings.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0a0c14' : '#f4f5fb')
  }, [settings])

  const toast = useCallback((message, tone = 'success') => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const addTransaction = useCallback(
    (tx) => {
      setTransactions((txs) => sortTxs([{ ...tx, id: newId(), createdAt: Date.now() }, ...txs]))
      toast(tx.type === 'income' ? 'Income added' : 'Expense added')
    },
    [toast],
  )

  const updateTransaction = useCallback(
    (id, patch) => {
      setTransactions((txs) => sortTxs(txs.map((t) => (t.id === id ? { ...t, ...patch } : t))))
      toast('Transaction updated')
    },
    [toast],
  )

  const deleteTransaction = useCallback(
    (id) => {
      setTransactions((txs) => txs.filter((t) => t.id !== id))
      toast('Transaction deleted', 'danger')
    },
    [toast],
  )

  const updateSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])
  const toggleTheme = useCallback(() => setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })), [])

  const resetDemo = useCallback(() => {
    setTransactions(generateDemoData())
    toast('Demo data restored')
  }, [toast])

  const clearAll = useCallback(() => {
    setTransactions([])
    toast('All transactions cleared', 'danger')
  }, [toast])

  const value = useMemo(
    () => ({
      transactions,
      settings,
      toasts,
      editor,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      updateSettings,
      toggleTheme,
      resetDemo,
      clearAll,
      toast,
      dismissToast,
      openEditor: (tx) => setEditor({ tx }),
      closeEditor: () => setEditor(null),
    }),
    [transactions, settings, toasts, editor, addTransaction, updateTransaction, deleteTransaction, updateSettings, toggleTheme, resetDemo, clearAll, toast, dismissToast],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
