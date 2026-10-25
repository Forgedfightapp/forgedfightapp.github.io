-- 006: @username tags on clips/photos + "Allow tags" setting. NOT RUN. Needs 004 + 005. Safe to re-run.
alter table public.profiles add column if not exists allow_tags boolean not null default true;

create table if not exists public.media_tags (
  post_id    uuid not null references public.media_posts(id) on delete cascade,
  tagged     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tagged)
);
alter table public.media_tags enable row level security;
-- read: anyone who can already see the post (media_posts RLS: owner + friends). No direct writes; RPCs only.
drop policy if exists media_tags_read on public.media_tags;
create policy media_tags_read on public.media_tags for select to authenticated
  using (exists (select 1 from public.media_posts m where m.id = post_id));

-- friends who can be tagged (username + display name only, never email)
create or replace function public.taggable_friends()
returns table (username text, display_name text, avatar_initial text, avatar_color text)
language sql stable security definer set search_path = '' as $$
  select p.username, p.display_name, p.avatar_initial, p.avatar_color
    from public.profiles p
   where p.id <> auth.uid() and p.username is not null and p.allow_tags
     and forged_private.is_friend(p.id)
   order by lower(p.username);
$$;

create or replace function public.tag_media(p_post uuid, p_usernames text[])
returns void language plpgsql security definer set search_path = '' as $$
declare n text; t uuid; ok boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.media_posts where id = p_post and owner = auth.uid()) then raise exception 'Post not found'; end if;
  if coalesce(array_length(p_usernames, 1), 0) > 10 then raise exception 'Up to 10 tags'; end if;
  foreach n in array coalesce(p_usernames, '{}') loop
    select id, allow_tags into t, ok from public.profiles where lower(username) = lower(ltrim(n, '@'));
    if t is null or not forged_private.is_friend(t) then raise exception '@% isn''t your friend', n; end if;
    if not ok then raise exception '@% has tags turned off', n; end if;
    insert into public.media_tags (post_id, tagged) values (p_post, t) on conflict do nothing;
  end loop;
end $$;

-- turning tags off also deletes every existing tag of me
create or replace function public.set_allow_tags(p_allow boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.profiles set allow_tags = coalesce(p_allow, true) where id = auth.uid();
  if not coalesce(p_allow, true) then delete from public.media_tags where tagged = auth.uid(); end if;
end $$;

-- list_media gains tags (usernames only)
drop function if exists public.list_media(int);
create function public.list_media(p_limit int default 30)
returns table (id uuid, owner uuid, kind text, path text, caption text, created_at timestamptz,
               display_name text, avatar_initial text, avatar_color text, is_me boolean, tags text[])
language sql stable security invoker set search_path = '' as $$
  select m.id, m.owner, m.kind, m.path, m.caption, m.created_at,
         coalesce(p.display_name, 'Fighter'), coalesce(p.avatar_initial, 'F'), coalesce(p.avatar_color, 'flame'),
         m.owner = auth.uid(),
         coalesce((select array_agg(tp.username order by tp.username) from public.media_tags t
                     join public.profiles tp on tp.id = t.tagged
                    where t.post_id = m.id and tp.allow_tags and tp.username is not null), '{}')
    from public.media_posts m left join public.profiles p on p.id = m.owner
   where m.created_at > now() - interval '30 days'
   order by m.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all on function public.taggable_friends(), public.tag_media(uuid, text[]), public.set_allow_tags(boolean), public.list_media(int) from public, anon;
grant execute on function public.taggable_friends(), public.tag_media(uuid, text[]), public.set_allow_tags(boolean), public.list_media(int) to authenticated;
