import { formatMoney } from '../utils/format'

export default function ChartTooltip({ active, payload, label, currency, labelFormatter, colors }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label !== undefined && <div className="chart-tooltip__label">{labelFormatter ? labelFormatter(label, payload) : label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} className="chart-tooltip__row">
          <span className="swatch" style={{ background: colors?.[p.dataKey] || p.payload?.fill || p.color }} />
          <span className="chart-tooltip__name">{p.name}</span>
          <span className="chart-tooltip__value">{formatMoney(p.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}
