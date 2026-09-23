// Shared request plumbing for both Edge Functions.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { fetchCards, type CardRow } from './tcgdex.ts'

const ALLOWED_ORIGINS = new Set([
  'https://threebluellc.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    // Every header the browser will send has to be named, or the preflight fails.
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

/**
 * Database calls must never fail quietly: a silent write failure looks exactly
 * like everything working until you notice nothing was saved.
 */
export function must<T>(label: string, result: { data: T; error: unknown }): T {
  if (result.error) {
    console.error(`db ${label} failed`, result.error)
    throw new Error(`db ${label}: ${JSON.stringify(result.error)}`)
  }
  return result.data
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )
}

/** Resolves the caller from their JWT, or null when the token is no good. */
export async function callerId(admin: SupabaseClient, req: Request): Promise<string | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const { data } = await admin.auth.getUser(jwt)
  return data?.user?.id ?? null
}

export const CARD_ID = /^[A-Za-z0-9._-]{2,40}$/

/**
 * Cache-first card lookup. A card already in the shared cache is returned as-is,
 * however old its price is; only unseen cards cost a TCGdex request.
 */
export async function getOrFetchCards(admin: SupabaseClient, cardIds: string[]): Promise<CardRow[]> {
  if (cardIds.length === 0) return []

  const cached = must('cards_cache select', await admin.from('cards_cache').select('*').in('card_id', cardIds))
  const have = new Set((cached ?? []).map((row) => row.card_id as string))
  const missing = cardIds.filter((id) => !have.has(id))

  let added: CardRow[] = []
  if (missing.length > 0) {
    added = await fetchCards(missing)
    if (added.length > 0) {
      must('cards_cache upsert', await admin.from('cards_cache').upsert(added, { onConflict: 'card_id' }))
    }
  }

  const all = [...((cached ?? []) as CardRow[]), ...added]
  // Preserve the ranking the caller asked for.
  return cardIds.map((id) => all.find((c) => c.card_id === id)).filter((c): c is CardRow => Boolean(c))
}
