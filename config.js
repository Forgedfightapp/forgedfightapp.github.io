/* Forged runtime config (3.4.0).
   social: Friends, head-to-head and leaderboards. Keep false until supabase/migrations/001_social.sql has been
   run in the Supabase SQL editor and supabase/verify.sql passes (see docs/social-setup.md). Then set it to true,
   bump the version in app.js + sw.js, commit and push.
   The publishable key is meant for the browser: every table is protected by Row Level Security. */
window.FORGED_CONFIG = Object.assign({
  social: false,
  supabaseUrl: 'https://ftnhmeqpzqpfdwhjfvnk.supabase.co',
  supabaseKey: 'sb_publishable_hspLZBFgnh5VhAeMXnBaSA_2agWNO41',
  redirectTo: 'https://forgedfightapp.github.io/',
  supabaseJs: 'vendor/supabase-js-2.117.2.js',
  apple: false   // Sign in with Apple: enable with the App Store build (Supabase > Auth > Providers > Apple)
}, window.FORGED_CONFIG || {});
