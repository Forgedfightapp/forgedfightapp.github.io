# Forged 3.4.0: turning on Friends (Supabase)

Friends, head-to-head challenges and the weekly friends leaderboard ship **switched off** (`social:false` in `config.js`).
The live app is unaffected until the schema below is applied and the flag is flipped.

Project: `https://ftnhmeqpzqpfdwhjfvnk.supabase.co` (ref `ftnhmeqpzqpfdwhjfvnk`, free plan, East US).
The client uses only the publishable key (`sb_publishable_…`), which is safe in the browser because every table has Row Level Security.
Never put a secret / service_role key in this repo.

## 1. Apply the schema (SQL Editor)

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste the whole of `supabase/migrations/001_social.sql` → **Run**. It's one transaction and idempotent (safe to run again).
3. New query → paste `supabase/verify.sql` → **Run**. The first row `== ALL CHECKS ==` must say `ok = true` (`0 failing of 74`).

What it creates: tables `profiles`, `invites`, `friendships`, `challenges`, `challenge_participants`, `progress_entries`
(+ `forged_private.rate_limits`), view `friends_leaderboard`, and RPCs `upsert_profile`, `create_invite`, `get_invite`,
`accept_invite`, `remove_friend`, `create_challenge`, `respond_challenge`, `leave_challenge`, `my_challenges`,
`get_challenge_board`, `submit_progress`, `delete_account`. No extensions, cron, Realtime or Edge Functions (free tier).

## 2. Auth settings (Dashboard)

**Authentication → URL Configuration**
- **Site URL:** `https://forgedfightapp.github.io/`
- **Redirect URLs:** add `https://forgedfightapp.github.io/` and `https://forgedfightapp.github.io/**`
  (add `http://localhost:8787/**` only if you want to test sign-in links locally).

**Authentication → Sign In / Providers → Email**
- Email provider **enabled**; "Confirm email" can stay on (the code / link confirms it).
- **Email OTP length:** 6 (the app accepts 6–10 digits). **Email OTP expiration:** 3600 s or less (e.g. 900).
- Leave "Secure email change" on.

**Authentication → Emails → Templates → Magic Link** (and **Confirm signup**): include the code, because an installed
iPhone app (home-screen PWA) can't receive a link that opens in Safari. Suggested body:

```html
<h2>Your Forged sign-in code</h2>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Enter it in the app. Or tap this link on the same phone: <a href="{{ .ConfirmationURL }}">Sign in</a></p>
<p>If you didn't ask for this, ignore this email.</p>
```

**Authentication → Rate Limits** (defaults are fine to start; recommended):
- Emails sent: the built-in email service is limited to a few per hour per project. **Before launch set up custom SMTP**
  (Authentication → Emails → SMTP Settings, e.g. Resend/Postmark/SES), then raise "emails per hour" to ~30–100.
- OTP / magic link per user: 60 s between requests (the app also enforces 60 s).
- Token verifications: keep the default (~30 per 5 min per IP).
- Consider enabling **CAPTCHA** (Attack Protection) once traffic grows; the app would need a small change to pass the token.

**Sign in with Apple** (later, with the App Store build): Authentication → Providers → Apple, then set `apple:true` in `config.js`.
The button and `ForgedCloud.signInWithApple()` are already wired.

**Free-tier note:** free projects pause after 7 days without activity. Open the dashboard (or upgrade to Pro) before testing.

## 3. Flip the flag

Preview first, on your own phone only (nothing changes for anyone else): open
`https://forgedfightapp.github.io/?social=1` once (`?social=0` turns the preview off again).

Turn it on for everyone:
1. `config.js`: `social: true`.
2. Bump `APP_VERSION` in `app.js` and `CACHE` in `sw.js` (e.g. 3.4.1) so phones pick up the change.
3. Commit + push. Then run `docs/social-test-checklist.md` on a real iPhone.

To switch it off again, set `social:false` and bump the version. Nothing local is lost either way.

## 4. Data, privacy, deletion

- Shared: display name, initial + colour, rank, level, XP, belt, and per-day counts (sessions, push-ups, mat minutes,
  daily challenges done, logging XP ≤ 30). Never notes, body weight, food, injuries or workout details.
- The server keeps 90 days of per-day counts per user and prunes older rows on each sync.
- Profile → Friends → **Delete account** calls `delete_account()`, which deletes the auth user; every row cascades.
- Leaderboards use server-validated per-day XP (≤ 30 a day, ≤ 10 per session, days ≤ 7 old). Profile XP/rank is self-reported.

## 5. Local SQL tests (optional)

`supabase/tests/run-local.sh` runs the migration twice, 33 behaviour tests (RLS, RPC validation, deletion, rate limits)
and verify.sql against a throwaway local Postgres database, using `supabase_stub.sql` to fake the Supabase auth schema.
