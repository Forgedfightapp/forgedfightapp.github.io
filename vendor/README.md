# Vendored libraries

- `supabase-js-2.117.2.js`: `@supabase/supabase-js` 2.117.2, `dist/umd/supabase.js` from the npm package, unmodified (MIT, see LICENSE-supabase-js.txt).
  sha256 59d39487c3589843b410322d8a3d562ce022aba1e5ccb16898ef3fb2a0da2ecd. Loaded on demand only when Friends is enabled; cached by the service worker so it works offline.
  To update: `npm pack @supabase/supabase-js@<version>`, copy `package/dist/umd/supabase.js` here under the new name, update `supabaseJs` in config.js and the list in sw.js.
