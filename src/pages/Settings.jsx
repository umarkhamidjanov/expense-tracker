import { useState } from 'react'
import { User, Palette, Wallet, Database, Sun, Moon, Download, Trash, Sparkles, HardDrive, CloudUpload, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { ImportDialog } from '../components/ImportLocalData'
import { deleteLocalData, readLocalData } from '../data/localData'
import { CURRENCIES, formatMoney } from '../utils/format'
import { exportCSV } from '../utils/csv'

function Section({ icon: Icon, title, desc, children, delay }) {
  return (
    <section className="card settings-section fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="settings-section__head">
        <span className="settings-section__icon">
          <Icon size={18} />
        </span>
        <div>
          <h3>{title}</h3>
          <p className="muted">{desc}</p>
        </div>
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-row__label">{label}</div>
        {hint && <div className="muted setting-row__hint">{hint}</div>}
      </div>
      <div className="setting-row__control">{children}</div>
    </div>
  )
}

// Inputs save when the field loses focus (or on Enter), not on every keystroke.
function useDraft(value) {
  const [draft, setDraft] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(String(value))
  }
  return [draft, setDraft]
}

function NumberSetting({ value, onCommit, currency, label }) {
  const [draft, setDraft] = useDraft(value)
  const commit = () => {
    const n = Number(draft)
    if (!Number.isFinite(n) || n < 0 || n >= 1e12) return setDraft(String(value))
    const rounded = Math.round(n * 100) / 100
    if (rounded !== value) onCommit(rounded)
    else setDraft(String(value))
  }
  return (
    <div className="input-affix">
      <input
        className="input"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="muted">{formatMoney(value, currency, { compact: true })}</span>
    </div>
  )
}

function TextSetting({ value, onCommit, label, maxLength = 40 }) {
  const [draft, setDraft] = useDraft(value)
  const commit = () => {
    const v = draft.trim()
    if (!v) return setDraft(String(value))
    if (v !== value) onCommit(v)
  }
  return (
    <input
      className="input"
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

const CONFIRMS = {
  sample: {
    title: 'Load sample data?',
    message: 'This adds about 200 sample transactions covering the last six months. They are labeled “Sample” and can be removed at any time without affecting your own transactions.',
    label: 'Load sample data',
    tone: 'primary',
  },
  removeSample: {
    title: 'Remove sample data?',
    message: 'All transactions labeled “Sample” will be deleted from your account. Your own transactions are not affected.',
    label: 'Remove',
  },
  clear: {
    title: 'Clear all transactions?',
    message: 'This permanently deletes every transaction in your account, on all devices. This cannot be undone.',
    label: 'Clear all',
  },
  deleteLocal: {
    title: 'Delete local copy?',
    message: 'This removes the data saved in this browser by the previous version of Lumen. Anything you have already imported stays in your account. This cannot be undone.',
    label: 'Delete local copy',
  },
}

export default function Settings() {
  const { settings, updateSettings, transactions, sampleCount, loadSampleData, removeSampleData, clearAll, toast, user } = useApp()
  const { signOut, sendPasswordReset } = useAuth()
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState(() => readLocalData(user.id))
  const [importOpen, setImportOpen] = useState(false)
  const dark = settings.theme === 'dark'
  const hasLocal = local.hasData || !!local.settings

  const saveSetting = async (patch, message) => {
    const res = await updateSettings(patch)
    if (res.ok && message) toast(message)
  }

  const runConfirm = async () => {
    setBusy(true)
    if (confirm === 'sample') await loadSampleData()
    else if (confirm === 'removeSample') await removeSampleData()
    else if (confirm === 'clear') await clearAll()
    else if (confirm === 'deleteLocal') {
      deleteLocalData(user.id)
      setLocal(readLocalData(user.id))
      toast('Local copy deleted', 'danger')
    }
    setBusy(false)
    setConfirm(null)
  }

  const resetPassword = async () => {
    const { error } = await sendPasswordReset(user.email)
    toast(error || `Password reset link sent to ${user.email}`, error ? 'danger' : 'success')
  }

  const c = confirm && CONFIRMS[confirm]

  return (
    <div className="page page--narrow">
      <Section icon={User} title="Profile" desc="How you appear across the app." delay={0}>
        <Row label="Display name">
          <TextSetting label="Display name" value={settings.name} onCommit={(v) => saveSetting({ name: v }, 'Name saved')} />
        </Row>
        <Row label="Email" hint="The address you sign in with.">
          <span className="setting-value">{user.email}</span>
        </Row>
      </Section>

      <Section icon={Palette} title="Appearance" desc="Personalize the look and feel." delay={60}>
        <Row label="Theme" hint="Saved on this device only.">
          <div className="tabs tabs--sm" role="tablist" aria-label="Theme">
            <button role="tab" aria-selected={dark} className={dark ? 'is-active' : ''} onClick={() => updateSettings({ theme: 'dark' })}>
              <Moon size={14} /> Dark
            </button>
            <button role="tab" aria-selected={!dark} className={!dark ? 'is-active' : ''} onClick={() => updateSettings({ theme: 'light' })}>
              <Sun size={14} /> Light
            </button>
          </div>
        </Row>
        <Row label="Currency" hint="Used for all amounts and charts.">
          <label className="select">
            <select value={settings.currency} onChange={(e) => saveSetting({ currency: e.target.value })} aria-label="Currency">
              {CURRENCIES.map((cur) => (
                <option key={cur.code} value={cur.code}>
                  {cur.code} — {cur.label}
                </option>
              ))}
            </select>
          </label>
        </Row>
      </Section>

      <Section icon={Wallet} title="Finances" desc="Baselines used to calculate your balance and budget." delay={120}>
        <Row label="Opening balance" hint="Your balance before the first recorded transaction.">
          <NumberSetting label="Opening balance" value={settings.openingBalance} currency={settings.currency} onCommit={(v) => saveSetting({ openingBalance: v }, 'Opening balance saved')} />
        </Row>
        <Row label="Monthly budget" hint="Spending target shown on the dashboard. Set 0 for no budget.">
          <NumberSetting label="Monthly budget" value={settings.monthlyBudget} currency={settings.currency} onCommit={(v) => saveSetting({ monthlyBudget: v }, 'Monthly budget saved')} />
        </Row>
      </Section>

      <Section
        icon={Database}
        title="Data"
        desc={`${transactions.length} transaction${transactions.length === 1 ? '' : 's'} saved to your account${sampleCount ? `, including ${sampleCount} sample` : ''}.`}
        delay={180}
      >
        <Row label="Export transactions" hint="Download everything as a CSV file.">
          <button className="btn btn-ghost" onClick={() => exportCSV(transactions)} disabled={!transactions.length}>
            <Download size={16} /> Export CSV
          </button>
        </Row>
        {sampleCount > 0 ? (
          <Row label="Sample data" hint={`${sampleCount} sample transactions are in your account.`}>
            <button className="btn btn-ghost" onClick={() => setConfirm('removeSample')}>
              <Trash size={16} /> Remove sample data
            </button>
          </Row>
        ) : (
          <Row label="Load sample data" hint="Add labeled demo transactions to explore the app.">
            <button className="btn btn-ghost" onClick={() => setConfirm('sample')}>
              <Sparkles size={16} /> Load sample data
            </button>
          </Row>
        )}
        <Row label="Clear all transactions" hint="Permanently delete every transaction in your account.">
          <button className="btn btn-danger-ghost" onClick={() => setConfirm('clear')} disabled={!transactions.length}>
            <Trash size={16} /> Clear all
          </button>
        </Row>
      </Section>

      {hasLocal && (
        <Section
          icon={HardDrive}
          title="This browser"
          desc={`Data saved here before you signed in: ${local.transactions.length} transaction${local.transactions.length === 1 ? '' : 's'}${local.settings ? ' and settings' : ''}.`}
          delay={210}
        >
          <Row label="Import into your account" hint="Copies the data; the local copy stays until you delete it.">
            <button className="btn btn-ghost" onClick={() => setImportOpen(true)}>
              <CloudUpload size={16} /> Import…
            </button>
          </Row>
          <Row label="Delete local copy" hint="Removes the old data from this browser only.">
            <button className="btn btn-danger-ghost" onClick={() => setConfirm('deleteLocal')}>
              <Trash size={16} /> Delete local copy
            </button>
          </Row>
        </Section>
      )}

      <Section icon={ShieldCheck} title="Account" desc={`Signed in as ${user.email}`} delay={240}>
        <Row label="Password" hint="We'll email you a secure link to set a new password.">
          <button className="btn btn-ghost" onClick={resetPassword}>
            <KeyRound size={16} /> Change password
          </button>
        </Row>
        <Row label="Sign out" hint="Signs out on this device only.">
          <button className="btn btn-ghost" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </Row>
      </Section>

      <p className="muted settings-foot">Lumen v1.1 · Your data is stored in your account and only you can access it.</p>

      <ConfirmDialog
        open={!!confirm}
        title={c?.title}
        message={c?.message}
        confirmLabel={busy ? 'Working…' : c?.label}
        tone={c?.tone}
        busy={busy}
        onCancel={() => !busy && setConfirm(null)}
        onConfirm={runConfirm}
      />

      <ImportDialog
        open={importOpen}
        local={local}
        onClose={() => {
          setImportOpen(false)
          setLocal(readLocalData(user.id))
        }}
      />
    </div>
  )
}
