# Manual test checklist: Friends / head-to-head (3.4.0)

Use two phones (or one phone + a desktop browser in a private window), two email addresses you can read, and the
preview switch `https://forgedfightapp.github.io/?social=1` until the flag is on for everyone.

## Before
- [ ] `001_social.sql` applied; `verify.sql` shows `== ALL CHECKS == | true`.
- [ ] Auth → URL configuration has the Site URL + redirect URLs; the email template shows `{{ .Token }}`.

## Flag off (live default)
- [ ] Without `?social=1`: no Friends button on Challenges, no Friends card in Profile, `#/friends` opens Home.
- [ ] Airplane mode: app opens and works as before.

## Sign-in (phone A, installed to home screen)
- [ ] Profile → Friends → "Sign in with email" → enter email → "Email me a code".
- [ ] Email arrives with a 6-digit code (check spam). Code autofills from Mail on iOS or type it → signed in.
- [ ] Wrong code → "That code is wrong or expired". Second request inside 60 s → "Wait a minute".
- [ ] In Safari (not installed): tapping the email link signs in and lands on the app (URL `?code=` disappears).
- [ ] Kill and reopen the app: still signed in.

## Friends (phone B signs in with the second email)
- [ ] A: Friends shows an 8-character code; "Share link" opens the share sheet.
- [ ] B: open A's link → "A invited you" → Add → both see each other in "This week" with rank and sessions.
- [ ] B: entering A's code by hand works; own code → "That is your own invite code"; nonsense → "Invite code not found".
- [ ] Edit (name + colour) on A → B sees the new name after Sync now / reopening.
- [ ] ⋯ → Remove friend: gone on both phones.

## Head-to-head
- [ ] A: Challenge a friend → B, Push-ups, 1 week → standings page.
- [ ] B: sees Accept / Decline on Friends → Accept.
- [ ] B logs 20 push-ups (Challenges → Log reps) → within ~20 s A's standings update (screen open).
- [ ] Sessions metric: log a workout on B → A sees +1. Mat hours: grappling 60 min → +1.0.
- [ ] Daily challenge streak: tap Done on a daily on two consecutive days → 2.
- [ ] Group: pick 2+ friends → "Group challenge" with all names.
- [ ] Leave challenge → it disappears for you; the other side no longer sees you.

## Offline
- [ ] Airplane mode on A: Friends shows the last synced data + "You're offline".
- [ ] Log a workout offline → Account shows "N updates waiting to sync" → airplane off → syncs (B sees it).

## Old challenge links (#/join)
- [ ] Signed in, Challenges → "Challenge a friend" link → on B (signed in) the join page shows "Add A as a friend".
- [ ] Signed out B: "Sign in to add A" → after sign-in A is added automatically.
- [ ] A 3.3.0-style link (no account) still works the old way (self-tracked).

## Privacy + deletion
- [ ] Dashboard → Table editor → `progress_entries`: only counts; no notes, weights or food anywhere.
- [ ] Profile → Friends → Delete account → confirm: signed out; dashboard shows the user and their rows gone; workouts on the phone remain.
- [ ] Signing in again with the same email starts a fresh account with no friends.

## Abuse checks (optional, browser console on a signed-in page)
- [ ] `ForgedCloud.submit([{metric:'xp',day:'<today>',value:500}])` → rejected (`value`).
- [ ] A day 10 days ago → rejected (`too_old`). 130 calls in an hour → "Too many requests".
