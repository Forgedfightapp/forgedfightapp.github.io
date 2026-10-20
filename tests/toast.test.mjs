// 3.9.2 toasts wrap and stay inside the viewport on narrow phones.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const results = [], errors = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const S = (id, date) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', rolls:[], sample:false, createdAt:1 });
const data = { schema:7, sessions:[S('a', new Date().toLocaleDateString('en-CA'))], profile:{ unit:'lb', setupDone:true, enabled:{ grappling:true, food:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], reps:[] };
for (const w of [320, 375, 390]) {
  const ctx = await browser.newContext({ viewport:{width:w,height:700}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  await ctx.addInitScript(() => { window.__FORGED_QUIET_MEDALS = true; });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data);
  await page.goto(BASE + '#/'); await page.waitForTimeout(300); await page.goto(BASE + '#/friends'); await page.waitForTimeout(300);
  // the first-run toast fires during boot; keep its real text on screen to measure it
  await page.evaluate(() => { const t = document.getElementById('toast'); if (/You start at/.test(t.textContent)) t.classList.add('show'); }); await page.waitForTimeout(350);
  const r = await page.evaluate(() => { const t = document.getElementById('toast'), b = t.getBoundingClientRect(); return t.classList.contains('show') ? { l:b.left, r:b.right, txt:t.textContent, show:true } : {}; });
  ok(`${w}px: first-run rank toast shown`, r.show && /You start at/.test(r.txt), r.txt);
  ok(`${w}px: toast within viewport with side margin`, r.l >= 8 && r.r <= w - 8, JSON.stringify(r));
  if (w === 375) await page.screenshot({ path:`${SHOTS}/82-toast-fix.png` });
  // action toast (Undo button) too
  await page.evaluate(() => { const t = document.getElementById('toast'); t.className = 'toast act show'; t.innerHTML = '<span>Logged Brazilian jiu-jitsu class · Oct 20 · 60 min with a long note</span><button class="undo">Undo</button>'; });
  const a = await page.evaluate(() => { const b = document.getElementById('toast').getBoundingClientRect(), u = document.querySelector('#toast .undo').getBoundingClientRect(); return { l:b.left, r:b.right, ur:u.right }; });
  ok(`${w}px: action toast + Undo within viewport`, a.l >= 8 && a.r <= w - 8 && a.ur <= a.r, JSON.stringify(a));
  await ctx.close();
}
ok('no page errors', !errors.length, errors.join('|'));
console.log(results.join('\n')); console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
