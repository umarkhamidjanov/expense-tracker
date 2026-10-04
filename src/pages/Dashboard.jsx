import { useMemo, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowRight, Target, Flame, CalendarDays, Sparkles, Plus, Database, LoaderCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import StatCard from '../components/StatCard'
import TransactionList from '../components/TransactionList'
import SpendingAssistant from '../components/SpendingAssistant'
import CategoryIcon from '../components/CategoryIcon'
import { CashflowChart, CategoryDonut, Legend, INCOME, EXPENSE } from '../components/charts'
import { byCategory, foldForChart, inMonth, monthlySeries, samePeriodLabel, throughDay, totals } from '../utils/stats'
import { formatMoney, lastNMonths, monthLabel, pctChange, toISODate } from '../utils/format'

export default function Dashboard({ onNavigate }) {
  const { transactions, settings } = useApp()
  const [period, setPeriod] = useState('month')
  const cur = settings.currency

  const data = useMemo(() => {
    const [prevKey, thisKey] = lastNMonths(2)
    const today = new Date()
    const dayOfMonth = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysInPrev = new Date(today.getFullYear(), today.getMonth(), 0).getDate()

    const thisMonth = inMonth(transactions, thisKey)
    const prevMonth = throughDay(inMonth(transactions, prevKey), dayOfMonth)
    const all = totals(transactions)
    const tm = totals(thisMonth)
    const pm = totals(prevMonth)
    const scope = period === 'month' ? tm : all
    const balance = settings.openingBalance + all.savings
    const prevBalance = balance - tm.savings
    const categories = byCategory(period === 'month' ? thisMonth : transactions)

    return {
      thisKey,
      compareLabel: samePeriodLabel(prevKey, dayOfMonth, daysInPrev),
      tm,
      pm,
      scope,
      balance,
      balanceChange: pctChange(balance, prevBalance),
      series: monthlySeries(transactions, lastNMonths(6)),
      categories,
      chartCats: foldForChart(categories),
      avgDaily: tm.expense / dayOfMonth,
      projected: (tm.expense / dayOfMonth) * daysInMonth,
      daysLeft: daysInMonth - dayOfMonth,
    }
  }, [transactions, period, settings.openingBalance])

  const isMonth = period === 'month'
  const budgetUsed = settings.monthlyBudget ? (data.tm.expense / settings.monthlyBudget) * 100 : 0
  const budgetTone = budgetUsed >= 100 ? 'over' : budgetUsed >= 85 ? 'warn' : 'ok'
  const hasBudget = settings.monthlyBudget > 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = settings.name.trim().split(' ')[0]

  return (
    <div className="page">
      <div className="page-head fade-up">
        <div>
          <h2 className="page-head__title">
            {greeting}
            {firstName ? `, ${firstName}` : ''} <span className="wave">👋</span>
          </h2>
          <p className="muted">Here’s what’s happening with your money{isMonth ? ` in ${monthLabel(data.thisKey, 'long')}` : ''}.</p>
        </div>
        <div className="tabs" role="tablist" aria-label="Summary period">
          <button role="tab" aria-selected={isMonth} className={isMonth ? 'is-active' : ''} onClick={() => setPeriod('month')}>
            This month
          </button>
          <button role="tab" aria-selected={!isMonth} className={!isMonth ? 'is-active' : ''} onClick={() => setPeriod('all')}>
            All time
          </button>
        </div>
      </div>

      {!transactions.length && <WelcomeCard />}

      <div className="stats-grid">
        <StatCard label="Total balance" value={data.balance} currency={cur} icon={Wallet} accent="violet" change={data.balanceChange} footnote="vs. start of month" delay={0} />
        <StatCard
          label="Total income"
          value={data.scope.income}
          currency={cur}
          icon={TrendingUp}
          accent="income"
          change={isMonth ? pctChange(data.tm.income, data.pm.income) : null}
          footnote={isMonth ? data.compareLabel : `${transactions.filter((t) => t.type === 'income').length} deposits`}
          delay={60}
        />
        <StatCard
          label="Total expenses"
          value={data.scope.expense}
          currency={cur}
          icon={TrendingDown}
          accent="expense"
          goodWhenUp={false}
          change={isMonth ? pctChange(data.tm.expense, data.pm.expense) : null}
          footnote={isMonth ? data.compareLabel : `${transactions.filter((t) => t.type === 'expense').length} payments`}
          delay={120}
        />
        <StatCard
          label="Savings"
          value={data.scope.savings}
          currency={cur}
          icon={PiggyBank}
          accent="savings"
          change={isMonth ? pctChange(data.tm.savings, data.pm.savings) : null}
          footnote={`${data.scope.savingsRate.toFixed(0)}% savings rate`}
          delay={180}
        />
      </div>

      {transactions.length > 0 && <SpendingAssistant />}

      <div className="grid grid--main">
        <section className="card card--chart fade-up" style={{ animationDelay: '220ms' }}>
          <div className="card__head">
            <div>
              <h3>Monthly cash flow</h3>
              <p className="muted">Income and spending, last 6 months</p>
            </div>
            <Legend items={[{ label: 'Income', color: INCOME }, { label: 'Expenses', color: EXPENSE }]} />
          </div>
          <CashflowChart data={data.series} currency={cur} />
        </section>

        <section className="card fade-up" style={{ animationDelay: '280ms' }}>
          <div className="card__head">
            <div>
              <h3>Spending by category</h3>
              <p className="muted">{isMonth ? monthLabel(data.thisKey, 'long') : 'All time'}</p>
            </div>
          </div>
          <CategoryDonut data={data.chartCats} total={data.scope.expense} currency={cur} size={190} />
        </section>
      </div>

      <div className="grid grid--main">
        <section className="card fade-up" style={{ animationDelay: '320ms' }}>
          <div className="card__head">
            <div>
              <h3>Recent transactions</h3>
              <p className="muted">Your latest activity</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('transactions')}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <TransactionList items={transactions.filter((t) => t.date <= toISODate()).slice(0, 6)} />
        </section>

        <div className="stack fade-up" style={{ animationDelay: '360ms' }}>
          <section className="card budget-card">
            <div className="card__head">
              <div>
                <h3>Monthly budget</h3>
                <p className="muted">{data.daysLeft} days left in {monthLabel(data.thisKey, 'long').split(' ')[0]}</p>
              </div>
              {hasBudget && (
                <span className={`badge badge--${budgetTone}`}>
                  <Target size={13} />
                  {budgetTone === 'over' ? 'Over budget' : budgetTone === 'warn' ? 'Near limit' : 'On track'}
                </span>
              )}
            </div>
            <div className="budget__figures">
              <span className="budget__spent">{formatMoney(data.tm.expense, cur)}</span>
              <span className="muted">{hasBudget ? `of ${formatMoney(settings.monthlyBudget, cur)}` : 'spent this month'}</span>
            </div>
            {!hasBudget ? (
              <div className="budget__empty">
                <span className="muted">Set a monthly budget to track your spending against it.</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('settings')}>
                  Set budget
                </button>
              </div>
            ) : (
              <>
            <div className="progress" role="progressbar" aria-valuenow={Math.round(budgetUsed)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
              <div className={`progress__bar progress__bar--${budgetTone}`} style={{ width: `${Math.min(100, budgetUsed)}%` }} />
            </div>
            <div className="budget__foot muted">
              <span>{budgetUsed.toFixed(0)}% used</span>
              <span>{formatMoney(Math.max(0, settings.monthlyBudget - data.tm.expense), cur)} remaining</span>
            </div>
              </>
            )}
          </section>

          <section className="card insights">
            <h3>Insights</h3>
            <div className="insight">
              <span className="insight__icon">
                <Flame size={17} />
              </span>
              <div>
                <div className="insight__value">{formatMoney(data.avgDaily, cur)}</div>
                <div className="muted">Average daily spend this month</div>
              </div>
            </div>
            <div className="insight">
              <span className="insight__icon">
                <CalendarDays size={17} />
              </span>
              <div>
                <div className="insight__value">{formatMoney(data.projected, cur)}</div>
                <div className="muted">Projected spend by month end</div>
              </div>
            </div>
            {data.categories[0] && (
              <div className="insight">
                <CategoryIcon id={data.categories[0].id} />
                <div>
                  <div className="insight__value">{data.categories[0].name}</div>
                  <div className="muted">
                    Top category · {formatMoney(data.categories[0].value, cur)} ({data.categories[0].share.toFixed(0)}%)
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function WelcomeCard() {
  const { openEditor, loadSampleData } = useApp()
  const [busy, setBusy] = useState(false)
  return (
    <section className="card welcome-card fade-up">
      <div className="welcome-card__icon">
        <Sparkles size={22} />
      </div>
      <div className="welcome-card__body">
        <h3>Welcome to Lumen</h3>
        <p className="muted">Your account is ready. Add your first transaction, or load sample data to explore the app. Sample transactions are labeled and can be removed any time in Settings.</p>
      </div>
      <div className="welcome-card__actions">
        <button className="btn btn-primary" onClick={() => openEditor()}>
          <Plus size={17} /> Add transaction
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await loadSampleData()
            setBusy(false)
          }}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : <Database size={16} />}
          {busy ? 'Loading…' : 'Load sample data'}
        </button>
      </div>
    </section>
  )
}
