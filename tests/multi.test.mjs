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
ok('step 1: "What do you train?" with Step 1 of 2, no goal fields yet', /What do you train/i.test(await page.locator('.welcome > h2').innerText()) && /Step 1 of 2/.test(await page.locator('#setupStep').innerText()) && await page.locator('#setupT-cal, #setupW, #setupSG-bench').count() === 0);
await page.locator('#go').tap(); await page.waitForSelector('#setupDone');
ok('step 2: "Set your goals" with Step 2 of 2', /Set your goals/i.test(await page.locator('.welcome > h2').innerText()) && /Step 2 of 2/.test(await page.locator('#setupStep').innerText()));
const secs = await page.locator('.goalsec h2').allInnerTexts();
ok('step 2 shows only relevant goals: nutrition (Food on), strength (Weights), no weight goal (off)', await page.locator('#setupT-cal').count() === 1 && await page.locator('#setupWater').count() === 1 && await page.locator('#setupSG-bench').count() === 1 && await page.locator('#setupW').count() === 0, JSON.stringify(secs));
ok('step 2: schedule rows only for chosen disciplines (BJJ, Weights, Cardio) + monthly target + optional comp', await page.locator('.goalsec .schedrow').count() === 3 && await page.locator('#goalForm .stepper').count() === 1 && await page.locator('#setupComp').count() === 1);
ok('protein placeholder hint 0.8–1 g per lb', /0\.8–1 g per lb/.test(await page.locator('#goalForm').innerText()));
ok('step 2 has Done, Skip for now and Back', await page.locator('#setupDone').isVisible() && await page.locator('#skipGoals').isVisible() && await page.locator('#setupBack').isVisible());
await page.screenshot({ path:`${SHOTS}/00c-first-run-goals.png` });
await page.locator('#setupBack').tap(); await page.waitForSelector('#catTiles');
ok('Back returns to step 1 with picks kept', await page.locator('.tile[data-k="weights"].on').count() === 1 && await page.locator('.tile[data-k="cardio"].on').count() === 1);
await page.locator('#go').tap(); await page.waitForSelector('#skipGoals');
await page.locator('#skipGoals').tap(); await page.waitForSelector('.statrow');
let d = await db();
ok('setup saves choices (Skip for now: no goals)', d.profile.setupDone && d.profile.enabled.weights && d.profile.enabled.cardio && !d.profile.enabled.striking && !d.profile.enabled.supps && !d.profile.targets && !d.strength.length, JSON.stringify(d.profile.enabled));
ok('no goals set: Home nutrition card links to Profile goals', await page.locator('#nutriCard #setGoalsHome').count() === 1 && !(await page.locator('#nutriCard').innerText()).includes(' / '));
await page.locator('#setGoalsHome').tap(); await page.waitForSelector('.sheet [data-ok]');
ok('Set your goals asks first: Leave this page? (Cancel / Go to goals)', /Leave this page\?/i.test(await page.locator('.sheet').innerText()) && /You'll go to Profile to set your goals/.test(await page.locator('.sheet').innerText()) && (await page.locator('.sheet [data-ok]').innerText()) === 'Go to goals' && await page.locator('.sheet [data-cancel]').count() === 1);
await page.locator('.sheet [data-cancel]').tap(); await page.waitForTimeout(350);
ok('Cancel stays on the page', (await page.evaluate(() => location.hash)) === '' || (await page.evaluate(() => location.hash)) === '#/');
await page.locator('#setGoalsHome').tap(); await page.waitForSelector('.sheet [data-ok]'); await page.locator('.sheet [data-ok]').tap(); await page.waitForSelector('#targetsCard'); await page.waitForTimeout(250);
ok('Go to goals opens the Profile goals section', await page.evaluate(() => location.hash) === '#/settings/goals' && await page.evaluate(() => { const r = document.querySelector('#targetsCard').getBoundingClientRect(); return r.top >= 0 && r.top < 400; }));
ok('Profile offers a way back (Back to Home)', /Back to Home/.test(await page.locator('#goalsBack').innerText()) && !(await page.locator('#backRow').isHidden()));
await page.locator('#targetsCard [data-target="cal"]').fill('2500'); await page.locator('#targetsCard [data-target="cal"]').blur(); await page.waitForTimeout(200);
await page.locator('#goalsBack').tap(); await page.waitForSelector('.statrow');
ok('after saving, Back returns to the page you came from', (await page.evaluate(() => location.hash)) === '#/' && (await db()).profile.targets.cal === 2500);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); delete d.profile.targets; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }); await page.reload(); await page.waitForSelector('.statrow');
await page.goto(BASE + '#/food'); await page.waitForSelector('.nutri-top');
ok('no goals set: Food screen shows link instead of progress', await page.locator('.nutri-top #setGoals').count() === 1 && !(await page.locator('.nutri-top').innerText()).includes('left'));
await page.locator('.nutri-top #setGoals').tap(); await page.waitForSelector('.sheet [data-ok]');
ok('Food screen: leave confirm, no discard warning when nothing typed', /Leave this page\?/i.test(await page.locator('.sheet').innerText()) && !/discarded/.test(await page.locator('.sheet').innerText()));
await page.locator('.sheet [data-cancel]').tap(); await page.waitForTimeout(350);
await page.locator('[data-add]').first().tap(); await page.waitForSelector('.foodform');
await page.locator('.foodform input[placeholder="e.g. Chicken breast"]').fill('Half-typed food');
await page.evaluate(() => document.querySelector('.nutri-top #setGoals').click()); await page.waitForTimeout(500);
ok('half-filled food entry: confirm warns it will be discarded', /Leave this page\?/i.test(await page.locator('.sheet').innerText()) && /will be discarded/.test(await page.locator('.sheet').innerText()));
await page.locator('.sheet [data-ok]').tap(); await page.waitForSelector('#targetsCard'); await page.waitForTimeout(200);
ok('goes to Profile goals with Back to Food', /Back to Food/.test(await page.locator('#goalsBack').innerText()));
await page.locator('#goalsBack').tap(); await page.waitForSelector('.nutri-top');
ok('Back returns to Food, unsaved food discarded', (await page.evaluate(() => location.hash)) === '#/food' && !(await db()).nutrition.entries.some(e => e.name === 'Half-typed food'));
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
{ const r = await page.evaluate(() => { const b = document.querySelector('.actions [data-save]').getBoundingClientRect(), fab = document.querySelector('.tabbar a.fab').getBoundingClientRect(); return { top:b.top, bottom:b.bottom, fabTop:fab.top }; });
  ok('Save is visible without scrolling (sticky above the nav)', r.top >= 0 && r.bottom <= r.fabTop, JSON.stringify(r)); }
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

const stepIn = (label, n) => (async () => { for (let i = 0; i < n; i++) await page.locator('.mixgrid .field', { hasText: label }).getByRole('button', { name:'Increase' }).tap(); })();
await stepIn('Pads', 4); await stepIn('Bag', 3); await stepIn('Sparring', 3);
await page.locator('#addSpar').tap();
await page.locator('.spar input').fill('Mo'); await page.locator('.spar textarea').fill('Check the low kick earlier');
await page.locator('[data-hr="avg"]').fill('151'); await page.locator('[data-hr="max"]').fill('182'); await page.locator('[data-hr="cal"]').fill('640');
await page.locator('[data-z="3"]').fill('12');
await page.locator('.field', { hasText:'Total rounds' }).scrollIntoViewIfNeeded(); await hideToast();
await page.evaluate(() => window.scrollTo(0, document.querySelector('#detailsSec').offsetTop - 70));
await page.screenshot({ path:`${SHOTS}/16-striking-log.png` });
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('.statrow');
d = await db(); const st = d.sessions.find(s => s.category === 'striking');
ok('striking saved with breakdown + sparring + HR', st && st.discipline === 'muaythai' && st.strike.mix.pads === 4 && st.strike.mix.sparring === 3 && st.rounds >= 10 && st.strike.spar[0].partner === 'Mo' && st.hr.avg === 151 && st.hr.zones[3] === 12, JSON.stringify(st && { mix:st.strike.mix, rounds:st.rounds, hr:st.hr }));
await page.goto(BASE + '#/session/' + st.id); await page.waitForSelector('.mix');
await page.screenshot({ path:`${SHOTS}/16b-striking-detail.png`, fullPage:true });

/* 3b. MMA and Mobility */
await page.goto(BASE + '#/settings'); await page.waitForTimeout(200);
await page.locator('.toggle', { has: page.locator('input[data-sec="mma"]') }).tap();
await page.locator('.toggle', { has: page.locator('input[data-sec="mobility"]') }).tap();
d = await db(); ok('MMA + Mobility toggles', d.profile.enabled.mma === true && d.profile.enabled.mobility === true);
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="mma"]').tap(); await page.waitForTimeout(150);
ok('MMA form: striking + grappling techniques, rounds, MMA round types', await page.locator('.field', { has:page.locator('label', { hasText:/^Striking techniques$/ }) }).count() === 1 && await page.locator('.field', { has:page.locator('label', { hasText:/^Grappling techniques$/ }) }).count() === 1 && JSON.stringify(await page.locator('.mixgrid .field>label').allTextContents()) === JSON.stringify(['Pad work','Drilling','Sparring','Grappling rounds']));
{ const st = page.locator('.field', { has:page.locator('label', { hasText:/^Striking techniques$/ }) }).locator('.tags input'); await st.fill('Jab'); await st.press('Enter');
  const gt = page.locator('.field', { has:page.locator('label', { hasText:/^Grappling techniques$/ }) }).locator('.tags input'); await gt.fill('Double leg'); await gt.press('Enter'); }
for (const [lab, n] of [['Sparring', 3], ['Grappling rounds', 2]]) for (let k = 0; k < n; k++) await page.locator('.mixgrid .field', { has:page.locator('label', { hasText:new RegExp('^' + lab + '$') }) }).getByRole('button', { name:'Increase' }).tap();
await page.locator('textarea').first().fill('Cage work and level changes');
await hideToast(); await page.evaluate(() => window.scrollTo(0, document.querySelector('#detailsSec').offsetTop - 70));
await page.screenshot({ path:`${SHOTS}/33-mma-log.png` });
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('.statrow');
d = await db(); const mm = d.sessions.find(s => s.category === 'mma');
ok('MMA saved: both technique lists, mix, rounds, notes', mm && mm.techniques[0] === 'Jab' && mm.gtech[0] === 'Double leg' && mm.strike.mix.sparring === 3 && mm.strike.mix.grappling === 2 && mm.rounds >= 5 && mm.strike.roundLen === 5 && mm.notes === 'Cage work and level changes', JSON.stringify(mm));
await page.goto(BASE + '#/session/' + mm.id); await page.waitForSelector('.mix');
ok('MMA detail shows round types + grappling techniques', /Grappling rounds/i.test(await page.locator('#view').innerText()) && /Double leg/.test(await page.locator('#view').innerText()));
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="mobility"]').tap(); await page.waitForTimeout(150);
await page.locator('.field', { has:page.locator('label', { hasText:/^Session type$/ }) }).first().getByRole('radio', { name:'Yoga' }).tap();
ok('Mobility quick log: duration 20 + date, focus chips', await page.locator('.focuschips button').count() === 7 && (await page.locator('.field', { has:page.locator('label', { hasText:/^Duration$/ }) }).locator('input').inputValue()) === '20');
await page.locator('.focuschips button[data-f="hips"]').tap(); await page.locator('.focuschips button[data-f="hamstrings"]').tap();
await page.locator('textarea').first().fill('Hip openers after open mat');
await hideToast(); await page.evaluate(() => window.scrollTo(0, document.querySelector('.cats').offsetTop - 70));
await page.screenshot({ path:`${SHOTS}/32-mobility-log.png` });
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('.statrow');
d = await db(); const mo = d.sessions.find(s => s.category === 'mobility');
ok('Mobility saved: type, focus areas, notes', mo && mo.discipline === 'yoga' && JSON.stringify(mo.focus) === '["hips","hamstrings"]' && mo.duration === 20 && mo.notes === 'Hip openers after open mat', JSON.stringify(mo));
ok('quick log offers MMA and Mobility again', await page.locator('.quick [data-rep]').filter({ hasText:'MMA' }).count() === 1 && await page.locator('.quick [data-rep]').filter({ hasText:'Yoga' }).count() === 1);

/* 4. weights with exercises, autocomplete, PR */
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="weights"]').tap();

await page.locator('#addEx').tap();
await page.locator('.exname').fill('benc');
await page.locator('.excard .sugg').getByRole('button', { name:'Bench press', exact:true }).tap();
const setIn = (i, f, v) => page.locator('.setrow').nth(i).locator(`input[data-f="${f}"]`).fill(v);
await setIn(0, 'reps', '5'); await setIn(0, 'weight', '185');
await page.locator('[data-addset]').tap(); await setIn(1, 'weight', '195'); await setIn(1, 'rpe', '8.5');
ok('exercise autocomplete + new PR flag', (await page.locator('.excard .exname').inputValue()) === 'Bench press' && (await page.locator('.prnote').textContent()).includes('New PR'));
await page.locator('#addEx').tap(); await page.locator('.exname').nth(1).fill('Pull-up');
await page.locator('.excard').nth(1).locator('input[data-f="reps"]').fill('10');
await hideToast(); await page.evaluate(() => window.scrollTo(0, document.querySelector('#detailsSec').offsetTop - 70));
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
  
  await page.setInputFiles('#wkFile', `${FIX}/${file}`); await page.waitForSelector(`text=${file}`);
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
ok('home essentials: week, hours, streak, quick log, nutrition, belt, week strip, ring', await page.locator('#weekStrip .wday').count() === 7 && await page.locator('#challenge svg.mring').count() === 1 && await page.locator('.statrow .stat').count() === 3 && await page.locator('.quick [data-rep]').count() >= 3 && await page.locator('#nutriCard').count() === 1 && await page.locator('#suppCard').count() === 0 && await page.locator('#beltCard svg.beltsvg.lg').count() === 1);
await hideToast(); await page.screenshot({ path:`${SHOTS}/01-dashboard.png` });
await page.screenshot({ path:`${SHOTS}/01b-dashboard-full.png`, fullPage:true });
await page.locator('#seeStats').tap(); await page.waitForSelector('#catCard');
ok('stats: hours by category, PRs, cardio distance', await page.locator('#catCard .list-row').count() === 6 && await page.locator('#prCard .list-row').count() >= 3 && /This week/.test(await page.locator('#cardioCard').innerText()));
await hideToast(); await page.screenshot({ path:`${SHOTS}/19-stats.png` });
await page.screenshot({ path:`${SHOTS}/19b-stats-full.png`, fullPage:true });
await page.goto(BASE + '#/history'); await page.waitForSelector('.sess');
await page.locator('.filters button[data-f="cardio"]').tap();
ok('history category filter', (await page.locator('.sess').count()) > 0 && (await page.locator('.sess .t').allInnerTexts()).every(t => /Run|Bike|Row|Swim|Rope|Other/.test(t)));
await page.locator('.filters button[data-f="all"]').tap(); await hideToast();
await page.screenshot({ path:`${SHOTS}/04-history.png` });

/* 8. food quick-add */
await page.goto(BASE + '#/food'); await page.waitForSelector('.qfb');
const n0 = (await db()).nutrition.entries.length;
taps = 0; await tap(page.locator('.qfb').first());
ok('food quick-add = 1 tap', (await db()).nutrition.entries.length === n0 + 1 && taps === 1);
await hideToast(); await page.screenshot({ path:`${SHOTS}/09-nutrition-daily.png` });

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
ok('export/import round-trips all workout types', S(af) === S(b4) && af.schema === 7 && JSON.stringify(af.weights) === JSON.stringify(b4.weights), `${af.sessions.length}/${b4.sessions.length}`);
await ctx.close();

/* 10. schema v1 -> v2 migration (existing BJJ-only user) */
({ ctx, page } = await mk());
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ sessions:[{ id:'old1', date:'2026-09-01', gi:'nogi', type:'open', duration:90, rounds:6, intensity:4, techniques:['Leg drag'], rolls:[{ id:'r1', partner:'Jake', result:'win', subsLanded:['Armbar'], subsTapped:[], stuck:[] }], weight:200, notes:'old', createdAt:1 }], profile:{ belt:'blue', stripes:1, unit:'lb' }, nutrition:{ entries:[], foods:[] } })); });
await page.reload(); await page.waitForSelector('.statrow, .welcome'); await page.waitForTimeout(200);
const m = await page.evaluate(() => ({ d:JSON.parse(localStorage.getItem('dm.bjj.v1')), b:localStorage.getItem('dm.bjj.v1.backup.v1') }));
ok('v1 data migrates to schema 7 as Grappling/BJJ', m.d.schema === 7 && Array.isArray(m.d.weights) && m.d.sessions[0].category === 'grappling' && m.d.sessions[0].discipline === 'bjj' && m.d.sessions[0].rolls[0].subsLanded[0] === 'Armbar' && m.d.profile.belt === 'blue');
ok('pre-migration backup kept', !!m.b && JSON.parse(m.b).sessions[0].id === 'old1' && !JSON.parse(m.b).schema);
ok('migrated user skips first-run', await page.locator('.welcome.setup').count() === 0 && await page.locator('.statrow').count() === 1);
await page.goto(BASE + '#/session/old1'); await page.waitForSelector('#del');
ok('migrated session renders', (await page.locator('#view').innerText()).includes('Jake'));
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
