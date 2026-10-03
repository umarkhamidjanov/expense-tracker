import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { slotVar } from '../data/categories'
import { formatMoney } from '../utils/format'
import ChartTooltip from './ChartTooltip'

const INCOME = 'var(--series-3)'
const EXPENSE = 'var(--series-2)'
const FLOW_COLORS = { income: INCOME, expense: EXPENSE }

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--text-muted)', fontSize: 12 },
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label} className="legend__item">
          <span className={`legend__swatch ${i.line ? 'is-line' : ''}`} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export function CashflowChart({ data, currency, height = 280 }) {
  return (
    <div className="chart-box" style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INCOME} stopOpacity={0.32} />
              <stop offset="100%" stopColor={INCOME} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EXPENSE} stopOpacity={0.3} />
              <stop offset="100%" stopColor={EXPENSE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" {...axisProps} dy={8} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
          <Tooltip
            cursor={{ stroke: 'var(--axis)', strokeWidth: 1, strokeDasharray: '4 4' }}
            content={<ChartTooltip currency={currency} colors={FLOW_COLORS} />}
          />
          <Area type="monotone" dataKey="income" name="Income" stroke={INCOME} strokeWidth={2} fill="url(#gIncome)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface-solid)' }} animationDuration={900} />
          <Area type="monotone" dataKey="expense" name="Expenses" stroke={EXPENSE} strokeWidth={2} fill="url(#gExpense)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface-solid)' }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MonthlyBarsChart({ data, currency, height = 300, activeKey, onSelect }) {
  return (
    <div className="chart-box" style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" {...axisProps} dy={8} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
          <Tooltip cursor={{ fill: 'var(--hover)' }} content={<ChartTooltip currency={currency} colors={FLOW_COLORS} />} />
          {['income', 'expense'].map((k) => (
            <Bar key={k} dataKey={k} name={k === 'income' ? 'Income' : 'Expenses'} fill={FLOW_COLORS[k]} radius={[4, 4, 0, 0]} maxBarSize={22} onClick={(d) => onSelect?.(d.key ?? d.payload?.key)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              {data.map((d) => (
                <Cell key={d.key} fillOpacity={!activeKey || d.key === activeKey ? 1 : 0.35} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DailyBarsChart({ data, currency, height = 240, monthName }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={14} dy={8} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
          <Tooltip
            cursor={{ fill: 'var(--hover)' }}
            content={<ChartTooltip currency={currency} colors={{ expense: 'var(--series-1)' }} labelFormatter={(d) => `${monthName} ${d}`} />}
          />
          <Bar dataKey="expense" name="Spent" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryDonut({ data, currency, total, centerLabel = 'Total spent', size = 220 }) {
  const [active, setActive] = useState(null)
  const shown = active !== null ? data[active] : null
  const chartData = data.map((d) => ({ ...d, fill: slotVar(d.slot) }))

  if (!data.length) {
    return <div className="donut-empty">No spending recorded for this period.</div>
  }

  return (
    <div className="donut-wrap" style={{ '--donut': `${size}px` }}>
      <div className="donut">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={1.5}
              cornerRadius={4}
              stroke="var(--surface-solid)"
              strokeWidth={2}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              animationDuration={900}
            >
              {chartData.map((d, i) => (
                <Cell key={d.id} fill={d.fill} fillOpacity={active === null || active === i ? 1 : 0.35} style={{ transition: 'fill-opacity .2s', outline: 'none' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut__center">
          <span className="donut__label">{shown ? shown.name : centerLabel}</span>
          <span className="donut__value">{formatMoney(shown ? shown.value : total, currency)}</span>
          {shown && <span className="donut__share">{shown.share.toFixed(1)}%</span>}
        </div>
      </div>
      <ul className="breakdown">
        {data.map((d, i) => (
          <li
            key={d.id}
            className={`breakdown__item ${active === i ? 'is-active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            title={d.members ? `Includes ${d.members.join(', ')}` : undefined}
          >
            <span className="legend__swatch" style={{ background: slotVar(d.slot) }} />
            <span className="breakdown__name">{d.name}</span>
            <span className="breakdown__share">{d.share.toFixed(0)}%</span>
            <span className="breakdown__value">{formatMoney(d.value, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { INCOME, EXPENSE }
