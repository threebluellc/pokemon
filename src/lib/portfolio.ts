import type { PortfolioItem, Printing } from './types'

/** The market price of one copy, or null when TCGdex has no price for this printing. */
export function priceOf(item: PortfolioItem): number | null {
  return item.card.prices?.[item.printing] ?? null
}

export function lineValue(item: PortfolioItem): number {
  return (priceOf(item) ?? 0) * item.quantity
}

export function totalValue(items: PortfolioItem[]): number {
  return items.reduce((sum, item) => sum + lineValue(item), 0)
}

export function totalCards(items: PortfolioItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * The oldest price timestamp in the portfolio. The header says "as of" this,
 * because it is the most pessimistic honest answer: everything is at least
 * this fresh.
 */
export function oldestPriceTime(items: PortfolioItem[]): string | null {
  let oldest: string | null = null
  for (const item of items) {
    const at = item.card.price_updated_at
    if (!at) continue
    if (!oldest || at < oldest) oldest = at
  }
  return oldest
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** "today, 6:14 AM", "yesterday, 9:02 PM", or "12 Sep, 9:02 PM". */
export function formatAsOf(iso: string | null): string {
  if (!iso) return 'not fetched yet'
  const when = new Date(iso)
  const time = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const dayDiff = Math.floor((midnight.getTime() - when.getTime()) / 86_400_000)

  if (when >= midnight) return `today, ${time}`
  if (dayDiff === 0) return `yesterday, ${time}`
  return `${when.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}, ${time}`
}

/** Just the day, for the narrow stat tile: "Today", "Yesterday", "12 Sep". */
export function formatAsOfDay(iso: string | null): string {
  if (!iso) return '—'
  const when = new Date(iso)
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  if (when >= midnight) return 'Today'
  if (when.getTime() >= midnight.getTime() - 86_400_000) return 'Yesterday'
  return when.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export type SortKey = 'value' | 'name' | 'newest'

export type Filters = {
  search: string
  sets: string[]
  printings: Printing[]
  rarities: string[]
  types: string[]
  sort: SortKey
}

export const NO_FILTERS: Filters = { search: '', sets: [], printings: [], rarities: [], types: [], sort: 'value' }

/** How many filter groups are narrowing the view. Drives the badge on the filter button. */
export function activeFilterCount(filters: Filters): number {
  return (
    (filters.sets.length > 0 ? 1 : 0) +
    (filters.printings.length > 0 ? 1 : 0) +
    (filters.rarities.length > 0 ? 1 : 0) +
    (filters.types.length > 0 ? 1 : 0)
  )
}

export function applyFilters(items: PortfolioItem[], filters: Filters): PortfolioItem[] {
  const needle = filters.search.trim().toLowerCase()

  const kept = items.filter((item) => {
    const card = item.card
    if (needle && !card.name.toLowerCase().includes(needle) && !card.set_name.toLowerCase().includes(needle)) {
      return false
    }
    if (filters.sets.length > 0 && !filters.sets.includes(card.set_id)) return false
    if (filters.printings.length > 0 && !filters.printings.includes(item.printing)) return false
    if (filters.rarities.length > 0 && !filters.rarities.includes(card.rarity ?? '')) return false
    if (filters.types.length > 0 && !card.types.some((t) => filters.types.includes(t))) return false
    return true
  })

  const sorted = [...kept]
  switch (filters.sort) {
    case 'name':
      sorted.sort((a, b) => a.card.name.localeCompare(b.card.name))
      break
    case 'newest':
      // Newest means most recently added to this portfolio.
      sorted.sort((a, b) => b.added_at.localeCompare(a.added_at))
      break
    case 'value':
      sorted.sort((a, b) => lineValue(b) - lineValue(a))
      break
  }
  return sorted
}
