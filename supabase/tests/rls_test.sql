-- Row Level Security test.
--
-- What it does: creates three throwaway users (A, B and C), makes A and B
-- accepted friends, leaves A's request to C pending, then tries every read and
-- write we care about while pretending to be each of them. It deletes the
-- throwaway users at the end, so nothing is left behind.
--
-- How to run it: Supabase dashboard -> SQL Editor -> New query -> paste all of
-- this -> Run. The last table shown should be every row PASS.
--
-- Safe to run more than once. It removes leftovers from an earlier run first.

drop table if exists public.rls_test_results;
create table public.rls_test_results (
  id int primary key,
  check_name text not null,
  expected text not null,
  actual text not null,
  result text not null
);

create or replace function public.rls_record(p_id int, p_name text, p_expected text, p_actual text)
returns void language sql as $fn$
  insert into public.rls_test_results values (
    p_id, p_name, p_expected, p_actual,
    case when p_expected = p_actual then 'PASS' else 'FAIL' end
  );
$fn$;

do $test$
declare
  a_id uuid := '00000000-0000-0000-0000-0000000000aa';
  b_id uuid := '00000000-0000-0000-0000-0000000000bb';
  c_id uuid := '00000000-0000-0000-0000-0000000000cc';
  b_item_id uuid;
  pending_id uuid;
  n bigint;
  affected int;
begin
  ---------------------------------------------------------------- set up
  delete from auth.users where id in (a_id, b_id, c_id);
  delete from public.cards_cache where card_id = 'rlstest-001';

  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, 'rls-test-not-a-real-password', now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
         '', '', '', ''
  from (values
    (a_id, 'rlstest_a@example.invalid'),
    (b_id, 'rlstest_b@example.invalid'),
    (c_id, 'rlstest_c@example.invalid')
  ) as u(id, email);

  insert into public.profiles (id, username) values
    (a_id, 'rlstest_a'), (b_id, 'rlstest_b'), (c_id, 'rlstest_c');

  insert into public.cards_cache (card_id, name, set_id, set_name, number, prices)
  values ('rlstest-001', 'Test Card', 'rlstest', 'Test Set', '001',
          '{"normal": 2.50, "holofoil": 10.00}'::jsonb);

  insert into public.portfolio_items (user_id, card_id, printing, condition, quantity)
  values (a_id, 'rlstest-001', 'normal', 'NM', 2);

  insert into public.portfolio_items (user_id, card_id, printing, condition, quantity)
  values (b_id, 'rlstest-001', 'holofoil', 'NM', 3)
  returning id into b_item_id;

  insert into public.portfolio_items (user_id, card_id, printing, condition, quantity)
  values (c_id, 'rlstest-001', 'normal', 'LP', 5);

  -- A and B are friends. A has asked C, and C has not answered.
  insert into public.friendships (requester_id, addressee_id, status)
  values (a_id, b_id, 'accepted');

  insert into public.friendships (requester_id, addressee_id, status)
  values (a_id, c_id, 'pending')
  returning id into pending_id;

  insert into public.usage_counters (user_id, scan_count) values (a_id, 7);

  ---------------------------------------------------------------- act as A
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', a_id, 'role', 'authenticated')::text, true);

  select count(*) into n from public.portfolio_items where user_id = a_id;
  execute 'reset role';
  perform public.rls_record(1, 'A reads own cards', '1', n::text);

  execute 'set local role authenticated';
  select count(*) into n from public.portfolio_items where user_id = b_id;
  execute 'reset role';
  perform public.rls_record(2, 'A reads accepted friend B''s cards', '1', n::text);

  execute 'set local role authenticated';
  select count(*) into n from public.portfolio_items where user_id = c_id;
  execute 'reset role';
  perform public.rls_record(3, 'A cannot read pending-request C''s cards', '0', n::text);

  -- A tries to add a card to B's portfolio. The policy should refuse the write.
  begin
    execute 'set local role authenticated';
    insert into public.portfolio_items (user_id, card_id, printing, condition, quantity)
    values (b_id, 'rlstest-001', 'normal', 'NM', 1);
    execute 'reset role';
    perform public.rls_record(4, 'A cannot insert into B''s portfolio', 'blocked', 'allowed');
  exception when insufficient_privilege then
    execute 'reset role';
    perform public.rls_record(4, 'A cannot insert into B''s portfolio', 'blocked', 'blocked');
  end;

  execute 'set local role authenticated';
  update public.portfolio_items set quantity = 99 where id = b_item_id;
  get diagnostics affected = row_count;
  execute 'reset role';
  perform public.rls_record(5, 'A cannot change B''s cards (rows changed)', '0', affected::text);

  execute 'set local role authenticated';
  delete from public.portfolio_items where id = b_item_id;
  get diagnostics affected = row_count;
  execute 'reset role';
  perform public.rls_record(6, 'A cannot delete B''s cards (rows deleted)', '0', affected::text);

  execute 'set local role authenticated';
  select count(*) into n from public.profiles;
  execute 'reset role';
  perform public.rls_record(7, 'A sees only their own profile row', '1', n::text);

  execute 'set local role authenticated';
  select count(*) into n from public.find_profile_by_username('rlstest_c');
  execute 'reset role';
  perform public.rls_record(8, 'A can look up an exact username (by design)', '1', n::text);

  execute 'set local role authenticated';
  select count(*) into n from public.find_profile_by_username('rlstest');
  execute 'reset role';
  perform public.rls_record(9, 'Partial username reveals nobody', '0', n::text);

  execute 'set local role authenticated';
  select count(*) into n from public.friend_summaries();
  execute 'reset role';
  perform public.rls_record(10, 'A''s friend list holds only accepted friends', '1', n::text);

  -- A asked C, so A must not be able to accept on C's behalf.
  execute 'set local role authenticated';
  update public.friendships set status = 'accepted' where id = pending_id;
  get diagnostics affected = row_count;
  execute 'reset role';
  perform public.rls_record(11, 'Requester cannot accept their own request', '0', affected::text);

  -- Card prices are shared reference data: readable by all, writable by none.
  execute 'set local role authenticated';
  select count(*) into n from public.cards_cache where card_id = 'rlstest-001';
  execute 'reset role';
  perform public.rls_record(12, 'A can read shared card data', '1', n::text);

  begin
    execute 'set local role authenticated';
    update public.cards_cache set prices = '{"normal": 9999}'::jsonb where card_id = 'rlstest-001';
    get diagnostics affected = row_count;
    execute 'reset role';
    perform public.rls_record(13, 'A cannot rewrite card prices (rows changed)', '0', affected::text);
  exception when insufficient_privilege then
    execute 'reset role';
    perform public.rls_record(13, 'A cannot rewrite card prices (rows changed)', '0', '0');
  end;

  begin
    execute 'set local role authenticated';
    update public.usage_counters set scan_count = 0 where user_id = a_id;
    get diagnostics affected = row_count;
    execute 'reset role';
    perform public.rls_record(14, 'A cannot reset their own scan count', '0', affected::text);
  exception when insufficient_privilege then
    execute 'reset role';
    perform public.rls_record(14, 'A cannot reset their own scan count', '0', '0');
  end;

  ---------------------------------------------------------------- act as C
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', c_id, 'role', 'authenticated')::text, true);

  select count(*) into n from public.portfolio_items where user_id = a_id;
  execute 'reset role';
  perform public.rls_record(15, 'Pending request gives C no access to A''s cards', '0', n::text);

  execute 'set local role authenticated';
  select count(*) into n from public.friend_summaries();
  execute 'reset role';
  perform public.rls_record(16, 'C has no friends while the request is pending', '0', n::text);

  execute 'set local role authenticated';
  select count(*) into n from public.friend_requests();
  execute 'reset role';
  perform public.rls_record(17, 'C sees the incoming request itself', '1', n::text);

  ---------------------------------------------------------------- act as a signed-out visitor
  -- A signed-out visitor holds no privileges on these tables at all, so Postgres
  -- refuses the query before Row Level Security is even consulted. That is a
  -- stronger result than "returned no rows", so either outcome counts as a pass
  -- and only actual rows coming back is a failure.
  begin
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n from public.portfolio_items;
    execute 'reset role';
    perform public.rls_record(18, 'Signed-out visitor gets no cards', 'no access',
      case when n = 0 then 'no access' else 'LEAKED ' || n || ' rows' end);
  exception when insufficient_privilege then
    execute 'reset role';
    perform public.rls_record(18, 'Signed-out visitor gets no cards', 'no access', 'no access');
  end;

  begin
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n from public.profiles;
    execute 'reset role';
    perform public.rls_record(19, 'Signed-out visitor gets no profiles', 'no access',
      case when n = 0 then 'no access' else 'LEAKED ' || n || ' rows' end);
  exception when insufficient_privilege then
    execute 'reset role';
    perform public.rls_record(19, 'Signed-out visitor gets no profiles', 'no access', 'no access');
  end;

  begin
    execute 'set local role anon';
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n from public.cards_cache;
    execute 'reset role';
    perform public.rls_record(20, 'Signed-out visitor gets no card data', 'no access',
      case when n = 0 then 'no access' else 'LEAKED ' || n || ' rows' end);
  exception when insufficient_privilege then
    execute 'reset role';
    perform public.rls_record(20, 'Signed-out visitor gets no card data', 'no access', 'no access');
  end;

  ---------------------------------------------------------------- username rules
  -- B tries to take the username A already has.
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', b_id, 'role', 'authenticated')::text, true);
    update public.profiles set username = 'rlstest_a' where id = b_id;
    execute 'reset role';
    perform public.rls_record(21, 'Two people cannot share a username', 'blocked', 'allowed');
  exception when unique_violation then
    execute 'reset role';
    perform public.rls_record(21, 'Two people cannot share a username', 'blocked', 'blocked');
  end;

  -- Capitals and punctuation are refused by the database, not just by the app.
  -- The claims have to be set again here: the block above ended in a caught
  -- exception, which rolled back the identity it had set.
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', b_id, 'role', 'authenticated')::text, true);
    update public.profiles set username = 'Bad-Name!' where id = b_id;
    get diagnostics affected = row_count;
    execute 'reset role';
    -- No exception was raised. Either the bad name was accepted, or no row
    -- matched and the constraint was never exercised. Report which, rather
    -- than claiming a pass we did not earn.
    perform public.rls_record(22, 'Username format is enforced in the database', 'blocked',
      case when affected = 0 then 'INCONCLUSIVE: no row matched' else 'allowed' end);
  exception when check_violation then
    execute 'reset role';
    perform public.rls_record(22, 'Username format is enforced in the database', 'blocked', 'blocked');
  end;

  ---------------------------------------------------------------- clean up
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (a_id, b_id, c_id);
  delete from public.cards_cache where card_id = 'rlstest-001';
end;
$test$;

drop function public.rls_record(int, text, text, text);

-- Every row should say PASS.
select id, check_name, expected, actual, result
from public.rls_test_results
order by id;
