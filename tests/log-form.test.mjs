import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
for (const w of [390, 375]) {
  const ctx = await browser.newContext({ viewport:{width:w,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  const settle = (ms=300) => page.waitForTimeout(ms);
  await page.goto(BASE); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await page.waitForSelector('#beltCard');
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); ['grappling','striking','cardio','weights'].forEach(k => d.profile.enabled[k] = true); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
  for (const c of ['grappling','striking','weights','cardio']) {
    await page.goto(BASE + '#/'); await settle(200); await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await settle(200);
    if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(); }
    await page.locator(`.cats button[data-c="${c}"]`).tap(); await settle(200);
    const t = `${w}px ${c}:`;
    ok(`${t} no expander / no "Add details" toggle; details always shown`, await page.locator('#view details.details').count() === 0 && !(await page.locator('#view').innerText()).includes('Add details') && await page.locator('#detailsSec').isVisible() && (await page.locator('#detailsSec .sect-title').textContent()).startsWith('Details'));
    const order = await page.evaluate(() => { const y = txt => { const l = [...document.querySelectorAll('#view .field>label, #view .field>.label')].find(x => x.textContent.trim().startsWith(txt)); return l ? l.getBoundingClientRect().top + scrollY : null; };
      return ['Intensity','Body weight','Import from device','Heart rate','Notes'].map(y); });
    ok(`${t} order Intensity → Body weight → Import from device → Heart rate → Notes`, order.every(x => x != null) && order.every((x,i) => !i || x > order[i-1]), JSON.stringify(order));
    ok(`${t} import keeps GPX/TCX/FIT/CSV + helper text`, (await page.locator('.field', { has:page.locator('label', { hasText:'Import from device' }) }).innerText()).includes('GPX · TCX · FIT · CSV') && await page.locator('.field', { has:page.locator('label', { hasText:'Import from device' }) }).locator('.hint').count() === 1);
    // duration digits never clipped
    const di = page.locator('.field', { has:page.locator('label', { hasText:/^Duration$/ }) }).locator('input');
    const fits = [];
    for (const val of ['30','45','120','600']) { await di.fill(val); fits.push(await di.evaluate(i => { const r = document.createRange(); r.selectNodeContents(i); const cs = getComputedStyle(i), cv = document.createElement('canvas').getContext('2d'); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return { v:i.value, need:Math.ceil(cv.measureText(i.value).width), have:i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }; })); }
    ok(`${t} duration shows 30/45/120/600 in full with "min"`, fits.every(f => f.need <= f.have) && await page.locator('.field', { has:page.locator('label', { hasText:/^Duration$/ }) }).locator('.unit').isVisible(), JSON.stringify(fits));
    await di.fill('60');
    // every stepper on the form fits its value
    const clipped = await page.evaluate(() => [...document.querySelectorAll('#view .stepper input')].filter(i => i.checkVisibility()).map(i => { const cs = getComputedStyle(i), cv = document.createElement('canvas').getContext('2d'); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const s = i.value || i.placeholder; return { s, need:cv.measureText(s.length < 3 && /^\d+$/.test(s) ? '888' : s).width, have:i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }; }).filter(x => x.need > x.have + .5));
    ok(`${t} all steppers fit 3 digits`, clipped.length === 0, JSON.stringify(clipped));
    if (w === 390 && c === 'grappling') {
      await page.locator('.field', { has:page.locator('label', { hasText:/^Duration$/ }) }).screenshot({ path:'/tmp/duration.png' });
      await page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.style.display = 'none'; const l = [...document.querySelectorAll('#view .field>label')].find(x => x.textContent.trim() === 'Intensity'); window.scrollTo(0, l.getBoundingClientRect().top + scrollY - 24); }); await settle();
      await page.screenshot({ path:`${SHOTS}/30-log-form-order.png` });
    }
  }
  await ctx.close();
}
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
