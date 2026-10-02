# Discipline > Motivation — Training Log (PWA)

Offline-first, iPhone-first training tracker. Vanilla JS, no build step, no CDNs. All data stays in
`localStorage` (key `dm.bjj.v1`, schema 2; v1 data auto-migrates and a backup is kept at `dm.bjj.v1.backup.v1`).

## Design priority: simple first
- **Quick log**: Home → `+` → Save = 3 taps (category + last-used duration + today pre-filled). Everything else lives under **Add details**.
- **Log again**: one tap on Home repeats a recent workout per category (with Undo).
- **Food quick add** (1 tap from recent/saved foods) and **Mark all taken** per supplement time block.
- Home shows essentials only; deeper charts are under **See all stats** (`#/stats`).
- First-run screen picks what you train; Profile → *What I track* hides unused sections. Bottom nav: Home · History · + · Food/Supplements/Nutrition · Profile.

## Features
Grappling (BJJ/Wrestling/Judo, rolls, subs, belt), Striking (round mix, sparring), Weights (sets × reps × weight, RPE, PRs/e1RM, volume),
Cardio (distance/time, pace/speed), heart rate + zones on all, GPX/TCX/FIT/CSV import, nutrition, supplements, JSON export/import, sample data.

## Run
    python3 -m http.server 8787 --directory .      # then open http://localhost:8787
    ./restart-preview.sh                            # server + Cloudflare quick tunnel (prints public URL)

## Tests (Playwright, iPhone 13 emulation)
`tests/core.test.mjs`, `tests/nutrition.test.mjs`, `tests/supplements.test.mjs`, `tests/multi.test.mjs` (run with `node`, needs
`playwright` installed and the server on :8787; `BASE`/`SHOTS` env vars override URL/screenshot dir). `multi.test.mjs` asserts the
quick log takes ≤3 taps from Home and writes the final screenshots, so run it last. Import fixtures: `tests/fixtures/` (regenerate with `python3 tests/make_fixtures.py`).

## Brand
`brand/make_brand.py` generates the logo/banner/lockup SVGs (text converted to paths); icons rendered to `icons/`.
