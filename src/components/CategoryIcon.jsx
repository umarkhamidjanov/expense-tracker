import { getCategory, slotVar } from '../data/categories'

export default function CategoryIcon({ id, size = 'md' }) {
  const c = getCategory(id)
  const Icon = c.icon
  return (
    <span className={`cat-icon cat-icon--${size}`} style={{ '--cat': slotVar(c.slot) }} aria-hidden="true">
      <Icon size={size === 'sm' ? 15 : size === 'lg' ? 20 : 18} strokeWidth={2} />
    </span>
  )
}
