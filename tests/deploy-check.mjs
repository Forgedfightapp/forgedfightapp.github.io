// Deploy check: BASE=https://forgedfightapp.github.io/ node tests/deploy-check.mjs (SW scope, cache, manifest icons, offline).
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE;
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto(BASE); await p.waitForSelector('#catTiles, .statrow');
const r = await p.evaluate(async () => { const reg = await navigator.serviceWorker.ready; const keys = await caches.keys(); const c = await caches.open(keys[0]); const n = (await c.keys()).length;
  const m = await (await fetch('manifest.webmanifest')).json(); const icons = await Promise.all(m.icons.map(async i => [i.src, (await fetch(new URL(i.src, new URL("manifest.webmanifest", location.href)))).status]));
  return { scope: reg.scope, script: reg.active && reg.active.scriptURL, state: reg.active && reg.active.state, caches: keys, cachedEntries: n, start_url: new URL(m.start_url, new URL('manifest.webmanifest', location.href)).href, icons, title: document.title, controlled: !!navigator.serviceWorker.controller }; });
await p.reload(); await p.waitForTimeout(800); r.controlledAfterReload = await p.evaluate(() => !!navigator.serviceWorker.controller);
await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(800); r.offlineTitle = await p.title(); r.offlineRenders = await p.locator('#catTiles, .statrow').count() > 0;
r.errors = errs; console.log(JSON.stringify(r, null, 1)); await b.close();
