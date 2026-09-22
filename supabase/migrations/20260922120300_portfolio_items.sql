-- Portfolio items: the cards a person owns.

-- Enums validate printing and condition in the database itself, so a bad value
-- cannot be written even if a bug or a hand-made request tries.
-- Printing names match the TCGdex price keys exactly.
create type public.card_printing as enum ('normal', 'holofoil', 'reverse-holofoil');
create type public.card_condition as enum ('NM', 'LP', 'MP', 'HP', 'DMG');

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null references public.cards_cache (card_id),
  printing public.card_printing not null,
  condition public.card_condition not null default 'NM',
  quantity int not null default 1 check (quantity > 0 and quantity <= 9999),
  added_at timestamptz not null default now(),
  -- Adding a card you already own bumps the quantity instead of duplicating it.
  unique (user_id, card_id, printing, condition)
);

create index portfolio_items_user_idx on public.portfolio_items (user_id);
create index portfolio_items_card_idx on public.portfolio_items (card_id);

alter table public.portfolio_items enable row level security;

revoke all on table public.portfolio_items from anon;
grant select, insert, update, delete on table public.portfolio_items to authenticated;

-- Your own cards: full access.
create policy "portfolio_items: owner full access"
  on public.portfolio_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- An accepted friend may read your cards, and nothing more. A pending request
-- grants nothing, because are_friends() only counts accepted friendships.
create policy "portfolio_items: accepted friends may read"
  on public.portfolio_items for select to authenticated
  using (public.are_friends((select auth.uid()), user_id));
