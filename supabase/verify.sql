-- Forged 3.4.0: verify that migrations/001_social.sql was applied correctly.
-- Paste into Supabase Dashboard > SQL Editor and Run. Read-only. Every row should say ok = true.
with
t(name) as (values ('profiles'),('invites'),('friendships'),('challenges'),('challenge_participants'),('progress_entries')),
f(name) as (values ('upsert_profile'),('create_invite'),('get_invite'),('accept_invite'),('remove_friend'),('create_challenge'),
                   ('respond_challenge'),('leave_challenge'),('my_challenges'),('get_challenge_board'),('submit_progress'),('delete_account')),
checks(check_name, ok, detail) as (
  select 'table public.' || t.name, c.oid is not null, coalesce('rls=' || c.relrowsecurity, 'missing')
    from t left join pg_class c on c.relname = t.name and c.relnamespace = 'public'::regnamespace
  union all
  select 'RLS on public.' || t.name, coalesce(c.relrowsecurity, false), ''
    from t left join pg_class c on c.relname = t.name and c.relnamespace = 'public'::regnamespace
  union all
  select 'select policy on public.' || t.name, exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.name and p.cmd = 'SELECT'), ''
    from t
  union all
  select 'no write policies on public.' || t.name, not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.name and p.cmd <> 'SELECT'), ''
    from t
  union all
  select 'anon cannot read public.' || t.name, not has_table_privilege('anon', 'public.' || t.name, 'select'), ''
    from t
  union all
  select 'authenticated cannot write public.' || t.name,
         not (has_table_privilege('authenticated', 'public.' || t.name, 'insert') or has_table_privilege('authenticated', 'public.' || t.name, 'update')
              or has_table_privilege('authenticated', 'public.' || t.name, 'delete')), ''
    from t
  union all
  select 'RLS on forged_private.rate_limits', coalesce((select relrowsecurity from pg_class where oid = to_regclass('forged_private.rate_limits')), false), ''
  union all
  select 'function public.' || f.name || ' (security definer)', coalesce(bool_and(p.prosecdef), false), count(p.oid) || ' found'
    from f left join pg_proc p on p.proname = f.name and p.pronamespace = 'public'::regnamespace group by f.name
  union all
  select 'search_path pinned on public.' || f.name, coalesce(bool_and(array_to_string(p.proconfig, ',') like '%search_path=%'), false), ''
    from f left join pg_proc p on p.proname = f.name and p.pronamespace = 'public'::regnamespace group by f.name
  union all
  select 'anon cannot call public.' || f.name, not coalesce(bool_or(has_function_privilege('anon', p.oid, 'execute')), false), ''
    from f left join pg_proc p on p.proname = f.name and p.pronamespace = 'public'::regnamespace where f.name <> 'get_invite' group by f.name
  union all
  select 'view public.friends_leaderboard (security_invoker)',
         coalesce((select 'security_invoker=true' = any(c.reloptions) from pg_class c where c.oid = to_regclass('public.friends_leaderboard')), false), ''
  union all
  select 'anon cannot read friends_leaderboard', to_regclass('public.friends_leaderboard') is not null and not has_table_privilege('anon', 'public.friends_leaderboard', 'select'), ''
)
select check_name, ok, detail from checks
union all
select '== ALL CHECKS ==', bool_and(ok), count(*) filter (where not ok) || ' failing of ' || count(*) from checks
order by 1;
