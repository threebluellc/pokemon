import { db } from './supabase'
import type { CachedCard, Condition, PortfolioItem, Printing, SearchHit } from './types'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const PROXY_URL = `${FUNCTIONS_URL}/tcgdex-proxy`
const IDENTIFY_URL = `${FUNCTIONS_URL}/identify-card`

export class ProxyError extends Error {
  /** Set when the server asked us to wait, e.g. the refresh cooldown. */
  retryAfterSeconds?: number
  constructor(message: string, retryAfterSeconds?: number) {
    super(message)
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Every TCGdex call goes through the Edge Function; the browser never calls TCGdex. */
async function callProxy<T>(body: Record<string, unknown>): Promise<T> {
  return await callFunction<T>(PROXY_URL, body)
}

async function callFunction<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const { data } = await db().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ProxyError('Please sign in again.')

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ProxyError('No connection. Check your signal and try again.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (payload?.error === 'cooldown') {
      throw new ProxyError('Prices were refreshed recently.', payload.retry_after_seconds)
    }
    throw new ProxyError(typeof payload?.error === 'string' ? payload.error : 'Something went wrong.')
  }
  return payload as T
}

export type IdentifyResult = {
  is_pokemon_card: boolean
  read?: { name: string; collector_number: string | null; set_name_or_code: string | null }
  confidence?: number
  model_used?: string
  candidates: CachedCard[]
  scans_used: number
  scans_limit: number
  cost_usd: number
}

/** Sends one downscaled JPEG for reading. The photo is never stored. */
export async function identifyCard(imageBase64: string): Promise<IdentifyResult> {
  return await callFunction<IdentifyResult>(IDENTIFY_URL, {
    image_base64: imageBase64,
    media_type: 'image/jpeg',
  })
}

export async function searchCards(query: string, number?: string): Promise<SearchHit[]> {
  const body: Record<string, unknown> = { action: 'search', query }
  if (number) body.number = number
  const result = await callProxy<{ cards: SearchHit[] }>(body)
  return result.cards
}

/** Card details with prices. Served from the shared cache when we already have it. */
export async function getCards(cardIds: string[]): Promise<CachedCard[]> {
  const result = await callProxy<{ cards: CachedCard[] }>({ action: 'get', card_ids: cardIds })
  return result.cards
}

export async function refreshBegin(): Promise<string[]> {
  const result = await callProxy<{ card_ids: string[] }>({ action: 'refresh_begin' })
  return result.card_ids
}

export async function refreshChunk(cardIds: string[]): Promise<number> {
  const result = await callProxy<{ updated: number }>({ action: 'refresh_chunk', card_ids: cardIds })
  return result.updated
}

type PortfolioRow = Omit<PortfolioItem, 'card'> & { cards_cache: CachedCard | null }

export async function loadPortfolio(userId: string): Promise<PortfolioItem[]> {
  const { data, error } = await db()
    .from('portfolio_items')
    .select('id, card_id, printing, condition, quantity, added_at, cards_cache(*)')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as PortfolioRow[])
    .filter((row) => row.cards_cache !== null)
    .map(({ cards_cache, ...item }) => ({ ...item, card: cards_cache as CachedCard }))
}

export type AddResult = { newQuantity: number; wasAlreadyOwned: boolean }

/**
 * Adds copies of a card. Owning the same card in the same printing and condition
 * bumps the quantity rather than creating a second row.
 */
export async function addToPortfolio(
  userId: string,
  cardId: string,
  printing: Printing,
  condition: Condition,
  quantity: number,
): Promise<AddResult> {
  const { data: existing, error: findError } = await db()
    .from('portfolio_items')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .eq('printing', printing)
    .eq('condition', condition)
    .maybeSingle()

  if (findError) throw new Error(findError.message)

  if (existing) {
    const newQuantity = (existing.quantity as number) + quantity
    const { error } = await db().from('portfolio_items').update({ quantity: newQuantity }).eq('id', existing.id)
    if (error) throw new Error(error.message)
    return { newQuantity, wasAlreadyOwned: true }
  }

  const { error } = await db()
    .from('portfolio_items')
    .insert({ user_id: userId, card_id: cardId, printing, condition, quantity })
  if (error) throw new Error(error.message)
  return { newQuantity: quantity, wasAlreadyOwned: false }
}

export async function updateItem(
  itemId: string,
  changes: { printing?: Printing; condition?: Condition; quantity?: number },
): Promise<void> {
  const { error } = await db().from('portfolio_items').update(changes).eq('id', itemId)
  if (error) {
    // 23505: that printing and condition already exist as another row.
    throw new Error(
      error.code === '23505'
        ? 'You already have this card in that printing and condition.'
        : error.message,
    )
  }
}

export async function removeItem(itemId: string): Promise<void> {
  const { error } = await db().from('portfolio_items').delete().eq('id', itemId)
  if (error) throw new Error(error.message)
}
