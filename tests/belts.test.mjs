import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { const l = `${c?'PASS':'FAIL'} ${n} ${x}`; results.push(l); if (!process.env.QUIET) console.error(l); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const mk = async () => { const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
  const page = await ctx.newPage(); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); }); page.on('pageerror', e => errors.push('pageerror: '+e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); }); return { ctx, page }; };
let { ctx, page } = await mk();
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const settle = (ms=300) => page.waitForTimeout(ms);
const hideToast = async () => { await page.evaluate(() => document.querySelector('#toast').classList.remove('show','act')); await page.waitForTimeout(450); };

/* ---------- 1. duration math ---------- */
await page.goto(BASE); await page.waitForSelector('#catTiles');
const D = (a, b) => page.evaluate(([a, b]) => { const x = window.DM_TEST.diffYMD(a, b); return `${x.y}y${x.m}m${x.d}d|${window.DM_TEST.fmtSpan(x)}`; }, [a, b]);
const cases = [
  ['2024-01-31','2024-02-29','0y1m0d|1 mo','month end clamps (leap Feb)'],
  ['2024-01-31','2024-03-01','0y1m1d|1 mo 1 d','past a short month (leap year)'],
  ['2023-01-31','2023-03-01','0y1m1d|1 mo 1 d','past a short month (non-leap)'],
  ['2023-12-15','2024-01-14','0y0m30d|30 d','across a year boundary, under a month'],
  ['2023-12-15','2024-01-15','0y1m0d|1 mo','across a year boundary, exactly a month'],
  ['2021-06-10','2023-09-05','2y2m26d|2 yr 2 mo','multi-year shows yr + mo'],
  ['2024-02-29','2025-02-28','1y0m0d|1 yr','leap day anniversary'],
  ['2025-03-30','2025-03-30','0y0m0d|0 d','same day'],
  ['2025-11-02','2026-03-08','0y4m6d|4 mo 6 d','spans DST changes'],
];
for (const [a, b, want, name] of cases) { const got = await D(a, b); ok(`duration: ${name}`, got === want, `${a}→${b} = ${got}`); }

/* ---------- 2. logging flow (fresh user), out-of-order backfill ---------- */
await page.locator('#go').tap(); await page.waitForSelector('#beltCard');
ok('home belt card prompts to log first belt', (await page.locator('#beltCard').innerText()).includes('Log your belt'));
let taps = 0;
taps++; await page.locator('#beltCard [data-promo]').tap(); await page.waitForSelector('#beltPick');
ok('first promotion defaults to white, 0 stripes, today', await page.locator('#beltPick button.on').getAttribute('data-belt') === 'white' && await page.locator('#stripeF .seg button.on').innerText() === '0' && await page.locator('#pDate').inputValue() === await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }));
taps++; await page.locator('#pSave').tap(); await settle();
let d = await db();
ok('log promotion in 2 taps', taps === 2 && d.belts.length === 1 && d.belts[0].belt === 'white', `taps=${taps}`);
// change today's entry into blue 2025-03-04 via edit
await page.goto(BASE + '#/belts'); await page.waitForSelector('.tl-item');
await page.locator('.tl-item').first().tap(); await page.waitForSelector('#pDel');
await page.locator('#beltPick [data-belt="blue"]').tap(); await page.locator('#pDate').fill('2025-03-04'); await page.locator('#pSave').tap(); await settle();
// backfill: white 0 (2023-01-10), then white 2 stripes (2024-06-01) — added after a later belt
const logPromo = async (belt, stripes, date, extra={}) => { await page.locator('[data-promo]').first().tap(); await page.waitForSelector('#beltPick');
  await page.locator(`#beltPick [data-belt="${belt}"]`).tap(); await page.locator('#stripeF .seg button', { hasText:new RegExp(`^${stripes}$`) }).tap(); await page.locator('#pDate').fill(date);
  if (extra.inst) { await page.locator('.sheet details summary').tap(); await page.locator('#pInst').fill(extra.inst); }
  await page.locator('#pSave').tap(); await settle(); };
await logPromo('white', 0, '2023-01-10');
await logPromo('white', 2, '2024-06-01', { inst:'Prof. Ana Silva' });
d = await db();
ok('profile rank derived from latest-dated entry (not latest logged)', d.profile.belt === 'blue' && d.profile.stripes === 0 && d.profile.promotedOn === '2025-03-04' && d.belts.length === 3);
const groups = await page.locator('.tl-group').evaluateAll(gs => gs.map(g => ({ belt:g.dataset.belt, span:g.querySelector('[data-span]').textContent, cur:g.classList.contains('current'), items:[...g.querySelectorAll('.tl-item .grow > b')].map(b => b.textContent), took:[...g.querySelectorAll('.tl-took')].map(t => t.textContent.trim()) })));
const blueSoFar = await page.evaluate(() => { const t = new Date(); const iso = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; return window.DM_TEST.fmtSpan(window.DM_TEST.diffYMD('2025-03-04', iso)); });
ok('timeline newest first, grouped by belt', groups.length === 2 && groups[0].belt === 'blue' && groups[0].cur && groups[1].belt === 'white', JSON.stringify(groups.map(g => g.belt)));
ok('current belt shows "so far" up to today', groups[0].span === blueSoFar && (await page.locator('.tl-group.current .tl-dur small').innerText()) === 'so far', `${groups[0].span} vs ${blueSoFar}`);
ok('past belt total time (2023-01-10 → 2025-03-04 = 2 yr 1 mo)', groups[1].span === '2 yr 1 mo', groups[1].span);
ok('stripes listed newest first with time since previous', JSON.stringify(groups[1].items) === JSON.stringify(['2 stripes','Promoted to white belt']) && groups[1].took[0].startsWith('1 yr 4 mo') && groups[1].took[1] === 'start', JSON.stringify(groups[1]));
ok('belt promotion shows time since previous stripe (9 mo 3 d)', groups[0].took[0].startsWith('9 mo 3 d'), groups[0].took[0]);
ok('instructor shown on entry', (await page.locator('.tl-group[data-belt="white"]').innerText()).includes('Prof. Ana Silva'));

// edit + undo, delete + undo
await page.locator('.tl-group[data-belt="white"] .tl-item').first().tap(); await page.waitForSelector('#pDel');
await page.locator('#stripeF .seg button', { hasText:/^3$/ }).tap(); await page.locator('#pSave').tap(); await settle();
ok('edit entry', (await db()).belts.some(b => b.belt === 'white' && b.stripes === 3));
await page.locator('#toast .undo').tap(); await settle();
ok('edit undo restores', (await db()).belts.some(b => b.belt === 'white' && b.stripes === 2) && !(await db()).belts.some(b => b.stripes === 3));
await page.locator('.tl-group[data-belt="white"] .tl-item').first().tap(); await page.waitForSelector('#pDel');
await page.locator('#pDel').tap(); await settle();
ok('delete entry', (await db()).belts.length === 2);
await page.locator('#toast .undo').tap(); await settle();
ok('delete undo restores', (await db()).belts.length === 3 && await page.locator('.tl-item').count() === 3);
await page.locator('[data-promo]').first().tap(); await page.waitForSelector('#pDate');
await page.locator('#pDate').fill('2099-01-01'); await page.locator('#pSave').tap(); await settle();
ok('cannot log a future date', (await db()).belts.length === 3 && await page.locator('#pDate').count() === 1);
await page.locator('.sheet [data-close]').tap(); await settle();

// home card: rank + since last stripe, tap opens timeline
await page.goto(BASE); await page.waitForSelector('#beltCard');
ok('full reload keeps promotions and profile (data loads safely)', (await db()).belts.length === 3 && await page.locator('.welcome.setup').count() === 0 && await page.evaluate(() => !localStorage.getItem('dm.bjj.v1.unreadable')));
const bc = await page.locator('#beltCard').textContent();
ok('home card: belt, time at rank, no stripe yet', bc.includes('Blue belt') && (await page.locator('#beltCard [data-b="rank"]').innerText()) === blueSoFar && bc.includes('none yet'));
await page.locator('#beltCard .belt').tap(); await settle();
ok('tapping the belt card opens the Belts timeline', await page.evaluate(() => location.hash) === '#/belts' && await page.locator('.histseg a.on').innerText() === 'Belts');
await page.locator('.histseg a', { hasText:'Workouts' }).tap(); await settle();
ok('History segment switches back to workouts', await page.evaluate(() => location.hash) === '#/history');
// next-rank default: blue 0 -> suggests blue 1
await page.goto(BASE + '#/settings'); await page.waitForSelector('#rankCard');
await page.locator('#rankCard [data-promo]').tap(); await page.waitForSelector('#beltPick');
ok('Profile: Log promotion suggests next stripe (blue, 1)', await page.locator('#beltPick button.on').getAttribute('data-belt') === 'blue' && await page.locator('#stripeF .seg button.on').innerText() === '1');
await page.locator('#beltPick [data-belt="black"]').tap();
ok('black belt uses degrees 0–6', (await page.locator('#stripeF label').innerText()).toLowerCase() === 'degree' && await page.locator('#stripeF .seg button').count() === 7);
await page.locator('#kidsT').tap();
ok('kids belts available on request', await page.locator('#beltPick [data-belt="grey"]').count() === 1 && await page.locator('#beltPick [data-belt="green"]').count() === 1);
await page.locator('.sheet [data-close]').tap(); await settle();

// export -> clear -> import
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-belts.json'; await dl.saveAs(path);
const b4 = (await db()).belts;
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(400);
ok('clear data removes promotions', (await db()).belts.length === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db();
ok('export/import round-trips promotions', JSON.stringify(d.belts) === JSON.stringify(b4) && d.profile.belt === 'blue' && d.schema === 5);
await ctx.close();

/* ---------- 3. migration v3 -> v4 ---------- */
({ ctx, page } = await mk());
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:3, sessions:[{ id:'a', date:'2025-06-01', category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:90, rounds:5, intensity:3, techniques:[], rolls:[], weight:'', notes:'', createdAt:1 }],
  profile:{ belt:'purple', stripes:3, promotedOn:'2025-05-01', unit:'lb', setupDone:true, enabled:{ grappling:true, food:false, supps:false } }, nutrition:{ entries:[], foods:[] }, supps:{ items:[], log:[] }, weights:[] })); });
await page.reload(); await page.waitForSelector('#beltCard'); await settle(200);
let mg = await page.evaluate(() => ({ d:JSON.parse(localStorage.getItem('dm.bjj.v1')), b:localStorage.getItem('dm.bjj.v1.backup.v3') }));
ok('v3 → v4: old belt setting becomes first history entry', mg.d.schema === 5 && mg.d.belts.length === 1 && mg.d.belts[0].belt === 'purple' && mg.d.belts[0].stripes === 3 && mg.d.belts[0].date === '2025-05-01' && mg.d.sessions.length === 1);
ok('v3 → v4: backup kept', !!mg.b && JSON.parse(mg.b).schema === 3 && JSON.parse(mg.b).profile.belt === 'purple');
ok('migrated rank shows on Home with mat time since promotion', (await page.locator('#beltCard').textContent()).includes('Purple belt · 3 stripes') && (await page.locator('#beltCard').textContent()).replace(/\s+/g,' ').includes('1 session · 1.5 h'));
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:3, sessions:[], profile:{ belt:'blue', stripes:1, promotedOn:'', setupDone:true }, nutrition:{ entries:[], foods:[] }, supps:{ items:[], log:[] }, weights:[] })); });
await page.reload(); await settle(300);
mg = await page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
ok('belt without a date migrates flagged "date unknown"', mg.belts.length === 1 && mg.belts[0].belt === 'blue' && mg.belts[0].notes.startsWith('Date unknown'));
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:3, sessions:[], profile:{ belt:'white', stripes:0, promotedOn:'', setupDone:true }, nutrition:{ entries:[], foods:[] }, supps:{ items:[], log:[] }, weights:[] })); });
await page.reload(); await settle(300);
ok('untouched default (white, no date) creates no fake entry', (await page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')))).belts.length === 0);
await ctx.close();

/* ---------- 4. sample data + screenshots ---------- */
({ ctx, page } = await mk());
await page.goto(BASE); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await page.waitForSelector('#beltCard'); await hideToast();
d = await db();
ok('sample: white → blue 1 stripe over ~3 years', d.belts.length === 7 && d.profile.belt === 'blue' && d.profile.stripes === 1 && d.belts.every(b => b.sample));
await page.goto(BASE + '#/belts'); await page.waitForSelector('.tl-group'); await hideToast();
ok('sample timeline: 2 belts, mat time logged for current belt', await page.locator('.tl-group').count() === 2 && (await page.locator('.tl-group.current .tl-meta').innerText()).includes('sessions'));
await page.screenshot({ path:`${SHOTS}/24-belt-timeline.png` });
await page.locator('[data-promo]').first().tap(); await page.waitForSelector('#beltPick'); await settle(400);
await page.screenshot({ path:`${SHOTS}/25-log-promotion.png` });
await page.locator('.sheet [data-close]').tap(); await settle();
await page.goto(BASE + '#/settings'); await page.waitForSelector('#rmS'); await page.locator('#rmS').tap(); await settle(400);
ok('remove sample removes sample promotions', (await db()).belts.length === 0);

ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
