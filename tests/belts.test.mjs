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

/* ---------- 2. belt + stripe events (3.2.0): separate dated events, backdating, missing stripes, edit/delete ---------- */
const TODAY = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
const YM = (a, b) => page.evaluate(([a, b]) => { const x = window.DM_TEST.diffYMD(a, b); return x.y ? `${x.y} yr${x.y > 1 ? 's' : ''} ${x.m} mo${x.m === 1 ? '' : 's'}` : x.m ? `${x.m} mo${x.m === 1 ? '' : 's'}` : `${x.d} day${x.d === 1 ? '' : 's'}`; }, [a, b]);
await page.locator('#go').tap(); await page.locator('#skipGoals').tap(); await page.waitForSelector('#beltCard');
ok('home belt card prompts to log first belt', (await page.locator('#beltCard').innerText()).includes('Log your belt'));
let taps = 0;
taps++; await page.locator('#beltCard [data-promo]').tap(); await page.waitForSelector('#beltPick');
ok('first promotion: New belt, white, "Belt earned" = today', (await page.locator('#pKind button.on').innerText()) === 'New belt' && await page.locator('#beltPick button.on').getAttribute('data-belt') === 'white' && (await page.locator('#dateLbl').innerText()).toLowerCase() === 'belt earned' && await page.locator('#pDate').inputValue() === TODAY && await page.locator('#stripeF').isHidden());
taps++; await page.locator('#pSave').tap(); await settle();
let d = await db();
ok('log a belt in 2 taps (stored as a belt event, 0 stripes)', taps === 2 && d.belts.length === 1 && d.belts[0].belt === 'white' && d.belts[0].kind === 'belt' && d.belts[0].stripes === 0, `taps=${taps}`);
await page.goto(BASE + '#/belts'); await page.waitForSelector('.tl-item');
await page.locator('.tl-item').first().tap(); await page.waitForSelector('#pDel');
await page.locator('#beltPick [data-belt="blue"]').tap(); await page.locator('#pDate').fill('2025-03-04'); await page.locator('#pSave').tap(); await settle();
const logEv = async (kind, belt, n, date, extra={}) => { await page.locator('[data-promo]').first().tap(); await page.waitForSelector('#beltPick');
  await page.locator('#pKind button', { hasText: kind === 'belt' ? 'New belt' : /Stripe|Degree/ }).tap(); await page.locator(`#beltPick [data-belt="${belt}"]`).tap();
  if (kind === 'belt') { if (await page.locator('#pKind button.on').innerText() !== 'New belt') await page.locator('#pKind button', { hasText:'New belt' }).tap(); }
  else { if (!(await page.locator('#pKind button.on').innerText()).match(/Stripe|Degree/)) await page.locator('#pKind button').nth(1).tap(); await page.locator('#pStripe button', { hasText:new RegExp(`^${n}$`) }).tap(); }
  await page.locator('#pDate').fill(date);
  if (extra.inst) { await page.locator('.sheet details summary').tap(); await page.locator('#pInst').fill(extra.inst); }
  await page.locator('#pSave').tap(); await settle(); };
await logEv('belt', 'white', 0, '2023-01-10');
await logEv('stripe', 'white', 2, '2024-06-01', { inst:'Prof. Ana Silva' });
d = await db();
ok('stripe saved as its own dated event with "Stripe earned" date', d.belts.some(e => e.kind === 'stripe' && e.belt === 'white' && e.stripes === 2 && e.date === '2024-06-01'));
ok('profile rank: latest belt earned (blue 2025-03-04), 0 stripes', d.profile.belt === 'blue' && d.profile.stripes === 0 && d.profile.promotedOn === '2025-03-04' && d.belts.length === 3);
ok('timeline offers to add the missing stripe 1 date at white', (await page.locator('.tl-group[data-belt="white"] [data-addstripe]').innerText()).includes('Add missing stripe 1 date'));
await page.locator('.tl-group[data-belt="white"] [data-addstripe]').tap(); await page.waitForSelector('#pStripe');
ok('missing-stripe shortcut pre-fills Stripe 1 at white belt', (await page.locator('#pStripe button.on').innerText()) === '1' && await page.locator('#beltPick button.on').getAttribute('data-belt') === 'white' && (await page.locator('#dateLbl').innerText()).toLowerCase() === 'stripe earned');
await page.locator('#pDate').fill('2023-09-15'); await page.locator('#pSave').tap(); await settle();
const groups = await page.locator('.tl-group').evaluateAll(gs => gs.map(g => ({ belt:g.dataset.belt, cur:g.classList.contains('current'), items:[...g.querySelectorAll('.tl-item .grow > b')].map(b => b.textContent), dates:[...g.querySelectorAll('.tl-item .grow > small:first-of-type')].map(x => x.textContent.split(' · ')[0]) })));
ok('timeline lists each belt and stripe with its date, newest first', groups.length === 2 && groups[0].belt === 'blue' && groups[0].cur && JSON.stringify(groups[1].items) === JSON.stringify(['Stripe 2 earned','Stripe 1 earned','White belt earned']) && JSON.stringify(groups[1].dates) === JSON.stringify(['Jun 1, 2024','Sep 15, 2023','Jan 10, 2023']), JSON.stringify(groups));
ok('instructor shown on entry', (await page.locator('.tl-group[data-belt="white"]').innerText()).includes('Prof. Ana Silva'));
// next suggestion at blue is Stripe 1
await page.locator('[data-promo]').first().tap(); await page.waitForSelector('#beltPick');
ok('Log promotion suggests the next stripe (Stripe 1 at blue)', (await page.locator('#pKind button.on').innerText()) === 'Stripe' && await page.locator('#beltPick button.on').getAttribute('data-belt') === 'blue' && (await page.locator('#pStripe button.on').innerText()) === '1');
await page.locator('#pDate').fill('2025-10-01'); await page.locator('#pSave').tap(); await settle();
await page.goto(BASE); await page.waitForSelector('#beltCard');
const atBelt = await YM('2025-03-04', TODAY), sinceStripe = await YM('2025-10-01', TODAY);
ok('belt card: current belt + stripes', (await page.locator('#beltCard h2').innerText()).toLowerCase().includes('blue belt · 1 stripe') && (await page.locator('#beltCard .beltsvg').getAttribute('data-stripes')) === '1');
ok('belt card: "Time at belt" from the belt earned date', (await page.locator('#beltCard [data-b="rank"]').innerText()) === atBelt && /Time at belt/.test(await page.locator('#beltCard').innerText()), `${await page.locator('#beltCard [data-b="rank"]').innerText()} vs ${atBelt}`);
ok('belt card: "Time since last stripe" from the latest stripe date', (await page.locator('#beltCard [data-b="since"]').innerText()) === sinceStripe && (await page.locator('#beltCard [data-b="beltdate"]').innerText()) === 'Mar 4, 2025' && (await page.locator('#beltCard [data-b="stripedate"]').innerText()) === 'Oct 1, 2025');
// promoting to a new belt resets stripes
await page.goto(BASE + '#/belts'); await page.waitForSelector('.tl-item');
await logEv('belt', 'purple', 0, TODAY);
d = await db(); ok('new belt resets stripes to 0', d.profile.belt === 'purple' && d.profile.stripes === 0 && (await page.locator('.tl-group.current .tl-item').count()) === 1);
ok('Belts page shows the summary card too', /Time at belt/.test(await page.locator('#beltCard').innerText()) && (await page.locator('#beltCard [data-b="since"]').innerText()) === 'no stripes yet');
await page.locator('#toast .undo').tap(); await settle();
ok('undo removes the purple belt', (await db()).profile.belt === 'blue' && (await db()).profile.stripes === 1);
// duplicate stripe refused
await logEv('stripe', 'white', 2, '2024-07-01');
ok('a duplicate stripe is refused (edit the existing one instead)', (await db()).belts.filter(e => e.kind === 'stripe' && e.belt === 'white' && e.stripes === 2).length === 1);
if (await page.locator('.sheet [data-close]').count()) { await page.locator('.sheet [data-close]').tap(); await settle(); }
// edit a stripe date, delete + undo
await page.locator('.tl-group[data-belt="white"] .tl-item[data-kind="stripe"]').first().tap(); await page.waitForSelector('#pDel');
ok('editing a stripe shows "Edit stripe" with its date', /Edit stripe/i.test(await page.locator('.sheet h3').innerText()) && await page.locator('#pDate').inputValue() === '2024-06-01');
await page.locator('#pDate').fill('2024-05-20'); await page.locator('#pSave').tap(); await settle();
ok('stripe date edited (backdated)', (await db()).belts.some(e => e.kind === 'stripe' && e.stripes === 2 && e.date === '2024-05-20'));
await page.locator('#toast .undo').tap(); await settle();
ok('edit undo restores the date', (await db()).belts.some(e => e.kind === 'stripe' && e.stripes === 2 && e.date === '2024-06-01'));
await page.locator('.tl-group[data-belt="white"] .tl-item[data-kind="stripe"]').first().tap(); await page.waitForSelector('#pDel');
await page.locator('#pDel').tap(); await settle();
ok('delete a stripe', (await db()).belts.length === 4);
await page.locator('#toast .undo').tap(); await settle();
ok('delete undo restores', (await db()).belts.length === 5 && await page.locator('.tl-item').count() === 5);
await page.locator('[data-promo]').first().tap(); await page.waitForSelector('#pDate');
await page.locator('#pDate').fill('2099-01-01'); await page.locator('#pSave').tap(); await settle();
ok('cannot log a future date', (await db()).belts.length === 5 && await page.locator('#pDate').count() === 1);
await page.locator('#beltPick [data-belt="black"]').tap(); await page.locator('#pKind button').nth(1).tap();
ok('black belt uses degrees 1–6', (await page.locator('#pKind button').nth(1).innerText()) === 'Degree' && await page.locator('#pStripe button').count() === 6);
await page.locator('#kidsT').tap();
ok('kids belts available on request', await page.locator('#beltPick [data-belt="grey"]').count() === 1 && await page.locator('#beltPick [data-belt="green"]').count() === 1);
await page.locator('.sheet [data-close]').tap(); await settle();
await hideToast(); await page.evaluate(() => window.scrollTo(0, 0)); await settle(200);
await page.screenshot({ path:`${SHOTS}/58-belt-stripes.png` });
await page.goto(BASE); await page.waitForSelector('#beltCard');
ok('full reload keeps events and profile', (await db()).belts.length === 5 && await page.locator('.welcome.setup').count() === 0 && await page.evaluate(() => !localStorage.getItem('dm.bjj.v1.unreadable')));
await page.locator('#beltCard .belt').tap(); await settle();
ok('tapping the belt card opens the Belts timeline', await page.evaluate(() => location.hash) === '#/belts' && await page.locator('.histseg a.on').innerText() === 'Belts');
await page.locator('.histseg a', { hasText:'Workouts' }).tap(); await settle();
ok('History segment switches back to workouts', await page.evaluate(() => location.hash) === '#/history');
// migration of snapshot entries: stripe count changed under the same belt = stripe event
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.belts = [{ id:'o1', date:'2021-01-05', belt:'white', stripes:0 }, { id:'o2', date:'2021-06-01', belt:'white', stripes:1 }, { id:'o3', date:'2022-02-01', belt:'white', stripes:3 }, { id:'o4', date:'2022-09-01', belt:'blue', stripes:0 }, { id:'o5', date:'2023-05-01', belt:'blue', stripes:2 }]; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.evaluate(() => { location.hash = "#/belts"; }); await page.reload(); await page.waitForSelector('.tl-group'); await settle(200);
const mk7 = await page.evaluate(() => window.DM_TEST.db.belts.map(e => [e.id, e.kind, e.stripes]));
ok('migration: same belt + stripe count changed → stripe events; belt changes → belt events', JSON.stringify(mk7) === JSON.stringify([['o1','belt',0],['o2','stripe',1],['o3','stripe',3],['o4','belt',0],['o5','stripe',2]]), JSON.stringify(mk7));
ok('migrated rank: blue 2 stripes, time at belt from 2022-09-01', (await page.evaluate(() => JSON.stringify([window.DM_TEST.db.profile.belt, window.DM_TEST.db.profile.stripes]))) === '["blue",2]' && (await page.locator('#beltCard [data-b="beltdate"]').innerText()) === 'Sep 1, 2022');
ok('migrated white belt shows the missing stripe 2', (await page.locator('.tl-group[data-belt="white"] [data-addstripe]').innerText()).includes('missing stripe 2'));

// export -> clear -> import
await page.goto(BASE + '#/settings'); await page.waitForSelector('#exp');
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-belts.json'; await dl.saveAs(path);
const b4 = (await db()).belts;
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(400);
ok('clear data removes promotions', (await db()).belts.length === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db();
ok('export/import round-trips belt + stripe events', JSON.stringify(d.belts.map(e => [e.id,e.date,e.belt,e.kind,e.stripes,e.notes])) === JSON.stringify(b4.map(e => [e.id,e.date,e.belt,e.kind,e.stripes,e.notes])) && d.profile.belt === 'blue' && d.belts.every(e => e.kind));
await ctx.close();

/* ---------- 3. migration v3 -> v4 ---------- */
({ ctx, page } = await mk());
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:3, sessions:[{ id:'a', date:'2025-06-01', category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:90, rounds:5, intensity:3, techniques:[], rolls:[], weight:'', notes:'', createdAt:1 }],
  profile:{ belt:'purple', stripes:3, promotedOn:'2025-05-01', unit:'lb', setupDone:true, enabled:{ grappling:true, food:false, supps:false } }, nutrition:{ entries:[], foods:[] }, supps:{ items:[], log:[] }, weights:[] })); });
await page.reload(); await page.waitForSelector('#beltCard'); await settle(200);
let mg = await page.evaluate(() => ({ d:JSON.parse(localStorage.getItem('dm.bjj.v1')), b:localStorage.getItem('dm.bjj.v1.backup.v3') }));
ok('v3 → v4: old belt setting becomes a belt event + 3 stripe events (dates flagged to set)', mg.d.schema === 7 && mg.d.belts.length === 4 && mg.d.belts[0].belt === 'purple' && mg.d.belts[0].kind === 'belt' && mg.d.belts[0].date === '2025-05-01' && mg.d.belts.filter(e => e.kind === 'stripe' && e.approx).length === 3 && mg.d.sessions.length === 1, JSON.stringify(mg.d.belts));
ok('v3 → v4: backup kept', !!mg.b && JSON.parse(mg.b).schema === 3 && JSON.parse(mg.b).profile.belt === 'purple');
ok('migrated rank shows on Home with mat time since promotion', (await page.locator('#beltCard').textContent()).includes('Purple belt · 3 stripes') && (await page.locator('#beltCard').textContent()).replace(/\s+/g,' ').includes('1 session · 1.5 h'));
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:3, sessions:[], profile:{ belt:'blue', stripes:1, promotedOn:'', setupDone:true }, nutrition:{ entries:[], foods:[] }, supps:{ items:[], log:[] }, weights:[] })); });
await page.reload(); await settle(300);
mg = await page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
ok('belt without a date migrates flagged "date unknown"', mg.belts.length === 2 && mg.belts[0].belt === 'blue' && mg.belts[0].kind === 'belt' && mg.belts[0].notes.startsWith('Date unknown'));
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:3, sessions:[], profile:{ belt:'white', stripes:0, promotedOn:'', setupDone:true }, nutrition:{ entries:[], foods:[] }, supps:{ items:[], log:[] }, weights:[] })); });
await page.reload(); await settle(300);
ok('untouched default (white, no date) creates no fake entry', (await page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')))).belts.length === 0);
await ctx.close();

/* ---------- 4. sample data + screenshots ---------- */
({ ctx, page } = await mk());
await page.goto(BASE); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await page.waitForSelector('#beltCard'); await hideToast();
d = await db();
ok('sample: white → blue 1 stripe over ~3 years', d.belts.length === 7 && d.profile.belt === 'blue' && d.profile.stripes === 1 && d.belts.every(b => b.sample) && d.belts.filter(b => b.kind === 'belt').length === 2);
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
