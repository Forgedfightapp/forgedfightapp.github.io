// 3.1.0 strength goals: PR targets per lift (+custom), rep goals, progress math, achievement detection, onboarding, Profile, Home line, benchmarks tie-in, export/import, sample data.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const T = (fn, arg) => page.evaluate(fn, arg);
const hideToast = () => page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); });
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const seed = async (data) => { await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data); await page.reload(); await settle(400); };
const W = (id, date, ex) => ({ id, date, category:'weights', discipline:'strength', type:'class', duration:60, intensity:3, rpe:6, exercises:ex, notes:'', sample:false, createdAt:1 });
const base = { schema:7, profile:{ unit:'lb', setupDone:true, enabled:{ grappling:true, weights:true, food:false, weight:false } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[],
  sessions:[ W('w1', D(-20), [{ name:'Bench press', sets:[{ reps:5, weight:200 },{ reps:1, weight:215 }] }, { name:'Pull-up', sets:[{ reps:10, weight:'' },{ reps:8, weight:'' }] }]),
             W('w2', D(-10), [{ name:'Incline bench press', sets:[{ reps:8, weight:150 }] }, { name:'Overhead press', sets:[{ reps:5, weight:115 }] }]) ],
  benchmarks:[{ id:'b1', date:D(-15), key:'pullups', value:11 }, { id:'b2', date:D(-15), key:'deadlift', value:400, w:375, r:2, u:'lb' }],
  strength:[{ id:'g1', key:'bench', target:245, u:'lb', date:D(60), createdAt:Date.now() - 30*864e5 }, { id:'g2', key:'pullups', target:15, createdAt:Date.now() - 30*864e5 },
            { id:'g3', key:'deadlift', target:200, u:'kg', createdAt:Date.now() - 30*864e5 }, { id:'g4', key:'custom', name:'Incline bench press', target:200, u:'lb', createdAt:Date.now() - 30*864e5 }] };

/* 1. progress math */
await seed(base);
let m = await T(() => { const T = window.DM_TEST, g = id => T.db.strength.find(x => x.id === id);
  return { bE:T.strengthBest(g('g1'), 'e1rm').value, bS:T.strengthBest(g('g1'), 'single').value, pE:T.strengthProgress(g('g1'), 'e1rm').pct, pS:T.strengthProgress(g('g1'), 'single').pct,
    pu:T.strengthBest(g('g2')).value, puP:T.strengthProgress(g('g2')).pct, dlT:T.sgTarget(g('g3')), dlE:T.strengthBest(g('g3'), 'e1rm').value, dlS:T.strengthBest(g('g3'), 'single').value,
    inc:T.strengthBest(g('g4')).value, left:T.strengthProgress(g('g1'), 'e1rm').left, nt:[T.nextTarget(g('g1')), T.nextTarget(g('g2'))] }; });
ok('est. 1RM (default) from logged sets: 200 × 5 → 233.3 (beats the 215 single)', m.bE === 233.3, JSON.stringify(m));
ok('heaviest-set option: 215', m.bS === 215);
ok('progress %: 233.3 / 245 = 95%, heaviest set 215 / 245 = 88%', m.pE === 95 && m.pS === 88 && m.left === 11.7, JSON.stringify(m));
ok('rep goal best = max of benchmarks (11) and logged reps (10): 11 / 15 = 73%', m.pu === 11 && m.puP === 73);
ok('kg target converted to current units (200 kg → 440.9 lb); deadlift benchmark counts (400 est. / 375 single)', m.dlT === 440.9 && m.dlE === 400 && m.dlS === 375, JSON.stringify(m));
ok('custom exercise goal from your exercise list: Incline bench 150 × 8 → 190', m.inc === 190);
ok('next target: +5% rounded to 5 lb (245 → 260), reps +2 (15 → 17)', JSON.stringify(m.nt) === '[260,17]', JSON.stringify(m.nt));
let d = await db(); ok('nothing marked achieved yet', d.strength.every(g => !g.achieved));

/* 2. Stats card + Home line */
await page.goto(BASE + '#/stats'); await page.waitForSelector('#strengthCard');
ok('Stats: Strength goals card with a row + bar + % per goal', await page.locator('#strengthCard .sgrow').count() === 4 && await page.locator('#strengthCard .sgrow .sgbar i').count() === 4 && (await page.locator('#strengthCard [data-sg="g1"] [data-pct]').getAttribute('data-pct')) === '95');
ok('bar width matches %', (await page.locator('#strengthCard [data-sg="g1"] .sgbar i').getAttribute('style')).includes('width:95%'));
ok('closest-to-done goal listed first', (await page.locator('#strengthCard .sgrow').first().getAttribute('data-sg')) === 'g1');
await page.goto(BASE + '#/'); await page.waitForSelector('.statrow');
ok('Home: compact line with the closest-to-done goal', /Bench press/.test(await page.locator('#strengthLine').innerText()) && /95%/.test(await page.locator('#strengthLine').innerText()) && await page.locator('.strline').count() === 1);
await page.goto(BASE + '#/benchmarks'); await page.waitForSelector('#benchAll');
ok('benchmarks tie-in: rows show the goal + %', (await page.locator('.benchrow[data-bench="pullups"] [data-v="goal"]').innerText()) === '15' && /73%/.test(await page.locator('.benchrow[data-bench="pullups"]').innerText()));

/* 3. Profile: method switch + add custom goal */
await page.goto(BASE + '#/settings'); await page.waitForSelector('#strengthProfile');
ok('Profile: strength goals editable, method choice defaults to est. 1RM', await page.locator('#strengthProfile .sgrow').count() === 4 && (await page.locator('#sgMethod button.on, #sgMethod [aria-checked="true"]').first().innerText()) === 'Est. 1RM');
await page.locator('#sgMethod button', { hasText:'Heaviest set' }).tap(); await settle(300);
d = await db(); ok('switching to heaviest set is saved and recomputes (88%)', d.profile.strengthMethod === 'single' && (await page.locator('#strengthProfile [data-sg="g1"] [data-pct]').getAttribute('data-pct')) === '88');
await page.locator('#sgMethod button', { hasText:'Est. 1RM' }).tap(); await settle(300);
await page.locator('#strengthProfile [data-addsg]').tap(); await page.waitForSelector('#sgSave');
ok('goal sheet: lift chips bench/squat/deadlift/OHP + Other', JSON.stringify(await page.locator('#sgKeys button').allInnerTexts()) === '["Bench press","Squat","Deadlift","Overhead press","Other"]');
await page.locator('[data-sgkey="ohp"]').tap(); await settle(150);
ok('sheet shows your current best for the lift (OHP 115 × 5 → 134)', /134/.test(await page.locator('#sgCur').innerText()));
await page.locator('#sgTarget').fill('155'); await page.locator('#sgDate').fill(D(45)); await page.locator('#sgSave').tap(); await settle(500);
d = await db(); const ohp = d.strength.find(g => g.key === 'ohp');
ok('OHP goal saved with target + optional date', ohp && ohp.target === 155 && ohp.date === D(45) && ohp.u === 'lb' && !ohp.achieved);
await page.locator('#strengthProfile [data-addsg]').tap(); await page.waitForSelector('#sgSave');
await page.locator('#sgBody .seg button', { hasText:'Rep goal' }).tap(); await settle(150);
ok('rep goals: pull-ups, push-ups, dead hang', JSON.stringify(await page.locator('#sgKeys button').allInnerTexts()) === '["Pull-ups","Push-ups","Dead hang"]');
await page.locator('[data-sgkey="hang"]').tap(); await page.locator('#sgTarget').fill('90'); await page.locator('#sgSave').tap(); await settle(500);
d = await db(); ok('dead hang goal (seconds) saved', d.strength.some(g => g.key === 'hang' && g.kind === 'reps' && g.target === 90));

/* 4. achievement: a logged set beats the target → Goal hit! New PR, achieved date, offer next target */
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="weights"]').tap();
await page.locator('#addEx').tap(); await page.locator('.exname').fill('Bench press');
const setIn = (i, f, v) => page.locator('.setrow').nth(i).locator(`input[data-f="${f}"]`).fill(v);
await setIn(0, 'reps', '3'); await setIn(0, 'weight', '230');
await page.locator('.actions [data-save]').tap(); await page.waitForSelector('#goalHit', { timeout:5000 }).catch(() => {});
ok('logged set beats the target: "Goal hit! New PR"', await page.locator('#goalHit').count() === 1 && /Goal hit! New PR/i.test(await page.locator('#goalHit').innerText()) && /Bench press/.test(await page.locator('#goalHit').innerText()));
d = await db(); const g1 = d.strength.find(g => g.id === 'g1');
ok('goal marked achieved with today\'s date and the value (230 × 3 → 253)', g1.achieved && g1.achieved.date === D(0) && g1.achieved.value === 253, JSON.stringify(g1));
ok('other goals not touched', d.strength.filter(g => g.achieved).length === 1);
ok('offers to set the next target (+5%: 260)', /Set next target \(260 lb\)/.test(await page.locator('#nextTarget').innerText()));
await settle(900); await page.screenshot({ path:`${SHOTS}/49b-goal-hit.png` });
await page.locator('#nextTarget').tap(); await page.waitForSelector('#sgSave'); await settle(200);
ok('next-target sheet pre-filled (bench, 260)', (await page.locator('#sgTarget').inputValue()) === '260' && await page.locator('[data-sgkey="bench"].on').count() === 1);
await page.locator('#sgSave').tap(); await settle(500);
d = await db(); ok('next target saved as a new open goal; achieved one kept', d.strength.filter(g => g.key === 'bench').length === 2 && d.strength.some(g => g.key === 'bench' && g.target === 260 && !g.achieved));
ok('celebration happens once (no re-trigger on re-check)', (await T(() => window.DM_TEST.checkStrengthGoals().length)) === 0);
// benchmark test beating a rep goal
await page.goto(BASE + '#/benchmarks'); await page.waitForSelector('[data-benchlog]'); await page.locator('[data-benchlog]').tap(); await page.waitForSelector('#bSave');
await page.locator('[data-b="pullups"]').fill('16'); await page.locator('#bSave').tap(); await page.waitForSelector('#goalHit', { timeout:5000 }).catch(() => {});
d = await db(); ok('a benchmark test beating a rep goal also counts (pull-ups 16 ≥ 15)', await page.locator('#goalHit').count() === 1 && d.strength.find(g => g.id === 'g2').achieved?.value === 16);
await page.locator('#goalHit [data-cancel]').tap(); await settle(400);

/* 5. Stats screenshot */
await page.goto(BASE + '#/stats'); await page.waitForSelector('#strengthCard'); await settle(200); await page.evaluate(() => document.querySelectorAll('.confetti').forEach(x => x.remove()));
await page.evaluate(() => { const c = document.querySelector('#strengthCard'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 70); }); await hideToast(); await settle(200);
await page.screenshot({ path:`${SHOTS}/49-strength-goals.png` });

/* 6. export / import / clear */
let [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.goto(BASE + '#/settings'); await page.waitForSelector('#exp'); await page.locator('#exp').tap(); })()]); await dl.saveAs('/tmp/sg-exp.json');
const exp = JSON.parse(fs.readFileSync('/tmp/sg-exp.json','utf8'));
ok('export includes strength goals (with achieved dates)', exp.strength?.length === d.strength.length && exp.strength.some(g => g.achieved?.date === D(0)));
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.strength = []; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }); await page.reload(); await settle(300);
await page.setInputFiles('#impFile', '/tmp/sg-exp.json'); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db(); ok('import restores strength goals', d.strength.length === exp.strength.length && d.strength.find(g => g.id === 'g1').achieved.value === 253);

/* 7. onboarding: strength goals only when Weights is picked */
await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#catTiles');
await page.locator('#go').tap(); await page.locator('#skipAbout').tap(); await page.waitForSelector('#setupDone');
ok('onboarding without Weights: no strength goals', await page.locator('#setupSG-bench').count() === 0);
await page.locator('#setupBack').tap(); await page.waitForSelector('#aboutNext'); await page.locator('#setupBack').tap(); await page.waitForSelector('#catTiles'); await page.locator('.tile[data-k="weights"]').tap(); await page.locator('#go').tap(); await page.locator('#skipAbout').tap(); await page.waitForSelector('#setupDone');
ok('onboarding with Weights: bench/squat/deadlift/OHP + pull-ups/push-ups/dead hang + date', await page.locator('[id^="setupSG-"]').count() === 7 && await page.locator('#setupSGDate').count() === 1);
await page.locator('#setupSG-squat').fill('315'); await page.locator('#setupSG-pushups').fill('50'); await page.locator('#setupSGDate').fill(D(90)); await page.locator('#setupDone').tap(); await page.waitForSelector('.statrow');
d = await db(); ok('onboarding saves only the filled strength goals', d.strength.length === 2 && d.strength.some(g => g.key === 'squat' && g.target === 315 && g.date === D(90)) && d.strength.some(g => g.key === 'pushups' && g.target === 50));

/* 8. sample data */
await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await settle(600);
d = await db(); ok('sample data includes strength goals (one achieved)', d.strength.filter(g => g.sample).length === 4 && d.strength.some(g => g.sample && g.achieved));
ok('Home line shows with sample data', await page.locator('#strengthLine').count() === 1);
ok('loading sample data does not fire the monthly-goal confetti', await page.locator('.confetti').count() === 0 && (await db()).challenges.filter(x => x.month === D(0).slice(0,7)).every(x => x.sample));
await page.goto(BASE + '#/settings'); await page.waitForSelector('#strengthProfile');
ok('Profile lists sample goals', await page.locator('#strengthProfile .sgrow').count() === 4);
await page.goto(BASE + '#/'); await page.waitForSelector('#rmSample'); await page.locator('#rmSample').tap(); await settle(200); if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(400); }
d = await db(); ok('remove sample removes sample strength goals', !d.strength.some(g => g.sample));
ok('storage key unchanged', await page.evaluate(() => !!localStorage.getItem('dm.bjj.v1')));
ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
if (!process.env.QUIET) results.forEach(r => console.log(r)); else results.forEach(r => console.log(r));
