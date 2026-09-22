-- Friendships: one row per pair of people, whichever way the request went.

create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- One row per pair: if A already asked B, B cannot open a second request to A.
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

revoke all on table public.friendships from anon;
grant select, insert, update, delete on table public.friendships to authenticated;

-- Both people in a pair can see the row.
create policy "friendships: read own"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- You send requests as yourself, and they always start out pending.
create policy "friendships: send request"
  on public.friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

-- Only the person who received a request may accept it, and accepting is the
-- only change allowed: nobody can flip a friendship back to pending.
create policy "friendships: addressee accepts"
  on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status = 'accepted');

-- Either side can remove the row: unfriend, decline, or cancel your own request.
create policy "friendships: either side removes"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Used by the portfolio policy below. SECURITY DEFINER so that checking a
-- friendship never depends on the policies of this table.
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
