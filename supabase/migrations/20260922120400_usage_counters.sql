-- Per-person limits: the daily scan cap and the price-refresh cooldown.

create table public.usage_counters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  scan_day date not null default (now() at time zone 'utc')::date,
  scan_count int not null default 0,
  last_refresh_at timestamptz
);

alter table public.usage_counters enable row level security;

revoke all on table public.usage_counters from anon;
grant select on table public.usage_counters to authenticated;

-- You may read your own counters, so the app can show how many scans are left.
create policy "usage_counters: read own"
  on public.usage_counters for select to authenticated
  using (user_id = (select auth.uid()));

-- Deliberately no write policies. Only the Edge Functions (service role) may
-- change these, so the scan limit and the refresh cooldown cannot be edited
-- from the phone.
