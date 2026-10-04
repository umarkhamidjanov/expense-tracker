import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'
import FitText from './FitText'

/**
 * `goodWhenUp` decides whether an increase is shown as positive (income) or
 * negative (expenses). Trend is always shown with an arrow + text, not color alone.
 */
export default function StatCard({ label, value, currency, icon: Icon, accent, change, goodWhenUp = true, footnote, delay = 0 }) {
  const hasChange = change !== null && change !== undefined && Number.isFinite(change)
  const up = hasChange && change >= 0
  const good = hasChange && (up === goodWhenUp)

  return (
    <div className={`card stat-card stat-card--${accent} fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-card__glow" aria-hidden="true" />
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__icon">
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-card__value">
        <FitText>
          <AnimatedNumber value={value} currency={currency} />
        </FitText>
      </div>
      <div className="stat-card__foot">
        {hasChange ? (
          <span className={`trend ${good ? 'trend--good' : 'trend--bad'}`}>
            {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        ) : null}
        <span className="muted">{footnote}</span>
      </div>
    </div>
  )
}
