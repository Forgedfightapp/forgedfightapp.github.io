// 3.2.1 calorie + macro calculator: Mifflin-St Jeor math, deficit/surplus/floors, macros, onboarding/Profile/Food entry points, Use these/Adjust, stored inputs, recalc prompt.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const T = (fn, arg) => page.evaluate(fn, arg);
const hideToast = () => page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); });
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const seed = async (data, hash = '') => { await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data); await page.reload(); if (hash) await page.goto(BASE + hash); await settle(500); };
const base = (o = {}) => ({ schema:7, profile:{ name:'Steve', unit:'lb', setupDone:true, challengeTarget:8, enabled:{ grappling:true, weights:true, food:true, weight:true }, ...o }, sessions:[], nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], game:{ rankSeen:0, levelSeen:1, seenDone:[], seenBadges:[] } });

/* 1. math */
await seed(base());
let r = await T(() => window.DM_TEST.macroCalc({ sex:'m', age:30, cm:180, kg:80, goalKg:75, act:'active', pace:'steady' }));
ok('Mifflin-St Jeor BMR (male 30 y, 180 cm, 80 kg = 1780)', r.bmr === 1780, JSON.stringify(r));
ok('maintenance = BMR × activity (Active 1.55 = 2759)', r.maint === 2759);
ok('goal below current: steady deficit −500 (rounded to 10)', r.cal === 2260 && r.dir === -1);
ok('protein 1 g per lb of goal weight (165 g)', r.p === 165, String(r.p));
ok('fat within 25–30% of calories, carbs are the rest', r.f === 63 && r.c === 258 && Math.abs(r.p * 4 + r.c * 4 + r.f * 9 - r.cal) <= 6, JSON.stringify([r.p, r.c, r.f]));
ok('estimated change ≈ −1 lb/week and a goal date', Math.abs(r.perWeekLb + 1) < 0.01 && r.goalDate > D(70) && r.goalDate < D(90), `${r.perWeekLb} ${r.goalDate}`);
r = await T(() => ['slow','aggressive'].map(p => window.DM_TEST.macroCalc({ sex:'m', age:30, cm:180, kg:80, goalKg:75, act:'active', pace:p }).cal));
ok('slow −250, aggressive −750', JSON.stringify(r) === '[2510,2010]', JSON.stringify(r));
r = await T(() => window.DM_TEST.macroCalc({ sex:'f', age:50, cm:155, kg:55, goalKg:50, act:'sed', pace:'aggressive' }));
ok('never below the floor (women 1200, or BMR if higher)', r.bmr === 1108 && r.cal === 1200 && r.floored, JSON.stringify(r));
r = await T(() => window.DM_TEST.macroCalc({ sex:'m', age:60, cm:160, kg:55, goalKg:50, act:'sed', pace:'aggressive' }));
ok('men: floor 1500', r.cal === 1500 && r.floored, JSON.stringify(r));
r = await T(() => ['slow','steady','aggressive'].map(p => { const x = window.DM_TEST.macroCalc({ sex:'m', age:25, cm:178, kg:70, goalKg:78, act:'very', pace:p }); return x.cal - x.maint; }));
ok('goal above current: surplus +250 / +350 / +500', r.every((x, i) => Math.abs(x - [250,350,500][i]) <= 5), JSON.stringify(r));
r = await T(() => window.DM_TEST.macroCalc({ sex:'f', age:35, cm:165, kg:62, goalKg:62, act:'light' }));
ok('equal goal: maintenance, no goal date', r.dir === 0 && Math.abs(r.cal - r.maint) <= 5 && !r.goalDate);
r = await T(() => window.DM_TEST.macroCalc({ sex:'m', age:30, cm:195, kg:150, goalKg:140, act:'athlete' }));
ok('protein capped at 250 g', r.p === 250, String(r.p));
r = await T(() => window.DM_TEST.calcInputsKg({ sex:'m', age:30, hu:'ftin', ft:5, inch:10, w:180, gw:170, u:'lb', act:'active', pace:'steady' }));
ok('ft/in and lb convert (5′10″ = 177.8 cm, 180 lb = 81.6 kg)', Math.abs(r.cm - 177.8) < 0.01 && Math.abs(r.kg - 81.65) < 0.05);

/* 2. Profile goals: Calculate for me → result → Adjust → Use these */
await seed(base({ goalWeight:'170' }), '#/settings/goals');
await page.waitForSelector('#calcMacros'); await page.locator('#calcMacros').tap(); await page.waitForSelector('#macroCalc');
ok('one short screen: sex, age, height, weights, activity, note', await page.locator('#mcAge').count() === 1 && await page.locator('#mcFt').count() === 1 && await page.locator('#mcIn2').count() === 1 && await page.locator('#mcAct [data-act]').count() === 5 && /Estimates only, not medical advice/.test(await page.locator('#macroCalc').innerText()));
ok('goal weight prefilled from the weight goal', await page.locator('#mcGw').inputValue() === '170');
ok('each activity level has a plain one-line description; training days mentioned', /Train 3–5 days a week/.test(await page.locator('#mcAct').innerText()) && /training days/i.test(await page.locator('#macroCalc').innerText()) && /Athlete \(2-a-days\)/.test(await page.locator('#mcAct').innerText()));
ok('activity defaults to Active for a new user; pace hidden until goal differs', await page.locator('#mcAct [data-act="active"].on').count() === 1 && await page.locator('#mcAct [data-act="sed"]').count() === 1);
await page.locator('#mcGo').tap(); await settle(200);
ok('missing fields are explained, not calculated', await page.locator('#mcResult').count() === 0 && /male or female/i.test(await page.locator('#toast').innerText()));
await page.getByRole('radio', { name:'Male', exact:true }).tap();
await page.locator('#mcAge').fill('34'); await page.locator('#mcFt').fill('5'); await page.locator('#mcIn2').fill('10'); await page.locator('#mcW').fill('185'); await page.locator('#mcGw').fill('170');
await settle(100);
ok('pace shows when goal differs, steady by default', await page.locator('#macroCalc .field', { hasText:'How fast to lose' }).isVisible() && /steady/i.test(await page.locator('#macroCalc .field', { hasText:'How fast to lose' }).locator('button.on').innerText()));
await page.locator('#mcAct [data-act="very"]').tap();
await page.locator('#mcGo').tap(); await page.waitForSelector('#mcResult');
const expect = await T(() => window.DM_TEST.macroCalc(window.DM_TEST.calcInputsKg({ sex:'m', age:34, hu:'ftin', ft:5, inch:10, w:185, gw:170, u:'lb', act:'very', pace:'steady' })));
const shown = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#mcResult [data-r]')].map(e => [e.dataset.r, e.textContent])));
ok('result card: calories, protein, carbs, fat, maintenance', shown.cal === expect.cal.toLocaleString() && shown.p === String(expect.p) && shown.c === String(expect.c) && shown.f === String(expect.f) && shown.maint.startsWith(expect.maint.toLocaleString()), JSON.stringify([shown, expect]));
ok('result card: weekly change and goal date', /−1 lb \/ week/.test(shown.wk) && /\d{4}/.test(shown.date), JSON.stringify(shown));
await hideToast(); await settle(200);
await page.screenshot({ path:`${SHOTS}/59-macro-calc.png` });
await page.locator('#mcAdjust').tap(); await settle(150);
ok('Adjust goes back to the inputs, keeping them', await page.locator('#mcIn').isVisible() && await page.locator('#mcAge').inputValue() === '34');
await page.locator('#macroCalc .field', { hasText:'How fast to lose' }).locator('button', { hasText:'Slow' }).tap();
await page.locator('#mcGo').tap(); await page.waitForSelector('#mcResult');
const slow = await T(() => window.DM_TEST.macroCalc(window.DM_TEST.calcInputsKg({ sex:'m', age:34, hu:'ftin', ft:5, inch:10, w:185, gw:170, u:'lb', act:'very', pace:'slow' })));
ok('changing pace recalculates', await page.locator('#mcResult [data-r="cal"]').textContent() === slow.cal.toLocaleString());
await page.locator('#mcUse').tap(); await settle(400);
let d = await db();
ok('Use these fills calorie and macro goals', d.profile.targets.cal === slow.cal && d.profile.targets.p === slow.p && d.profile.targets.c === slow.c && d.profile.targets.f === slow.f);
ok('inputs are stored for recalculation', d.profile.calc && d.profile.calc.age === 34 && d.profile.calc.ft === 5 && d.profile.calc.inch === 10 && d.profile.calc.w === 185 && d.profile.calc.act === 'very' && d.profile.calc.pace === 'slow' && d.profile.calc.sex === 'm');
ok('goal fields still editable and show the new numbers', await page.locator('#targetsCard [data-target="cal"]').inputValue() === String(slow.cal));
await page.locator('#targetsCard [data-target="p"]').fill('180'); await page.locator('#targetsCard [data-target="p"]').blur(); await settle(200);
ok('editing after Use these keeps the edit', (await db()).profile.targets.p === 180);
await page.locator('#calcMacros').tap(); await page.waitForSelector('#macroCalc');
ok('reopening remembers your details', await page.locator('#mcAge').inputValue() === '34' && await page.locator('#mcFt').inputValue() === '5' && await page.locator('#mcAct [data-act="very"].on').count() === 1);
await page.locator('#mcHu').tap();
ok('switch to cm converts height', await page.locator('#mcCm').inputValue() === '178');
await page.locator('.sheet [data-close]').first().tap(); await settle();

/* 3. recalc prompt when logged weight moves > 5 lb */
ok('no recalc prompt yet', await page.locator('#recalcCard').count() === 0);
await page.evaluate(d => { const x = JSON.parse(localStorage.getItem('dm.bjj.v1')); x.weights = [{ id:'w1', date:d, w:182, u:'lb', createdAt:Date.now() }]; localStorage.setItem('dm.bjj.v1', JSON.stringify(x)); }, D(0));
await page.reload(); await page.waitForSelector('#targetsCard');
ok('a 3 lb change does not prompt', await page.locator('#recalcCard').count() === 0);
await page.evaluate(d => { const x = JSON.parse(localStorage.getItem('dm.bjj.v1')); x.weights = [{ id:'w1', date:d, w:178.6, u:'lb', createdAt:Date.now() }]; localStorage.setItem('dm.bjj.v1', JSON.stringify(x)); }, D(0));
await page.reload(); await page.waitForSelector('#targetsCard');
ok('a >5 lb change offers Recalculate? in Profile', await page.locator('#targetsCard #recalcCard').count() === 1 && /down 6.4 lb/.test(await page.locator('#recalcCard').innerText()));
await page.goto(BASE + '#/food'); await settle();
ok('…and on the Food screen', await page.locator('#recalcCard').count() === 1);
await page.locator('#recalcGo').tap(); await page.waitForSelector('#macroCalc');
ok('Recalculate prefills the new weight', await page.locator('#mcW').inputValue() === '178.6');
await page.locator('#mcGo').tap(); await page.waitForSelector('#mcResult'); await page.locator('#mcUse').tap(); await settle(400);
d = await db();
ok('after recalculating the prompt goes away', d.profile.calc.w === 178.6 && await page.locator('#recalcCard').count() === 0);
await page.evaluate(d => { const x = JSON.parse(localStorage.getItem('dm.bjj.v1')); x.weights.push({ id:'w2', date:d, w:171, u:'lb', createdAt:Date.now() }); localStorage.setItem('dm.bjj.v1', JSON.stringify(x)); }, D(0));
await page.reload(); await page.waitForSelector('#recalcCard');
await page.locator('#recalcNo').tap(); await settle(200);
ok('Not now hides it until weight moves another 5 lb', await page.locator('#recalcCard').count() === 0 && (await db()).profile.calc.dismissW === 171);

/* 4. Food screen with no goals */
await seed(base(), '#/food');
ok('Food screen without goals offers Calculate for me', await page.locator('#calcFood').count() === 1 && await page.locator('#setGoals').count() === 1);
await page.locator('#calcFood').tap(); await page.waitForSelector('#macroCalc');
ok('it opens the calculator', await page.locator('#mcGo').count() === 1);
await page.locator('.sheet [data-close]').first().tap(); await settle();

/* 5. kg + cm user */
await seed(base({ unit:'kg' }), '#/settings/goals');
await page.locator('#calcMacros').tap(); await page.waitForSelector('#macroCalc');
ok('metric users get cm and kg', await page.locator('#mcCm').count() === 1 && /\(kg\)/i.test(await page.locator('#macroCalc').innerText()));
await page.locator('#macroCalc .seg button', { hasText:'Female' }).tap();
await page.locator('#mcAge').fill('28'); await page.locator('#mcCm').fill('168'); await page.locator('#mcW').fill('64'); await page.locator('#mcGw').fill('64');
await page.locator('#mcGo').tap(); await page.waitForSelector('#mcResult');
const mt = await T(() => window.DM_TEST.macroCalc({ sex:'f', age:28, cm:168, kg:64, goalKg:64, act:'active' }));
ok('metric maintenance result', await page.locator('#mcResult [data-r="cal"]').textContent() === mt.cal.toLocaleString() && /maintain/.test(await page.locator('#mcResult [data-r="wk"]').textContent()));
await page.locator('.sheet [data-close]').first().tap(); await settle();

/* 6. onboarding: step 2 About you (calculator inputs for everyone) → step 3 pre-filled */
await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#catTiles');
for (const k of ['food', 'weight']) { if (await page.locator(`#extraTiles .tile[data-k="${k}"]`).getAttribute('aria-pressed') !== 'true') await page.locator(`#extraTiles .tile[data-k="${k}"]`).tap(); }
await page.locator('#go').tap(); await page.waitForSelector('#aboutNext');
ok('About you shows the calculator inputs inline (no sheet, no Calculate for me)', await page.locator('#macroCalc').count() === 0 && await page.locator('#setupCalc').count() === 0 && await page.locator('#mcAge').isVisible() && await page.locator('#mcAct').isVisible());
await page.getByRole('radio', { name:'Male', exact:true }).tap(); await page.locator('#mcAge').fill('40'); await page.locator('#mcFt').fill('6'); await page.locator('#mcIn2').fill('0');
await page.locator('#mcW').fill('200'); await page.locator('#mcGw').fill('185'); await settle(100);
ok('pace appears when the goal differs', await page.locator('.mcform .field', { hasText:/How fast to lose/i }).isVisible());
await page.locator('#mcAct [data-act="active"]').tap();
await page.locator('#aboutNext').tap(); await page.waitForSelector('#setupDone');
const ob = await T(() => window.DM_TEST.macroCalc(window.DM_TEST.calcInputsKg({ sex:'m', age:40, hu:'ftin', ft:6, inch:0, w:200, gw:185, u:'lb', act:'active', pace:'steady' })));
ok('step 3 pre-fills calories and macros from About you', await page.locator('#setupT-cal').inputValue() === String(ob.cal) && await page.locator('#setupT-p').inputValue() === String(ob.p) && await page.locator('#setupT-c').inputValue() === String(ob.c) && await page.locator('#setupT-f').inputValue() === String(ob.f) && /Calculated from your details/.test(await page.locator('#setupCalcNote').innerText()));
ok('step 3 pre-fills water (200 lb → 100 oz) and the weight goal', await page.locator('#setupWater').inputValue() === '100' && await page.locator('#setupW').inputValue() === '200' && await page.locator('#setupGoal').inputValue() === '185' && await page.locator('#setupGoalDate').inputValue() === ob.goalDate);
await page.locator('#setupT-f').fill(String(ob.f + 5));
await page.locator('#setupDone').tap(); await settle(500);
d = await db();
ok('finishing saves targets (with your edit), water and the calculator inputs', d.profile.targets.cal === ob.cal && d.profile.targets.f === ob.f + 5 && d.profile.calc.age === 40 && d.profile.calc.act === 'active' && d.profile.goalWeight === '185' && Math.round(d.profile.waterGoal) === Math.round(100 * 29.5735));
/* metric + Food/Weight off: the numbers still get shown and saved */
await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#catTiles');
for (const k of ['food', 'weight']) { if (await page.locator(`#extraTiles .tile[data-k="${k}"]`).getAttribute('aria-pressed') === 'true') await page.locator(`#extraTiles .tile[data-k="${k}"]`).tap(); }
await page.locator('#go').tap(); await page.waitForSelector('#aboutNext');
await page.locator('#mcUnits').getByRole('radio', { name:/kg/ }).tap(); await settle(100);
ok('units switch to kg · cm swaps height to cm and weight labels to kg', await page.locator('#mcCm').isVisible() && /kg/.test(await page.locator('.mcform').innerText()));
await page.getByRole('radio', { name:'Female', exact:true }).tap(); await page.locator('#mcAge').fill('28'); await page.locator('#mcCm').fill('168'); await page.locator('#mcW').fill('64');
await page.locator('#mcAct [data-act="active"]').tap();
await page.locator('#aboutNext').tap(); await page.waitForSelector('#setupDone');
const om = await T(() => window.DM_TEST.macroCalc({ sex:'f', age:28, cm:168, kg:64, goalKg:64, act:'active' }));
const mlExp = Math.round(Math.round(64 * 2.20462 / 2) * 29.5735 / 50) * 50;
ok('Food off: step 3 still shows the calculated numbers; water in ml (rounded to 50)', await page.locator('#setupT-cal').inputValue() === String(om.cal) && await page.locator('#setupWater').inputValue() === String(mlExp) && await page.locator('#setupW').count() === 0, await page.locator('#setupWater').inputValue() + ' vs ' + mlExp);
await page.locator('#setupDone').tap(); await settle(500);
d = await db();
ok('saved: targets, calc, metric units', d.profile.targets.cal === om.cal && d.profile.calc.u === 'kg' && d.profile.unit === 'kg' && Math.round(d.profile.waterGoal) === mlExp);
/* skip */
await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#catTiles');
await page.locator('#go').tap(); await page.waitForSelector('#skipAbout'); await page.locator('#skipAbout').tap(); await page.waitForSelector('#setupDone');
ok('Skip for now on About you: empty numbers and a way back', await page.locator('#setupT-cal').inputValue() === '' && await page.locator('#toAbout').count() === 1);
await page.locator('#toAbout').tap(); await page.waitForSelector('#aboutNext');
ok('"Go back to About you" opens step 2', /Step 2 of 3/.test(await page.locator('#setupStep').innerText()));

ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(results.join('\n'));
if (!process.env.QUIET) console.log(`${results.filter(x => x.startsWith('PASS')).length}/${results.length}`);
