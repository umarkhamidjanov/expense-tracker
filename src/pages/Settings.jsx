import { useState } from 'react'
import { User, Palette, Wallet, Database, Sun, Moon, Download, RotateCcw, Trash } from 'lucide-react'
import { useApp } from '../context/AppContext'
import ConfirmDialog from '../components/ConfirmDialog'
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

function NumberSetting({ value, onCommit, currency }) {
  const [draft, setDraft] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(String(value))
  }
  const commit = () => {
    const n = Number(draft)
    if (Number.isFinite(n) && n >= 0) onCommit(Math.round(n * 100) / 100)
    else setDraft(String(value))
  }
  return (
    <div className="input-affix">
      <input className="input" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      <span className="muted">{formatMoney(value, currency, { compact: true })}</span>
    </div>
  )
}

export default function Settings() {
  const { settings, updateSettings, transactions, resetDemo, clearAll, toast } = useApp()
  const [confirm, setConfirm] = useState(null)
  const dark = settings.theme === 'dark'

  return (
    <div className="page page--narrow">
      <Section icon={User} title="Profile" desc="How you appear across the app." delay={0}>
        <Row label="Display name">
          <input
            className="input"
            value={settings.name}
            maxLength={40}
            onChange={(e) => updateSettings({ name: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && updateSettings({ name: 'Alex Morgan' })}
          />
        </Row>
      </Section>

      <Section icon={Palette} title="Appearance" desc="Personalize the look and feel." delay={60}>
        <Row label="Theme" hint="Switch between dark and light mode.">
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
            <select value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })} aria-label="Currency">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
          </label>
        </Row>
      </Section>

      <Section icon={Wallet} title="Finances" desc="Baselines used to calculate your balance and budget." delay={120}>
        <Row label="Opening balance" hint="Your balance before the first recorded transaction.">
          <NumberSetting value={settings.openingBalance} currency={settings.currency} onCommit={(v) => { updateSettings({ openingBalance: v }); toast('Opening balance saved') }} />
        </Row>
        <Row label="Monthly budget" hint="Spending target shown on the dashboard.">
          <NumberSetting value={settings.monthlyBudget} currency={settings.currency} onCommit={(v) => { updateSettings({ monthlyBudget: v }); toast('Monthly budget saved') }} />
        </Row>
      </Section>

      <Section icon={Database} title="Data" desc={`${transactions.length} transactions stored locally in this browser.`} delay={180}>
        <Row label="Export transactions" hint="Download everything as a CSV file.">
          <button className="btn btn-ghost" onClick={() => exportCSV(transactions)} disabled={!transactions.length}>
            <Download size={16} /> Export CSV
          </button>
        </Row>
        <Row label="Restore demo data" hint="Replace all transactions with sample data.">
          <button className="btn btn-ghost" onClick={() => setConfirm('reset')}>
            <RotateCcw size={16} /> Restore
          </button>
        </Row>
        <Row label="Clear all transactions" hint="Permanently delete every transaction.">
          <button className="btn btn-danger-ghost" onClick={() => setConfirm('clear')} disabled={!transactions.length}>
            <Trash size={16} /> Clear all
          </button>
        </Row>
      </Section>

      <p className="muted settings-foot">Lumen v1.0 · Your data never leaves this device.</p>

      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'clear' ? 'Clear all transactions?' : 'Restore demo data?'}
        message={
          confirm === 'clear'
            ? 'This permanently deletes every transaction. This cannot be undone.'
            : 'Your current transactions will be replaced with the sample dataset.'
        }
        confirmLabel={confirm === 'clear' ? 'Clear all' : 'Restore'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'clear') clearAll()
          else resetDemo()
          setConfirm(null)
        }}
      />
    </div>
  )
}
