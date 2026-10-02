# Discipline > Motivation — BJJ Training Log (PWA)
Vanilla JS, no dependencies, data in localStorage (key `dm.bjj.v1`), JSON export/import.
- Serve: `python3 -m http.server 8787 --directory /workspace/bjj-tracker`
- Public preview: `./restart-preview.sh` (restarts server + Cloudflare quick tunnel, prints new URL)
- Tests (Playwright, iPhone 390x844 @3x): `cd /workspace/pwtest && node test.mjs && node nutri.mjs && node supps.mjs` (copies in tests/)
- Icons: `python3 make_icons.py`. Bump `CACHE` in sw.js when shipping changes.
