// Copies the deployable web app (repo root) into native/www for Capacitor. Tests, docs, store, supabase and native are left out.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), out = join(root, 'native', 'www');
const FILES = ['index.html', 'privacy.html', 'terms.html', 'styles.css', 'config.js', 'social.js', 'app.js', 'programs.js', 'tips.js', 'foods.js', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['icons', 'vendor', 'brand/forged', 'brand/fonts'];
rmSync(out, { recursive:true, force:true }); mkdirSync(out, { recursive:true });
for (const f of FILES) cpSync(join(root, f), join(out, f));
for (const d of DIRS) if (existsSync(join(root, d))) cpSync(join(root, d), join(out, d), { recursive:true, filter:s => !/\/(tools|make_forged\.py|icon-jobs\.json)/.test(s) });
console.log('web files copied to', out);
