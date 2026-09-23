// Everything that talks to TCGdex lives here. No API key is needed, but the
// docs ask callers to be considerate, so we cache and keep concurrency low.

const BASE = 'https://api.tcgdex.net/v2/en'

/** The three printings we track. These match TCGdex's price keys exactly. */
export const PRINTINGS = ['normal', 'holofoil', 'reverse-holofoil'] as const
export type Printing = (typeof PRINTINGS)[number]

export type CardRow = {
  card_id: string
  name: string
  set_id: string
  set_name: string
  rarity: string | null
  number: string
  printed_total: number | null
  types: string[]
  image_url: string | null
  prices: Record<string, number>
  price_updated_at: string
  source_updated_at: string | null
}

export type SearchHit = {
  card_id: string
  name: string
  set_id: string
  set_name: string
  number: string
  printed_total: number | null
  image_url: string | null
}

export type SetInfo = {
  name: string
  printedTotal: number | null
  /**
   * Position in TCGdex's set list, which is ordered oldest to newest. The list
   * endpoint carries no release date, so this is our recency signal; a higher
   * number means a more recent set.
   */
  order: number
}

// One instance of the function serves many requests, so holding the set list in
// memory saves a call on nearly every search. Sets change a few times a year.
let setIndex: { at: number; sets: Map<string, SetInfo>; pocket: Set<string> } | null = null
const SET_INDEX_MAX_AGE_MS = 24 * 60 * 60 * 1000

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`TCGdex ${path} returned ${response.status}`)
  return await response.json()
}

async function loadSetIndex() {
  if (setIndex && Date.now() - setIndex.at < SET_INDEX_MAX_AGE_MS) return setIndex

  const [allSets, pocketSeries] = await Promise.all([
    getJson('/sets') as Promise<Array<{ id: string; name: string; cardCount?: { official?: number } }>>,
    // The mobile game's cards share the API but are not real cards, so we drop them.
    getJson('/series/tcgp') as Promise<{ sets?: Array<{ id: string }> }>,
  ])

  const sets = new Map<string, SetInfo>()
  allSets.forEach((s, index) => {
    sets.set(s.id, { name: s.name, printedTotal: s.cardCount?.official ?? null, order: index })
  })

  const pocket = new Set<string>((pocketSeries.sets ?? []).map((s) => s.id))
  setIndex = { at: Date.now(), sets, pocket }
  return setIndex
}

/** A TCGdex card id is "<setId>-<number>", e.g. "sv10.5b-116". */
export function setIdOf(cardId: string): string {
  return cardId.slice(0, cardId.lastIndexOf('-'))
}

/** Set name, printed total and recency. Served from the in-memory index. */
export async function setMeta(setId: string): Promise<SetInfo | null> {
  const index = await loadSetIndex()
  return index.sets.get(setId) ?? null
}

// The set list has no short codes, so those need a call per set. Worth it only
// for a handful of candidates, and remembered for the life of the instance.
const abbreviations = new Map<string, string | null>()

/** The set's printed code, such as BLK or JTG. One request per set, then cached. */
export async function setAbbreviation(setId: string): Promise<string | null> {
  const known = abbreviations.get(setId)
  if (known !== undefined) return known
  try {
    const detail = (await getJson(`/sets/${encodeURIComponent(setId)}`)) as {
      abbreviation?: { official?: string }
    }
    const code = detail.abbreviation?.official ?? null
    abbreviations.set(setId, code)
    return code
  } catch {
    abbreviations.set(setId, null)
    return null
  }
}

export async function searchCards(name: string, setFilter?: string, numberFilter?: string): Promise<SearchHit[]> {
  const index = await loadSetIndex()

  const params = new URLSearchParams({ name })
  if (setFilter) params.set('set.id', setFilter)
  const hits = (await getJson(`/cards?${params}`)) as Array<{
    id: string
    localId: string
    name: string
    image?: string
  }>

  const wanted = numberFilter?.replace(/^0+/, '')

  return hits
    .filter((c) => !index.pocket.has(setIdOf(c.id)))
    // TCGdex's number filter is a "contains" match, so narrow it here instead.
    .filter((c) => !wanted || c.localId.replace(/^0+/, '') === wanted)
    .map((c) => {
      const setId = setIdOf(c.id)
      const info = index.sets.get(setId)
      return {
        hit: {
          card_id: c.id,
          name: c.name,
          set_id: setId,
          set_name: info?.name ?? setId,
          number: c.localId,
          printed_total: info?.printedTotal ?? null,
          image_url: c.image ?? null,
        },
        order: info?.order ?? -1,
      }
    })
    // Newest sets first. TCGdex returns no useful order, which otherwise buries
    // a current card under decade-old promos and trainer kits.
    .sort((a, b) => b.order - a.order)
    .map((entry) => entry.hit)
}

/** Full card detail including current TCGplayer prices. */
export async function fetchCard(cardId: string): Promise<CardRow | null> {
  let card: {
    id: string
    name: string
    localId: string
    rarity?: string
    types?: string[]
    image?: string
    set?: { id: string; name: string; cardCount?: { official?: number } }
    pricing?: { tcgplayer?: Record<string, unknown> }
  }
  try {
    card = (await getJson(`/cards/${encodeURIComponent(cardId)}`)) as typeof card
  } catch {
    return null
  }
  if (!card?.id) return null

  const tcg = card.pricing?.tcgplayer
  const prices: Record<string, number> = {}
  if (tcg) {
    for (const key of PRINTINGS) {
      const entry = tcg[key] as { marketPrice?: number } | undefined
      if (typeof entry?.marketPrice === 'number') prices[key] = entry.marketPrice
    }
  }

  return {
    card_id: card.id,
    name: card.name,
    set_id: card.set?.id ?? setIdOf(card.id),
    set_name: card.set?.name ?? '',
    rarity: card.rarity ?? null,
    number: card.localId,
    printed_total: card.set?.cardCount?.official ?? null,
    types: card.types ?? [],
    // Base URL only. The app adds "/low.webp" or "/high.webp".
    image_url: card.image ?? null,
    prices,
    price_updated_at: new Date().toISOString(),
    source_updated_at: typeof tcg?.updated === 'string' ? tcg.updated : null,
  }
}

/** Fetches several cards with a small amount of parallelism. */
export async function fetchCards(cardIds: string[], concurrency = 4): Promise<CardRow[]> {
  const out: CardRow[] = []
  let next = 0

  async function worker() {
    while (next < cardIds.length) {
      const id = cardIds[next++]
      const row = await fetchCard(id)
      if (row) out.push(row)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, cardIds.length) }, worker))
  return out
}
