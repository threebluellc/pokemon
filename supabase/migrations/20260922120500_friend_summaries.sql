-- Reading things about other people. Both functions are SECURITY DEFINER so they
-- can see rows the caller's own policies hide, and both are written so they only
-- ever return data about people the caller is actually connected to.

-- Accepted friends only: username, how many cards they own, and what those are
-- worth. A pending request returns nothing here.
create function public.friend_summaries()
returns table (
  friend_id uuid,
  username text,
  card_count bigint,
  total_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    coalesce(sum(i.quantity), 0)::bigint,
    round(coalesce(sum(i.quantity * coalesce((c.prices ->> i.printing::text)::numeric, 0)), 0), 2)
  from public.friendships f
  join public.profiles p
    on p.id = case
                when f.requester_id = (select auth.uid()) then f.addressee_id
                else f.requester_id
              end
  left join public.portfolio_items i on i.user_id = p.id
  left join public.cards_cache c on c.card_id = i.card_id
  where f.status = 'accepted'
    and (select auth.uid()) in (f.requester_id, f.addressee_id)
  group by p.id, p.username
  order by p.username;
$$;

revoke all on function public.friend_summaries() from public, anon;
grant execute on function public.friend_summaries() to authenticated;

-- Friend requests waiting on someone: the ones sent to you, and the ones you
-- sent. Only usernames, so a request reveals nothing about a collection.
create function public.friend_requests()
returns table (
  friendship_id uuid,
  other_id uuid,
  username text,
  direction text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    p.id,
    p.username,
    case when f.addressee_id = (select auth.uid()) then 'incoming' else 'outgoing' end,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case
                when f.requester_id = (select auth.uid()) then f.addressee_id
                else f.requester_id
              end
  where f.status = 'pending'
    and (select auth.uid()) in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

revoke all on function public.friend_requests() from public, anon;
grant execute on function public.friend_requests() to authenticated;
