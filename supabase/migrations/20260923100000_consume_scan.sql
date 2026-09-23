-- Counts one card scan against the caller's daily limit.
--
-- Done in the database rather than in the Edge Function so that two scans
-- arriving at once cannot both read the same count and both be allowed.
-- The day rolls over in UTC.

create function public.consume_scan(p_user_id uuid, p_limit int)
returns table (allowed boolean, used int, scan_limit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  new_count int;
begin
  insert into public.usage_counters (user_id, scan_day, scan_count)
  values (p_user_id, today, 0)
  on conflict (user_id) do nothing;

  -- Lock this person's row, then roll the day over if it is stale.
  perform 1 from public.usage_counters where user_id = p_user_id for update;

  update public.usage_counters
  set scan_day = today, scan_count = 0
  where user_id = p_user_id and scan_day <> today;

  select scan_count into new_count from public.usage_counters where user_id = p_user_id;

  if new_count >= p_limit then
    return query select false, new_count, p_limit;
    return;
  end if;

  update public.usage_counters
  set scan_count = scan_count + 1
  where user_id = p_user_id
  returning scan_count into new_count;

  return query select true, new_count, p_limit;
end;
$$;

-- Only the Edge Functions may call this. Nobody on a phone can hand themselves
-- more scans, because the app has no way to reach it.
revoke all on function public.consume_scan(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_scan(uuid, int) to service_role;
