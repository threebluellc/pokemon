-- Profiles: one row per signed-in person, holding their public username.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  -- 3-20 characters: lowercase letters, digits and underscore only.
  -- [a-z] rejects capitals outright, so usernames are always stored lowercase
  -- and the plain unique constraint above is therefore case-insensitive too.
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

-- You can read, create and rename only your own profile.
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No delete policy: a profile goes away with its auth user (cascade above).

-- Looking someone up to send a friend request.
-- SECURITY DEFINER lets this read rows the caller's own policies hide, but it
-- answers only exact username matches and returns only id + username, so nobody
-- can list, browse or scrape the people using the app.
create function public.find_profile_by_username(p_username text)
returns table (id uuid, username text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.username = lower(trim(p_username))
    and (select auth.uid()) is not null
  limit 1;
$$;

revoke all on function public.find_profile_by_username(text) from public, anon;
grant execute on function public.find_profile_by_username(text) to authenticated;
