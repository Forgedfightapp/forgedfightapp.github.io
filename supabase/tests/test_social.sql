-- LOCAL TESTING ONLY: behaviour tests for migrations/001_social.sql on plain Postgres.
-- Run: ./run-local.sh  (needs a local Postgres; creates a throwaway database forged_test)
\set ON_ERROR_STOP 1
\o /dev/null
\set A '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set B '''bbbbbbbb-0000-0000-0000-00000000000b'''
\set C '''cccccccc-0000-0000-0000-00000000000c'''
\set D '''dddddddd-0000-0000-0000-00000000000d'''
insert into auth.users (id, email) values (:A, 'steve@x'), (:B, 'alex@x'), (:C, 'cara@x'), (:D, 'dan@x');

create function pg_temp.expect_error(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm !~* pat then raise exception 'expected error ~ "%" but got "%" for: %', pat, sqlerrm, q; end if;
    return;
  end;
  raise exception 'expected an error ~ "%" for: %', pat, q;
end $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS %', msg; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------- signed out ----------
set role anon; select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error('select * from public.profiles', 'permission denied');
select pg_temp.expect_error('select public.create_invite()', 'permission denied');
select pg_temp.expect_error('select * from public.friends_leaderboard', 'permission denied');
reset role;

-- ---------- Steve: profile + invite ----------
set role authenticated; select set_config('request.jwt.claim.sub', :A, false);
select pg_temp.ok((select display_name from public.upsert_profile('  Steve<script>  ', 'gold', 3, 17, 4200, 'blue')) = 'Stevescript', 'profile name trimmed, angle brackets stripped');
select pg_temp.ok((select avatar_initial from public.profiles where id = :A) = 'S', 'avatar initial from name');
select pg_temp.expect_error($q$select public.upsert_profile('x', 'gold', 9, 1, 0, '')$q$, 'Invalid rank');
select pg_temp.expect_error($q$select public.upsert_profile(repeat('x', 31), 'gold', 1, 1, 0, '')$q$, 'too long');
select pg_temp.expect_error($q$insert into public.profiles (id) values ('cccccccc-0000-0000-0000-00000000000c')$q$, 'permission denied');
select pg_temp.expect_error($q$update public.profiles set xp = 999999$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.progress_entries values (auth.uid(), 'sessions', current_date, 4, now())$q$, 'permission denied');
select pg_temp.expect_error($q$select * from forged_private.rate_limits$q$, 'permission denied');
create temp table inv as select public.create_invite() as code; grant select on inv to anon;
select pg_temp.ok((select code ~ '^[A-HJ-NP-Z2-9]{8}$' from inv), 'invite code format');
select pg_temp.ok((select public.create_invite()) = (select code from inv), 'create_invite reuses the active code');
select pg_temp.expect_error(format('select * from public.accept_invite(%L)', (select code from inv)), 'own invite');
reset role;

-- ---------- signed-out invite preview ----------
set role anon; select set_config('request.jwt.claim.sub', '', false);
select pg_temp.ok((select display_name from public.get_invite((select lower(code) from inv))) = 'Stevescript', 'get_invite works signed out (name only), case-insensitive');
reset role;

-- ---------- Alex accepts ----------
set role authenticated; select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.ok((select count(*) from public.profiles) = 0, 'before friendship: cannot see Steve (no own profile yet)');
select pg_temp.ok((select display_name from public.accept_invite((select code from inv))) = 'Stevescript', 'accept_invite returns the friend');
select pg_temp.ok((select already from public.accept_invite((select code from inv))) = true, 'accepting twice is a no-op');
select public.upsert_profile('Alex', 'sky', 1, 6, 900, 'white');
select pg_temp.ok((select count(*) from public.profiles) = 2, 'friends see each other''s profile');
select pg_temp.ok((select count(*) from public.friendships) = 1, 'friendships: only your own rows');
select pg_temp.ok((select count(*) from public.invites) = 0, 'invites: cannot read others'' invites');
-- progress validation
select pg_temp.ok((public.submit_progress(jsonb_build_array(
  jsonb_build_object('metric','sessions','day',current_date,'value',2),
  jsonb_build_object('metric','xp','day',current_date,'value',20),
  jsonb_build_object('metric','pushups','day',current_date,'value',150),
  jsonb_build_object('metric','mat_minutes','day',current_date - 1,'value',90),
  jsonb_build_object('metric','daily_done','day',current_date - 1,'value',1),
  jsonb_build_object('metric','daily_done','day',current_date,'value',1)
))->>'accepted')::int = 6, 'valid progress accepted');
create temp table r1 as select public.submit_progress(jsonb_build_array(
  jsonb_build_object('metric','sessions','day',current_date - 8,'value',1),
  jsonb_build_object('metric','sessions','day',current_date + 2,'value',1),
  jsonb_build_object('metric','sessions','day',current_date,'value',5),
  jsonb_build_object('metric','xp','day',current_date,'value',40),
  jsonb_build_object('metric','xp','day',current_date - 2,'value',10),
  jsonb_build_object('metric','pushups','day',current_date,'value',2.5),
  jsonb_build_object('metric','weight','day',current_date,'value',80),
  jsonb_build_object('metric','notes','day',current_date,'value','hi')
)) as r;
select pg_temp.ok((select (r->>'accepted')::int = 0 and jsonb_array_length(r->'rejected') = 8 from r1), 'invalid progress rejected (backdate > 7 days, future, > 4 sessions, > 30 XP, XP without sessions, fractional, unknown metric)');
select pg_temp.ok((select r->'rejected'->0->>'reason' = 'too_old' from r1), 'backdate reason reported');
select pg_temp.expect_error($q$select public.submit_progress('{"a":1}')$q$, 'array');
select pg_temp.expect_error(format('select public.submit_progress(%L::jsonb)', (select jsonb_agg(jsonb_build_object('metric','sessions','day',current_date,'value',1)) from generate_series(1,65))), 'max 64');
reset role;

-- ---------- Cara: stranger ----------
set role authenticated; select set_config('request.jwt.claim.sub', :C, false);
select public.upsert_profile('Cara', 'jade', 0, 1, 0, '');
select pg_temp.ok((select count(*) from public.profiles) = 1, 'stranger sees only own profile');
select pg_temp.ok((select count(*) from public.progress_entries) = 0, 'stranger sees no progress');
select pg_temp.ok((select count(*) from public.friends_leaderboard) = 1, 'stranger leaderboard = only me');
select pg_temp.expect_error(format('select public.create_challenge(%L, %L, current_date, current_date + 6, array[%L]::uuid[])', 'h2h', 'sessions', :A), 'only challenge friends');
reset role;

-- ---------- Steve: leaderboard + head-to-head ----------
set role authenticated; select set_config('request.jwt.claim.sub', :A, false);
select public.submit_progress(jsonb_build_array(jsonb_build_object('metric','sessions','day',current_date,'value',1), jsonb_build_object('metric','xp','day',current_date,'value',10)));
select pg_temp.ok((select count(*) from public.friends_leaderboard) = 2, 'leaderboard: me + friend');
select pg_temp.ok((select display_name from public.friends_leaderboard where place = 1) = 'Alex', 'leaderboard ordered by weekly verified XP');
select pg_temp.ok((select week_sessions from public.friends_leaderboard where display_name = 'Alex') = (select coalesce(sum(value),0) from public.progress_entries where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' and metric = 'sessions' and day >= forged_private.week_start()), 'leaderboard week sessions');
select pg_temp.expect_error(format('select public.create_challenge(%L, %L, current_date, current_date + 40, array[%L]::uuid[])', 'h2h', 'sessions', :B), '1 to 31 days');
select pg_temp.expect_error(format('select public.create_challenge(%L, %L, current_date - 10, current_date, array[%L]::uuid[])', 'h2h', 'sessions', :B), 'last 7 days');
select pg_temp.expect_error(format('select public.create_challenge(%L, %L, current_date, current_date + 6, array[%L]::uuid[])', 'h2h', 'weight', :B), 'Invalid metric');
select pg_temp.expect_error(format('select public.create_challenge(%L, %L, current_date, current_date + 6, array[%L, %L]::uuid[])', 'h2h', 'sessions', :B, :C), '1 friend');
create temp table ch as select public.create_challenge('h2h', 'pushups', current_date - 1, current_date + 5, array[:B]::uuid[], 'Push-up war') as id;
create temp table ch2 as select public.create_challenge('h2h', 'daily_streak', current_date - 1, current_date + 5, array[:B]::uuid[]) as id;
select pg_temp.ok((select count(*) from public.my_challenges()) = 2, 'my_challenges lists both');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.ok((select my_status from public.my_challenges() where id = (select id from ch)) = 'invited', 'friend is invited');
select public.respond_challenge((select id from ch), true);
select pg_temp.ok((select score from public.get_challenge_board((select id from ch)) where is_me) = 150, 'board: friend push-ups in window');
select pg_temp.ok((select score from public.get_challenge_board((select id from ch2)) where is_me) = 2, 'board: daily streak = 2 days in a row');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :C, false);
select pg_temp.expect_error(format('select * from public.get_challenge_board(%L)', (select id from ch)), 'not found');
select pg_temp.ok((select count(*) from public.challenges) = 0, 'stranger cannot read the challenge');
reset role;

-- ---------- group challenge: co-participants who are not friends ----------
set role authenticated; select set_config('request.jwt.claim.sub', :C, false);
create temp table inv2 as select public.create_invite() as code;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :A, false);
select public.accept_invite((select code from inv2));
create temp table gch as select public.create_challenge('group', 'sessions', current_date, current_date + 6, array[:B, :C]::uuid[]) as id;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :C, false);
select pg_temp.ok((select count(*) from public.profiles) = 3, 'co-participants see each other''s public profile');
select pg_temp.ok((select count(*) from public.progress_entries where user_id = :B) = (select count(*) from public.progress_entries where user_id = :B and metric = 'sessions' and day >= current_date), 'non-friend co-participant: only the shared metric and dates');
select pg_temp.ok((select count(*) from public.friends_leaderboard) = 2, 'leaderboard is friends only (not co-participants)');
select public.leave_challenge((select id from gch));
select pg_temp.ok((select count(*) from public.profiles) = 2, 'after leaving, the non-friend is hidden again');
reset role;

-- ---------- remove friend + delete account ----------
set role authenticated; select set_config('request.jwt.claim.sub', :B, false);
select public.remove_friend(:A);
select pg_temp.ok((select count(*) from public.friends_leaderboard) = 1, 'remove_friend removes both sides');
select public.delete_account();
reset role;
select pg_temp.ok(not exists (select 1 from auth.users where id = :B), 'delete_account removes the auth user');
select pg_temp.ok(not exists (select 1 from public.profiles where id = :B) and not exists (select 1 from public.progress_entries where user_id = :B)
  and not exists (select 1 from public.challenge_participants where user_id = :B) and not exists (select 1 from public.friendships where :B in (user_id, friend_id)), 'delete_account cascades to every table');
select pg_temp.ok(exists (select 1 from public.challenges where id = (select id from ch)), 'challenges created by others survive');

-- ---------- rate limit ----------
set role authenticated; select set_config('request.jwt.claim.sub', :D, false);
select pg_temp.expect_error($q$select public.upsert_profile('Dan') from generate_series(1, 61)$q$, 'Too many requests');
reset role;
\o
select 'ALL SQL TESTS PASSED';
