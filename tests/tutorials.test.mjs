// 3.9.0 first-visit tutorials: coach-mark tour per page, seen state in localStorage, never over onboarding, replay from Profile.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
process.on('uncaughtException', e => { console.log(results.join('\n')); console.log('ERROR', e.message.split('\n')[0]); process.exit(1); });
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
await ctx.addInitScript(() => { window.__FORGED_QUIET_MEDALS = true; });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=700) => page.waitForTimeout(ms);
const S = (id, date) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', rolls:[], sample:false, createdAt:1 });
const data = { schema:7, sessions:[S('a', new Date().toLocaleDateString('en-CA'))], profile:{ unit:'lb', setupDone:true, enabled:{ grappling:true, weights:true, food:true, weight:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], reps:[] };
const seed = async (d, hash='#/', seen=null, force=true) => { await page.goto(BASE + 'sw.js'); await page.evaluate(([d, seen, force]) => { localStorage.clear(); if (d) localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); if (force) localStorage.setItem('forged.tut.force', '1'); if (seen) localStorage.setItem('forged.tut.seen', JSON.stringify(seen)); }, [d, seen, force]); await page.goto(BASE + hash); await settle(900); };
const tut = () => page.locator('#tut');
const seenNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('forged.tut.seen') || '{}'));

/* 1. onboarding: no tutorial over setup */
await seed(null, '#/');
ok('no tutorial over the onboarding setup flow', await page.evaluate(() => document.body.classList.contains('setup-mode')) && await tut().count() === 0);

/* 2. automated browsers without opt-in see nothing (keeps other suites unblocked) */
await seed(data, '#/', null, false);
ok('no tutorial for automated runs without opt-in', await tut().count() === 0);

/* 3. Home tour */
await seed(data, '#/');
ok('Home: tutorial shows on first visit', await tut().count() === 1 && await tut().getAttribute('data-page') === 'home');
ok('Home: dialog with step counter, title, Next + Skip', /Home · 1 of \d/.test(await page.locator('.tut-n').textContent()) && (await page.locator('.tut-card h3').textContent()).length > 0 && await page.locator('#tutNext').textContent() === 'Next' && await page.locator('#tutSkip').isVisible());
ok('Home: highlight ring visible in brand orange', await page.locator('.tut-hole').evaluate(e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).borderTopColor === 'rgb(242, 113, 28)'));
ok('card is FORGED dark', await page.locator('.tut-card').evaluate(e => getComputedStyle(e).backgroundColor === 'rgb(11, 11, 12)'));
await page.screenshot({ path:`${SHOTS}/79-tutorial-home.png` });
const total = +(await page.locator('.tut-n').textContent()).match(/of (\d)/)[1];
ok('Home: 2-4 steps', total >= 2 && total <= 4, String(total));
for (let i = 1; i < total; i++) await page.click('#tutNext');
ok('last step says Done', await page.locator('#tutNext').textContent() === 'Done');
await page.click('#tutNext');
ok('Done closes and marks home seen', await tut().count() === 0 && (await seenNow()).home === 1);
await page.reload(); await settle(900);
ok('Home: not shown again after seen', await tut().count() === 0 || await tut().getAttribute('data-page') !== 'home');
if (await tut().count()) await page.click('#tutSkip');

/* 4. Log tour + Skip */
await page.goto(BASE + '#/log'); await settle(900);
ok('Log: tutorial shows on first visit', await tut().getAttribute('data-page') === 'log');
await page.screenshot({ path:`${SHOTS}/80-tutorial-log.png` });
await page.click('#tutSkip');
ok('Skip closes and marks log seen', await tut().count() === 0 && (await seenNow()).log === 1);
ok('log form still works under it', await page.locator('#view .field').count() > 0);

/* 5. every page */
for (const [hash, key] of [['#/food','food'],['#/history','history'],['#/challenges','challenges'],['#/belts','belts'],['#/friends','friends'],['#/settings','settings'],['#/stats','stats'],['#/programs','programs'],['#/benchmarks','benchmarks'],['#/comps','comps'],['#/badges','badges'],['#/pro?pro=1','pro']]) {
  const all = await page.evaluate(() => FORGED_TUT.pages);
  const seen = Object.fromEntries(all.filter(k => k !== key).map(k => [k, 1]));
  await seed(data, hash.replace('?pro=1',''), seen);
  if (key === 'pro') { await page.goto(BASE + '?pro=1#/pro'); await settle(900); }
  const n = await tut().count();
  const pg = n ? await tut().getAttribute('data-page') : '';
  const cnt = n ? +(await page.locator('.tut-n').textContent()).match(/of (\d)/)[1] : 0;
  ok(`${key}: tutorial shows (${cnt} steps)`, pg === key && cnt >= 1 && cnt <= 4, `${n} ${pg}`);
  if (n) await page.click('#tutSkip');
}
/* weight on Home after home tour */
await seed(data, '#/', { home:1 });
ok('weight: Lose/Maintain/Gain tour shows on Home after the home tour', await tut().count() === 1 ? await tut().getAttribute('data-page') === 'weight' : !(await page.locator('#weightCard').count()));

/* 6. Replay from Profile */
const allSeen = Object.fromEntries((await page.evaluate(() => FORGED_TUT.pages)).map(k => [k, 1]));
await seed(data, '#/settings', allSeen);
ok('Profile has Replay tutorials button', await page.locator('#tutReplay').count() === 1 && await tut().count() === 0);
await page.click('#tutReplay'); await settle(900);
ok('Replay clears seen and shows Profile tour', JSON.stringify(await seenNow()) === '{}' && await tut().getAttribute('data-page') === 'settings');
await page.keyboard.press('Escape');
ok('Escape closes', await tut().count() === 0);
await page.goto(BASE + '#/'); await settle(900);
ok('after replay Home tour shows again', await tut().getAttribute('data-page') === 'home');

ok('no page errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
