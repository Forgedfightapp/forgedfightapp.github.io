// 3.9.1 Friends tab in the bottom nav (when social is on), balanced on iPhone SE.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const S = (id, date) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', rolls:[], sample:false, createdAt:1 });
const data = { schema:7, sessions:[S('a', new Date().toLocaleDateString('en-CA'))], profile:{ unit:'lb', setupDone:true, enabled:{ grappling:true, food:true, weight:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], reps:[] };
for (const [w, h, name] of [[375, 667, 'SE'], [390, 844, '13']]) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  await ctx.addInitScript(() => { window.__FORGED_QUIET_MEDALS = true; });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data);
  await page.goto(BASE + '#/'); await page.waitForTimeout(600);
  const order = await page.locator('.tabbar a:visible').evaluateAll(a => a.map(x => x.dataset.tab));
  ok(`${name}: tab order Home, History, Friends, +, Food, Profile`, order.join() === 'home,history,friends,log,food,settings', order.join());
  const g = await page.evaluate(() => { const bar = document.querySelector('.tabbar').getBoundingClientRect(), f = document.querySelector('.tabbar a.fab').getBoundingClientRect();
    const labels = [...document.querySelectorAll('.tabbar a:not([hidden]) span')].map(s => { const r = s.getBoundingClientRect(), p = s.parentElement.getBoundingClientRect(); return r.width <= p.width + 0.5 && s.scrollWidth <= s.clientWidth + 1; });
    const rects = [...document.querySelectorAll('.tabbar a:not([hidden])')].map(a => a.getBoundingClientRect()); const overlap = rects.some((r, i) => i && r.left < rects[i-1].right - 0.5);
    return { center: Math.abs((f.left + f.right) / 2 - (bar.left + bar.right) / 2), labels, overlap, fits: rects.every(r => r.right <= bar.right + 0.5) }; });
  ok(`${name}: + stays centered`, g.center < 2, String(g.center));
  ok(`${name}: labels fit, no overlap, nothing off-screen`, g.labels.every(Boolean) && !g.overlap && g.fits, JSON.stringify(g));
  await page.locator('.tabbar a[data-tab="friends"]').tap(); await page.waitForTimeout(600);
  ok(`${name}: Friends tab opens #/friends and is active`, (await page.evaluate(() => location.hash)) === '#/friends' && await page.locator('.tabbar a[data-tab="friends"].active').count() === 1);
  ok(`${name}: Friends header is top-level (no back link)`, await page.evaluate(() => document.querySelector('#backRow').hidden));
  if (name === 'SE') await page.waitForTimeout(4000), await page.screenshot({ path:`${SHOTS}/81-friends-tab.png` });
  await page.goto(BASE + '#/signin'); await page.waitForTimeout(500);
  ok(`${name}: sign-in keeps Friends tab active`, await page.locator('.tabbar a[data-tab="friends"].active').count() === 1);
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); }); await ctx.close();
}
// social off: tab hidden, classic 5-slot bar
{ const ctx = await browser.newContext({ viewport:{width:375,height:667} }); const page = await ctx.newPage();
  await ctx.addInitScript(() => { window.__FORGED_QUIET_MEDALS = true; window.FORGED_CONFIG_OVERRIDE = 1; });
  await page.route('**/config.js', async r => { const res = await r.fetch(); r.fulfill({ response:res, body:(await res.text()).replace(/social\s*:\s*true/, 'social:false') }); });
  await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data);
  await page.goto(BASE + '#/'); await page.waitForTimeout(600);
  ok('social off: Friends tab hidden, 5 items', await page.locator('.tabbar a:visible').count() === 5 && !(await page.evaluate(() => document.querySelector('.tabbar').classList.contains('six'))));
  await ctx.close(); }
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n')); console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
