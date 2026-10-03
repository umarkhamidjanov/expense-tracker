import {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  House,
  Zap,
  Film,
  HeartPulse,
  Plane,
  GraduationCap,
  Repeat,
  Ellipsis,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  Coins,
} from 'lucide-react'

// `slot` maps a category to a fixed categorical chart color (1–8), so a
// category keeps its color regardless of rank or filters. Categories without
// a slot are folded into "Other" in charts.
export const EXPENSE_CATEGORIES = [
  { id: 'housing', name: 'Housing', icon: House, slot: 1 },
  { id: 'food', name: 'Food & Dining', icon: UtensilsCrossed, slot: 2 },
  { id: 'transport', name: 'Transport', icon: Car, slot: 3 },
  { id: 'shopping', name: 'Shopping', icon: ShoppingBag, slot: 4 },
  { id: 'entertainment', name: 'Entertainment', icon: Film, slot: 5 },
  { id: 'health', name: 'Health', icon: HeartPulse, slot: 6 },
  { id: 'utilities', name: 'Utilities', icon: Zap, slot: 7 },
  { id: 'travel', name: 'Travel', icon: Plane, slot: 8 },
  { id: 'education', name: 'Education', icon: GraduationCap, slot: null },
  { id: 'subscriptions', name: 'Subscriptions', icon: Repeat, slot: null },
  { id: 'other', name: 'Other', icon: Ellipsis, slot: null },
]

export const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salary', icon: Briefcase, slot: 3 },
  { id: 'freelance', name: 'Freelance', icon: Laptop, slot: 1 },
  { id: 'investments', name: 'Investments', icon: TrendingUp, slot: 7 },
  { id: 'gifts', name: 'Gifts', icon: Gift, slot: 5 },
  { id: 'other-income', name: 'Other Income', icon: Coins, slot: null },
]

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
const BY_ID = Object.fromEntries(ALL.map((c) => [c.id, c]))

export function getCategory(id) {
  return BY_ID[id] || BY_ID.other
}

export function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function slotVar(slot) {
  return slot ? `var(--series-${slot})` : 'var(--series-other)'
}

export function categoryColor(id) {
  return slotVar(getCategory(id).slot)
}
