# Forged social plan: friends, head-to-head challenges, leaderboards

Status: **design only.** No backend account has been created; Steve approves before anything is set up.
3.2.0 ships everything on the phone (XP, ranks, badges, challenges) plus a no-server "Challenge a friend" link.

## 1. Recommendation (short version)

**Use Supabase** (Postgres + Auth + Row Level Security + Edge Functions) on the free tier to start, then the Pro plan ($25/mo) once there is real traffic.

Why Supabase over Firebase for Forged:
- The data is relational (users ↔ friends ↔ challenges ↔ results ↔ leaderboards). Postgres handles joins, unique constraints and ranking queries (`rank() over`) in one place. In Firestore the same thing needs denormalised copies and fan-out writes.
- Costs are predictable: free tier, then a flat $25/mo with generous included usage. Firestore bills per document read/write, so leaderboards and friend feeds can get expensive with no warning.
- Row Level Security keeps the rules in SQL next to the data, and the schema can be versioned in git.
- It is open source and self-hostable, so we are not locked in.

Firebase is the better pick only if we want offline-first realtime sync and FCM push out of the box with no SQL. Forged is already offline-first (localStorage), so we don't need Firestore's offline cache.

## 2. Free tiers compared (check current pricing before signing up)

| | Supabase Free | Supabase Pro | Firebase Spark (free) | Firebase Blaze (pay as you go) |
|---|---|---|---|---|
| Database | 500 MB Postgres | 8 GB included, then about $0.125/GB | Firestore 1 GiB, 50k reads / 20k writes / 20k deletes per day | about $0.06 per 100k reads, $0.18 per 100k writes |
| Auth | 50k MAU | 100k MAU included | Unlimited for email/social (phone SMS is paid) | Same; Identity Platform features cost extra |
| Functions | Edge Functions, 500k calls/mo | 2M calls/mo | Cloud Functions need Blaze | about 2M calls/mo free, then about $0.40/M |
| Storage | 1 GB | 100 GB | 5 GB | about $0.026/GB |
| Gotchas | Free projects **pause after 1 week idle**; 2 free projects | $25/mo per org + usage | Per-read billing; no functions on Spark | Bills can spike; set budget alerts |

## 3. Auth

- **Sign in with Apple is required** by App Store Review Guideline 4.8 if we ship any other third-party/social login (Google etc.) in the iOS app. Plan: Sign in with Apple + email magic link from day one, Google optional.
- Supabase Auth supports Apple, Google and email OTP/magic link natively. Firebase Auth does too.
- **Account deletion in the app** is required by Apple (5.1.1(v)). Build a "Delete account" button that calls an Edge Function to delete the user and their rows.
- Local data stays the source of truth. Signing in is optional and only needed for friends and leaderboards.

## 4. Data model (Postgres)

```
users(id uuid pk = auth.uid, handle citext unique, display_name, avatar_url, rank_idx int, level int, xp int,
      xp_verified int, created_at, deleted_at)
friendships(user_id, friend_id, status enum('pending','accepted','blocked'), created_at, pk(user_id, friend_id))
invites(code text pk, inviter_id, expires_at, max_uses int, uses int)
workouts(id uuid pk, user_id, date, category, duration_min, rpe, rounds, client_created_at, server_received_at,
         payload jsonb)                       -- minimal summary; no notes or photos by default
challenges(id uuid pk, kind enum('h2h','group'), template_id text, goal numeric, starts_on, ends_on,
           created_by, created_at)
challenge_members(challenge_id, user_id, joined_at, progress numeric, completed_at, pk(challenge_id, user_id))
xp_events(id bigserial, user_id, source enum('log','challenge','streak','pr','goal','ring'), amount int,
          ref text, occurred_on date, created_at, unique(user_id, source, ref))   -- idempotent
leaderboard_weekly (materialized view): user_id, week, xp, rank() over (partition by week order by xp desc)
reports(id, reporter_id, target_type, target_id, reason, created_at)          -- needed once there is UGC
```

RLS: users read their own rows and their accepted friends' public profile/XP; only members can read a challenge's members; all writes go through RPC/Edge Functions.

## 5. Invite links

- `https://forgedfightapp.github.io/#/invite/<code>`: the code is a random 10-character token in `invites` with an expiry and a use limit.
- Opening it signed out shows "Sign in to add Steve". After sign-in, an Edge Function accepts the invite and creates both friendship rows.
- iOS app later: Universal Links on the same path.
- 3.2.0 already ships the no-server version: `#/join/<base64url JSON {v, id, d, f, s}>` carries a challenge template, length and sender name. The friend tracks it on their own phone (self-reported, nothing compared live).

## 6. Server-side XP validation

The client already computes XP deterministically from history (`gameState()` in app.js). The server re-runs the **same rules** on the workout summaries it receives:
- XP for logging is capped at 30/day. Workouts with `server_received_at - date > 7 days` earn no challenge XP (this mirrors the client's `gFair`).
- Plausibility checks: duration ≤ 6 h, ≤ 4 sessions/day, rounds ≤ 40, PR jumps over 25% get flagged rather than counted.
- `xp_events` has a unique `(user, source, ref)` so replays can't double count.
- Leaderboards and head-to-head results use `xp_verified` (server XP) only. The local rank on the phone stays the client number.
- Rate limit write RPCs per user (Edge Function + a Postgres counter).

## 7. Client sync seam (already in 3.2.0)

`window.ForgedSync = { enabled:false, adapter:null, emit(type, payload) }`. The game code emits `challenge.done`, `badge.earned`, `rank.up`, `pro.granted` and `friend.join`. A future `sync-supabase.js` sets `adapter = { push(event), pull() }`, queues events in IndexedDB while offline, and flushes them on reconnect. No other app code needs to change.

## 8. Cost estimate (rough, assumes about 4 workouts/user/week, minimal payloads)

| Users (MAU) | Supabase | Firebase (Blaze) |
|---|---|---|
| 1k | Free tier fits (about 50 MB DB, well under limits). Idle pausing makes Pro ($25/mo) worth it once launched. | About $0–5/mo (leaderboard reads add up) |
| 10k | Pro $25/mo; DB about 0.5–1 GB, still within included usage, so about **$25–35/mo** | About $30–120/mo depending on how often leaderboards and friend lists are read |

## 9. App Store / UGC rules for the later Pro feed

Posts and pictures make it user-generated content (Guideline 1.2). Before shipping a feed we need:
- A way to **report** posts/users, **block** users, and filter objectionable content.
- Published contact info, plus **acting on reports within 24 hours**.
- Terms of use that users agree to (EULA) and a privacy policy covering photos.
- Age rating to match (UGC usually means 12+ or higher), and no unmoderated DMs at first.
- Image moderation (e.g. a moderation API in an Edge Function) and storage RLS.
- If Pro is sold in the iOS app it must use In-App Purchase for digital features (3.1.1). Real-world rewards and partnerships are out of scope for now.

## 10. Phases

1. (done, 3.2.0) Local XP/ranks/badges/challenges + share cards + friend challenge links.
2. Accounts (Apple + email), profile handle, account deletion, server XP replay.
3. Friends + invites + head-to-head challenges (live progress) + weekly friends leaderboard.
4. (Pro) Feed with posts/photos, after the moderation items in section 9 are in place.
