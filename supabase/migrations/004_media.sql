-- 3.12.0 friends media: share a photo or short clip with friends.
-- Private bucket 'media' (25 MB per file, images + videos only). Files live at <owner uid>/<random>.<ext>.
-- Only the owner and their friends can read (signed URLs); only the owner can upload or delete.
-- Posts older than 30 days are hidden by list_media(); the owner's app deletes its own expired files + rows
-- when Friends opens (storage files can't be removed safely from SQL). Safe to re-run.

-- 1. bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 26214400,
        array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2. table
create table if not exists public.media_posts (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null,
  path        text not null unique,
  caption     text not null default '',
  created_at  timestamptz not null default now(),
  constraint media_kind check (kind in ('photo','video')),
  constraint media_caption_len check (char_length(caption) <= 200),
  constraint media_path_owner check (split_part(path, '/', 1) = owner::text)
);
create index if not exists media_posts_owner_idx on public.media_posts (owner, created_at desc);
alter table public.media_posts enable row level security;

drop policy if exists media_read on public.media_posts;
create policy media_read on public.media_posts for select to authenticated
  using (owner = auth.uid() or forged_private.is_friend(owner));
drop policy if exists media_insert on public.media_posts;
create policy media_insert on public.media_posts for insert to authenticated
  with check (owner = auth.uid());
drop policy if exists media_delete on public.media_posts;
create policy media_delete on public.media_posts for delete to authenticated
  using (owner = auth.uid());
grant select, insert, delete on public.media_posts to authenticated;

-- 3. storage policies (folder 1 = owner uid)
drop policy if exists media_obj_read on storage.objects;
create policy media_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text
         or forged_private.is_friend(((storage.foldername(name))[1])::uuid)));
drop policy if exists media_obj_insert on storage.objects;
create policy media_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists media_obj_delete on storage.objects;
create policy media_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4. feed: my posts + friends' posts from the last 30 days, with name and avatar
create or replace function public.list_media(p_limit int default 30)
returns table (id uuid, owner uuid, kind text, path text, caption text, created_at timestamptz,
               display_name text, avatar_initial text, avatar_color text, is_me boolean)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.owner, m.kind, m.path, m.caption, m.created_at,
         coalesce(p.display_name, 'Fighter'), coalesce(p.avatar_initial, 'F'), coalesce(p.avatar_color, 'flame'),
         m.owner = auth.uid()
    from public.media_posts m left join public.profiles p on p.id = m.owner
   where m.created_at > now() - interval '30 days'
   order by m.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;
-- my posts that are past 30 days (the app deletes their files, then the rows)
create or replace function public.my_expired_media()
returns table (id uuid, path text)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.path from public.media_posts m
   where m.owner = auth.uid() and m.created_at <= now() - interval '30 days' limit 50;
$$;
revoke all on function public.list_media(int) from public;
revoke all on function public.my_expired_media() from public;
grant execute on function public.list_media(int) to authenticated;
grant execute on function public.my_expired_media() to authenticated;
-- Expiry: rows are kept until the owner's app deletes the file + row (my_expired_media), so no file is orphaned.
-- Files of users who never open the app again can be swept by hand in Storage > media.
