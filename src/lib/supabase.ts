import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False until the Supabase project details are supplied at build time. */
export const isConfigured = Boolean(url && anonKey)

// These two values ship inside the JavaScript bundle, which is fine: they only
// ever allow what Row Level Security allows. Real secrets live in Supabase Edge
// Function secrets and never reach the phone.
const client: SupabaseClient | null = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // We use hash routing (/#/profile), and we never sign in through a link,
        // so Supabase must not try to read a session out of the URL hash.
        detectSessionInUrl: false,
      },
    })
  : null

/** The Supabase client. Only call this behind an `isConfigured` check. */
export function db(): SupabaseClient {
  if (!client) throw new Error('Supabase is not configured')
  return client
}

export type Profile = {
  id: string
  username: string
  created_at: string
}
