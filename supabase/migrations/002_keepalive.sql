-- 3.8.0 keep-alive: a tiny read-only function the GitHub Actions cron calls with the publishable key,
-- so the free project sees real database activity every few days. It returns the server time and reads no user data.
create or replace function public.keepalive() returns timestamptz
  language sql stable security invoker set search_path = public as $$ select now() $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
