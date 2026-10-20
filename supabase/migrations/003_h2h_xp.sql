-- 3.10.0: allow "Workout XP" head-to-head challenges (progress_entries already stores the 'xp' metric).
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.
alter table public.challenges drop constraint if exists challenges_metric;
alter table public.challenges add constraint challenges_metric
  check (metric in ('sessions','pushups','mat_minutes','daily_streak','xp'));

create or replace function public.create_challenge(p_kind text, p_metric text, p_starts_on date, p_ends_on date,
  p_friends uuid[], p_title text default '')
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := forged_private.require_user(); cid uuid; f uuid; n int; t text;
begin
  perform forged_private.hit('challenge', 20, 86400);
  if p_kind not in ('h2h','group') then raise exception 'Invalid challenge type' using errcode = '22023'; end if;
  if p_metric not in ('sessions','pushups','mat_minutes','daily_streak','xp') then raise exception 'Invalid metric' using errcode = '22023'; end if;
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
