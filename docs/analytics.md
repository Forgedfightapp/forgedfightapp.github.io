# Analytics and error reporting: proposal (not enabled)

Status: proposal for Steve, Oct 20, 2026. **Nothing is enabled.** Forged currently sends no analytics. The privacy policy says so and promises an update before anything is added.

## What we'd want to know
- **Usage:** daily/weekly active devices (roughly), which screens get used (Home, Log, Food, Challenges, Stats), and how many people finish onboarding, enable Friends or open the Pro screen.
- **Errors:** uncaught JS errors and failed promises, with app version and screen, so a broken release is noticed quickly.

## Rules
- No cookies, no device fingerprinting, no cross-site tracking, no ad SDKs.
- Never send log contents: no notes, weight, food, injuries or names.
- Coarse and anonymous. Opt-out toggle in Profile → Your data.
- It must keep the App Store "Data Not Collected" label honest, or we update the label (Diagnostics, not linked to user).

## Options (all free at our size)

### A. Self-hosted counter in our Supabase (recommended)
- One table and one RPC, using the Supabase project we already have:
  ```sql
  create table public.app_events (
    day date not null default current_date,
    version text not null,
    kind text not null check (kind in ('open','screen','error','onboarded','pro_view')),
    name text not null default '',            -- screen name or error message (first 120 chars, no user data)
    n int not null default 1,
    primary key (day, version, kind, name)
  );
  alter table public.app_events enable row level security;  -- no select policy: write-only via RPC
  create function public.track(p_version text, p_kind text, p_name text) returns void
    language sql security definer set search_path = public as $$
    insert into app_events(version, kind, name) values (left(p_version,12), p_kind, left(p_name,120))
    on conflict (day, version, kind, name) do update set n = app_events.n + 1 $$;
  grant execute on function public.track to anon, authenticated;
  ```
- Client: a 30-line `track(kind, name)` in app.js that batches events in localStorage and sends them at most once per hour with the publishable key. It's skipped when the user opts out.
- Errors: `window.addEventListener('error' / 'unhandledrejection')` → `track('error', message)`, deduplicated per day.
- **Pros:** free (fits the Supabase free tier), counts only with no per-user rows, data stays with us, no new vendor in the privacy policy.
- **Cons:** we build the dashboards ourselves, as saved SQL queries in Supabase. We'd add rate limiting like the existing `rate_limits` table. "Daily devices" is a rough number: one `open` event per device per day.

### B. GoatCounter (goatcounter.com)
- Free for non-commercial and small use (donation-ware), open source, no cookies, GDPR-friendly. It can also be self-hosted.
- One `<script data-goatcounter=… src=//gc.zgo.at/count.js>`. That's a CDN, which breaks our "no CDNs" rule, so we'd vendor `count.js` and use its `count()` API for hash routes.
- **Pros:** dashboards out of the box, about 5 minutes to set up.
- **Cons:** page views only, no error reporting. Commercial use after Pro launches should be a paid plan or a donation. It's another processor to list.

### C. Errors only: Sentry free tier (Developer plan: 5k errors/month)
- Strong error grouping with source context.
- The SDK is heavy (around 30 KB+), sends device/browser metadata, and is a US processor. If used, turn off `sendDefaultPii` and session replay.
- Overkill for us right now. Option A's error counter covers us until we have real users.

## Recommendation
1. Option A for both usage and errors, added after launch with an opt-out toggle and a privacy policy update (section 6).
2. If we want nicer charts without building them, add GoatCounter for page views on the public website only (landing page, policies), not inside the app.
3. Review this at 1,000 weekly users.
