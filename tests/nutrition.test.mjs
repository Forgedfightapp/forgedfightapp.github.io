import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: '+e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
await page.goto(BASE); await page.waitForLoadState('networkidle');
await page.getByRole('button', { name:/Load sample data/ }).tap();
await page.waitForSelector('#nutriCard');
let d = await db();
ok('sample nutrition loaded', d.nutrition.entries.length > 40 && d.nutrition.foods.length > 10, `${d.nutrition.entries.length} entries / ${d.nutrition.foods.length} foods`);
ok('dashboard nutrition card', /calories/i.test(await page.locator('#nutriCard').innerText()));
await page.locator('#nutriCard').scrollIntoViewIfNeeded(); await page.waitForTimeout(2500);
await page.screenshot({ path:`${SHOTS}/08-dashboard-nutrition-card.png` });
// food tab via nav
await page.locator('.tabbar a[data-tab="food"]').tap();
await page.waitForSelector('.ring');
ok('food tab active', await page.locator('.tabbar a[data-tab="food"].active').count() === 1);
const calBefore = Number(await page.locator('.ring-v').textContent());
await page.screenshot({ path:`${SHOTS}/09-nutrition-daily.png` });
await page.screenshot({ path:`${SHOTS}/09b-nutrition-daily-full.png`, fullPage:true });
// add new food (custom)
await page.locator('[data-add="dinner"]').tap();
await page.waitForSelector('.foodform');
await page.locator('.foodform input[placeholder="e.g. Chicken breast"]').fill('Test Steak');
await page.locator('.foodform input[placeholder="e.g. 100 g, 1 cup"]').fill('8 oz');
await page.locator('input[data-k="cal"]').fill('500');
await page.locator('input[data-k="p"]').fill('60');
await page.locator('input[data-k="c"]').fill('0');
await page.locator('input[data-k="f"]').fill('28');
await page.locator('details.more summary').tap();
await page.locator('input[data-k="sodium"]').fill('300');
await page.getByRole('button', { name:'More servings' }).tap(); // 1.5
ok('live total', (await page.locator('.foodtotal').innerText()).includes('750'));
await page.evaluate(() => document.querySelector('.sheet .panel').scrollTop = 0); await page.waitForTimeout(300);
await page.screenshot({ path:`${SHOTS}/10-add-food-form.png` });
await page.locator('.foodform [data-save]').tap();
await page.waitForSelector('.sheet', { state:'hidden' });
d = await db();
const steak = d.nutrition.entries.find(e => e.name === 'Test Steak');
ok('food entry saved', steak && steak.qty === 1.5 && steak.cal === 500 && steak.meal === 'dinner' && steak.sodium === 300, JSON.stringify(steak));
ok('saved to My foods', d.nutrition.foods.some(f => f.name === 'Test Steak'));
ok('daily total updated', Number(await page.locator('.ring-v').textContent()) === calBefore + 750, `${calBefore} -> ${await page.locator('.ring-v').textContent()}`);
// autocomplete from saved foods
await page.locator('[data-add="snack"]').tap();
await page.locator('.foodform input[placeholder="e.g. Chicken breast"]').fill('stea');
const sug = page.locator('.foodform .sugg button', { hasText:'Test Steak' });
ok('autocomplete suggests saved food', await sug.count() === 1);
await sug.tap();
ok('autocomplete fills macros', await page.locator('input[data-k="p"]').inputValue() === '60');
await page.locator('.foodform [data-save]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
ok('re-added from autocomplete', (await db()).nutrition.entries.filter(e => e.name==='Test Steak').length === 2);
// edit entry
await page.locator('.meal[data-meal="snack"] .food-row', { hasText:'Test Steak' }).tap();
await page.locator('input[data-k="cal"]').fill('400');
await page.locator('.foodform [data-save]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
ok('entry edited', (await db()).nutrition.entries.some(e => e.name==='Test Steak' && e.meal==='snack' && e.cal===400));
// delete entry
await page.locator('.meal[data-meal="snack"] .food-row', { hasText:'Test Steak' }).tap();
await page.locator('.foodform [data-del]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
ok('entry deleted', (await db()).nutrition.entries.filter(e => e.name==='Test Steak').length === 1);
// My foods sheet quick add
await page.locator('#savedFoods').tap();
await page.waitForSelector('.flist .list-row');
await page.screenshot({ path:`${SHOTS}/11-my-foods.png` });
await page.locator('.flist .list-row', { hasText:'Almonds' }).locator('[data-quick]').tap();
await page.waitForSelector('.foodform');
await page.locator('.foodform [data-save]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
ok('quick add from My foods', (await db()).nutrition.entries.filter(e => e.name==='Almonds' && e.date === new Date().toLocaleDateString('en-CA')).length >= 1);
// day navigation + weekly
await page.locator('[aria-label="Previous day"]').tap(); await page.waitForURL(/#\/food\/\d/); await page.waitForSelector('text=Jump to today');
ok('previous day nav', /#\/food\/\d{4}-\d{2}-\d{2}/.test(page.url()) && (await page.locator('.daynav').innerText()).includes('Jump to today'));
ok('weekly summary', /Avg kcal/i.test(await page.locator('.card', { hasText:'Last 7 days' }).innerText()) && await page.locator('.card', { hasText:'Last 7 days' }).locator('svg.chart rect.bar').count() === 7);
// targets in settings
await page.locator('.tabbar a[data-tab="settings"]').tap();
const ti = page.locator('input[data-target="p"]');
await ti.fill('200'); await ti.blur(); await page.waitForTimeout(200);
ok('protein target saved', (await db()).profile.targets.p === 200);
await page.locator('.tabbar a[data-tab="food"]').tap();
ok('target reflected on food view', (await page.locator('.mbar.pro').innerText()).includes('/ 200'));
// export/import/clear
await page.locator('.tabbar a[data-tab="settings"]').tap();
const before = await db();
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-nutri.json'; await dl.saveAs(path);
const ex = JSON.parse(fs.readFileSync(path,'utf8'));
ok('export has nutrition', ex.nutrition.entries.length === before.nutrition.entries.length && ex.nutrition.foods.length === before.nutrition.foods.length);
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(200);
const cl = await db();
ok('clear wipes nutrition', cl.nutrition.entries.length === 0 && cl.nutrition.foods.length === 0 && !cl.profile.targets);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(300);
const after = await db();
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const N = x => JSON.stringify(canon({ e:[...x.nutrition.entries].sort((a,b)=>a.id.localeCompare(b.id)), f:[...x.nutrition.foods].sort((a,b)=>a.id.localeCompare(b.id)), t:x.profile.targets }));
if (N(after) !== N(before)) { const A = canon(after.nutrition.entries), B = canon(before.nutrition.entries); console.log('DIFF', JSON.stringify(A.find((e)=>JSON.stringify(e)!==JSON.stringify(B.find(x=>x.id===e.id))))); const FA = canon(after.nutrition.foods), FB = canon(before.nutrition.foods); console.log('FDIFF', JSON.stringify(FA.find(e=>JSON.stringify(e)!==JSON.stringify(FB.find(x=>x.id===e.id))))); }
ok('import round-trips nutrition + targets', N(after) === N(before));
// remove sample keeps user food
await page.goto(BASE + '#/settings'); await page.locator('#rmS').tap(); await page.waitForTimeout(200);
const rs = await db();
ok('remove sample keeps user food entries', rs.nutrition.entries.length >= 1 && rs.nutrition.entries.every(e => !e.sample) && rs.nutrition.entries.some(e => e.name === 'Test Steak'));
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
