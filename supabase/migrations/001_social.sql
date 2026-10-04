-- =====================================================================================
-- Forged 3.4.0 social schema: friends, invites, head-to-head / group challenges,
-- progress summaries and a weekly friends leaderboard.
--
-- Paste the whole file into Supabase Dashboard > SQL Editor > New query > Run.
-- Idempotent: running it again is safe (create if not exists / create or replace /
-- drop policy if exists). Free-tier friendly: no extensions, no cron, no Realtime,
-- no Edge Functions, old progress rows are pruned on write.
--
-- Privacy: only summaries are stored (display name, avatar initial/colour, rank,
-- level, XP, belt, and per-day counts: sessions, push-ups, mat minutes, daily
-- challenges done, logging XP). Never notes, body weight, food or workout details.
--
-- Security model:
--   * RLS is enabled on every table. Clients can only SELECT, and only their own rows
--     plus their friends' / co-participants' public summaries.
--   * Every write goes through a SECURITY DEFINER RPC that validates input with the
--     same rules as the app (30 XP/day logging cap, 7-day backdate limit, sane maxima).
--   * Helper functions live in schema forged_private, which the Data API does not expose.
-- =====================================================================================

begin;

create schema if not exists forged_private;
revoke all on schema forged_private from public;
grant usage on schema forged_private to authenticated;

-- -------------------------------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null default 'Fighter',
  avatar_initial text not null default 'F',
  avatar_color   text not null default 'flame',
  rank_idx       smallint not null default 0,
  level          int not null default 1,
  xp             int not null default 0,
  belt           text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint profiles_name_len   check (char_length(display_name) between 1 and 30),
  constraint profiles_initial    check (char_length(avatar_initial) between 1 and 2),
  constraint profiles_color      check (avatar_color in ('flame','gold','steel','ember','jade','violet','sky','rose')),
  constraint profiles_rank       check (rank_idx between 0 and 7),
  constraint profiles_level      check (level between 1 and 200),
  constraint profiles_xp         check (xp between 0 and 5000000),
  constraint profiles_belt       check (belt ~ '^[a-z-]{0,20}$')
);

create table if not exists public.invites (
  code        text primary key,
  inviter_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 days'),
  max_uses    int not null default 25,
  uses        int not null default 0,
  constraint invites_code check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  constraint invites_uses check (uses >= 0 and max_uses between 1 and 100)
);
create index if not exists invites_inviter_idx on public.invites (inviter_id);

-- Friendships are stored in both directions (one row per side) so RLS stays simple.
create table if not exists public.friendships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  via_code   text,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendships_not_self check (user_id <> friend_id)
);
create index if not exists friendships_friend_idx on public.friendships (friend_id);

create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  metric      text not null,
  title       text not null default '',
  starts_on   date not null,
  ends_on     date not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint challenges_kind   check (kind in ('h2h','group')),
  constraint challenges_metric check (metric in ('sessions','pushups','mat_minutes','daily_streak')),
  constraint challenges_title  check (char_length(title) <= 60),
  constraint challenges_dates  check (ends_on >= starts_on and ends_on - starts_on <= 30)
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'invited',
  joined_at    timestamptz,
  primary key (challenge_id, user_id),
  constraint cp_status check (status in ('invited','joined','declined','left'))
);
create index if not exists cp_user_idx on public.challenge_participants (user_id);

-- One row per user, metric and day: the day's total (re-sent totals overwrite, so replays can't double count).
create table if not exists public.progress_entries (
  user_id    uuid not null references auth.users(id) on delete cascade,
  metric     text not null,
  day        date not null,
  value      int not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, metric, day),
  constraint progress_metric check (metric in ('sessions','pushups','mat_minutes','daily_done','xp')),
  constraint progress_value  check (value >= 0)
);
create index if not exists progress_day_idx on public.progress_entries (day);

-- Write rate limits (no client access at all).
create table if not exists forged_private.rate_limits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null default now(),
  hits         int not null default 0,
  primary key (user_id, bucket)
);

-- -------------------------------------------------------------------------------------
-- Private helpers (SECURITY DEFINER so RLS policies can use them without recursion)
-- -------------------------------------------------------------------------------------
-- Weeks run Monday to Sunday in this time zone (the app's users are US-based; change here if needed).
create or replace function forged_private.week_start()
returns date language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'America/Chicago')::date;
$$;

create or replace function forged_private.metric_source(m text)
returns text language sql immutable set search_path = '' as $$
  select case m when 'daily_streak' then 'daily_done' else m end;
$$;

create or replace function forged_private.is_friend(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = target);
$$;

create or replace function forged_private.in_challenge(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_participants p
                 where p.challenge_id = cid and p.user_id = auth.uid() and p.status in ('invited','joined'));
$$;

create or replace function forged_private.shares_challenge(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_participants a
                 join public.challenge_participants b on b.challenge_id = a.challenge_id
                 where a.user_id = auth.uid() and b.user_id = target
                   and a.status in ('invited','joined') and b.status in ('invited','joined'));
$$;

-- Progress is visible to the owner, to friends, and to co-participants only for the
-- metric and dates of a challenge they share.
create or replace function forged_private.can_see_progress(target uuid, m text, d date)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = auth.uid()
      or forged_private.is_friend(target)
      or exists (select 1 from public.challenge_participants a
                 join public.challenge_participants b on b.challenge_id = a.challenge_id
                 join public.challenges c on c.id = a.challenge_id
                 where a.user_id = auth.uid() and b.user_id = target
                   and a.status in ('invited','joined') and b.status in ('invited','joined')
                   and forged_private.metric_source(c.metric) = m
                   and d between c.starts_on and c.ends_on);
$$;


-- Per-metric daily maximum (mirrors the app: max 4 sessions a day, 30 XP a day for logging, ...)
create or replace function forged_private.metric_max(m text)
returns int language sql immutable set search_path = '' as $$
  select case m when 'sessions' then 4 when 'pushups' then 3000 when 'mat_minutes' then 480
                when 'daily_done' then 3 when 'xp' then 30 else 0 end;
$$;

create or replace function forged_private.require_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  return u;
end $$;

-- Fixed-window rate limit: raises once a user exceeds max_hits within window_secs.
create or replace function forged_private.hit(p_bucket text, p_max int, p_secs int)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user(); n int;
begin
  insert into forged_private.rate_limits as r (user_id, bucket, window_start, hits) values (u, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_secs) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_secs) then now() else r.window_start end
  returning r.hits into n;
  if n > p_max then raise exception 'Too many requests, try again later' using errcode = '54000'; end if;
end $$;

create or replace function forged_private.ensure_profile(u uuid)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.profiles (id) values (u) on conflict (id) do nothing;
$$;

-- 8 characters from a 32-letter alphabet without 0/O/1/I, from gen_random_uuid() (cryptographically random).
create or replace function forged_private.new_code()
returns text language plpgsql volatile set search_path = '' as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := uuid_send(gen_random_uuid()); s text := ''; i int;
begin
  for i in 0..7 loop s := s || substr(a, (get_byte(b, i) % 32) + 1, 1); end loop;
  return s;
end $$;

revoke all on all functions in schema forged_private from public, anon;
grant execute on function forged_private.is_friend(uuid), forged_private.in_challenge(uuid),
  forged_private.shares_challenge(uuid), forged_private.can_see_progress(uuid, text, date),
  forged_private.metric_source(text), forged_private.week_start() to authenticated;

-- -------------------------------------------------------------------------------------
-- Row Level Security: read-only for clients, writes only through the RPCs below
-- -------------------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.invites                enable row level security;
alter table public.friendships            enable row level security;
alter table public.challenges             enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.progress_entries       enable row level security;
alter table forged_private.rate_limits    enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or forged_private.is_friend(id) or forged_private.shares_challenge(id));

drop policy if exists invites_read_own on public.invites;
create policy invites_read_own on public.invites for select to authenticated
  using (inviter_id = (select auth.uid()));

drop policy if exists friendships_read_own on public.friendships;
create policy friendships_read_own on public.friendships for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists challenges_read_member on public.challenges;
create policy challenges_read_member on public.challenges for select to authenticated
  using (forged_private.in_challenge(id));

drop policy if exists cp_read_member on public.challenge_participants;
create policy cp_read_member on public.challenge_participants for select to authenticated
  using (user_id = (select auth.uid()) or forged_private.in_challenge(challenge_id));

drop policy if exists progress_read on public.progress_entries;
create policy progress_read on public.progress_entries for select to authenticated
  using (forged_private.can_see_progress(user_id, metric, day));

-- rate_limits: RLS on, no policies = no client access.

revoke all on public.profiles, public.invites, public.friendships, public.challenges,
  public.challenge_participants, public.progress_entries from anon, authenticated;
revoke all on forged_private.rate_limits from public, anon, authenticated;
grant select on public.profiles, public.invites, public.friendships, public.challenges,
  public.challenge_participants, public.progress_entries to authenticated;

-- -------------------------------------------------------------------------------------
-- Leaderboard view: you + your friends, this week (Monday to Sunday, see forged_private.week_start).
-- security_invoker = true, so the RLS above decides what each caller can see.
-- -------------------------------------------------------------------------------------
create or replace view public.friends_leaderboard with (security_invoker = true) as
with people as (
  select auth.uid() as user_id where auth.uid() is not null
  union
  select f.friend_id from public.friendships f where f.user_id = auth.uid()
), wk as (
  select forged_private.week_start() as ws
)
select p.id as user_id, p.display_name, p.avatar_initial, p.avatar_color, p.rank_idx, p.level, p.xp, p.belt,
       coalesce(sum(e.value) filter (where e.metric = 'sessions'), 0)::int    as week_sessions,
       coalesce(sum(e.value) filter (where e.metric = 'xp'), 0)::int          as week_xp,
       coalesce(sum(e.value) filter (where e.metric = 'pushups'), 0)::int     as week_pushups,
       coalesce(sum(e.value) filter (where e.metric = 'mat_minutes'), 0)::int as week_mat_minutes,
       rank() over (order by coalesce(sum(e.value) filter (where e.metric = 'xp'), 0) desc,
                             coalesce(sum(e.value) filter (where e.metric = 'sessions'), 0) desc)::int as place,
       (p.id = auth.uid()) as is_me
from people x
join public.profiles p on p.id = x.user_id
cross join wk
left join public.progress_entries e on e.user_id = p.id and e.day >= wk.ws and e.day < wk.ws + 7
group by p.id;

revoke all on public.friends_leaderboard from anon, authenticated;
grant select on public.friends_leaderboard to authenticated;

-- -------------------------------------------------------------------------------------
-- RPCs (call with supabase.rpc('name', {...}))
-- -------------------------------------------------------------------------------------

-- Create or update your public profile.
create or replace function public.upsert_profile(p_display_name text, p_avatar_color text default 'flame',
  p_rank_idx int default 0, p_level int default 1, p_xp int default 0, p_belt text default '')
returns public.profiles language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user(); nm text; r public.profiles;
begin
  perform forged_private.hit('profile', 60, 3600);
  nm := btrim(regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]<>]', '', 'g'));
  if char_length(nm) < 1 then nm := 'Fighter'; end if;
  if char_length(nm) > 30 then raise exception 'Name is too long (max 30)' using errcode = '22023'; end if;
  if coalesce(p_avatar_color, '') not in ('flame','gold','steel','ember','jade','violet','sky','rose') then p_avatar_color := 'flame'; end if;
  if p_rank_idx is null or p_rank_idx not between 0 and 7 then raise exception 'Invalid rank' using errcode = '22023'; end if;
  if p_level is null or p_level not between 1 and 200 then raise exception 'Invalid level' using errcode = '22023'; end if;
  if p_xp is null or p_xp not between 0 and 5000000 then raise exception 'Invalid XP' using errcode = '22023'; end if;
  if coalesce(p_belt, '') !~ '^[a-z-]{0,20}$' then p_belt := ''; end if;
  insert into public.profiles as p (id, display_name, avatar_initial, avatar_color, rank_idx, level, xp, belt, updated_at)
  values (u, nm, upper(left(nm, 1)), p_avatar_color, p_rank_idx, p_level, p_xp, coalesce(p_belt, ''), now())
  on conflict (id) do update set display_name = excluded.display_name, avatar_initial = excluded.avatar_initial,
    avatar_color = excluded.avatar_color, rank_idx = excluded.rank_idx, level = excluded.level, xp = excluded.xp,
    belt = excluded.belt, updated_at = now()
  returning * into r;
  return r;
end $$;

-- Your invite code (reuses the active one, else creates a new one: 30 days, 25 uses).
create or replace function public.create_invite()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user(); c text; tries int := 0;
begin
  perform forged_private.ensure_profile(u);
  select i.code into c from public.invites i
   where i.inviter_id = u and i.expires_at > now() + interval '3 days' and i.uses < i.max_uses
   order by i.created_at desc limit 1;
  if c is not null then return c; end if;
  perform forged_private.hit('invite', 10, 86400);
  loop
    c := forged_private.new_code(); tries := tries + 1;
    begin
      insert into public.invites (code, inviter_id) values (c, u);
      return c;
    exception when unique_violation then
      if tries > 5 then raise; end if;
    end;
  end loop;
end $$;

-- Who sent this invite? (Shown before sign-in: "Sign in to add Steve". Name/initial/colour/rank only.)
create or replace function public.get_invite(p_code text)
returns table (display_name text, avatar_initial text, avatar_color text, rank_idx smallint, valid boolean)
language sql stable security definer set search_path = '' as $$
  select p.display_name, p.avatar_initial, p.avatar_color, p.rank_idx, (i.expires_at > now() and i.uses < i.max_uses)
  from public.invites i join public.profiles p on p.id = i.inviter_id
  where i.code = upper(btrim(p_code));
$$;

-- Accept an invite: creates the friendship in both directions. Safe to call twice.
create or replace function public.accept_invite(p_code text)
returns table (friend_id uuid, display_name text, avatar_initial text, avatar_color text, rank_idx smallint, already boolean)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare u uuid := forged_private.require_user(); inv public.invites; was boolean;
begin
  perform forged_private.hit('accept', 30, 3600);
  perform forged_private.ensure_profile(u);
  select * into inv from public.invites i where i.code = upper(btrim(p_code)) for update;
  if not found then raise exception 'Invite code not found' using errcode = 'P0002'; end if;
  if inv.inviter_id = u then raise exception 'That is your own invite code' using errcode = '22023'; end if;
  was := exists (select 1 from public.friendships f where f.user_id = u and f.friend_id = inv.inviter_id);
  if not was then
    if inv.expires_at <= now() or inv.uses >= inv.max_uses then raise exception 'This invite has expired' using errcode = '22023'; end if;
    if (select count(*) from public.friendships f where f.user_id = u) >= 200 then raise exception 'Friend limit reached (200)' using errcode = '54000'; end if;
    insert into public.friendships (user_id, friend_id, via_code) values (u, inv.inviter_id, inv.code), (inv.inviter_id, u, inv.code)
      on conflict do nothing;
    update public.invites set uses = uses + 1 where code = inv.code;
  end if;
  return query select p.id, p.display_name, p.avatar_initial, p.avatar_color, p.rank_idx, was
    from public.profiles p where p.id = inv.inviter_id;
end $$;

create or replace function public.remove_friend(p_friend uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user();
begin
  delete from public.friendships where (user_id = u and friend_id = p_friend) or (user_id = p_friend and friend_id = u);
end $$;

-- Start a challenge with friends. h2h = exactly one friend; group = 2 to 19 friends.
create or replace function public.create_challenge(p_kind text, p_metric text, p_starts_on date, p_ends_on date,
  p_friends uuid[], p_title text default '')
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user(); cid uuid; f uuid; n int; t text;
begin
  perform forged_private.hit('challenge', 20, 86400);
  if p_kind not in ('h2h','group') then raise exception 'Invalid challenge type' using errcode = '22023'; end if;
  if p_metric not in ('sessions','pushups','mat_minutes','daily_streak') then raise exception 'Invalid metric' using errcode = '22023'; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on or p_ends_on - p_starts_on > 30 then
    raise exception 'A challenge lasts 1 to 31 days' using errcode = '22023'; end if;
  if p_starts_on < current_date - 7 or p_starts_on > current_date + 14 then
    raise exception 'Start date must be within the last 7 days or the next 14' using errcode = '22023'; end if;
  select count(distinct x) into n from unnest(coalesce(p_friends, '{}')) x where x is not null and x <> u;
  if (p_kind = 'h2h' and n <> 1) or (p_kind = 'group' and n not between 2 and 19) then
    raise exception 'Pick 1 friend for head-to-head, 2 to 19 for a group' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_friends) x where x is not null and x <> u
             and not exists (select 1 from public.friendships fr where fr.user_id = u and fr.friend_id = x)) then
    raise exception 'You can only challenge friends' using errcode = '42501'; end if;
  if (select count(*) from public.challenges c where c.created_by = u and c.ends_on >= current_date) >= 10 then
    raise exception 'You have 10 active challenges already' using errcode = '54000'; end if;
  t := left(btrim(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]<>]', '', 'g')), 60);
  insert into public.challenges (kind, metric, title, starts_on, ends_on, created_by)
    values (p_kind, p_metric, t, p_starts_on, p_ends_on, u) returning id into cid;
  insert into public.challenge_participants (challenge_id, user_id, status, joined_at) values (cid, u, 'joined', now());
  for f in select distinct x from unnest(p_friends) x where x is not null and x <> u loop
    insert into public.challenge_participants (challenge_id, user_id, status) values (cid, f, 'invited');
  end loop;
  return cid;
end $$;

create or replace function public.respond_challenge(p_challenge uuid, p_accept boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user();
begin
  update public.challenge_participants
     set status = case when p_accept then 'joined' else 'declined' end,
         joined_at = case when p_accept then now() else joined_at end
   where challenge_id = p_challenge and user_id = u and status in ('invited','joined');
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.leave_challenge(p_challenge uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user();
begin
  update public.challenge_participants set status = 'left' where challenge_id = p_challenge and user_id = u;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
end $$;

-- Your challenges (invited or joined), newest first, with the creator's name.
create or replace function public.my_challenges()
returns table (id uuid, kind text, metric text, title text, starts_on date, ends_on date, my_status text,
               created_by uuid, created_by_name text, participants int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.kind, c.metric, c.title, c.starts_on, c.ends_on, me.status, c.created_by,
         (select p.display_name from public.profiles p where p.id = c.created_by),
         (select count(*)::int from public.challenge_participants x where x.challenge_id = c.id and x.status in ('invited','joined'))
  from public.challenge_participants me join public.challenges c on c.id = me.challenge_id
  where me.user_id = auth.uid() and me.status in ('invited','joined') and c.ends_on >= current_date - 30
  order by c.ends_on >= current_date desc, c.starts_on desc
  limit 50;
$$;

-- Live standings for one challenge (participants only). daily_streak = longest run of days
-- with a daily challenge done inside the challenge window.
create or replace function public.get_challenge_board(p_challenge uuid)
returns table (user_id uuid, display_name text, avatar_initial text, avatar_color text, rank_idx smallint,
               status text, score int, place int, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.challenges;
begin
  if not forged_private.in_challenge(p_challenge) then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  select * into c from public.challenges where id = p_challenge;
  return query
  with pp as (
    select cp.user_id, cp.status from public.challenge_participants cp
    where cp.challenge_id = c.id and cp.status in ('invited','joined')
  ), e as (
    select pe.user_id, pe.day, pe.value from public.progress_entries pe join pp on pp.user_id = pe.user_id
    where pe.metric = forged_private.metric_source(c.metric) and pe.day between c.starts_on and c.ends_on and pe.value > 0
  ), runs as (
    select e.user_id, count(*) as len from (select e.user_id, e.day, e.day - (row_number() over (partition by e.user_id order by e.day))::int as grp from e) e
    group by e.user_id, e.grp
  ), sc as (
    select pp.user_id, pp.status,
      case when c.metric = 'daily_streak' then coalesce((select max(r.len) from runs r where r.user_id = pp.user_id), 0)
           else coalesce((select sum(e.value) from e where e.user_id = pp.user_id), 0) end::int as score
    from pp
  )
  select sc.user_id, p.display_name, p.avatar_initial, p.avatar_color, p.rank_idx, sc.status, sc.score,
         rank() over (order by sc.score desc)::int, sc.user_id = auth.uid()
  from sc join public.profiles p on p.id = sc.user_id
  order by sc.score desc, p.display_name;
end $$;

-- Submit per-day totals synced from the phone: [{"metric":"sessions","day":"2026-10-03","value":2}, ...]
-- Rules (mirror the app): days within the last 7 (+1 for time zones), whole numbers within the per-metric
-- maximum, logging XP <= 30 a day and <= 10 per session that day. Re-sent days overwrite (idempotent).
create or replace function public.submit_progress(p_entries jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user(); it jsonb; m text; d date; v numeric; ok int := 0; bad jsonb := '[]'::jsonb; sess int;
begin
  perform forged_private.hit('progress', 120, 3600);
  if jsonb_typeof(p_entries) is distinct from 'array' then raise exception 'Expected an array' using errcode = '22023'; end if;
  if jsonb_array_length(p_entries) > 64 then raise exception 'Too many entries (max 64)' using errcode = '22023'; end if;
  perform forged_private.ensure_profile(u);
  -- sessions first, so the XP check below sees this batch's session counts
  for it in select x from jsonb_array_elements(p_entries) x order by (x->>'metric' = 'sessions') desc loop
    m := it->>'metric';
    begin d := (it->>'day')::date; exception when others then d := null; end;
    begin v := (it->>'value')::numeric; exception when others then v := null; end;
    if m is null or m not in ('sessions','pushups','mat_minutes','daily_done','xp') then
      bad := bad || jsonb_build_object('metric', m, 'day', it->>'day', 'reason', 'metric');
    elsif d is null or d > current_date + 1 then
      bad := bad || jsonb_build_object('metric', m, 'day', it->>'day', 'reason', 'date');
    elsif d < current_date - 7 then
      bad := bad || jsonb_build_object('metric', m, 'day', it->>'day', 'reason', 'too_old');
    elsif v is null or v <> trunc(v) or v < 0 or v > forged_private.metric_max(m) then
      bad := bad || jsonb_build_object('metric', m, 'day', it->>'day', 'reason', 'value');
    else
      if m = 'xp' then
        select coalesce((select pe.value from public.progress_entries pe where pe.user_id = u and pe.metric = 'sessions' and pe.day = d), 0) into sess;
        if v > sess * 10 then
          bad := bad || jsonb_build_object('metric', m, 'day', it->>'day', 'reason', 'value');
          continue;
        end if;
      end if;
      insert into public.progress_entries as pe (user_id, metric, day, value, updated_at) values (u, m, d, v::int, now())
      on conflict (user_id, metric, day) do update set value = excluded.value, updated_at = now()
        where pe.value is distinct from excluded.value;
      ok := ok + 1;
    end if;
  end loop;
  delete from public.progress_entries where user_id = u and day < current_date - 90;   -- free tier: keep it small
  return jsonb_build_object('accepted', ok, 'rejected', bad);
end $$;

-- App Store 5.1.1(v): delete the account and everything tied to it (cascades through every table).
create or replace function public.delete_account()
returns void language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user();
begin
  delete from auth.users where id = u;
end $$;

-- Function privileges: signed-in users only (get_invite also works signed out).
revoke all on function public.upsert_profile(text, text, int, int, int, text), public.create_invite(),
  public.get_invite(text), public.accept_invite(text), public.remove_friend(uuid),
  public.create_challenge(text, text, date, date, uuid[], text), public.respond_challenge(uuid, boolean),
  public.leave_challenge(uuid), public.my_challenges(), public.get_challenge_board(uuid),
  public.submit_progress(jsonb), public.delete_account() from public, anon;
grant execute on function public.upsert_profile(text, text, int, int, int, text), public.create_invite(),
  public.get_invite(text), public.accept_invite(text), public.remove_friend(uuid),
  public.create_challenge(text, text, date, date, uuid[], text), public.respond_challenge(uuid, boolean),
  public.leave_challenge(uuid), public.my_challenges(), public.get_challenge_board(uuid),
  public.submit_progress(jsonb), public.delete_account() to authenticated;
grant execute on function public.get_invite(text) to anon;

commit;
