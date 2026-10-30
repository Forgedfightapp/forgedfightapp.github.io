// 3.9.2 bottom nav: 5 tabs in one even row, + centered and floating above the bar.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const results = [], errors = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const S = (id, date) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', rolls:[], sample:false, createdAt:1 });
const data = { schema:7, sessions:[S('a', new Date().toLocaleDateString('en-CA'))], profile:{ unit:'lb', setupDone:true, enabled:{ grappling:true, food:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], reps:[] };
for (const [w, h] of [[320, 568], [375, 667], [393, 852], [430, 932]]) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  await ctx.addInitScript(() => { window.__FORGED_QUIET_MEDALS = true; });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); localStorage.setItem('forged.tut.seen', '{"home":1,"weight":1}'); }, data);
  await page.goto(BASE + '#/'); await page.waitForTimeout(700);
  const g = await page.evaluate(() => {
    const bar = document.querySelector('.tabbar').getBoundingClientRect(), fab = document.querySelector('.tabbar a.fab').getBoundingClientRect();
    const tabs = [...document.querySelectorAll('.tabbar a:not(.fab):not([hidden])')].map(a => ({ tab:a.dataset.tab, r:a.getBoundingClientRect(), s:a.querySelector('span') }));
    const tops = tabs.map(t => Math.round(t.r.top)), widths = tabs.map(t => t.r.width), centers = tabs.map(t => (t.r.left + t.r.right) / 2);
    const gaps = centers.slice(1).map((c, i) => c - centers[i]);
    return { order:tabs.map(t => t.tab).join(), oneRow:new Set(tops).size === 1, wSpread:Math.max(...widths) - Math.min(...widths), gSpread:Math.max(...gaps) - Math.min(...gaps),
      inside:tabs.every(t => t.r.left >= bar.left - .5 && t.r.right <= bar.right + .5), labels:tabs.every(t => t.s.scrollWidth <= t.s.clientWidth + 1 && t.s.getBoundingClientRect().width <= t.r.width + .5),
      fabCenter:Math.abs((fab.left + fab.right) / 2 - (bar.left + bar.right) / 2), fabAbove:fab.top < bar.top - 30, barH:bar.height };
  });
  ok(`${w}px: tab order Home, History, Friends, Build, Profile`, g.order === 'home,history,friends,build,settings', g.order);
  ok(`${w}px: single row, nothing wraps`, g.oneRow && g.inside, JSON.stringify(g));
  ok(`${w}px: equal widths and spacing`, g.wSpread < 1 && g.gSpread < 1, JSON.stringify(g));
  ok(`${w}px: labels fit`, g.labels);
  ok(`${w}px: + centered and raised above the bar`, g.fabCenter < 1 && g.fabAbove, JSON.stringify(g));
  ok(`${w}px: bar is one row tall`, g.barH < 100, String(g.barH));
  await page.locator('.tabbar a.fab').tap(); await page.waitForTimeout(400);
  ok(`${w}px: + still opens Log`, (await page.evaluate(() => location.hash)) === '#/log');
  if (w === 393) { await page.goto(BASE + '#/'); await page.waitForTimeout(3500); await page.screenshot({ path:`${SHOTS}/83-nav-even.png` }); }
  await ctx.close();
}
ok('no page errors', !errors.length, errors.join('|'));
console.log(results.join('\n')); console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
