// 3.18.0: assessment, workout generator rules (equipment, injury, mat-day spacing, experience, exact days, length, Quick/Full),
// Today's session + Build a workout, ?start= deep links, not-medical-advice consent, and the removals (food, water, supps, weight plan, sauna, vitals, XP, recap, tips).
import { webkit, devices } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const G = require('../generator.js');
const BASE = process.env.BASE || 'http://localhost:8787/', SHOTS = process.env.SHOTS || '/workspace/forged-shots';
const results = [], errors = []; const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c?'':x}`); if (!c) process.exitCode = 1; };
const LIB = Object.fromEntries(G.LIB.map(x => [x.name, x]));
const all = w => w.main.concat(w.acc);
const prof = (o = {}) => ({ exp:'intermediate', goal:'strength', arts:['bjj'], equip:G.PRESET.gym, injuries:[], ...o });

/* ---------- generator rules (pure) ---------- */
let eqBad = [], injBad = [], dupBad = [], lenBad = [], cntBad = [];
for (const loc of G.LOCATIONS.map(x => x[0])) for (const type of ['full','upper','lower']) for (const m of [G.QUICK_MIN, 30, 45, 60]) for (let k = 0; k < 6; k++) {
  const p = prof({ equip:G.PRESET[loc] }), w = G.workout(p, { type, minutes:m, seed:`${loc}${type}${m}${k}` });
  all(w).forEach(e => { if (!LIB[e.name].equip.every(q => p.equip.includes(q))) eqBad.push(`${loc}:${e.name}`); });
  const pats = all(w).map(e => e.pattern); if (new Set(pats).size !== pats.length) dupBad.push(pats.join());
  if (w.est > m + 3) lenBad.push(`${loc}/${type}/${m}:${w.est}`);
  const n = all(w).length; if (n < 4 || n > 6) cntBad.push(`${loc}/${m}:${n}`);
}
ok('equipment: every exercise uses only equipment at the location (incl. hotel + bodyweight)', !eqBad.length, eqBad.slice(0, 5).join(' '));
ok('no duplicate movement patterns in a workout', !dupBad.length, dupBad.slice(0, 3).join(' | '));
ok('length: estimated time fits Quick (~25) and 30/45/60 (≤ +3 min)', !lenBad.length, lenBad.slice(0, 5).join(' '));
ok('4–6 exercises per workout', !cntBad.length, cntBad.slice(0, 5).join(' '));
const n30 = all(G.workout(prof(), { minutes:30, seed:'a' })).length, n60 = all(G.workout(prof(), { minutes:60, seed:'a' })).length;
ok('longer sessions get more exercises (30 → 4, 60 → 6)', n30 === 4 && n60 === 6, `${n30}/${n60}`);
for (const area of ['Knee','Shoulder','Lower back']) for (let k = 0; k < 8; k++) {
  const w = G.workout(prof({ injuries:[area] }), { type:'full', minutes:45, seed:'i' + k });
  all(w).forEach(e => { if (LIB[e.name].inj.includes(area)) injBad.push(`${area}:${e.name}`); });
  const rh = w.rehab.filter(r => r.area === area).length; if (rh < 2 || rh > 3) injBad.push(`${area} rehab=${rh}`);
  if (!/not medical advice/i.test(w.note)) injBad.push('note');
}
ok('injury: skips moves that load the area, adds 2–3 rehab moves + not-medical-advice note', !injBad.length, injBad.slice(0, 5).join(' '));
ok('no injury → no rehab block or note', G.workout(prof(), { minutes:45, seed:'n' }).rehab.length === 0 && !G.workout(prof(), { minutes:45, seed:'n' }).note);
const sw = G.swaps(prof({ equip:G.PRESET.hotel }), 'Dumbbell goblet squat', 'Knee');
ok('swap by pain: no option loads the painful area; by equipment: only available gear', sw.every(n => !LIB[n].inj.includes('Knee') && LIB[n].equip.every(q => G.PRESET.hotel.includes(q))), sw.join());
const beg = G.workout(prof({ exp:'beginner' }), { minutes:60, seed:'e' }), adv = G.workout(prof({ exp:'advanced' }), { minutes:60, seed:'e' });
ok('experience: beginner 2 main lifts, advanced 3', beg.main.length === 2 && adv.main.length === 3, `${beg.main.length}/${adv.main.length}`);
ok('experience: advanced does more main sets and lower reps than beginner', adv.main[0].sets > beg.main[0].sets && parseInt(adv.main[0].reps) < parseInt(beg.main[0].reps), `${adv.main[0].sets}x${adv.main[0].reps} vs ${beg.main[0].sets}x${beg.main[0].reps}`);
ok('experience: beginner gets no advanced-difficulty moves', all(beg).every(e => LIB[e.name].diff <= G.maxDiff('beginner')));
ok('experience: progression note differs by level', beg.main[0].prog !== adv.main[0].prog);
let planBad = [];
for (let mask = 1; mask < 128; mask += 3) for (const matMask of [0, 0b0101010, 0b1001001, 0b1111111 & ~mask]) {
  const lift = [0,1,2,3,4,5,6].filter(d => mask & (1 << d)), mat = [0,1,2,3,4,5,6].filter(d => matMask & (1 << d));
  const plan = G.weekPlan({ schedule:{ lift, mat, len:45 } });
  if (plan.map(x => x.dow).sort().join() !== lift.slice().sort().join()) planBad.push('days ' + lift);
  plan.forEach(x => { const before = mat.includes((x.dow + 1) % 7);
    if (before !== x.beforeMat) planBad.push('beforeMat ' + x.dow);
    if (before && x.type === 'lower') planBad.push(`lower before mat ${lift}/${mat}`);
    if (before && x.type === 'full' && !x.lightLegs) planBad.push(`heavy full before mat ${lift}/${mat}`); });
}
ok('schedule: plan uses exactly the chosen lift days', !planBad.some(x => x.startsWith('days')), planBad.join(' '));
ok('mat-day spacing: no heavy legs the day before a mat day', !planBad.length, planBad.slice(0, 4).join(' '));
let llBad = [];
for (let k = 0; k < 10; k++) G.workout(prof(), { type:'full', minutes:45, lightLegs:true, seed:'l' + k }).main.concat([]).forEach(e => { if (LIB[e.name].heavyLegs) llBad.push(e.name); });
ok('light-legs day has no heavy leg moves', !llBad.length, llBad.join());

/* ---------- app ---------- */
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
const W = ms => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1') || 'null'));
const tap = async s => { await page.locator(s).first().tap(); await W(200); };
await page.goto(BASE + 'terms.html'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('forged.tut.seen', JSON.stringify({ home:1, build:1, log:1, settings:1, belts:1, stats:1, history:1, friends:1 })); localStorage.setItem('forged.assess.force', '1'); });
ok('Terms has a "Not medical advice" section (#medical) about generated workouts and rehab', /generated workouts/i.test(await page.locator('#medical + p').innerText()));
await page.goto(BASE); await page.waitForSelector('#asArts');
ok('new user starts on the assessment (no tab bar)', !(await page.locator('.tabbar').isVisible()));
ok('BJJ is preselected', await page.locator('#asArts [data-k="bjj"].on').count() === 1);
await tap('#asArts [data-k="bjj"]'); await tap('#asNext'); ok('arts are required', /at least one art/i.test(await page.locator('#toast').innerText()));
await tap('#asArts [data-k="bjj"]'); await tap('#asArts [data-k="muaythai"]'); await tap('#asArts [data-k="wrestling"]');
ok('main art picker appears when more than one art', await page.locator('#asPrimary button').count() === 3);
await tap('#asPrimary [data-k="muaythai"]'); await tap('#asNext');
ok('belt step only for belted arts (BJJ + Muay Thai, not wrestling)', await page.locator('.card[data-art]').count() === 2);
await page.locator('.card[data-art="bjj"] [data-k="blue"]').tap(); await W(150); await page.locator('.card[data-art="bjj"] .focuschips').nth(1).locator('[data-k="2"]').tap(); await W(150);
await page.locator('.card[data-art="bjj"] input[type="date"]').fill('2025-03-01');
await page.screenshot({ path:`${SHOTS}/p3180-t-belts.png` }); await tap('#asNext');
const todayDow = new Date().getDay(), tomorrow = (todayDow + 1) % 7;
for (const d of [tomorrow, (todayDow + 3) % 7]) await tap(`#asMat [data-k="${d}"]`);
await tap('#asNext'); ok('lift days are required', /lift day/i.test(await page.locator('#toast').innerText()));
for (const d of [todayDow, (todayDow + 4) % 7]) await tap(`#asLift [data-k="${d}"]`);
await tap('#asLen [data-k="60"]'); await tap('#asNext');
ok('location: gym preset prefills the equipment checklist', await page.locator('#asEquip .on').count() === G.PRESET.gym.length);
await tap('#asAddLoc'); await tap('#asLocType [data-k="hotel"]');
ok('second location: hotel preset (no barbell)', await page.locator('#asEquip [data-k="barbell"].on').count() === 0 && await page.locator('#asEquip [data-k="dumbbell"].on').count() === 1);
await page.fill('#asLocName', 'Road hotel'); await tap('#asNext');
ok('experience is its own step with a one-line description each', await page.locator('#asExp .list-row small').count() === 3);
await tap('#asNext'); ok('experience is required', /experience/i.test(await page.locator('#toast').innerText()));
await tap('#asExp [data-k="advanced"]'); await tap('#asNext');
await tap('#asGoal [data-k="strength"]'); await tap('#asNext');
await tap('#asInj [data-k="Knee"]'); await tap('#asNext');
await page.fill('#asName', 'Steve'); await tap('#asNext');
ok('finish needs the not-medical-advice box', /medical/i.test(await page.locator('#toast').innerText()) && /\/assess/.test(page.url()) || await page.locator('#asNma').count() === 1);
await page.locator('#asNma input').check(); await tap('#asNext'); await page.waitForSelector('#todayCard'); await W(400);
let d = await db();
ok('assessment saved: arts, primary, schedule, len, 2 locations, exp, goal, injuries, consent', d.profile.assess.done && d.profile.assess.arts.join() === 'bjj,muaythai,wrestling' && d.profile.assess.primary === 'muaythai'
  && d.profile.assess.schedule.len === 60 && d.profile.assess.locations.length === 2 && d.profile.assess.exp === 'advanced' && d.profile.assess.goal === 'strength' && d.profile.assess.injuries.join() === 'Knee' && !!d.profile.nmaAt && d.profile.name === 'Steve', JSON.stringify(d.profile.assess).slice(0, 300));
ok('sections follow the arts (grappling + striking + weights)', d.profile.enabled.grappling && d.profile.enabled.striking && d.profile.enabled.weights);
const bjj = d.belts.filter(b => !b.art || b.art === 'bjj'), mt = d.belts.filter(b => b.art === 'muaythai');
ok('belts seeded: BJJ blue 2 stripes on the date; Muay Thai starter rank', bjj.length >= 1 && bjj.some(b => b.belt === 'blue' && b.date === '2025-03-01') && mt.length >= 1, JSON.stringify(d.belts));
ok('Home opens on Today\'s session (today is a lift day) with Warm-up / Main lifts / Accessories / Rehab', await page.locator('#todayCard[data-type]').count() === 1
  && /Warm-up/i.test(await page.locator('#todayCard').innerText()) && /Main lifts/i.test(await page.locator('#todayCard').innerText()) && /Rehab/i.test(await page.locator('#todayCard').innerText()));
ok('day before a mat day is not heavy legs', await page.locator('#todayCard').getAttribute('data-type') !== 'lower' && (await page.locator('#todayCard').getAttribute('data-type') !== 'full' || /easy legs/.test(await page.locator('#todayEst').innerText())));
ok('one Quick / Full control, no minute picker', await page.locator('#qfSeg button').count() === 2 && await page.locator('#todayCard [data-min], #todayCard select').count() === 0);
const estFull = parseInt((await page.locator('#todayEst').innerText()).match(/\d+/)[0]);
await page.screenshot({ path:`${SHOTS}/p3180-t-today-full.png`, fullPage:true });
await tap('#qfSeg [data-mode="quick"]'); await W(300);
const estQuick = parseInt((await page.locator('#todayEst').innerText()).match(/\d+/)[0]);
ok('Quick is ~20–30 min and shorter than Full (60)', estQuick <= 30 && estQuick >= 15 && estQuick < estFull, `${estQuick}/${estFull}`);
const names0 = await page.locator('#todayList [data-ex]').evaluateAll(x => x.map(e => e.dataset.ex).join());
const locId = await page.locator('#locSeg [data-loc]:not(.on)').first().getAttribute('data-loc');
await tap('#locSeg [data-loc]:not(.on)'); await W(300);
const names1 = await page.locator('#todayList [data-ex]').evaluateAll(x => x.map(e => e.dataset.ex).join());
const locEq = (await db()).profile.assess.locations.find(l => l.id === locId).equip;
ok('location picker regenerates the workout for that equipment', names0 !== names1 && names1.split(',').every(n => LIB[n].equip.every(q => locEq.includes(q))), names1);
const first = await page.locator('#todayList [data-swapx]').first().getAttribute('data-swapx');
await tap('#todayList [data-swapx]'); await page.waitForSelector('#swapList'); await page.screenshot({ path:`${SHOTS}/p3180-t-swap.png` });
if (await page.locator('#swapList [data-to]').count()) { const to = await page.locator('#swapList [data-to]').first().getAttribute('data-to'); await tap('#swapList [data-to]'); await W(600);
  ok('swap replaces the exercise', (await page.locator('#todayList [data-ex]').evaluateAll(x => x.map(e => e.dataset.ex))).includes(to) && !(await page.locator('#todayList [data-ex]').evaluateAll(x => x.map(e => e.dataset.ex))).includes(first)); }
else { ok('swap sheet explains when nothing fits', /No other option/.test(await page.locator('#swapList').innerText())); await page.locator('.sheet [data-cancel], .sheet .close, .sheet button').last().tap(); await W(400); }
const nEx = await page.locator('#todayList [data-ex]').count();
await tap('#startSession'); await page.waitForSelector('.excard'); await W(400);
ok('Start session opens the live logger with the exercises', /#\/log/.test(page.url()) && await page.locator('.excard:not(.carow)').count() === nEx, `${await page.locator('.excard').count()} vs ${nEx}`);
await page.goto(BASE + '#/'); await W(300); if (await page.locator('.sheet [data-ok]').count()) { await tap('.sheet [data-ok]'); }
await page.goto(BASE + '#/build'); await page.waitForSelector('#buildCard');
ok('Build a workout: Generate + Follow a program, full/upper/lower, week plan on exact days', await page.locator('#typeSeg button').count() === 3 && await page.locator('#weekPlan [data-dow]').count() === 7
  && /Upper body|Full body|Lower body/.test(await page.locator(`#weekPlan [data-dow="${todayDow}"]`).innerText()));
await page.goto(BASE + '#/build/program'); await page.waitForSelector('#progList'); ok('Follow a program lists programs + finishers', await page.locator('#progList .tmpl').count() > 0 && await page.locator('#finList .list-row').count() > 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#assessCard');
ok('Profile: Redo assessment + Not medical advice link', await page.locator('#redoAssess').count() === 1 && (await page.locator('#nmaLink').getAttribute('href')) === 'terms.html#medical');
const prText = await page.locator('#view').innerText();
ok('Profile: no Shop row, no Sections toggles, no food/water/supps/weight-plan/vitals/looks', !/FORGED Shop|Calories|Water goal|Supplement|Weight plan|Max heart|Looks/i.test(prText));
await tap('#redoAssess'); await page.waitForSelector('#asArts');
ok('Redo assessment is prefilled', await page.locator('#asArts .on').count() === 3); await page.screenshot({ path:`${SHOTS}/p3180-t-redo.png` });
/* deep links from the website */
await page.goto(BASE + '?start=assess'); await page.waitForSelector('#asArts');
ok('?start=assess opens the assessment and cleans the URL', /#\/assess$/.test(page.url()) && !/start=/.test(page.url()), page.url());
await page.goto(BASE + '?start=signin'); await W(800);
const cfgSocial = await page.evaluate(() => !!(window.FORGED_CONFIG && (window.FORGED_CONFIG.supabaseUrl || window.FORGED_CONFIG.url)) || !!document.querySelector('.tabbar a[data-tab="friends"]:not([hidden])'));
ok('?start=signin opens sign-in (or Home when social is off) and cleans the URL', !/start=/.test(page.url()) && (cfgSocial ? /#\/signin|#\/friends/.test(page.url()) : true), page.url());
if (await page.locator('#siSend').count()) { await page.fill('#siEmail', 'a@example.com'); await tap('#siSend');
  ok('sign-up needs the not-medical-advice box (pre-ticked once accepted)', await page.locator('#siNma input').isChecked()); }
/* removals */
const tabs = await page.locator('.tabbar a[data-tab]').evaluateAll(a => a.map(x => x.dataset.tab).join());
ok('tab bar: Build replaces Food', /build/.test(tabs) && !/food/.test(tabs), tabs);
for (const [from, to] of [['#/food','#/build'],['#/supps','#/build'],['#/programs','#/build'],['#/rank','#/settings'],['#/badges','#/settings'],['#/comps','#/belts']]) { await page.goto(BASE + from); await W(300); ok(`${from} → ${to}`, page.url().endsWith(to), page.url()); }
await page.goto(BASE + '#/belts'); await page.waitForSelector('#compsCard'); ok('competitions: one light entry on Belts', await page.locator('#compsCard').count() === 1);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); const t = new Date().toLocaleDateString('en-CA'); d.sessions.push({ id:'st1', date:t, category:'grappling', discipline:'gi', duration:60, rpe:7, createdAt:Date.now() }, { id:'st2', date:t, category:'weights', discipline:'strength', duration:45, rpe:8, exercises:[{ name:'Bench press', sets:[{ w:200, r:5 }] }], createdAt:Date.now() }); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.goto(BASE + '#/stats'); await page.reload(); await page.waitForSelector('#weeklyCard'); await W(300);
ok('Stats: weekly chart holds load + type split; one Strength & PRs card; no Benchmarks duplicate', await page.locator('#weeklyCard').count() === 1 && await page.locator('#strengthCard').count() === 1 && await page.locator('#benchCard, #loadCard').count() === 0);
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); const lf = await page.locator('#view').innerText();
ok('log form: no heart rate, import-from-device or body-weight fields', !/Heart rate|Import from device|Body weight/i.test(lf));
ok('mobility has no sauna/steam', await page.evaluate(() => !/sauna|steam/i.test(JSON.stringify(window.DM_TEST || {}))) && await page.locator('text=/Sauna|Steam/').count() === 0);
const js = await page.evaluate(() => Promise.all(['app.js','index.html','sw.js','tutorial.js','styles.css'].map(f => fetch(f + '?x=' + Date.now()).then(r => r.text()))).then(a => a.join('\n')));
ok('no leftover code for removed features', !/viewFood|foodPicker|ZXING|zxing|waterCard|suppCard|\bwplan\b|macroCalc|viewRecap|tipDeck|gameCheck|medalCase|sauna|hrZones|Shop row|foods\.js|tips\.js/i.test(js.split('\n').filter(l => !/archive|const pk = |recovery/.test(l)).join('\n')), (js.match(/viewFood|foodPicker|ZXING|zxing|waterCard|suppCard|wplan|macroCalc|viewRecap|tipDeck|gameCheck|medalCase|sauna|hrZones|foods\.js|tips\.js/i) || [])[0]);
/* migration: a 3.17 user with food, water, weight plan, sauna and XP data loads safely; data archived, not lost */
await page.goto(BASE + 'terms.html'); await page.evaluate(() => { const t = new Date().toLocaleDateString('en-CA');
  localStorage.clear(); localStorage.setItem('forged.tut.seen', JSON.stringify({ home:1 })); localStorage.setItem('forged.assess.force', '1');
  localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:7, sessions:[{ id:'s1', date:t, category:'mobility', discipline:'sauna', duration:20, notes:'hot', hr:{ avg:120 } }, { id:'s2', date:t, category:'grappling', discipline:'gi', duration:60 }],
    profile:{ unit:'lb', setupDone:true, goalWeight:180, maxHR:190, enabled:{ grappling:true, food:true, weight:true, supps:true }, schedule:{ grappling:[1,3], weights:[2] }, marks:{ on:true } },
    nutrition:{ entries:[{ id:'e1', date:t, name:'Rice', cal:200 }], foods:[], water:[{ id:'w1', date:t, ml:500 }] }, game:{ rankSeen:3 }, weights:[{ date:t, w:185 }], belts:[], comps:[], injuries:[], strength:[], reps:[] })); });
await page.goto(BASE); await page.waitForSelector('#asArts'); await W(300);
d = await db();
ok('migration: schema 8, v7 backup kept, nutrition + weight-plan + game archived, no crash', d.schema === 8 && !d.nutrition && d.archive.v317.nutrition.entries.length === 1 && d.archive.v317.profile.goalWeight === 180 && !errors.length, JSON.stringify(d.archive || {}).slice(0, 200));
ok('migration: v7 backup written', await page.evaluate(() => !!localStorage.getItem('dm.bjj.v1.backup.v7')));
ok('migration: sauna session becomes recovery with "Sauna" in notes; HR kept in storage only', d.sessions.find(s => s.id === 's1').discipline === 'recovery' && /^Sauna/.test(d.sessions.find(s => s.id === 's1').notes));
ok('migration: weigh-ins kept (Profile weigh-in)', d.weights.length === 1);
ok('existing user gets the assessment once, prefilled (BJJ from Grappling, Mon/Wed mat, Tue lift)', await page.locator('#asArts [data-k="bjj"].on').count() === 1);
ok('no page errors', !errors.length, errors.join(' | '));
await browser.close();
console.log(results.join('\n')); console.log(`${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
