import { generateDemoData } from './demoData'

// Older saves stored the title in `description`; move it to `name`, leaving
// `description` for optional notes. Anything that isn't a list falls back to demo data.
export function migrate(txs) {
  return Array.isArray(txs)
    ? txs.map((t) => ('name' in t ? t : { ...t, name: t.description || '', description: '' }))
    : generateDemoData()
}
