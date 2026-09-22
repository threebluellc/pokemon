-- Shared card data and prices from TCGdex, cached so two people who own the
-- same card only cost us one lookup.

create table public.cards_cache (
  card_id text primary key,                   -- TCGdex id, e.g. "sv10.5b-116"
  name text not null,
  set_id text not null,
  set_name text not null,
  set_release_date date,                      -- for sorting by newest set
  rarity text,
  number text not null,                       -- TCGdex localId, e.g. "116"
  printed_total int,                          -- set.cardCount.official, e.g. 86 -> "116/086"
  types text[] not null default '{}',
  -- Base image URL. TCGdex needs a suffix: "/low.webp" for the grid,
  -- "/high.webp" for the detail sheet.
  image_url text,
  -- TCGplayer market prices in USD, keyed by printing:
  -- {"normal": 0.08, "holofoil": 18.24, "reverse-holofoil": 0.24}
  prices jsonb not null default '{}'::jsonb,
  price_updated_at timestamptz,               -- when we last fetched the price
  source_updated_at timestamptz,              -- TCGdex's own pricing timestamp
  cached_at timestamptz not null default now()
);

alter table public.cards_cache enable row level security;

revoke all on table public.cards_cache from anon;
grant select on table public.cards_cache to authenticated;

-- Any signed-in person may read the shared card data.
create policy "cards_cache: read"
  on public.cards_cache for select to authenticated
  using (true);

-- Deliberately no insert/update/delete policies. Only the Edge Functions, which
-- use the service role and bypass RLS, may write card data or prices.
