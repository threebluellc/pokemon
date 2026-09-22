// tcgdex-proxy: the only thing allowed to talk to TCGdex.
//
// Prices are fetched on demand only: when a card is added and has no price yet,
// or when the person taps Refresh. Nothing expires on a timer and nothing is
// fetched in the background.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { fetchCards, searchCards, type CardRow } from './tcgdex.ts'

const ALLOWED_ORIGINS = new Set([
  'https://threebluellc.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])

/** Most requests to TCGdex per call, so one tap cannot start a flood. */
const MAX_IDS_PER_CALL = 20
/** Minutes a person must wait between full price refreshes. */
const REFRESH_COOLDOWN_MINUTES = 5

const CARD_ID = /^[A-Za-z0-9._-]{2,40}$/

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    // supabase-js and our own fetch both send `apikey`; the browser refuses the
    // request unless every header it will send is listed here.
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

/**
 * Database calls must never fail quietly: a silent write failure looks exactly
 * like everything working until you notice nothing was saved.
 */
function must<T>(label: string, result: { data: T; error: unknown }): T {
  if (result.error) {
    console.error(`db ${label} failed`, result.error)
    throw new Error(`db ${label}: ${JSON.stringify(result.error)}`)
  }
  return result.data
}

/** Keeps only well-formed card ids, de-duplicated and capped. */
function cleanCardIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  for (const value of input) {
    if (typeof value === 'string' && CARD_ID.test(value)) seen.add(value)
    if (seen.size >= MAX_IDS_PER_CALL) break
  }
  return [...seen]
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405, origin)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SB_SECRET_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(jwt)
  const userId = auth?.user?.id
  if (!userId) return json({ error: 'Please sign in again.' }, 401, origin)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400, origin)
  }

  try {
    switch (body.action) {
      case 'search':
        return await handleSearch(body, origin)
      case 'get':
        return await handleGet(admin, body, origin)
      case 'refresh_begin':
        return await handleRefreshBegin(admin, userId, origin)
      case 'refresh_chunk':
        return await handleRefreshChunk(admin, userId, body, origin)
      default:
        return json({ error: 'Unknown action.' }, 400, origin)
    }
  } catch (error) {
    // Never echo the raw error: it can carry upstream URLs and internals.
    console.error('tcgdex-proxy failed', { action: body.action, message: String(error).slice(0, 200) })
    return json({ error: 'Could not reach the card service. Please try again.' }, 502, origin)
  }
})

async function handleSearch(body: Record<string, unknown>, origin: string | null) {
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (query.length < 2 || query.length > 50) {
    return json({ error: 'Type at least 2 characters.' }, 400, origin)
  }
  const setId = typeof body.set_id === 'string' && /^[A-Za-z0-9._-]{1,20}$/.test(body.set_id) ? body.set_id : undefined
  const number = typeof body.number === 'string' && /^[0-9]{1,5}$/.test(body.number) ? body.number : undefined

  const cards = await searchCards(query, setId, number)
  return json({ cards: cards.slice(0, 30) }, 200, origin)
}

/**
 * Cache-first. A card already in the shared cache is returned as-is, however old
 * its price is; only cards we have never seen cost a request. Two people who own
 * the same card share one lookup.
 */
async function handleGet(admin: SupabaseClient, body: Record<string, unknown>, origin: string | null) {
  const wanted = cleanCardIds(body.card_ids)
  if (wanted.length === 0) return json({ error: 'No card ids given.' }, 400, origin)

  const cached = must('cards_cache select', await admin.from('cards_cache').select('*').in('card_id', wanted))
  const have = new Set((cached ?? []).map((row) => row.card_id as string))
  const missing = wanted.filter((id) => !have.has(id))

  let added: CardRow[] = []
  if (missing.length > 0) {
    added = await fetchCards(missing)
    if (added.length > 0) {
      must('cards_cache upsert', await admin.from('cards_cache').upsert(added, { onConflict: 'card_id' }))
    }
  }

  return json({ cards: [...(cached ?? []), ...added] }, 200, origin)
}

/**
 * Starts a refresh: checks the cooldown, then hands back every distinct card in
 * the caller's own portfolio. The client walks that list in chunks.
 */
async function handleRefreshBegin(admin: SupabaseClient, userId: string, origin: string | null) {
  const counter = must(
    'usage_counters select',
    await admin.from('usage_counters').select('last_refresh_at').eq('user_id', userId).maybeSingle(),
  )

  const last = counter?.last_refresh_at ? Date.parse(counter.last_refresh_at as string) : 0
  const waitMs = last + REFRESH_COOLDOWN_MINUTES * 60_000 - Date.now()
  if (waitMs > 0) {
    return json(
      { error: 'cooldown', retry_after_seconds: Math.ceil(waitMs / 1000) },
      429,
      origin,
    )
  }

  must(
    'usage_counters upsert',
    await admin
      .from('usage_counters')
      .upsert({ user_id: userId, last_refresh_at: new Date().toISOString() }, { onConflict: 'user_id' }),
  )

  const items = must(
    'portfolio_items select',
    await admin.from('portfolio_items').select('card_id').eq('user_id', userId),
  )
  const cardIds = [...new Set((items ?? []).map((row) => row.card_id as string))]

  return json({ card_ids: cardIds }, 200, origin)
}

/** Refreshes one chunk, but only cards the caller actually owns. */
async function handleRefreshChunk(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  origin: string | null,
) {
  const requested = cleanCardIds(body.card_ids)
  if (requested.length === 0) return json({ error: 'No card ids given.' }, 400, origin)

  // Trust nothing from the client: keep only ids that are in this person's own
  // portfolio, so nobody can use a refresh to fetch arbitrary cards.
  const owned = must(
    'portfolio_items ownership check',
    await admin.from('portfolio_items').select('card_id').eq('user_id', userId).in('card_id', requested),
  )

  const allowed = [...new Set((owned ?? []).map((row) => row.card_id as string))]
  if (allowed.length === 0) return json({ updated: 0 }, 200, origin)

  const rows = await fetchCards(allowed)
  if (rows.length > 0) {
    must('cards_cache upsert', await admin.from('cards_cache').upsert(rows, { onConflict: 'card_id' }))
  }

  return json({ updated: rows.length }, 200, origin)
}
