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
const todayStr = await (async () => { await page.goto(BASE); return page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }); })();
await page.waitForLoadState('networkidle');
// empty state
await page.goto(BASE + '#/supps'); await page.waitForSelector('#firstSupp');
ok('empty supplements state', true);
await page.goto(BASE);
await page.getByRole('button', { name:/Load sample data/ }).tap();
await page.waitForSelector('#suppCard');
let d = await db();
ok('sample stack loaded', d.supps.items.length === 7 && d.supps.log.length > 100, `${d.supps.items.length} items / ${d.supps.log.length} logs`);
const cardTxt = await page.locator('#suppCard').innerText();
ok('dashboard supplement card X/Y', /\d+\s*\/\s*\d+/.test(cardTxt), cardTxt.replace(/\n/g,' | '));
await page.locator('#suppCard').scrollIntoViewIfNeeded(); await page.waitForTimeout(2600);
await page.screenshot({ path:`${SHOTS}/12-dashboard-supplement-card.png` });
// via nav: Fuel tab -> Supplements switch
await page.locator('.tabbar a[data-tab="food"]').tap();
await page.waitForSelector('.fuelseg');
await page.locator('.fuelseg a', { hasText:'Supplements' }).tap();
await page.waitForSelector('.supp-item');
ok('fuel tab active on supplements', await page.locator('.tabbar a[data-tab="food"].active').count() === 1);
const count = async () => (await page.locator('#suppCount').innerText()).replace(/\s/g,'');
const c0 = await count();
await page.waitForTimeout(500);
await page.screenshot({ path:`${SHOTS}/13-supplement-checklist.png` });
await page.screenshot({ path:`${SHOTS}/13b-supplement-checklist-full.png`, fullPage:true });
// mark taken
const pending = page.locator('.supp-item:not(.done)').first();
const pname = (await pending.locator('b').innerText()).trim();
await pending.tap();
const item = page.locator('.supp-item', { hasText:pname });
ok('mark taken', await item.evaluate(e => e.classList.contains('done')) && (await item.innerText()).includes('Taken'));
const [x0, y0] = c0.split('/').map(Number);
ok('count increments', await count() === `${x0+1}/${y0}`, `${c0} -> ${await count()}`);
d = await db(); const it = d.supps.items.find(i => i.name === pname);
const rec = d.supps.log.find(l => l.itemId === it.id && l.date === todayStr);
ok('taken timestamp recorded', rec && Math.abs(rec.takenAt - Date.now()) < 60000);
// undo via toast
await page.locator('#toast .undo').tap();
ok('undo via toast', !(await item.evaluate(e => e.classList.contains('done'))) && await count() === c0);
// tap again then tap to unmark
await item.tap(); await item.tap();
ok('tap again unmarks', !(await item.evaluate(e => e.classList.contains('done'))));
await item.tap();
// add item with specific weekday (today's weekday) + every-N
await page.locator('#manageStack').tap(); await page.waitForSelector('.slist');
await page.screenshot({ path:`${SHOTS}/14-supplement-stack.png` });
await page.locator('#addSupp').tap(); await page.waitForSelector('.suppform');
await page.locator('.suppform input[placeholder="e.g. Creatine"]').fill('Test Zinc');
await page.locator('.suppform input[placeholder="e.g. 5"]').fill('30');
await page.locator('.suppform select').selectOption('mg');
await page.locator('.suppform').getByRole('radio', { name:'Bedtime' }).tap();
await page.locator('.suppform').getByRole('radio', { name:'Specific days' }).tap();
const dow = new Date().getDay(); const other = (dow + 3) % 7;
await page.locator(`.daychips button[data-d="${other}"]`).tap(); // today's weekday preselected; add another
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('.sheet .panel').scrollTop = 0);
await page.evaluate(() => document.querySelector('#toast').classList.remove('show','act'));
await page.screenshot({ path:`${SHOTS}/15-add-supplement-form.png` });
await page.locator('.suppform [data-save]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
d = await db(); const zinc = d.supps.items.find(i => i.name === 'Test Zinc');
ok('supplement added', zinc && zinc.unit === 'mg' && zinc.time === 'bed' && zinc.schedule.type === 'weekdays' && zinc.schedule.days.includes(dow) && zinc.schedule.days.includes(other), JSON.stringify(zinc));
ok('new item on today checklist', await page.locator('.supp-item', { hasText:'Test Zinc' }).count() === 1);
// edit: switch to every 3 days starting tomorrow => not today
await page.locator('#manageStack').tap(); await page.locator('.srow', { hasText:'Test Zinc' }).tap();
await page.locator('.suppform').getByRole('radio', { name:'Every N days' }).tap();
await page.locator('.suppform').getByRole('button', { name:'Increase' }).tap();
const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-CA'); });
await page.locator('.suppform input[type=date]').fill(tomorrow);
await page.locator('.suppform [data-save]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
d = await db(); const z2 = d.supps.items.find(i => i.name === 'Test Zinc');
ok('supplement edited (every 3 days)', z2.schedule.type === 'interval' && z2.schedule.every === 3 && z2.start === tomorrow);
ok('not scheduled before start', await page.locator('.supp-item', { hasText:'Test Zinc' }).count() === 0);
// archive
await page.locator('#manageStack').tap(); await page.locator('.srow', { hasText:'Fish oil' }).tap();
await page.locator('.suppform [data-arch]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
ok('archive hides from checklist', await page.locator('.supp-item', { hasText:'Fish oil' }).count() === 0 && (await db()).supps.items.find(i => i.name==='Fish oil').archived === true);
// restore
await page.locator('#manageStack').tap(); await page.locator('.srow.arch', { hasText:'Fish oil' }).tap();
await page.locator('.suppform [data-arch]').tap(); await page.waitForSelector('.sheet', { state:'hidden' });
ok('restore', await page.locator('.supp-item', { hasText:'Fish oil' }).count() === 1);
// delete with confirm
await page.locator('#manageStack').tap(); await page.locator('.srow', { hasText:'Test Zinc' }).tap();
await page.locator('.suppform [data-del]').tap(); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(200);
ok('delete', !(await db()).supps.items.some(i => i.name === 'Test Zinc'));
// adherence
const adh = await page.locator('.card', { hasText:'Adherence' }).innerText();
ok('adherence 7/30 shown', /\d+%[\s\S]*Last 7 days[\s\S]*\d+%[\s\S]*Last 30 days/.test(adh) && await page.locator('.adh').count() === 7);
// Saturday-only weekly item label
ok('weekly item label', adh.includes('Sats only'));
// adherence math check in page
const math = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); return d.supps.items.length; });
// previous day backfill
await page.locator('[aria-label="Previous day"]').tap(); await page.waitForSelector('text=Jump to today');
const yItem = page.locator('.supp-item').first(); const wasDone = await yItem.evaluate(e => e.classList.contains('done'));
await yItem.tap();
ok('backfill previous day toggles', (await page.locator('.supp-item').first().evaluate(e => e.classList.contains('done'))) !== wasDone);
// export / clear / import
await page.locator('.tabbar a[data-tab="settings"]').tap();
const before = await db();
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-supps.json'; await dl.saveAs(path);
const ex = JSON.parse(fs.readFileSync(path,'utf8'));
ok('export has supplements', ex.supps.items.length === before.supps.items.length && ex.supps.log.length === before.supps.log.length);
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(200);
const cl = await db();
ok('clear wipes supplements', cl.supps.items.length === 0 && cl.supps.log.length === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(300);
const after = await db();
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const S = x => JSON.stringify(canon({ i:[...x.supps.items].sort((a,b)=>a.id.localeCompare(b.id)), l:[...x.supps.log].sort((a,b)=>a.id.localeCompare(b.id)) }));
if (S(after) !== S(before)) { const A = canon(after.supps.items), B = canon(before.supps.items); console.log('DIFF', JSON.stringify(A.find(e => JSON.stringify(e)!==JSON.stringify(B.find(x=>x.id===e.id))))); }
ok('import round-trips supplements', S(after) === S(before));
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
