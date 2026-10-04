import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [], results = [];
const ok = (name, cond, extra='') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
  userAgent: devices['iPhone 13'].userAgent, acceptDownloads:true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

await page.goto(BASE); await page.waitForLoadState('networkidle');
const swOk = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
ok('service worker registers & activates', swOk);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1') || '{"sessions":[]}'));
const stat = async label => (await page.locator('.stat', { hasText: label }).locator('.v').innerText()).trim();

// sample data
await page.getByRole('button', { name: /Load sample data/ }).tap();
await page.waitForSelector('.statrow');
const n0 = (await db()).sessions.length;
ok('sample data loads', n0 > 20, `(${n0} sessions)`);
ok('home shows essentials only', await page.locator('#nutriCard').count() === 1 && await page.locator('#suppCard').count() === 1 && await page.locator('svg.chart').count() === 0);
await page.locator('#seeStats').tap(); await page.waitForSelector('#catCard');
ok('weekly chart renders (stats)', await page.locator('svg.chart g.wk').count() === 12);
ok('weight chart renders (stats)', await page.locator('svg.chart path.line').count() === 1);
const month0 = Number(await stat('Sessions in'));
await page.goto(BASE); await page.waitForSelector('.statrow');
ok('belt card', /blue belt/i.test(await page.locator('.card', { hasText: /belt/i }).first().innerText()));
await page.waitForTimeout(2700);
await page.screenshot({ path: `${SHOTS}/01-dashboard.png` });
await page.screenshot({ path: `${SHOTS}/01b-dashboard-full.png`, fullPage:true });
const week0 = Number(await stat('Sessions this week'));

// log session
await page.locator('.tabbar a.fab').tap();
await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="grappling"]').tap();

await page.getByRole('radio', { name: 'No-Gi' }).tap();
await page.getByRole('radio', { name: 'Drilling' }).tap();
await page.locator('.field', { hasText: 'Duration' }).getByRole('button', { name: 'Increase' }).tap(); // 60/75 -> +15
await page.locator('.intensity button[data-i="4"]').tap();
const techInput = page.locator('.field', { hasText: 'Techniques drilled' }).locator('.tags input');
await techInput.tap(); await techInput.fill('knee');
const sugg = page.locator('.field', { hasText: 'Techniques drilled' }).locator('.sugg button', { hasText: 'Knee slice pass' });
ok('technique autocomplete suggests', await sugg.count() === 1);
await sugg.tap();
await techInput.fill('Test Technique Zeta'); await techInput.press('Enter');
await page.locator('.field', { hasText: 'Body weight' }).locator('input').fill('201.4');
await page.locator('textarea').fill('Playwright test session');
await page.screenshot({ path: `${SHOTS}/02-log-session-form.png` });
await page.screenshot({ path: `${SHOTS}/02b-log-session-form-full.png`, fullPage:true });

// add roll
await page.locator('#addRoll').tap();
await page.waitForSelector('.sheet .panel');
await page.locator('.sheet input[list="partners"]').fill('Test Partner');
await page.locator('.sheet').getByRole('radio', { name: 'Won' }).tap();
const fld = l => page.locator('.sheet .field', { hasText: l }).locator('.tags input');
await fld('Submissions landed').fill('Omoplata'); await fld('Submissions landed').press('Enter');
await fld('Tapped to').fill('Heel hook'); await fld('Tapped to').press('Enter');
await fld('Got stuck in').fill('Turtle'); await fld('Got stuck in').press('Enter');
await page.screenshot({ path: `${SHOTS}/03-roll-log.png` });
await page.locator('.sheet [data-save]').tap();
ok('roll added to form', await page.locator('#rollList .roll').count() === 1);
// edit roll
await page.locator('#rollList .roll').first().tap();
await page.locator('.sheet input[list="partners"]').fill('Edited Partner');
await page.locator('.sheet [data-save]').tap();
ok('roll edited', (await page.locator('#rollList .roll').innerText()).includes('Edited Partner'));
// add 2nd roll then delete it
await page.locator('#addRoll').tap(); await page.locator('.sheet input[list="partners"]').fill('Temp'); await page.locator('.sheet [data-save]').tap();
await page.locator('#rollList .roll').nth(1).tap(); await page.locator('.sheet [data-del]').tap();
ok('roll deleted', await page.locator('#rollList .roll').count() === 1);
await page.screenshot({ path: `${SHOTS}/03b-form-with-roll.png`, fullPage:true });
await page.locator('.actions [data-save]').tap();
await page.waitForSelector('.statrow');
let d = await db(); const mine = d.sessions.find(s => s.notes === 'Playwright test session');
ok('session saved', !!mine && mine.gi === 'nogi' && mine.type === 'drill' && mine.intensity === 4 && mine.weight === 201.4 && mine.techniques.includes('Test Technique Zeta'), JSON.stringify(mine && {gi:mine.gi,type:mine.type,dur:mine.duration,w:mine.weight}));
ok('roll saved', mine?.rolls.length === 1 && mine.rolls[0].partner === 'Edited Partner' && mine.rolls[0].subsLanded[0] === 'Omoplata' && mine.rolls[0].subsTapped[0] === 'Heel hook' && mine.rolls[0].stuck[0] === 'Turtle');
ok('dashboard week count +1', Number(await stat('Sessions this week')) === week0 + 1, `${week0} -> ${await stat('Sessions this week')}`);
await page.goto(BASE + '#/stats'); await page.waitForSelector('#catCard');
ok('stats month count +1', Number(await stat('Sessions in')) === month0 + 1);
ok('weight trend shows latest weight', (await page.locator('#weightStats').innerText()).includes('201.4'));
await page.goto(BASE); await page.waitForSelector('.statrow');

// autocomplete includes custom tag from history
await page.locator('.tabbar a.fab').tap();

const ti2 = page.locator('.field', { hasText: 'Techniques drilled' }).locator('.tags input');
await ti2.fill('zeta');
ok('previously-used tag autocompletes', await page.locator('.sugg button', { hasText: 'Test Technique Zeta' }).count() === 1);
await page.goto(BASE + '#/history');

// history -> edit
await page.waitForSelector('.sess'); await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}/04-history.png` });
await page.locator(`a.sess[href="#/session/${mine.id}"]`).tap();
await page.waitForSelector('#del');
await page.screenshot({ path: `${SHOTS}/05-session-detail.png`, fullPage:true });
await page.locator('a.btn.primary', { hasText: 'Edit' }).tap();
await page.locator('textarea').fill('Playwright test session EDITED');
await page.locator('.actions [data-save]').tap();
await page.waitForSelector('text=Delete');
d = await db();
ok('session edited', d.sessions.find(s => s.id === mine.id)?.notes === 'Playwright test session EDITED');

// delete with confirm (cancel first)
await page.locator('#del').tap(); await page.locator('.sheet [data-cancel]').tap();
ok('delete cancel keeps session', (await db()).sessions.some(s => s.id === mine.id));
await page.locator('#del').tap(); await page.locator('.sheet [data-ok]').tap();
await page.waitForURL(/#\/history/);
ok('session deleted after confirm', !(await db()).sessions.some(s => s.id === mine.id) && (await db()).sessions.length === n0);

// stats page screenshot
await page.goto(BASE + '#/stats'); await page.waitForSelector('text=Sub ratio'); await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}/06-submissions.png` });

// export / import round trip
await page.goto(BASE + '#/settings'); await page.waitForSelector('#exp');
await page.screenshot({ path: `${SHOTS}/07-settings.png`, fullPage:true });
const before = await db();
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export.json'; await dl.saveAs(path);
const exported = JSON.parse(fs.readFileSync(path, 'utf8'));
ok('export contains all sessions', exported.sessions.length === before.sessions.length);
// clear all
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap();
await page.waitForTimeout(200);
ok('clear all data', (await db()).sessions.length === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path);
await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(300);
const after = await db();
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const norm = x => JSON.stringify(canon([...x.sessions].sort((a,b)=>a.id.localeCompare(b.id))));
if (norm(after) !== norm(before)) { const A = canon(after.sessions), B = canon(before.sessions); const ia = A.findIndex((s,i)=>JSON.stringify(s)!==JSON.stringify(B.find(x=>x.id===s.id))); console.log('DIFF', JSON.stringify(A[ia]), JSON.stringify(B.find(x=>x.id===A[ia].id))); }
ok('import round-trips sessions', norm(after) === norm(before), `${after.sessions.length}/${before.sessions.length}`);
ok('import round-trips profile', JSON.stringify(after.profile) === JSON.stringify(before.profile));

// offline reload via SW
await page.evaluate(() => { location.hash = '#/'; });
await ctx.setOffline(true);
await page.reload(); await page.waitForSelector('.statrow, .welcome', { timeout: 5000 }).catch(()=>{});
ok('app loads offline from SW cache', await page.locator('.statrow').count() === 1);
await ctx.setOffline(false);
const offlineErrs = errors.filter(e => !/ERR_INTERNET_DISCONNECTED/.test(e));
ok('no console errors', offlineErrs.length === 0, JSON.stringify(offlineErrs));
console.log(results.join('\n'));
await browser.close();
