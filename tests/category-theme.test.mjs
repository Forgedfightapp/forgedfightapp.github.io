// 3.1.0: log form themed to the chosen category colour via CSS variables on body[data-theme].
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=250) => page.waitForTimeout(ms);
const hideToast = () => page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); });
const css = (sel, prop) => page.evaluate(([s, p]) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; }, [sel, prop]);
const lum = rgb => { const [r,g,b] = rgb.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .03928 ? v/12.92 : ((v+.055)/1.055) ** 2.4; }); return .2126*r + .7152*g + .0722*b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const COL = { grappling:'rgb(242, 113, 28)', striking:'rgb(245, 197, 66)', mma:'rgb(229, 72, 77)', weights:'rgb(143, 176, 217)', cardio:'rgb(111, 211, 168)', mobility:'rgb(180, 140, 242)' };

await page.goto(BASE); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:7, sessions:[], profile:{ setupDone:true, unit:'lb', enabled:{ grappling:true, striking:true, mma:true, weights:true, cardio:true, mobility:true, food:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[] })); });
await page.reload(); await page.waitForSelector('.statrow');
const fab0 = await css('.tabbar a.fab', 'backgroundColor');
ok('Home uses the default flame orange', fab0 === COL.grappling, fab0);
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
for (const c of ['grappling','striking','mma','weights','cardio','mobility']) {
  await page.locator(`.cats button[data-c="${c}"]`).tap(); await settle(200);
  const save = await css('.actions [data-save]', 'backgroundColor'), ink = await css('.actions [data-save]', 'color');
  const segOn = await css('#view .seg button.on', 'backgroundColor');
  await page.locator('.effort button[data-r="7"]').tap(); await settle(400);
  const eff = await css('.effort button.on', 'backgroundColor'), effInk = await css('.effort button.on', 'color');
  ok(`${c}: body[data-theme] set, Save + selected chips + RPE use ${COL[c]}`, (await page.evaluate(() => document.body.dataset.theme)) === c && save === COL[c] && eff === COL[c] && (!segOn || segOn === COL[c]), JSON.stringify({ save, segOn, eff }));
  ok(`${c}: readable text on the colour (≥4.5:1)`, contrast(save, ink) >= 4.5 && contrast(eff, effInk) >= 4.5, `${contrast(save, ink).toFixed(1)} / ${contrast(eff, effInk).toFixed(1)}`);
  await page.locator('.effort button[data-r="7"]').tap(); await settle(80); // toggle off again
}
await page.locator('.cats button[data-c="striking"]').tap(); await settle(200);
ok('yellow (Striking) uses dark text', lum(await css('.actions [data-save]', 'color')) < 0.05);
// focus ring follows the theme
await page.locator('.cats button[data-c="mma"]').tap(); await settle(200);
const inp = page.locator('#view input.input, #view textarea').first(); await inp.focus(); await settle(100);
const ring = await page.evaluate(() => getComputedStyle(document.activeElement).borderColor);
ok('focus ring uses the category colour (MMA)', /240, 113, 117|229, 72, 77/.test(ring), ring);
ok('nav + button follows the form colour', (await css('.tabbar a.fab', 'backgroundColor')) === COL.mma);
// screenshots: MMA with session type + effort + feel, then Cardio
await page.locator('.effort button[data-r="8"]').tap(); await page.locator('.feelpick [data-feel="4"]').tap();
await page.locator('.field', { has:page.locator('label', { hasText:/^Session type$/ }) }).locator('button', { hasText:'Pad work' }).tap();
await page.evaluate(() => { const l = [...document.querySelectorAll('#view .field>label')].find(x => x.textContent.trim() === 'Session type'); window.scrollTo(0, l.getBoundingClientRect().top + scrollY - 330); }); await hideToast(); await settle(200);
await page.screenshot({ path:`${SHOTS}/50-category-theme-mma.png` });
await page.locator('.cats button[data-c="cardio"]').tap(); await settle(200);
ok('switches instantly on category change (Cardio green)', (await css('.actions [data-save]', 'backgroundColor')) === COL.cardio && (await css('.tabbar a.fab', 'backgroundColor')) === COL.cardio);
await page.locator('.effort button[data-r="6"]').tap(); await page.locator('.feelpick [data-feel="5"]').tap();
await page.evaluate(() => window.scrollTo(0, 0)); await hideToast(); await settle(200);
await page.screenshot({ path:`${SHOTS}/51-category-theme-cardio.png` });
// leaving resets
await page.locator('.tabbar a[data-tab="home"]').tap(); await settle(300);
if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(400); }
ok('leaving the form resets to flame orange', (await page.evaluate(() => document.body.dataset.theme)) === undefined && (await css('.tabbar a.fab', 'backgroundColor')) === COL.grappling);
await page.goto(BASE + '#/settings'); await settle(200);
ok('other pages keep the default accent', (await css('#view .seg button.on', 'backgroundColor') || COL.grappling) === COL.grappling);
ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
results.forEach(r => console.log(r));
