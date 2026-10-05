-- RLS tests: run against a local database where migrations were applied.
-- Simulates two authenticated users and proves user B cannot read user A's attempts.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
insert into public.attempts (user_id, item_id, score) values ('00000000-0000-0000-0000-00000000000a', 'nav-ecdis-001', 1);
do $$ begin
  if (select count(*) from public.attempts) <> 1 then raise exception 'A should see own attempt'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $$ begin
  if (select count(*) from public.attempts) <> 0 then raise exception 'RLS FAIL: B can read A''s attempts'; end if;
end $$;
-- B cannot insert rows for A
do $$ begin
  begin
    insert into public.attempts (user_id, item_id, score) values ('00000000-0000-0000-0000-00000000000a', 'x', 1);
    raise exception 'RLS FAIL: B inserted a row for A';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;
-- B cannot grant itself a subscription
do $$ begin
  begin
    insert into public.subscriptions (user_id, tier, country, provider, status) values ('00000000-0000-0000-0000-00000000000b', 'pro', 'ng', 'x', 'active');
    raise exception 'RLS FAIL: user created own subscription';
  exception when insufficient_privilege then null;
  end;
end $$;
-- draft items hidden from non-admins in prod mode
reset role;
insert into public.items (id, type, competence, topic, countries, difficulty, status, body) values
  ('t-draft', 'mcq', 'NAV', 't', '{*}', 1, 'draft', '{}'), ('t-rev', 'mcq', 'NAV', 't', '{*}', 1, 'reviewed', '{}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select set_config('app.content_mode', 'prod', true);
do $$ begin
  if exists (select 1 from public.items where id = 't-draft') then raise exception 'RLS FAIL: draft visible in prod'; end if;
  if not exists (select 1 from public.items where id = 't-rev') then raise exception 'reviewed item should be visible'; end if;
end $$;
select 'RLS TESTS PASSED' as result;
rollback;
