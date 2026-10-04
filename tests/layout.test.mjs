import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
// simulate iPhone standalone insets (home indicator 34px, notch 47px)
await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--safe-b:34px !important;--safe-t:47px !important}'; document.head.appendChild(s); }); });
const settle = (ms=300) => page.waitForTimeout(ms);

/* first-run: nav hidden, last button fully visible above the home indicator */
await page.goto(BASE); await page.waitForSelector('#catTiles');
await page.locator('.tile[data-k="weight"]').tap();
ok('first-run hides the bottom nav', !(await page.locator('.tabbar').isVisible()));
ok('first-run is minimal: no calorie/protein goal fields', await page.locator('#setupCal, #setupPro, #tgtWrap').count() === 0);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await settle();
const lastSetup = await page.evaluate(() => { const b = [...document.querySelectorAll('#view button')].pop().getBoundingClientRect(); return b.bottom; });
ok('first-run: last button clears the 34px home-indicator inset', lastSetup <= 844 - 34, `bottom=${Math.round(lastSetup)}`);
await page.screenshot({ path:`${SHOTS}/00b-first-run-bottom.png` });
await page.locator('#loadSample').tap(); await page.waitForSelector('#beltCard');
ok('nav returns after setup', await page.locator('.tabbar').isVisible());

/* every screen: the last control scrolls fully clear of the nav (incl. the raised + button) */
const ids = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); return { s:d.sessions[0].id }; });
for (const [name, hash] of [['Home','#/'],['History','#/history'],['Belts','#/belts'],['Stats','#/stats'],['Food','#/food'],['Comps','#/comps'],['Benchmarks','#/benchmarks'],['Programs','#/programs'],['Program','#/program/full2'],['Profile','#/settings'],['Log workout','#/log'],['Workout detail',`#/session/${ids.s}`]]) {
  await page.goto(BASE + hash); await settle(400);
  if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(300); }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await settle(250);
  const r = await page.evaluate(() => { let max = 0, what = '';
    document.querySelectorAll('#view *').forEach(e => { if (!e.checkVisibility({ checkOpacity:true, checkVisibilityCSS:true })) return; const b = e.getBoundingClientRect(); if (b.width && b.height && b.bottom > max) { max = b.bottom; what = (e.textContent||'').trim().slice(0,30); } });
    const fab = document.querySelector('.tabbar a.fab').getBoundingClientRect(), bar = document.querySelector('.tabbar').getBoundingClientRect(); return { last:max, fabTop:fab.top, barTop:bar.top, what }; });
  ok(`${name}: last control fully above the nav`, r.last <= r.fabTop, `${r.what} bottom=${Math.round(r.last)} fabTop=${Math.round(r.fabTop)} navTop=${Math.round(r.barTop)}`);
}
await page.goto(BASE + '#/settings'); await page.waitForSelector('#targetsCard');
const tl = await page.locator('#targetsCard label').evaluateAll(ls => ls.map(x => x.textContent));
ok('Profile goals: clearer labels', tl[0] === 'Calories' && tl[1] === 'Protein (g)', JSON.stringify(tl));
ok('Profile goals: helper text', (await page.locator('#targetsCard .hint').textContent()).startsWith('Used to track your progress on the Nutrition screen. You can change these anytime in Profile.'));
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
