export const PRINTINGS = ['normal', 'holofoil', 'reverse-holofoil'] as const
export type Printing = (typeof PRINTINGS)[number]

export const PRINTING_LABELS: Record<Printing, string> = {
  normal: 'Normal',
  holofoil: 'Holofoil',
  'reverse-holofoil': 'Reverse Holofoil',
}

export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const
export type Condition = (typeof CONDITIONS)[number]

/** A row of the shared card cache. */
export type CachedCard = {
  card_id: string
  name: string
  set_id: string
  set_name: string
  rarity: string | null
  number: string
  printed_total: number | null
  types: string[]
  image_url: string | null
  prices: Partial<Record<Printing, number>>
  price_updated_at: string | null
  source_updated_at: string | null
}

export type PortfolioItem = {
  id: string
  card_id: string
  printing: Printing
  condition: Condition
  quantity: number
  added_at: string
  card: CachedCard
}

/** A search result, before we have fetched prices for it. */
export type SearchHit = {
  card_id: string
  name: string
  set_id: string
  set_name: string
  number: string
  printed_total: number | null
  image_url: string | null
}

// TCGdex gives a base image URL; the size and format are a suffix.
export function cardImage(card: { image_url: string | null }, size: 'low' | 'high'): string | null {
  return card.image_url ? `${card.image_url}/${size}.webp` : null
}

/** "116/086", or just "116" for the few sets with no printed total. */
export function cardNumber(card: { number: string; printed_total: number | null }): string {
  if (card.printed_total == null) return card.number
  return `${card.number}/${String(card.printed_total).padStart(3, '0')}`
}

export const TYPE_COLORS: Record<string, string> = {
  Grass: 'var(--type-grass)',
  Fire: 'var(--type-fire)',
  Water: 'var(--type-water)',
  Lightning: 'var(--type-lightning)',
  Psychic: 'var(--type-psychic)',
  Fighting: 'var(--type-fighting)',
  Darkness: 'var(--type-darkness)',
  Metal: 'var(--type-metal)',
  Dragon: 'var(--type-dragon)',
  Colorless: 'var(--type-colorless)',
}
