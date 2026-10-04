# Forged — For the fight (PWA)

Offline-first, iPhone-first training tracker. Vanilla JS, no build step, no CDNs. All data stays in
`localStorage` (key `dm.bjj.v1`, schema 7; older data auto-migrates and backups are kept at `dm.bjj.v1.backup.v1` / `.backup.v2` / `.backup.v3` / `.backup.v4` / `.backup.v5` / `.backup.v6`; the storage key is unchanged from the Discipline > Motivation releases, and old D>M backup files import fine; an unreadable store is copied to `dm.bjj.v1.unreadable` before starting fresh).

## Design priority: simple first
- **Quick log**: Home → `+` → Save = 3 taps (category + last-used duration + today pre-filled). The Save button stays pinned above the nav. All other fields are always visible under a **Details (optional)** heading, with Notes right after the main type/technique fields, then the rest, ending with Effort (RPE) → Body weight → Import from device (GPX/TCX/FIT/CSV) → Heart rate.
- **Log again**: one tap on Home repeats a recent workout per category (with Undo).
- **Food quick add** (1 tap from recent/saved foods).
- Home shows essentials only; deeper charts are under **See all stats** (`#/stats`).
- First run is two steps: *What do you train?* (sports + Food + Weight goal), then *Set your goals* showing only the goals that apply (all optional, Skip for now). Profile → *What I track* hides unused sections. Bottom nav: Home · History · + · Food (Stats when Food is off) · Profile.

## Navigation
Every non-tab screen has a big Back/Cancel button top-left (below the iOS safe area); every sheet has Close/Cancel, closes on swipe-down,
backdrop tap, Esc, and the iOS/browser back gesture (sheets push a history entry; popstate closes them). Bottom-nav taps always close what is
open and go to that screen; sheets stop above the nav so it is never covered. Leaving a filled-in workout asks "Discard this workout?".

## Weight goal
Start weight (defaults to first weigh-in), goal weight, optional goal date, lb/kg. Home → Log weight (prefilled with last value) → Save = 2 taps.
Weigh-ins and workout body weight merge into one history (latest entry per day). Home card: current, goal, lost/gained so far, left to go,
progress %, sparkline (lose or gain inferred from start vs goal). Stats: chart with goal line, weekly average rate (least squares, last 28 days),
projected goal date.

## 3.2.0: challenges, ranks, badges, looks, share cards, belt + stripe dates
- **Challenges** (Home shows only the rank chip + one challenge; See all → `#/challenges`): 3 daily, 3 weekly, 3 monthly (one easy/medium/hard each), picked deterministically from the date + your enabled sports. Progress comes from logged workouts; entries backfilled more than 7 days later do not count toward challenges.
- **XP, levels, ranks** (`#/rank`): 10 XP per workout (max 30/day), +20 per week continuing a streak, +25 per PR (est. 1RM beats your previous best), +50 per strength goal hit, +100 per monthly goal hit, plus challenge XP (daily 30/50/75, weekly 100/150/200, monthly 300/400/500). Level curve: level L needs 100·L·(L−1) XP. Ranks: Apprentice 1, Striker 5, Journeyman 10, Smith 15, Blacksmith 20, Master Smith 25, Forgemaster 30, Forged 35. XP is recomputed from your history, so existing users start at the rank they have already earned (recorded silently, no fake rank-up).
- **Pro week**: reaching Master Smith grants 7 days of Pro once (`game.proUntil`). Everything is still free in this build.
- **Badges** (`#/badges`): 20, locked ones show how to earn them. **Looks** (Profile → Rank, badges & looks): accent colours, share-card frames and rank flair, unlocked by rank and badges.
- **Share cards**: canvas PNG, square 1080×1080 or story 1080×1920, with a Show numbers toggle. Uses Web Share with files when available, otherwise downloads the image. Available for sessions, goal hits, rank-ups, challenges, streaks and monthly rings.
- **Friend challenge links** (no server): `#/join/<code>` carries the challenge in the URL; progress is tracked locally from each person's own workouts. `window.ForgedSync` is the seam for future sync (see `docs/social-plan.md`).
- **BJJ belt + stripe events**: belt promotions and stripe promotions are separate dated entries ("Belt earned" / "Stripe earned", default today, backdatable). The Belt card and History → Belts show current belt + stripes, time at belt, time since last stripe and a timeline. A new belt resets stripes to 0; "+ Add missing stripe N date" fills gaps; tap any entry to edit or delete. Older entries are migrated: a stripe-count change under the same belt becomes a stripe event; a belt entry that started with stripes gets stripe events marked "date not recorded".
- Monthly workout goal helper text now reads "Total workouts per month, any type (BJJ, weights, cardio, etc.). Fills the ring on Home."
- No real-world rewards and no social feed. `docs/social-plan.md` covers the future accounts/backend plan (recommendation: Supabase).

## 3.1.0: training features, goals, onboarding
- **Onboarding (2 steps)**: Step 1 of 2 *What do you train?*; Step 2 of 2 *Set your goals* shows only what applies: daily calories/protein/carbs/fat/water (Food on; protein hint 0.8–1 g per lb), current/goal weight + date (Weight goal on), strength goals (Weights on), monthly workout target, usual training days per chosen sport, optional next competition. Every field optional; *Done*, *Skip for now*, Back to step 1. Goals stay editable in Profile.
- **Set goal links** (Food screen, water card, Home nutrition/weight/week cards) first ask *Leave this page? You'll go to Profile to set your goals.* (Cancel / Go to goals) and warn when unsaved input (half-filled food entry or workout) will be discarded. Profile then shows *← Back to <page>*.
- **Weekly schedule** per sport (Profile) + Home *This week* strip (planned vs done dots); warnings for back-to-back hard days (effort ≥8) and weekly load >30% above the 4-week average.
- **Effort & feel**: Effort (RPE 1–10) replaces Intensity (old 1–5 values are kept; RPE = intensity × 2), *How did it feel?* emoji picker after Notes. Load = minutes × RPE; Stats shows a 12-week load chart and acute:chronic ratio (Fresh / Building / High load).
- **Competitions**: countdown card with taper tips in the last 7 days; past comps get a result (win/loss/medal) + notes; History → Comps.
- **Benchmarks**: pull-ups, push-ups, dead hang, plank, est. 1RM squat/bench/deadlift (entered or Epley from logs), body weight; latest/best/sparkline, retest reminder every 6 weeks; rows show the related strength goal.
- **Strength goals**: PR targets for bench/squat/deadlift/overhead press or any exercise from your list, and rep goals (pull-ups, push-ups, dead hang seconds), each with an optional date. Progress uses est. 1RM (Epley, default) or heaviest set (Profile choice); Stats card with bars + %, compact Home line for the closest goal. A logged set or benchmark test that beats a target shows *Goal hit! New PR*, records the date and offers the next target (+5% lifts, +2 reps, +15 s hang).
- **Category colours on the log form**: picking Grappling/Striking/MMA/Weights/Cardio/Mobility re-themes the whole form (selected chips, session type, Effort, toggles, focus rings, pinned Save, the + button) via CSS variables on `body[data-theme]`; it switches instantly and resets when you leave. Fills use dark text (≥5:1 on every colour).
- **Injury log** (Home card while active, severity chart, reminder on the log form), **monthly challenge ring** (target in Profile, confetti), **programs** (templates in `programs.js`, swaps, progression, today's workout on Home; behind a single `isPro()` check, currently free).
- **Supplements removed**: existing real supplement data is kept untouched in `archive.supps` (stored, exported, re-imported; a note in Profile → Your data). **Drilling** is no longer a session type; stored `drill` sessions are kept and shown/edited as Class (MMA's Drilling rounds remain). **Pad work** replaces Open mat for Striking and MMA (Class, Pad work, Private, Competition, Seminar, Other); stored Striking/MMA `open` sessions migrate (and import) as `pads`. Grappling keeps Open mat.

## 3.0.0: FORGED + six sports
- **Rebrand: FORGED, "For the fight".** Anvil and orange/white flame mark, FORGED wordmark (Barlow Condensed ExtraBold, as outlines). Name/short_name
  "Forged" in the title, manifest, apple title, header and first-run. The old Discipline > Motivation / Training Log copy is gone.
- **Categories:** Grappling (Sport picker: BJJ default, Wrestling, Judo, Sambo, Submission grappling; Gi/No-Gi only for BJJ) · Striking (Boxing,
  Muay Thai, Kickboxing, Karate/Taekwondo, Other) · MMA (rounds, round length, pad work/drilling/sparring/grappling rounds, striking *and* grappling
  techniques, sparring partners) · Weights · Cardio (unchanged) · Mobility (Yoga, Stretching, Foam rolling, Mobility flow, Recovery/other; focus-area
  chips: hips, hamstrings, shoulders, back, neck, ankles, full body). Belt tracking stays BJJ-only.
- All six are in first-run "What you train", Profile → What I track, quick log / Log again, stats hours-by-category, history filters and sample data.
  Sports you do not pick stay hidden.
- Form order stays the same everywhere: type → techniques/focus → Notes → category fields → Intensity → Body weight → Import from device → Heart rate.
  Quick log is still 3 taps (Mobility: duration + date).
- **Striking comes back on its own.** Migrating to schema 6 (backup `.backup.v5`) moves every session from 2.3.0's `archive.striking` back into the
  normal list, unchanged. Old striking sessions with the "MMA" style become the MMA category. Striking/MMA/Mobility get switched on during that one
  migration only if you have sessions in them. Importing an old backup with an archive restores it the same way.

## 2.3.0: BJJ, Weights, Cardio (superseded by 3.0.0)
- Striking removed everywhere: first-run, "What I track", log form, quick log, dashboard/stats, history filters, sample data.
- **Existing striking data is never deleted or converted.** On migration to schema 5 (backup `.backup.v4`), striking sessions move
  unchanged from `sessions` into `archive.striking`. They stay in storage, Export backup and Import (old backups are archived the same way);
  they are hidden from the UI/stats, and Profile → Your data says how many are kept. Clear all data removes them. CSV rows that are striking are skipped.
  Converting them to another category would have changed what the data means and made stats wrong, so they are archived instead.
- The "Grappling" label is now "BJJ" (internal key stays `grappling`). New BJJ sessions have no Style picker (just Gi/No-Gi). Older
  Wrestling/Judo sessions keep their style and still show/edit it.

## 2.2.2
- Log form order: notes come right after the main type and technique/exercise fields. Grappling: Session type → Techniques drilled → Notes → Rounds → Rolls → Intensity → Body weight → Import from device → Heart rate. Weights: exercises → Notes → …. Cardio: distance/time → Notes → ….
- Suggestion chips wrap onto at most 2 rows; no chip is cut off at the edge.

## 2.2.1
- Paired fields everywhere (Profile goals, Goal weight/date, first-run, workout, food and supplement forms) line up: each row's labels take the same height and the inputs sit at the bottom, all 54 px tall. Checked at 390/375/320 px, also with larger label text.
- Shorter Profile goal labels under "Daily nutrition goals": Calories, Protein (g), Carbs (g), Fat (g), Water (oz|ml).
- SVG belt illustration (`beltSVG(belt, stripes, 'lg'|'sm')`). Home and Profile show a tied belt in the current colour, with white stripe tape on the black bar (red bar for black belt). With no promotions it shows a white belt and "Track your belt journey". The timeline uses the small flat version.
- Log form: Duration gets its own full-width row with Date below it, so 3 digits plus "min" always fit. Steppers in 2-column rows have narrower −/+ buttons. No "Add details" expander. Save is sticky (`html,body{overflow-x:clip}`; before, `hidden` stopped sticky from working). "Import from device".

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
Grappling (BJJ gi/no-gi + belt, Wrestling, Judo, Sambo, Submission grappling; rolls, subs), Striking and MMA (rounds by type, sparring notes), Mobility, Weights (sets × reps × weight, RPE, PRs/e1RM, volume),
Cardio (distance/time, pace/speed), heart rate + zones on all, GPX/TCX/FIT/CSV import, nutrition + water, schedule, effort/load, competitions, benchmarks, strength goals, injuries, monthly ring, programs, JSON export/import, sample data.

## Live app & deploy (GitHub Pages)
Live: **https://forgedfightapp.github.io/** (repo: https://github.com/Forgedfightapp/forgedfightapp.github.io, public, Pages from `main` / root, HTTPS enforced).
`.nojekyll` makes Pages serve files as they are. All paths are relative (manifest `start_url`/`scope` `./`, `sw.js` registered as `sw.js`), so the app runs at the site root.

To deploy from now on: commit in `/workspace/bjj-tracker`, then run `git push`. Pages rebuilds in about 1 minute.
On every release, bump `APP_VERSION` in `app.js` **and** the `CACHE` name in `sw.js` (e.g. `forged-shell-v3.0.1`) so installed apps pick up the update when reopened.

## Run locally (optional)
    python3 -m http.server 8787 --directory .      # then open http://localhost:8787
    ./restart-preview.sh                            # optional: server + Cloudflare quick tunnel (temporary preview URL, changes on restart)

## Tests (Playwright, iPhone 13 emulation)
`tests/core.test.mjs`, `tests/nutrition.test.mjs`, `tests/nav-weight.test.mjs`, `tests/belts.test.mjs`, `tests/water.test.mjs`, `tests/layout.test.mjs`, `tests/align.test.mjs`, `tests/belt-graphic.test.mjs`, `tests/log-form.test.mjs`, `tests/categories.test.mjs`, `tests/features.test.mjs`, `tests/strength-goals.test.mjs`, `tests/category-theme.test.mjs`, `tests/game.test.mjs`, `tests/multi.test.mjs`, `tests/deploy-check.mjs` (live-site SW/manifest check) (run with `node`, needs
`playwright` installed and the server on :8787; `BASE`/`SHOTS` env vars override URL/screenshot dir). `multi.test.mjs` asserts the
quick log takes ≤3 taps from Home and writes the final screenshots, so run it last. Import fixtures: `tests/fixtures/` (regenerate with `python3 tests/make_fixtures.py`).

## Brand (3.0.0: FORGED)
Assets live in `brand/forged/`: `forged-mark.svg` (icon mark), `wordmark.svg` (mark + FORGED + FOR THE FIGHT, text as outlines), `wordmark-text.svg`,
`wordmark-light-bg.svg`, `wordmark-header.svg` (used in the header), `app_icon.svg` / `app_icon_maskable.svg` (mark inside the safe circle),
`favicon.svg`, PNGs `icon-1024/512/192.png`, `icon-maskable-512/192.png`, `apple-touch-icon.png` (180), `favicon-32/16.png`, and `icon-preview.png`.
Copies used by the manifest are in `icons/`. To regenerate: `python3 brand/forged/make_forged.py` → `node brand/forged/tools/tightsvg.mjs <pad> <svgs>` →
`node brand/forged/tools/render.mjs brand/forged/icon-jobs.json` → `node brand/forged/tools/forgedprev.mjs` (Playwright needed).
Colors on the near-black base `--bg #0B0B0C` (surfaces #161618 / #1F1F22):
- `--brand` / `--accent-fill #F2711C` is the flame orange for fills, with dark text `--accent-ink #0B0B0C` on it (6.7:1). Primary buttons now use dark text on orange.
- `--accent #F58A45` is for small orange text: 8.1:1 on the background, 7.4:1 / 6.7:1 on surfaces.
- Tagline gray #9C9C9C is 7.2:1. `--danger` is now red #FF6B6B so it can't be mistaken for the accent.
Fonts: Barlow Condensed ExtraBold (`brand/forged/`, SIL OFL) for headings; Oswald/Barlow are still in `brand/fonts/`.
The old Discipline > Motivation assets (chevron, wordmarks, icons, scripts) moved to `brand/legacy/dm-2.x/` (unused).
