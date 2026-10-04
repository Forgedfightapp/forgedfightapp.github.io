import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
// every visible 2/3-column field grid: controls in the same row share the same top and bottom
const checkGrids = (page) => page.evaluate(() => { const out = [];
  document.querySelectorAll('.grid2, .grid3').forEach(g => { if (!g.checkVisibility()) return; const rows = {};
    [...g.children].filter(c => c.classList.contains('field')).forEach(f => { const ctl = [...f.children].find(c => c.tagName !== 'LABEL' && !c.classList.contains('hint')); const lab = f.querySelector(':scope>label'); if (!ctl) return;
      const r = ctl.getBoundingClientRect(), key = Math.round(f.getBoundingClientRect().top); (rows[key] ||= []).push({ t:r.top, b:r.bottom, lab:lab?.textContent, lines:lab ? Math.round(lab.scrollHeight / parseFloat(getComputedStyle(lab).lineHeight)) : 0 }); });
    Object.values(rows).forEach(r => { if (r.length < 2) return; const dt = Math.max(...r.map(x=>x.t)) - Math.min(...r.map(x=>x.t)), db = Math.max(...r.map(x=>x.b)) - Math.min(...r.map(x=>x.b));
      out.push({ labels:r.map(x=>x.lab).join(' | '), dt, db, wrapped:r.some(x => x.lines > 1) }); }); });
  return out; });
for (const [w, big] of [[390,false],[375,false],[375,true],[320,true]]) {
  const ctx = await browser.newContext({ viewport:{width:w,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  // "big": simulate larger iOS text (labels ~20% bigger) to force wrapping
  if (big) await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.field>label{font-size:16px !important}'; document.head.appendChild(s); }));
  const tag = `${w}px${big ? ' large text' : ''}`, settle = (ms=300) => page.waitForTimeout(ms);
  const screens = [];
  const nav = async (hash) => { await page.goto(BASE + hash); await settle(350); for (let i = 0; i < 2; i++) if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').first().tap(); await settle(350); } };
  const run = async (name) => { const rs = await checkGrids(page); screens.push(...rs.map(r => ({ ...r, name })));
    const bad = rs.filter(r => r.dt > 1 || r.db > 1); ok(`${tag} ${name}: paired fields aligned (${rs.length} rows${rs.some(r=>r.wrapped)?', some labels wrap':''})`, rs.length > 0 && !bad.length, JSON.stringify(bad)); };
  await page.goto(BASE); await page.waitForSelector('#catTiles'); await page.locator('.tile[data-k="weight"]').tap(); await page.locator('.tile[data-k="weights"]').tap(); await page.locator('#go').tap(); await page.waitForSelector('#setupDone'); await settle(); await run('first-run goals step (weight, nutrition, strength, comp)'); await page.locator('#setupBack').tap(); await page.waitForSelector('#loadSample');
  await page.locator('#loadSample').tap(); await page.waitForSelector('#beltCard');
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); Object.keys(d.profile.enabled).forEach(k => d.profile.enabled[k] = true); d.profile.enabled.cardio = d.profile.enabled.weights = true; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
  await page.goto(BASE + '#/settings'); await page.waitForSelector('#targetsCard'); await settle(); await run('Profile (weight goal + nutrition goals)');
  if (w === 390 && !big) { await page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.style.display = 'none'; document.querySelector('#targetsCard').scrollIntoView({ block:'start' }); window.scrollBy(0, -320); }); await settle(); await page.screenshot({ path:`${SHOTS}/27-profile-goals-aligned.png` }); }
  for (const c of ['grappling','striking','mma','cardio','weights','mobility']) {
    await nav('#/log'); await page.waitForSelector('.cats');
    if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(); }
    await page.locator(`.cats button[data-c="${c}"]`).tap(); await settle(150);
     await settle(200);
    await run(`Log workout (${c})`);
  }
  await nav('#/food'); await page.waitForSelector('[data-add="dinner"]'); await page.locator('[data-add="dinner"]').tap(); await page.locator('#fpManual').tap(); await page.waitForSelector('.foodform'); await settle(400);
  await page.locator('details.more summary').tap(); await settle(); await run('Food entry sheet');
  if (w === 375 && big) console.log(screens.filter(s => s.wrapped).map(s => `  wrapped: ${s.name}: ${s.labels}`).join('\n'));
  await ctx.close();
}
/* Profile labels */
{ const ctx = await browser.newContext({ viewport:{width:390,height:844} }); const page = await ctx.newPage();
  await page.goto(BASE); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').click(); await page.waitForSelector('#beltCard');
  await page.goto(BASE + '#/settings'); await page.waitForSelector('#targetsCard');
  const tl = await page.locator('#targetsCard label').evaluateAll(ls => ls.map(x => x.textContent));
  ok('Profile goal labels shortened under "Daily nutrition goals"', JSON.stringify(tl) === JSON.stringify(['Calories','Protein (g)','Carbs (g)','Fat (g)','Water (oz)']) && (await page.locator('#targetsCard h2').textContent()) === 'Daily nutrition goals', JSON.stringify(tl));
  await ctx.close(); }
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
