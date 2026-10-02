import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const FIX = '/workspace/bjj-tracker/tests/fixtures';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const mk = async () => { const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
  const page = await ctx.newPage(); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); }); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); }); return { ctx, page }; };
let { ctx, page } = await mk();
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
let taps = 0; const tap = async loc => { taps++; await loc.tap(); };
const hideToast = async () => { await page.evaluate(() => document.querySelector('#toast').classList.remove('show','act')); await page.waitForTimeout(450); };

/* 1. first-run setup */
await page.goto(BASE); await page.waitForSelector('#catTiles');
ok('first-run screen shown on empty app', await page.locator('.welcome.setup').count() === 1);
await page.screenshot({ path:`${SHOTS}/00-first-run.png` });
await page.locator('.tile[data-k="weights"]').tap();
await page.locator('.tile[data-k="cardio"]').tap();
ok('first-run has no calorie/protein goal fields', await page.locator('#setupCal, #setupPro, #tgtWrap').count() === 0);
await page.locator('#go').tap(); await page.waitForSelector('.statrow');
let d = await db();
ok('setup saves choices', d.profile.setupDone && d.profile.enabled.weights && d.profile.enabled.cardio && !d.profile.enabled.striking && !d.profile.enabled.supps && !d.profile.targets, JSON.stringify(d.profile.enabled));
ok('no goals set: Home nutrition card links to Profile goals', await page.locator('#nutriCard #setGoalsHome').count() === 1 && !(await page.locator('#nutriCard').innerText()).includes(' / '));
await page.locator('#setGoalsHome').tap(); await page.waitForSelector('#targetsCard'); await page.waitForTimeout(200);
ok('Set your goals opens the Profile goals section', await page.evaluate(() => location.hash) === '#/settings/goals' && await page.evaluate(() => { const r = document.querySelector('#targetsCard').getBoundingClientRect(); return r.top >= 0 && r.top < 400; }));
await page.goto(BASE + '#/food'); await page.waitForSelector('.nutri-top');
ok('no goals set: Food screen shows link instead of progress', await page.locator('.nutri-top #setGoals').count() === 1 && !(await page.locator('.nutri-top').innerText()).includes('left'));
await page.goto(BASE); await page.waitForSelector('.statrow');
ok('hidden section stays hidden (no supplements card)', await page.locator('#suppCard').count() === 0 && await page.locator('#nutriCard').count() === 1);
ok('nav label plain', (await page.locator('.tabbar a[data-tab="food"] span').innerText()) === 'Food');
ok('bottom nav has 5 items', await page.locator('.tabbar a').count() === 5);

/* 2. quick log in <=3 taps from Home */
taps = 0;
await tap(page.locator('.tabbar a.fab'));
await page.waitForSelector('.cats');
ok('log form only shows enabled types', await page.locator('.cats button').count() === 3 && await page.locator('.cats button[data-c="striking"]').count() === 0);
await page.screenshot({ path:`${SHOTS}/02a-quick-log.png` });
await tap(page.locator('.cats button[data-c="weights"]'));
await tap(page.locator('.actions [data-save]'));
await page.waitForSelector('.statrow');
d = await db();
ok('quick log saved in 3 taps from Home', taps === 3 && d.sessions.length === 1 && d.sessions[0].category === 'weights' && d.sessions[0].duration === 60, `taps=${taps}`);
// repeat last: 1 tap from Home
taps = 0;
await tap(page.locator('.quick [data-rep]').first());
d = await db();
ok('repeat last = 1 tap from Home', taps === 1 && d.sessions.length === 2 && d.sessions.every(s => s.category === 'weights'));
await page.locator('#toast .undo').tap(); await page.waitForTimeout(150);
ok('repeat can be undone', (await db()).sessions.length === 1);

/* 3. turn on striking in settings, log striking with details */
await page.locator('.tabbar a[data-tab="settings"]').tap();
await page.locator('.toggle', { has: page.locator('input[data-sec="striking"]') }).tap();
await page.locator('.toggle', { has: page.locator('input[data-sec="grappling"]') }).tap(); // hide grappling
d = await db();
ok('section toggles', d.profile.enabled.striking === true && d.profile.enabled.grappling === false);
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="striking"]').tap();
await page.getByRole('radio', { name:'Muay Thai' }).tap();
await page.locator('details.details summary').tap();
const stepIn = (label, n) => (async () => { for (let i = 0; i < n; i++) await page.locator('.mixgrid .field', { hasText: label }).getByRole('button', { name:'Increase' }).tap(); })();
await stepIn('Pads', 4); await stepIn('Bag', 3); await stepIn('Sparring', 3);
await page.locator('#addSpar').tap();
await page.locator('.spar input').fill('Mo'); await page.locator('.spar textarea').fill('Check the low kick earlier');
await page.locator('[data-hr="avg"]').fill('151'); await page.locator('[data-hr="max"]').fill('182'); await page.locator('[data-hr="cal"]').fill('640');
await page.locator('[data-z="3"]').fill('12');
await page.locator('.field', { hasText:'Total rounds' }).scrollIntoViewIfNeeded(); await hideToast();
await page.evaluate(() => window.scrollTo(0, document.querySelector('details.details').offsetTop - 70));
await page.screenshot({ path:`${SHOTS}/16-striking-log.png` });
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('.statrow');
d = await db(); const st = d.sessions.find(s => s.category === 'striking');
ok('striking saved with breakdown + sparring + HR', st && st.discipline === 'muaythai' && st.strike.mix.pads === 4 && st.strike.mix.sparring === 3 && st.rounds >= 10 && st.strike.spar[0].partner === 'Mo' && st.hr.avg === 151 && st.hr.zones[3] === 12, JSON.stringify(st && { mix:st.strike.mix, rounds:st.rounds, hr:st.hr }));
await page.goto(BASE + '#/session/' + st.id); await page.waitForSelector('.mix');
await page.screenshot({ path:`${SHOTS}/16b-striking-detail.png`, fullPage:true });

/* 4. weights with exercises, autocomplete, PR */
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="weights"]').tap();
await page.locator('details.details summary').tap();
await page.locator('#addEx').tap();
await page.locator('.exname').fill('benc');
await page.locator('.excard .sugg').getByRole('button', { name:'Bench press', exact:true }).tap();
const setIn = (i, f, v) => page.locator('.setrow').nth(i).locator(`input[data-f="${f}"]`).fill(v);
await setIn(0, 'reps', '5'); await setIn(0, 'weight', '185');
await page.locator('[data-addset]').tap(); await setIn(1, 'weight', '195'); await setIn(1, 'rpe', '8.5');
ok('exercise autocomplete + new PR flag', (await page.locator('.excard .exname').inputValue()) === 'Bench press' && (await page.locator('.prnote').textContent()).includes('New PR'));
await page.locator('#addEx').tap(); await page.locator('.exname').nth(1).fill('Pull-up');
await page.locator('.excard').nth(1).locator('input[data-f="reps"]').fill('10');
await hideToast(); await page.evaluate(() => window.scrollTo(0, document.querySelector('details.details').offsetTop - 70));
await hideToast(); await page.screenshot({ path:`${SHOTS}/17-weights-log.png` });
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('.statrow');
d = await db(); const wk = d.sessions.filter(s => s.category === 'weights').find(s => s.exercises?.length);
ok('weights saved: sets x reps x weight, RPE', wk && wk.exercises[0].name === 'Bench press' && wk.exercises[0].sets.length === 2 && wk.exercises[0].sets[1].weight === 195 && wk.exercises[0].sets[1].reps === 5 && wk.exercises[0].sets[1].rpe === 8.5 && wk.exercises[1].sets[0].reps === 10, JSON.stringify(wk?.exercises));
await page.goto(BASE + '#/session/' + wk.id); await page.waitForSelector('.ex-view');
ok('weights detail shows PR + volume', (await page.locator('.ex-view').first().innerText()).includes('PR') && (await page.locator('.card', { hasText:'Exercises' }).innerText()).includes('1,900'));

/* 5. cardio with auto pace */
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="cardio"]').tap();
await page.getByRole('radio', { name:'Run' }).tap();
await page.locator('details.details summary').tap();
await page.locator('.field', { hasText:'Unit' }).getByRole('radio', { name:'km' }).tap();
await page.locator('input[data-k="distance"]').fill('5');
await page.locator('[aria-label="Minutes"]').fill('25'); await page.locator('[aria-label="Seconds"]').fill('00');
ok('auto pace', (await page.locator('.pace').innerText()).includes('5:00 /km'), await page.locator('.pace').innerText());
await hideToast(); await page.evaluate(() => window.scrollTo(0, document.querySelector('.cats').offsetTop - 80));
await page.screenshot({ path:`${SHOTS}/18-cardio-log.png` });
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('.statrow');
d = await db(); const run = d.sessions.find(s => s.category === 'cardio');
ok('cardio saved (distance/time/duration)', run && run.cardio.distance === 5 && run.cardio.unit === 'km' && run.cardio.sec === 1500 && run.duration === 25, JSON.stringify(run?.cardio));

/* 6. workout file imports */
const importInto = async (file, cat) => {
  await page.goto(BASE + '#/log'); await page.waitForSelector('.cats');
  if (cat) await page.locator(`.cats button[data-c="${cat}"]`).tap();
  await page.locator('details.details summary').tap();
  await page.setInputFiles('#wkFile', `${FIX}/${file}`); await page.waitForSelector('text=📎');
};
await importInto('run.gpx', 'weights');
ok('GPX: switches to cardio, fills distance/time/HR', await page.locator('.cats button.on').getAttribute('data-c') === 'cardio' && await (async () => { const v = Number(await page.locator('input[data-k="distance"]').inputValue()); return Math.abs(v - 3.0) < 0.15 || Math.abs(v * 1.609344 - 3.0) < 0.15; })() && await page.locator('[aria-label="Minutes"]').inputValue() === '10' && await page.locator('[data-hr="avg"]').inputValue() === '150' && await page.locator('[data-hr="max"]').inputValue() === '160',
  `${await page.locator('input[data-k="distance"]').inputValue()} (default unit), ${await page.locator('[aria-label="Minutes"]').inputValue()} min, hr ${await page.locator('[data-hr="avg"]').inputValue()}/${await page.locator('[data-hr="max"]').inputValue()}`);
ok('GPX: date + zones prefilled', await page.locator('.field', { hasText:'Date' }).locator('input').inputValue() === '2026-09-28' && (await page.locator('[data-z="2"]').inputValue()) !== '');
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('.statrow');
d = await db(); ok('GPX import saved with source', d.sessions.some(s => s.source === 'run.gpx' && s.date === '2026-09-28' && s.cardio.sec === 600));
await importInto('ride.tcx', 'cardio');
ok('TCX: bike, 2 laps summed (16 km, 40 min, 550 kcal, max 168)', (await page.getByRole('radio', { name:'Bike' }).getAttribute('aria-checked')) === 'true' && await page.locator('[aria-label="Minutes"]').inputValue() === '40' && await page.locator('[data-hr="cal"]').inputValue() === '550' && await page.locator('[data-hr="max"]').inputValue() === '168' && Math.abs(Number(await page.locator('input[data-k="distance"]').inputValue()) - 9.94) < 0.05,
  `${await page.locator('input[data-k="distance"]').inputValue()} ${await page.locator('[aria-label="Minutes"]').inputValue()}min ${await page.locator('[data-hr="cal"]').inputValue()}kcal avg ${await page.locator('[data-hr="avg"]').inputValue()}`);
ok('TCX: weighted avg HR', await page.locator('[data-hr="avg"]').inputValue() === '141');
await importInto('row.fit', 'cardio');
ok('FIT: row, 20 min, 5 km, HR 139/160, 320 kcal', (await page.getByRole('radio', { name:'Row' }).getAttribute('aria-checked')) === 'true' && await page.locator('[aria-label="Minutes"]').inputValue() === '20' && await page.locator('[data-hr="avg"]').inputValue() === '139' && await page.locator('[data-hr="max"]').inputValue() === '160' && await page.locator('[data-hr="cal"]').inputValue() === '320' && Math.abs(Number(await page.locator('input[data-k="distance"]').inputValue()) - 3.11) < 0.03,
  `${await page.locator('input[data-k="distance"]').inputValue()} mi ${await page.locator('[aria-label="Minutes"]').inputValue()}min`);
await importInto('workouts.csv', 'weights');
ok('CSV (form): first row prefills', await page.locator('.cats button.on').getAttribute('data-c') === 'cardio' && await page.locator('[data-hr="avg"]').inputValue() === '152');
// bulk CSV in settings
const before = (await db()).sessions.length;
await page.goto(BASE + '#/settings'); await page.waitForTimeout(150);
ok('leaving a filled-in form asks to discard', await page.locator('.sheet h3', { hasText:'Discard this workout?' }).count() === 1);
await page.locator('.sheet [data-ok]').tap(); await page.waitForSelector('#csvFile', { state:'attached' });
await page.setInputFiles('#csvFile', `${FIX}/workouts.csv`); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(250);
d = await db(); const added = d.sessions.filter(s => s.source === 'CSV import');
ok('CSV bulk import adds 4 workouts', d.sessions.length === before + 4 && added.some(s => s.category === 'striking' && s.discipline === 'muaythai' && s.hr.max === 180) && added.some(s => s.discipline === 'swim' && s.cardio.distance === 1.5 && s.cardio.unit === 'km') && added.some(s => s.date === '2026-09-21'), JSON.stringify(added.map(s => [s.date, s.category, s.discipline])));

/* 7. stats view (dashboard depth) with sample data */
await page.goto(BASE + '#/settings'); await page.locator('#ldS').tap(); await page.waitForTimeout(300);
await page.goto(BASE); await page.waitForSelector('.statrow');
ok('home essentials: week, hours, streak, quick log, nutrition, supps, belt', await page.locator('.statrow .stat').count() === 3 && await page.locator('.quick [data-rep]').count() >= 3 && await page.locator('#nutriCard').count() === 1 && await page.locator('#suppCard').count() === 1 && await page.locator('.beltbar').count() === 1);
await hideToast(); await page.screenshot({ path:`${SHOTS}/01-dashboard.png` });
await page.screenshot({ path:`${SHOTS}/01b-dashboard-full.png`, fullPage:true });
await page.locator('#seeStats').tap(); await page.waitForSelector('#catCard');
ok('stats: hours by category, PRs, cardio distance', await page.locator('#catCard .list-row').count() === 4 && await page.locator('#prCard .list-row').count() >= 3 && /This week/.test(await page.locator('#cardioCard').innerText()));
await hideToast(); await page.screenshot({ path:`${SHOTS}/19-stats.png` });
await page.screenshot({ path:`${SHOTS}/19b-stats-full.png`, fullPage:true });
await page.goto(BASE + '#/history'); await page.waitForSelector('.sess');
await page.locator('.filters button[data-f="cardio"]').tap();
ok('history category filter', (await page.locator('.sess').count()) > 0 && (await page.locator('.sess .t').allInnerTexts()).every(t => /Run|Bike|Row|Swim|Rope|Other/.test(t)));
await page.locator('.filters button[data-f="all"]').tap(); await hideToast();
await page.screenshot({ path:`${SHOTS}/04-history.png` });

/* 8. food quick-add + supplements mark-all */
await page.goto(BASE + '#/food'); await page.waitForSelector('.qfb');
const n0 = (await db()).nutrition.entries.length;
taps = 0; await tap(page.locator('.qfb').first());
ok('food quick-add = 1 tap', (await db()).nutrition.entries.length === n0 + 1 && taps === 1);
await hideToast(); await page.screenshot({ path:`${SHOTS}/09-nutrition-daily.png` });
await page.goto(BASE + '#/supps'); await page.waitForSelector('.supp-item');
const grp = page.locator('.supp-group', { has: page.locator('[data-all]') }).first();
const pendingInGroup = await grp.locator('.supp-item:not(.done)').count();
await grp.locator('[data-all]').tap();
ok('supplements: mark all in a time block (1 tap)', pendingInGroup > 0 && await page.locator('.supp-group .alldone').count() >= 1);
await page.locator('#toast .undo').tap(); await page.waitForTimeout(150);
ok('mark-all undo', await page.locator('[data-all]').count() >= 1);
await hideToast(); await page.screenshot({ path:`${SHOTS}/13-supplement-checklist.png` });

/* 9. export -> clear -> import round trip of multi-discipline data */
await page.goto(BASE + '#/settings'); await page.waitForSelector('#exp');
const b4 = await db();
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-multi.json'; await dl.saveAs(path);
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(200);
ok('clear -> first-run again', (await db()).sessions.length === 0 && await page.locator('.welcome.setup').count() === 1);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await page.waitForTimeout(300);
const af = await db();
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canon(v[k])])) : v;
const S = x => JSON.stringify(canon([...x.sessions].sort((a,b) => a.id.localeCompare(b.id))));
if (S(af) !== S(b4)) { const A = canon(af.sessions), B = canon(b4.sessions); const bad = A.find(e => JSON.stringify(e) !== JSON.stringify(B.find(x => x.id === e.id))); console.log('DIFF', JSON.stringify(bad), JSON.stringify(B.find(x => x.id === bad?.id))); }
ok('export/import round-trips all workout types', S(af) === S(b4) && af.schema === 4 && JSON.stringify(af.weights) === JSON.stringify(b4.weights), `${af.sessions.length}/${b4.sessions.length}`);
await ctx.close();

/* 10. schema v1 -> v2 migration (existing BJJ-only user) */
({ ctx, page } = await mk());
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ sessions:[{ id:'old1', date:'2026-09-01', gi:'nogi', type:'open', duration:90, rounds:6, intensity:4, techniques:['Leg drag'], rolls:[{ id:'r1', partner:'Jake', result:'win', subsLanded:['Armbar'], subsTapped:[], stuck:[] }], weight:200, notes:'old', createdAt:1 }], profile:{ belt:'blue', stripes:1, unit:'lb' }, nutrition:{ entries:[], foods:[] } })); });
await page.reload(); await page.waitForSelector('.statrow, .welcome'); await page.waitForTimeout(200);
const m = await page.evaluate(() => ({ d:JSON.parse(localStorage.getItem('dm.bjj.v1')), b:localStorage.getItem('dm.bjj.v1.backup.v1') }));
ok('v1 data migrates to schema 4 as Grappling/BJJ', m.d.schema === 4 && Array.isArray(m.d.weights) && m.d.sessions[0].category === 'grappling' && m.d.sessions[0].discipline === 'bjj' && m.d.sessions[0].rolls[0].subsLanded[0] === 'Armbar' && m.d.profile.belt === 'blue');
ok('pre-migration backup kept', !!m.b && JSON.parse(m.b).sessions[0].id === 'old1' && !JSON.parse(m.b).schema);
ok('migrated user skips first-run', await page.locator('.welcome.setup').count() === 0 && await page.locator('.statrow').count() === 1);
await page.goto(BASE + '#/session/old1'); await page.waitForSelector('#del');
ok('migrated session renders', (await page.locator('#view').innerText()).includes('Jake'));
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
