import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, PiggyBank, Percent, Flame, Receipt } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CategoryDonut, DailyBarsChart, Legend, MonthlyBarsChart, INCOME, EXPENSE } from '../components/charts'
import CategoryIcon from '../components/CategoryIcon'
import { byCategory, dailySeries, foldForChart, inMonth, monthlySeries, samePeriodLabel, throughDay, totals } from '../utils/stats'
import { formatDate, formatMoney, lastNMonths, monthLabel, pctChange } from '../utils/format'

function Kpi({ icon: Icon, label, value, change, goodWhenUp = true, sub }) {
  const has = change !== null && Number.isFinite(change)
  const up = has && change >= 0
  const good = has && up === goodWhenUp
  return (
    <div className="kpi">
      <div className="kpi__top">
        <span className="kpi__icon">
          <Icon size={16} />
        </span>
        <span className="muted">{label}</span>
      </div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__foot">
        {has && (
          <span className={`trend ${good ? 'trend--good' : 'trend--bad'}`}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        <span className="muted">{sub}</span>
      </div>
    </div>
  )
}

export default function Analytics() {
  const { transactions, settings } = useApp()
  const cur = settings.currency
  const months = useMemo(() => lastNMonths(12), [])
  const [selected, setSelected] = useState(months[months.length - 1])
  const idx = months.indexOf(selected)
  const prevKey = lastNMonths(2, new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, 1))[0]

  const d = useMemo(() => {
    const [y, m] = selected.split('-').map(Number)
    const now = new Date()
    const isCurrent = y === now.getFullYear() && m === now.getMonth() + 1
    const days = isCurrent ? now.getDate() : new Date(y, m, 0).getDate()
    const daysInPrev = new Date(y, m - 1, 0).getDate()
    const monthTxs = inMonth(transactions, selected)
    // For the in-progress month, compare against the same days of the prior month.
    const prev = isCurrent ? throughDay(inMonth(transactions, prevKey), days) : inMonth(transactions, prevKey)
    const t = totals(monthTxs)
    const p = totals(prev)
    const cats = byCategory(monthTxs)
    const prevCats = Object.fromEntries(byCategory(prev).map((c) => [c.id, c.value]))
    const expenses = monthTxs.filter((x) => x.type === 'expense')
    return {
      t,
      p,
      avgDaily: t.expense / days,
      prevAvgDaily: p.expense / (isCurrent ? Math.min(days, daysInPrev) : daysInPrev),
      compareLabel: isCurrent ? samePeriodLabel(prevKey, days, daysInPrev) : 'vs. prior month',
      cats,
      prevCats,
      chartCats: foldForChart(cats),
      daily: dailySeries(transactions, selected),
      top: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
      series: monthlySeries(transactions, months),
    }
  }, [transactions, selected, prevKey, months])

  const visibleSeries = d.series.slice(-6)
  const tableRows = [...d.series].reverse().filter((r) => r.income || r.expense)
  const maxCat = d.cats[0]?.value || 1

  return (
    <div className="page">
      <div className="page-head fade-up">
        <div>
          <h2 className="page-head__title">Monthly statistics</h2>
          <p className="muted">
            {d.compareLabel === 'vs. prior month' ? `Compared with ${monthLabel(prevKey, 'long')}` : d.compareLabel.replace('vs.', 'Compared with')}
          </p>
        </div>
        <div className="month-picker">
          <button className="icon-btn" onClick={() => setSelected(months[idx - 1])} disabled={idx <= 0} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <span className="month-picker__label">{monthLabel(selected, 'long')}</span>
          <button className="icon-btn" onClick={() => setSelected(months[idx + 1])} disabled={idx >= months.length - 1} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <section className="card kpi-grid fade-up" style={{ animationDelay: '40ms' }}>
        <Kpi icon={TrendingUp} label="Income" value={formatMoney(d.t.income, cur)} change={pctChange(d.t.income, d.p.income)} sub={d.compareLabel} />
        <Kpi icon={TrendingDown} label="Expenses" value={formatMoney(d.t.expense, cur)} change={pctChange(d.t.expense, d.p.expense)} goodWhenUp={false} sub={d.compareLabel} />
        <Kpi icon={PiggyBank} label="Net savings" value={formatMoney(d.t.savings, cur)} change={pctChange(d.t.savings, d.p.savings)} sub={d.compareLabel} />
        <Kpi icon={Percent} label="Savings rate" value={`${d.t.savingsRate.toFixed(1)}%`} change={null} sub={`${d.p.savingsRate.toFixed(1)}% ${d.compareLabel.replace('vs. ', 'in ')}`} />
        <Kpi icon={Flame} label="Avg. daily spend" value={formatMoney(d.avgDaily, cur)} change={pctChange(d.avgDaily, d.prevAvgDaily)} goodWhenUp={false} sub={d.compareLabel} />
        <Kpi icon={Receipt} label="Transactions" value={d.t.count} change={null} sub={`${d.p.count} ${d.compareLabel.replace('vs. ', 'in ')}`} />
      </section>

      <div className="grid grid--main">
        <section className="card card--chart fade-up" style={{ animationDelay: '100ms' }}>
          <div className="card__head">
            <div>
              <h3>Income vs. expenses</h3>
              <p className="muted">Last 6 months · click a month to inspect it</p>
            </div>
            <Legend items={[{ label: 'Income', color: INCOME }, { label: 'Expenses', color: EXPENSE }]} />
          </div>
          <MonthlyBarsChart data={visibleSeries} currency={cur} activeKey={selected} onSelect={(k) => k && setSelected(k)} />
        </section>

        <section className="card fade-up" style={{ animationDelay: '160ms' }}>
          <div className="card__head">
            <div>
              <h3>Spending by category</h3>
              <p className="muted">{monthLabel(selected, 'long')}</p>
            </div>
          </div>
          <CategoryDonut data={d.chartCats} total={d.t.expense} currency={cur} size={190} />
        </section>
      </div>

      <section className="card fade-up" style={{ animationDelay: '200ms' }}>
        <div className="card__head">
          <div>
            <h3>Daily spending</h3>
            <p className="muted">{monthLabel(selected, 'long')} · peak day {formatMoney(Math.max(0, ...d.daily.map((x) => x.expense)), cur)}</p>
          </div>
        </div>
        <DailyBarsChart data={d.daily} currency={cur} monthName={monthLabel(selected)} />
      </section>

      <div className="grid grid--half">
        <section className="card fade-up" style={{ animationDelay: '240ms' }}>
          <div className="card__head">
            <div>
              <h3>Category breakdown</h3>
              <p className="muted">Change vs. {monthLabel(prevKey, 'long')}</p>
            </div>
          </div>
          {d.cats.length ? (
            <ul className="cat-bars">
              {d.cats.map((c) => {
                const ch = pctChange(c.value, d.prevCats[c.id])
                return (
                  <li key={c.id} className="cat-bar">
                    <CategoryIcon id={c.id} size="sm" />
                    <div className="cat-bar__body">
                      <div className="cat-bar__row">
                        <span className="cat-bar__name">{c.name}</span>
                        <span className="cat-bar__value">{formatMoney(c.value, cur)}</span>
                      </div>
                      <div className="cat-bar__track">
                        <div className="cat-bar__fill" style={{ width: `${(c.value / maxCat) * 100}%`, background: `var(--series-${c.slot || 'other'})` }} />
                      </div>
                    </div>
                    <span className={`cat-bar__change ${ch === null ? '' : ch > 0 ? 'trend--bad' : 'trend--good'}`}>
                      {ch === null ? 'New' : `${ch > 0 ? '+' : ''}${ch.toFixed(0)}%`}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="donut-empty">No expenses this month.</div>
          )}
        </section>

        <section className="card fade-up" style={{ animationDelay: '280ms' }}>
          <div className="card__head">
            <div>
              <h3>Largest expenses</h3>
              <p className="muted">Top 5 in {monthLabel(selected, 'long')}</p>
            </div>
          </div>
          {d.top.length ? (
            <ol className="top-list">
              {d.top.map((t, i) => (
                <li key={t.id}>
                  <span className="top-list__rank">{i + 1}</span>
                  <CategoryIcon id={t.category} size="sm" />
                  <div className="top-list__main">
                    <div className="top-list__title">{t.name || 'Expense'}</div>
                    <div className="muted">{formatDate(t.date)}</div>
                  </div>
                  <span className="top-list__amount">{formatMoney(t.amount, cur)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="donut-empty">No expenses this month.</div>
          )}
        </section>
      </div>

      <section className="card fade-up" style={{ animationDelay: '320ms' }}>
        <div className="card__head">
          <div>
            <h3>Month by month</h3>
            <p className="muted">Full history table</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Income</th>
                <th className="num">Expenses</th>
                <th className="num">Net</th>
                <th className="num">Savings rate</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.key} className={r.key === selected ? 'is-selected' : ''} onClick={() => setSelected(r.key)}>
                  <td>{monthLabel(r.key, 'long')}</td>
                  <td className="num" data-label="Income">{formatMoney(r.income, cur)}</td>
                  <td className="num" data-label="Expenses">{formatMoney(r.expense, cur)}</td>
                  <td className={`num ${r.net >= 0 ? 'text-income' : 'text-expense'}`} data-label="Net">
                    {r.net >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(r.net), cur)}
                  </td>
                  <td className="num" data-label="Savings rate">{r.income ?`${((r.net / r.income) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
