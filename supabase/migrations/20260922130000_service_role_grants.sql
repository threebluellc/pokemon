-- The Edge Functions connect as `service_role`, which bypasses Row Level
-- Security but still needs ordinary table privileges. The earlier migrations
-- granted rights to `authenticated` only, so every write from a function was
-- refused with "permission denied".
--
-- Only what the functions actually use is granted here. `service_role` is
-- reachable only with the secret key, which lives in Edge Function secrets and
-- never leaves the server.

-- tcgdex-proxy fills the shared card cache and refreshes prices.
grant select, insert, update on table public.cards_cache to service_role;

-- It reads portfolio rows to check that a card being refreshed really belongs
-- to the caller. It never writes them: the app does that under RLS.
grant select on table public.portfolio_items to service_role;

-- The refresh cooldown, and later the daily scan limit.
grant select, insert, update on table public.usage_counters to service_role;
