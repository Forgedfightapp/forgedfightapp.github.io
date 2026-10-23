// 3.14.0: Weights quick workout generator (muscle groups, shuffle, log via existing lifting log)
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = '/workspace/bjj-tracker/screenshots';
const results = [], errors = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
let offlineReq = 0; page.on('request', r => { if (/supabase|api\./.test(r.url()) && page.url().includes('#/log')) offlineReq++; });
const settle = (ms=400) => page.waitForTimeout(ms);
await page.goto(BASE); await page.locator('#loadSample').tap(); await page.waitForSelector('#weekCard'); await settle(1200);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.profile.enabled.weights = true; delete d.profile.wgroups; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.goto(BASE + '#/'); await settle(200); await page.reload(); await page.waitForSelector('#weekCard'); await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await settle(200);
if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(); }
await page.locator('.cats button[data-c="weights"]').tap(); await settle(300);
ok('picker card shows on Weights', await page.locator('#wgCard').count() === 1);
const chips = await page.locator('#wgChips button').allInnerTexts();
ok('nine muscle groups incl. Grip/Neck', JSON.stringify(chips) === JSON.stringify(['Chest','Back','Shoulders','Arms','Legs','Core','Full body','Grip','Neck']), JSON.stringify(chips));
ok('no workout until a group is picked', await page.locator('.wg-ex').count() === 0);
await page.locator('#wgCard').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -60)); await settle(200);
await page.screenshot({ path:`${SHOTS}/95-workout-picker.png` });
await page.locator('#wgChips button[data-g="back"]').tap(); await page.locator('#wgChips button[data-g="legs"]').tap(); await settle(200);
const n = await page.locator('.wg-ex').count();
ok('4–6 exercises', n >= 4 && n <= 6, String(n));
const rows = await page.locator('.wg-ex small').allInnerTexts();
ok('each has sets × reps and rest', rows.every(r => /^\d × \d+–\d+(s| m)? · rest (\d+s|[\d.]+ min)$/.test(r)), JSON.stringify(rows));
const first = await page.locator('.wg-ex b').allInnerTexts();
const pressed = await page.evaluate(() => [...document.querySelectorAll('#wgChips button.on')].map(b => b.dataset.g));
ok('chips multi-select + aria', JSON.stringify(pressed) === '["back","legs"]');
await page.evaluate(() => { document.querySelector('#wgChips').scrollIntoView({ block:'start' }); window.scrollBy(0, -70); }); await settle(300);
await page.screenshot({ path:`${SHOTS}/96-workout-generated.png` });
// same day + same groups → same workout (daily)
const again = await page.evaluate(() => DM_TEST_GEN(['back','legs']));
ok('daily suggestion is stable', JSON.stringify(again) === JSON.stringify(first), JSON.stringify(again));
let changed = false; for (let i = 0; i < 4 && !changed; i++) { await page.locator('#wgShuffle').tap(); await settle(150); changed = JSON.stringify(await page.locator('.wg-ex b').allInnerTexts()) !== JSON.stringify(first); }
ok('Shuffle changes the workout', changed);
// grappler groups
await page.locator('#wgChips button[data-g="back"]').tap(); await page.locator('#wgChips button[data-g="legs"]').tap(); await page.locator('#wgChips button[data-g="grip"]').tap(); await page.locator('#wgChips button[data-g="neck"]').tap(); await settle(200);
const gn = await page.locator('.wg-ex').count(); ok('Grip+Neck builds 4–6', gn >= 4 && gn <= 6, String(gn));
ok('Neck work stays light (2 sets)', (await page.locator('.wg-ex small').allInnerTexts()).some(t => t.startsWith('2 ×')));
const names = await page.locator('.wg-ex b').allInnerTexts();
await page.locator('#wgUse').tap(); await settle(600);
const logged = await page.evaluate(() => [...document.querySelectorAll('.exlist input, .exlist b, .exlist .exname')].map(x => x.value || x.textContent).join('|'));
ok('Log this workout fills the lifting log', names.every(x => logged.includes(x)), logged.slice(0,200));
const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')).profile.wgroups);
ok('groups remembered', JSON.stringify(persisted) === '["grip","neck"]', JSON.stringify(persisted));
ok('no network calls from the generator', offlineReq === 0, String(offlineReq));
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n')); await browser.close();
