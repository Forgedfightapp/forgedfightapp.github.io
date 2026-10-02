# Discipline > Motivation — Training Log (PWA)

Offline-first, iPhone-first training tracker. Vanilla JS, no build step, no CDNs. All data stays in
`localStorage` (key `dm.bjj.v1`, schema 4; older data auto-migrates and backups are kept at `dm.bjj.v1.backup.v1` / `.backup.v2` / `.backup.v3`; an unreadable store is copied to `dm.bjj.v1.unreadable` before starting fresh).

## Design priority: simple first
- **Quick log**: Home → `+` → Save = 3 taps (category + last-used duration + today pre-filled). Everything else lives under **Add details**.
- **Log again**: one tap on Home repeats a recent workout per category (with Undo).
- **Food quick add** (1 tap from recent/saved foods) and **Mark all taken** per supplement time block.
- Home shows essentials only; deeper charts are under **See all stats** (`#/stats`).
- First-run screen picks what you train; Profile → *What I track* hides unused sections. Bottom nav: Home · History · + · Food/Supplements/Nutrition · Profile.

## Navigation
Every non-tab screen has a big Back/Cancel button top-left (below the iOS safe area); every sheet has Close/Cancel, closes on swipe-down,
backdrop tap, Esc, and the iOS/browser back gesture (sheets push a history entry; popstate closes them). Bottom-nav taps always close what is
open and go to that screen; sheets stop above the nav so it is never covered. Leaving a filled-in workout asks "Discard this workout?".

## Weight goal
Start weight (defaults to first weigh-in), goal weight, optional goal date, lb/kg. Home → Log weight (prefilled with last value) → Save = 2 taps.
Weigh-ins and workout body weight merge into one history (latest entry per day). Home card: current, goal, lost/gained so far, left to go,
progress %, sparkline (lose or gain inferred from start vs goal). Stats: chart with goal line, weekly average rate (least squares, last 28 days),
projected goal date.

## Belt history (2.2.0)
History → Belts: vertical timeline, newest first, one group per belt with date range, total time (calendar y/m/d, e.g. "2 yr 3 mo"; current belt
"so far"), each stripe with time since the previous promotion, and sessions/mat hours logged in that period. "Log promotion" (Home belt card,
Profile, timeline) pre-selects the next likely rank: Log promotion → Save = 2 taps. Kids belts and black-belt degrees (0–6) supported; backfill in
any order (sorted by date); edit/delete with undo. The current rank is derived from the latest-dated entry.

## Nutrition goals & water (2.2.0)
Calorie/protein/carb/fat and water goals are set only in Profile ("Daily calorie goal", "Daily protein goal (g)" …). Without goals, Home and Food show
a "Set your goals" link instead of progress. Water card on Food: +8 oz glass, +16.9 oz bottle, + custom (250/500 ml when units are kg), undo, total
and progress vs optional goal; a water line on the Home nutrition card. First-run asks only what you train (+ optional weight goal); the bottom nav
is hidden there, and every screen pads for nav + home-indicator inset.

## Features
Grappling (BJJ/Wrestling/Judo, rolls, subs, belt), Striking (round mix, sparring), Weights (sets × reps × weight, RPE, PRs/e1RM, volume),
Cardio (distance/time, pace/speed), heart rate + zones on all, GPX/TCX/FIT/CSV import, nutrition, supplements, JSON export/import, sample data.

## Run
    python3 -m http.server 8787 --directory .      # then open http://localhost:8787
    ./restart-preview.sh                            # server + Cloudflare quick tunnel (prints public URL)

## Tests (Playwright, iPhone 13 emulation)
`tests/core.test.mjs`, `tests/nutrition.test.mjs`, `tests/supplements.test.mjs`, `tests/nav-weight.test.mjs`, `tests/belts.test.mjs`, `tests/water.test.mjs`, `tests/layout.test.mjs`, `tests/multi.test.mjs` (run with `node`, needs
`playwright` installed and the server on :8787; `BASE`/`SHOTS` env vars override URL/screenshot dir). `multi.test.mjs` asserts the
quick log takes ≤3 taps from Home and writes the final screenshots, so run it last. Import fixtures: `tests/fixtures/` (regenerate with `python3 tests/make_fixtures.py`).

## Brand (v2.1.1)
Approved 2026-10 logo: DISCIPLINE (white, Oswald Bold) › red chevron #DC141F › MOTIVATION (gray, Barlow) on #111.
Final assets in `brand/` (copied from /workspace/dm-logo/final). Header uses `brand/wordmark-header.svg` (the transparent-light wordmark
with padding trimmed). Icons are rendered from `brand/app_icon.svg`; the maskable icon (`brand/app_icon_maskable.svg`) shrinks the chevron to 86%
so it sits inside the 40% safe-zone circle. Re-render: `node brand/render_svg.mjs brand/icon-jobs.json`; preview: `node brand/make_icon_preview.mjs`.
Colors: `--brand #DC141F` (fills, white text on it 5.0:1), `--accent #F04A52` for small red text (5.2:1 on #111, ≥4.5:1 on all surfaces).
Fonts Oswald/Barlow are bundled in `brand/fonts/` (SIL OFL) and used only for headings. Old boxed D > M marks live in `brand/legacy/` (unused).
