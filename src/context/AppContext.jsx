import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { generateDemoData } from '../data/demoData'
import { friendlyError } from '../data/repository'
import { claimLocalData, getLocalOwner, prepareForImport, setImportState, settingsForImport } from '../data/localData'
import { useTheme } from './ThemeContext'

// Defaults for a brand-new account. (The pre-accounts demo used a made-up opening
// balance and budget; real accounts start from zero.)
const DEFAULT_PROFILE = {
  currency: 'USD',
  name: '',
  openingBalance: 0,
  monthlyBudget: 0,
}

const REFRESH_AFTER_MS = 30_000

const sortTxs = (txs) =>
  [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)))

const newId = () => crypto.randomUUID()

export const nameFromEmail = (email = '') => {
  const local = email.split('@')[0] || ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : ''
}

const AppContext = createContext(null)

export function AppProvider({ user, repo, children }) {
  const { theme, setTheme, toggleTheme } = useTheme()
  const userId = user.id
  const userRef = useRef(user)
  userRef.current = user

  const [status, setStatus] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [pending, setPending] = useState(0)
  const [toasts, setToasts] = useState([])
  const [editor, setEditor] = useState(null) // null | { tx?: Transaction }
  const toastId = useRef(0)
  const txRef = useRef(transactions)
  txRef.current = transactions
  const profileRef = useRef(profile)
  profileRef.current = profile
  const pendingRef = useRef(0)
  const lastLoad = useRef(0)

  // `action` is an optional { label, onClick } button shown in the toast (e.g. Undo).
  const toast = useCallback((message, tone = 'success', action = null) => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-2), { id, message, tone, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action || tone === 'danger' ? 6000 : 3200)
  }, [])

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // Counts in-flight writes so the UI can show "Saving…".
  const track = useCallback(async (fn) => {
    pendingRef.current += 1
    setPending((p) => p + 1)
    try {
      return await fn()
    } finally {
      pendingRef.current -= 1
      setPending((p) => p - 1)
    }
  }, [])

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setStatus('loading')
        setLoadError(null)
      }
      try {
        const [txs, prof] = await Promise.all([repo.listTransactions(userId), repo.getProfile(userId)])
        let p = prof
        if (!p) {
          // The sign-up trigger normally creates this row; create it if it's missing.
          const u = userRef.current
          p = { ...DEFAULT_PROFILE, name: (u.user_metadata?.display_name || nameFromEmail(u.email)).slice(0, 40) }
          await repo.saveProfile(userId, p)
        }
        setTransactions(sortTxs(txs))
        setProfile({ ...DEFAULT_PROFILE, ...p })
        setStatus('ready')
        lastLoad.current = Date.now()
      } catch (e) {
        if (!silent) {
          setLoadError(friendlyError(e, 'load your data'))
          setStatus('error')
        }
      }
    },
    [repo, userId],
  )

  useEffect(() => {
    load()
  }, [load])

  // Pick up changes made on other devices when the tab becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pendingRef.current === 0 && lastLoad.current && Date.now() - lastLoad.current > REFRESH_AFTER_MS) {
        load({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // Add / edit wait for the server so the form can stay open (with the user's input) on failure.
  const addTransaction = useCallback(
    async (tx) => {
      const full = { ...tx, id: newId(), createdAt: Date.now(), isSample: false }
      try {
        await track(() => repo.insertTransactions(userId, [full]))
      } catch (e) {
        return { ok: false, error: friendlyError(e, 'save this transaction') }
      }
      setTransactions((txs) => sortTxs([full, ...txs]))
      toast(tx.type === 'income' ? 'Income added' : 'Expense added')
      return { ok: true }
    },
    [repo, userId, track, toast],
  )

  const updateTransaction = useCallback(
    async (id, patch) => {
      try {
        await track(() => repo.updateTransaction(userId, id, patch))
      } catch (e) {
        return { ok: false, error: friendlyError(e, 'save your changes') }
      }
      setTransactions((txs) => sortTxs(txs.map((t) => (t.id === id ? { ...t, ...patch } : t))))
      toast('Transaction updated')
      return { ok: true }
    },
    [repo, userId, track, toast],
  )

  const restoreTransaction = useCallback(
    async (removed) => {
      setTransactions((txs) => (txs.some((t) => t.id === removed.id) ? txs : sortTxs([removed, ...txs])))
      try {
        await track(() => repo.insertTransactions(userId, [removed]))
        toast('Transaction restored')
      } catch (e) {
        setTransactions((txs) => txs.filter((t) => t.id !== removed.id))
        toast(friendlyError(e, 'restore this transaction'), 'danger')
      }
    },
    [repo, userId, track, toast],
  )

  // Delete is optimistic (feels instant) and rolls back if the server refuses.
  const deleteTransaction = useCallback(
    async (id) => {
      const removed = txRef.current.find((t) => t.id === id)
      if (!removed) return
      setTransactions((txs) => txs.filter((t) => t.id !== id))
      toast(`Deleted “${removed.name || 'transaction'}”`, 'danger', {
        label: 'Undo',
        onClick: () => restoreTransaction(removed),
      })
      try {
        await track(() => repo.deleteTransactions(userId, { id }))
      } catch (e) {
        setTransactions((txs) => (txs.some((t) => t.id === id) ? txs : sortTxs([removed, ...txs])))
        toast(friendlyError(e, 'delete this transaction'), 'danger')
      }
    },
    [repo, userId, track, toast, restoreTransaction],
  )

  // Theme stays on this device; everything else is saved to the account profile.
  const updateSettings = useCallback(
    async (patch) => {
      const { theme: nextTheme, ...rest } = patch
      if (nextTheme) setTheme(nextTheme)
      if (!Object.keys(rest).length) return { ok: true }
      const previous = profileRef.current
      setProfile((p) => ({ ...p, ...rest }))
      try {
        await track(() => repo.saveProfile(userId, rest))
        return { ok: true }
      } catch (e) {
        setProfile((p) => ({ ...p, ...Object.fromEntries(Object.keys(rest).map((k) => [k, previous[k]])) }))
        toast(friendlyError(e, 'save your settings'), 'danger')
        return { ok: false }
      }
    },
    [repo, userId, track, toast, setTheme],
  )

  const loadSampleData = useCallback(async () => {
    const samples = generateDemoData().map((t) => ({ ...t, id: newId(), isSample: true }))
    try {
      await track(() => repo.insertTransactions(userId, samples))
    } catch (e) {
      toast(friendlyError(e, 'load the sample data'), 'danger')
      return { ok: false }
    }
    setTransactions((txs) => sortTxs([...samples, ...txs]))
    toast(`Loaded ${samples.length} sample transactions`)
    return { ok: true }
  }, [repo, userId, track, toast])

  const removeSampleData = useCallback(async () => {
    try {
      await track(() => repo.deleteTransactions(userId, { sample: true }))
    } catch (e) {
      toast(friendlyError(e, 'remove the sample data'), 'danger')
      return { ok: false }
    }
    setTransactions((txs) => txs.filter((t) => !t.isSample))
    toast('Sample data removed', 'danger')
    return { ok: true }
  }, [repo, userId, track, toast])

  const clearAll = useCallback(async () => {
    try {
      await track(() => repo.deleteTransactions(userId))
    } catch (e) {
      toast(friendlyError(e, 'clear your transactions'), 'danger')
      return { ok: false }
    }
    setTransactions([])
    toast('All transactions cleared', 'danger')
    return { ok: true }
  }, [repo, userId, track, toast])

  // Copies (never moves) this browser's pre-accounts data into the account.
  const importLocal = useCallback(
    async ({ own = [], sample = [], settings = null }) => {
      // Never import local data another account on this browser has already claimed.
      const owner = getLocalOwner()
      if (owner && owner !== userId) return { ok: false, error: 'This data belongs to another account on this browser.' }
      const txs = [...prepareForImport(own), ...prepareForImport(sample, { sample: true })]
      const profilePatch = settingsForImport(settings)
      try {
        await track(async () => {
          if (txs.length) await repo.insertTransactions(userId, txs)
          if (profilePatch) await repo.saveProfile(userId, profilePatch)
        })
      } catch (e) {
        return { ok: false, error: friendlyError(e, 'import your data') }
      }
      claimLocalData(userId)
      setImportState(userId, 'imported')
      await load({ silent: true })
      toast(txs.length ? `Imported ${txs.length} transaction${txs.length === 1 ? '' : 's'}` : 'Settings imported')
      return { ok: true }
    },
    [repo, userId, track, toast, load],
  )

  const settings = useMemo(
    () => ({ ...profile, name: profile.name || nameFromEmail(user.email), theme }),
    [profile, theme, user.email],
  )
  const sampleCount = useMemo(() => transactions.filter((t) => t.isSample).length, [transactions])

  const value = useMemo(
    () => ({
      user,
      status,
      loadError,
      retry: load,
      saving: pending > 0,
      transactions,
      sampleCount,
      settings,
      toasts,
      editor,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      updateSettings,
      toggleTheme,
      loadSampleData,
      removeSampleData,
      clearAll,
      importLocal,
      toast,
      dismissToast,
      openEditor: (tx) => setEditor({ tx }),
      closeEditor: () => setEditor(null),
    }),
    [user, status, loadError, load, pending, transactions, sampleCount, settings, toasts, editor, addTransaction, updateTransaction, deleteTransaction, updateSettings, toggleTheme, loadSampleData, removeSampleData, clearAll, importLocal, toast, dismissToast],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
