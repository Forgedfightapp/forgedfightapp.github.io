-- 005_username.sql (3.16.0) - unique usernames + add friend by username + public profile view.
-- NOT RUN YET. Run in the Supabase SQL editor after review, then set FORGED_CONFIG.usernames = true.
-- Usernames (X/Instagram style): 3-20 chars, letters, numbers, _ and . only; no spaces; no leading/trailing
-- or double period. Stored with the user's casing, unique case-insensitively. Reserved and offensive handles
-- are refused by claim_username (the only write path: clients have no insert/update grant on profiles).
-- Lists mirror username.js - keep them in sync.
-- Privacy: nothing here reads or returns auth.users / email. Lookups return only username,
-- display name, initial, colour and belt.

alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_fmt;
alter table public.profiles add constraint profiles_username_fmt
  check (username is null or (username ~ '^[A-Za-z0-9_.]{3,20}$' and username !~ '(^[.])|([.]$)|([.][.])'));
create unique index if not exists profiles_username_lower_uq on public.profiles (lower(username));

-- my own username (for the profile screen)
create or replace function public.my_username() returns text language sql stable security definer set search_path = '' as $$
  select p.username from public.profiles p where p.id = auth.uid() $$;

create or replace function forged_private.norm_username(p text)
returns text language sql immutable set search_path = '' as $$ select lower(btrim(coalesce(p, ''))) $$;

create or replace function forged_private.username_variants(n text)
returns text[] language sql immutable set search_path = '' as $$
  with b as (select regexp_replace(lower(n), '[._]', '', 'g') as x),
       v as (select translate(x, '013457@$89!|', 'oieastasbgil') a, translate(x, '013457@$89!|', 'oleastasbgil') b2 from b)
  select array[a, b2, regexp_replace(a, '(.)\1+', '\1', 'g'), regexp_replace(b2, '(.)\1+', '\1', 'g')] from v $$;

create or replace function forged_private.reserved_username(n text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(n) = any (array['admin','administrator','forged','forgedapp','forgedfight','ferro','ferroco','support','matfinder','help','official','staff','moderator','mod','root','system','team','security','owner','api','www','null','undefined','me','you','everyone']) or forged_private.username_variants(n) && array['admin','administrator','forged','forgedapp','forgedfight','ferro','ferroco','support','matfinder','help','official','staff','moderator','mod','root','system','team','security','owner','api','www','null','undefined','me','you','everyone'] $$;

create or replace function forged_private.offensive_username(n text)
returns boolean language sql immutable set search_path = '' as $$
  select exists (
    select 1 from unnest(forged_private.username_variants(n)) v0,
      lateral (select (select coalesce(string_agg(w, '|'), '') from unnest(array['cucumber','document','circumstance','scunthorpe','dickson','dickens','hancock','peacock','cockpit','analysis','analyst','canal','banal','shitake','shiitake','classic','grappler']) w) as al) a,
      lateral (select case when a.al = '' then v0 else regexp_replace(v0, a.al, '', 'g') end as v) c
    where c.v = any (array['ass','fag','tit','sex','kys','hoe','arse','damn','crap','piss','nig','spic']) or exists (select 1 from unnest(array['nigger','nigga','faggot','fagot','retard','tranny','chink','spick','kike','wetback','gook','coon','raghead','beaner','fuck','fuk','shit','cunt','bitch','whore','slut','pussy','dick','cock','penis','vagina','porn','rape','rapist','nazi','hitler','kkk','molest','pedo','incest','anal','cum','jizz','twat','wank','bastard','motherf','asshole','dildo','blowjob','handjob','boob','tits','nude']) t where position(t in c.v) > 0)) $$;

-- Is a username free? (anyone signed in; rate limited; returns only true/false)
create or replace function public.username_available(p_username text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare raw text := btrim(coalesce(p_username, '')); n text := lower(raw);
begin
  if raw !~ '^[A-Za-z0-9_.]{3,20}$' or raw ~ '(^[.])|([.]$)|([.][.])' or forged_private.reserved_username(n) or forged_private.offensive_username(n) then return false; end if;
  return not exists (select 1 from public.profiles p where lower(p.username) = n and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
end $$;

-- Claim / change my username. Unique index is the real guard against races.
create or replace function public.claim_username(p_username text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user(); n text := regexp_replace(btrim(coalesce(p_username, '')), '^@', '');
begin
  perform forged_private.hit('username', 20, 3600);
  if n ~ '\s' then raise exception 'Usernames can''t have spaces' using errcode = '22023'; end if;
  if n !~ '^[A-Za-z0-9_.]*$' then raise exception 'Only letters, numbers, _ and . are allowed' using errcode = '22023'; end if;
  if char_length(n) < 3 or char_length(n) > 20 then raise exception 'Usernames are 3-20 characters' using errcode = '22023'; end if;
  if n ~ '(^[.])|([.]$)|([.][.])' then raise exception 'Can''t start or end with a period, or use two in a row' using errcode = '22023'; end if;
  if forged_private.reserved_username(n) then raise exception 'That username is reserved' using errcode = '22023'; end if;
  if forged_private.offensive_username(n) then raise exception 'That username isn''t allowed' using errcode = '22023'; end if;
  perform forged_private.ensure_profile(u);
  begin
    update public.profiles set username = n, updated_at = now() where id = u;
  exception when unique_violation then raise exception 'That username is taken' using errcode = '23505'; end;
  return n;
end $$;

-- Public card for a username (for the add prompt / search). No email, no ids.
create or replace function public.find_username(p_username text)
returns table (username text, display_name text, avatar_initial text, avatar_color text, belt text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform forged_private.hit('find', 120, 3600);
  return query select p.username, p.display_name, p.avatar_initial, p.avatar_color, p.belt
    from public.profiles p where lower(p.username) = forged_private.norm_username(p_username);
end $$;

-- Add a friend by username (both directions, like accept_invite).
create or replace function public.add_friend_by_username(p_username text)
returns table (friend_id uuid, display_name text, avatar_initial text, avatar_color text, rank_idx smallint, already boolean)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare u uuid := forged_private.require_user(); t uuid; was boolean;
begin
  perform forged_private.hit('accept', 30, 3600);
  perform forged_private.ensure_profile(u);
  select p.id into t from public.profiles p where lower(p.username) = forged_private.norm_username(p_username);
  if t is null then raise exception 'No one has that username' using errcode = 'P0002'; end if;
  if t = u then raise exception 'That is your own username' using errcode = '22023'; end if;
  was := exists (select 1 from public.friendships f where f.user_id = u and f.friend_id = t);
  if not was then
    if (select count(*) from public.friendships f where f.user_id = u) >= 200 then raise exception 'Friend limit reached (200)' using errcode = '54000'; end if;
    insert into public.friendships (user_id, friend_id, via_code) values (u, t, null), (t, u, null) on conflict do nothing;
  end if;
  return query select p.id, p.display_name, p.avatar_initial, p.avatar_color, p.rank_idx, was from public.profiles p where p.id = t;
end $$;

-- Proposed public profile view: only the safe columns. Clients should read this, not profiles.
create or replace view public.public_profiles with (security_invoker = true) as
  select p.id, p.username, p.display_name, p.avatar_initial, p.belt from public.profiles p;
revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

revoke all on function public.my_username(), public.username_available(text), public.claim_username(text), public.find_username(text),
  public.add_friend_by_username(text) from public, anon;
grant execute on function public.username_available(text), public.claim_username(text), public.find_username(text),
  public.add_friend_by_username(text), public.my_username() to authenticated;
grant execute on function public.username_available(text) to anon;   -- onboarding checks before sign-in
