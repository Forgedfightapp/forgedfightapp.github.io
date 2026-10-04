// 3.1.0 features: schedule/week strip, effort+feel+load, competitions, benchmarks, injuries, monthly ring, programs, supplements archived, Drilling removed.
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
const prof = (x={}) => ({ name:'', unit:'lb', distUnit:'mi', setupDone:true, enabled:{ grappling:true, striking:false, mma:false, weights:true, cardio:true, mobility:true, food:false, weight:false }, ...x });
const S = (id, date, o={}) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, techniques:[], notes:'', weight:'', rolls:[], sample:false, createdAt:1, ...o });

/* 1. migration v6 -> v7: RPE from intensity, Drilling kept but shown as Class, supplements archived */
const v6 = { schema:6, sessions:[1,2,3,4,5].map(i => S('m'+i, D(-40 - i), { intensity:i, type: i === 2 ? 'drill' : 'class' })),
  profile:prof({ enabled:{ grappling:true, food:true, supps:true } }), nutrition:{ entries:[], foods:[], water:[] },
  supps:{ items:[{ id:'cr', name:'Creatine', dose:'5', unit:'g', time:'morning', schedule:{ type:'daily' }, start:D(-50) }, { id:'smp', name:'Sample fish oil', sample:true }], log:[{ id:'l1', itemId:'cr', date:D(-45), takenAt:1 }, { id:'l2', itemId:'smp', date:D(-45), sample:true }] }, weights:[], belts:[] };
await seed(v6);
let d = await db();
ok('v6 → v7: effort (RPE) mapped from intensity 1→2, 2→4, 3→6, 4→8, 5→10', d.schema === 7 && [1,2,3,4,5].every(i => d.sessions.find(s => s.id === 'm'+i).rpe === i*2), JSON.stringify(d.sessions.map(s => [s.intensity, s.rpe])));
ok('old intensity values are kept', [1,2,3,4,5].every(i => d.sessions.find(s => s.id === 'm'+i).intensity === i));
ok('v6 backup kept', await page.evaluate(() => !!localStorage.getItem('dm.bjj.v1.backup.v6')));
ok('supplements archived (real data kept, sample dropped), not in the live data', !d.supps && d.archive?.supps?.items.length === 1 && d.archive.supps.items[0].name === 'Creatine' && d.archive.supps.log.length === 1);
ok('stored Drilling value is kept (safe)', d.sessions.find(s => s.id === 'm2').type === 'drill');
await page.goto(BASE + '#/session/m2'); await settle();
ok('Drilling session shows as Class', !/drilling/i.test(await page.locator('#view').innerText()) && (await page.locator('#title').innerText()) === 'BJJ');
await page.goto(BASE + '#/edit/m2'); await settle();
ok('editing a Drilling session: Class is selected, no Drilling option', await page.getByRole('radio', { name:'Drilling' }).count() === 0 && (await page.locator('.field', { has:page.locator('label', { hasText:/^Session type$/ }) }).locator('button.on').innerText()) === 'Class');
for (const c of ['striking','mma']) { await page.evaluate(c => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.profile.enabled[c] = true; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, c); }
await page.goto(BASE + '#/'); await page.reload(); await settle(300);
for (const c of ['grappling','striking','mma']) { await page.goto(BASE + '#/'); await settle(150); await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await page.locator(`.cats button[data-c="${c}"]`).tap(); await settle(200);
  const opts = await page.locator('.field', { has:page.locator('label', { hasText:/^Session type$/ }) }).locator('button').allInnerTexts();
  const want = c === 'grappling' ? '["Class","Open mat","Private","Competition","Seminar","Other"]' : '["Class","Pad work","Private","Competition","Seminar","Other"]';
  ok(`${c}: Session type = ${JSON.parse(want).join(', ')}`, JSON.stringify(opts) === want, JSON.stringify(opts)); }
await page.locator('.cats button[data-c="mma"]').tap(); await settle(200);
ok('MMA work breakdown still has Drilling', await page.locator('.mixgrid .field label', { hasText:/^Drilling$/ }).count() === 1);
await page.goto(BASE + '#/'); await settle(150);
if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(300); }
ok('no Supplements anywhere: nav says Food, no Home card', (await page.locator('.tabbar a[data-tab="food"] span').innerText()) === 'Food' && await page.locator('#suppCard').count() === 0);
await page.goto(BASE + '#/supps'); await settle(300);
ok('#/supps goes to Food', (await page.evaluate(() => location.hash)) === '#/food');
await page.goto(BASE + '#/settings'); await settle(300);
ok('What I track has no Supplements toggle', await page.locator('input[data-sec="supps"]').count() === 0);
ok('Profile > Your data notes the archived supplements', /Supplement tracking was removed in 3\.1\. Your 1 supplement and 1 check-off are kept/.test(await page.locator('#suppArchiveNote').innerText()));
let [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]); await dl.saveAs('/tmp/feat-exp1.json');
let exp = JSON.parse(fs.readFileSync('/tmp/feat-exp1.json','utf8'));
ok('export keeps archived supplements', exp.archive?.supps?.items?.[0]?.name === 'Creatine' && !exp.supps && exp.schema === 7);
// old 3.0 backup with supplements imports, archived
fs.writeFileSync('/tmp/feat-old.json', JSON.stringify({ app:'forged', version:'3.0.0', ...v6 }));
await page.setInputFiles('#impFile', '/tmp/feat-old.json'); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db(); ok('old backup with supplements imports (archived)', d.archive?.supps?.items.length === 1 && !d.supps && d.sessions.length === 5);
await page.goto(BASE); await settle(200);
ok('first-run has no Supplements tile', await page.evaluate(() => { localStorage.clear(); return true; }) && (await page.reload(), await page.waitForSelector('#catTiles'), await page.locator('.tile[data-k="supps"]').count()) === 0);

/* 2. load math + warnings */
const loadSess = [];
for (let w = 1; w <= 4; w++) [1, 3].forEach(k => loadSess.push(S(`c${w}${k}`, D(-7*w - k), { duration:60, rpe:5 }))); // chronic: 8 × 300 = 2400 → 600/wk
await seed({ schema:7, sessions:loadSess, profile:prof(), nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[] });
let ls = await T(() => window.DM_TEST.loadStatus());
ok('load = minutes × effort; 4-week average', (await T(() => window.DM_TEST.loadOf({ duration:75, rpe:8 }))) === 600 && ls.chronic === 600 && ls.acute === 0 && ls.label === 'Fresh', JSON.stringify(ls));
ok('missing effort falls back to intensity × 2', (await T(() => window.DM_TEST.rpeOf({ intensity:4 }))) === 8 && (await T(() => window.DM_TEST.rpeFromIntensity(1))) === 2);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); const t = new Date(), y = new Date(); y.setDate(t.getDate() - 1); const f = x => x.toLocaleDateString('en-CA');
  d.sessions.push({ id:'h1', date:f(y), category:'grappling', discipline:'bjj', type:'open', duration:60, rpe:9, intensity:5, createdAt:5 }, { id:'h2', date:f(t), category:'grappling', discipline:'bjj', type:'class', duration:60, rpe:8, intensity:4, createdAt:6 });
  localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.goto(BASE + '#/'); await page.reload(); await settle(400);
ls = await T(() => window.DM_TEST.loadStatus());
ok('acute 1020 vs 600 → ratio 1.7 "High load"', ls.acute === 1020 && ls.ratio === 1.7 && ls.label === 'High load' && ls.jump, JSON.stringify(ls));
const warns = await page.locator('#weekCard [data-warn]').allInnerTexts();
ok('Home warns: back-to-back hard days + load jump > 30%', warns.some(w => /back-to-back/.test(w)) && warns.some(w => /70% above your 4-week average/.test(w)), JSON.stringify(warns));
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.sessions = d.sessions.filter(s => s.id !== 'h1'); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }); await page.reload(); await settle(300);
ok('ratio 0.8–1.3 is "Building"; no warnings', (await T(() => window.DM_TEST.loadStatus().label)) === 'Building' && await page.locator('#weekCard [data-warn]').count() === 0);

/* 3. effort + feel on the form (every category), quick log unchanged */
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await page.locator('.cats button[data-c="weights"]').tap(); await settle(200);
ok('effort picker 1–10 + 5-emoji feel picker', await page.locator('.effort button').count() === 10 && await page.locator('.feelpick button').count() === 5);
await page.locator('.effort button[data-r="7"]').tap(); await page.locator('.feelpick button[data-feel="5"]').tap(); await settle(100);
ok('effort label shows the load', /Hard · load 420/.test(await page.locator('#effLabel').innerText()), await page.locator('#effLabel').innerText());
await page.locator('.field', { has:page.locator('label', { hasText:/^How did it feel\?$/ }) }).scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -170)); await settle(200); await hideToast();
await page.screenshot({ path:`${SHOTS}/41-effort-feel.png` });
await page.locator('.actions [data-save]').tap(); await settle(400);
d = await db(); let w1 = d.sessions.find(s => s.category === 'weights');
ok('saved effort 7 (intensity 4 kept in sync) and feel 5', w1 && w1.rpe === 7 && w1.intensity === 4 && w1.feel === 5, JSON.stringify(w1));
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await page.locator('.cats button[data-c="cardio"]').tap(); await page.locator('.actions [data-save]').tap(); await settle(300);
d = await db(); const c1 = d.sessions.find(s => s.category === 'cardio');
ok('effort and feel stay optional (quick log saves without them)', c1 && c1.rpe === undefined && c1.feel === undefined);

/* 4. stats: weekly load chart + ratio */
await page.goto(BASE + '#/stats'); await page.waitForSelector('#loadCard');
ok('stats: 12-week load chart + ratio label', await page.locator('#loadCard svg rect.bar').count() === 12 && ['fresh','building','high load'].includes((await page.locator('#acwrLabel').innerText()).toLowerCase()));
await page.locator('#loadCard').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -100)); await settle(); await hideToast();
await page.screenshot({ path:`${SHOTS}/42-load-chart.png` });

/* 5. weekly schedule */
await page.goto(BASE + '#/settings/schedule'); await page.waitForSelector('#scheduleCard'); await settle();
const dowToday = new Date().getDay(), dowY = (dowToday + 6) % 7;
await page.locator(`#scheduleCard .schedrow:has-text("Grappling") button[data-d="${dowToday}"]`).tap();
await page.locator(`#scheduleCard .schedrow:has-text("Weights") button[data-d="${(dowToday + 1) % 7}"]`).tap();
d = await db(); ok('schedule saved per discipline', d.profile.schedule.grappling.includes(dowToday) && d.profile.schedule.weights.includes((dowToday + 1) % 7));
await page.goto(BASE + '#/'); await settle(300);
const td = await page.locator('#weekStrip .wday.today .wd').count();
ok('week strip: 7 days, today has planned+done dots', await page.locator('#weekStrip .wday').count() === 7 && td >= 1 && await page.locator('#weekStrip .wday.today .wd.on').count() >= 1);

/* 6. monthly challenge ring */
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.profile.challengeTarget = 3; d.challenges = []; const m = new Date().toLocaleDateString('en-CA').slice(0,7); d.sessions = d.sessions.filter(s => !s.date.startsWith(m)); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await settle(300);
ok('ring: 0 / 3 this month', /^0 \/ 3 workouts this month$/.test(await page.locator('#chText').innerText()));
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await page.locator('.actions [data-save]').tap(); await settle(300);
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await page.locator('.actions [data-save]').tap(); await settle(300);
ok('ring: 2 / 3, not hit yet', /^2 \/ 3/.test(await page.locator('#chText').innerText()) && (await db()).challenges.length === 0);
await page.locator('.quick [data-rep]').first().tap(); await settle(250);
ok('3rd workout hits the goal: celebration + month recorded once', await page.locator('.confetti').count() === 1 && (await db()).challenges.length === 1 && /Monthly goal hit/.test(await page.locator('#challenge').innerText()));
await page.waitForTimeout(2700); await page.goto(BASE + '#/stats'); await settle(200); await page.goto(BASE + '#/'); await settle(300);
ok('no repeat celebration; history kept', await page.locator('.confetti').count() === 0 && (await db()).challenges.length === 1);
await page.goto(BASE + '#/settings/schedule'); await page.waitForSelector('#scheduleCard'); await settle();
await page.locator('#scheduleCard .stepper button[aria-label="Increase"]').tap(); await settle(100);
ok('monthly goal editable in Profile (default 8)', (await db()).profile.challengeTarget === 4);
await page.goto(BASE + '#/stats'); await settle(200);
ok('stats lists months achieved', /1 month achieved/.test(await page.locator('#challengeHist').innerText()));
ok('backfill helper: months with ≥ target workouts', (await T(() => window.DM_TEST.challengeMonths([{date:'2026-01-02'},{date:'2026-01-03'},{date:'2026-02-01'}], 2, '2026-03'))).length === 1);

/* 7. competitions */
await page.goto(BASE + '#/settings'); await page.waitForSelector('#compsProfile');
await page.locator('#compsProfile [data-addcomp]').tap(); await page.waitForSelector('#compName');
await page.fill('#compName', 'City Open'); await page.fill('#compDate', D(5)); await page.dispatchEvent('#compDate', 'change'); await page.fill('#compClass', 'Light (Gi)'); await page.fill('#compTarget', '170');
await page.locator('.sheet [data-save]').tap(); await settle(400);
await page.goto(BASE + '#/'); await settle(300);
ok('Home: "5 days to City Open" + taper tips in the final week', (await page.locator('#compTitle').innerText()) === '5 days to City Open' && await page.locator('#taperTips li').count() === 5, await page.locator('#compCard').innerText());
ok('days-to helper', (await T(d => window.DM_TEST.daysTo(d), D(12))) === 12);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.comps[0].date = new Date(Date.now() + 20*864e5).toLocaleDateString('en-CA'); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }); await page.reload(); await settle(300);
ok('no taper tips 20 days out', await page.locator('#taperTips').count() === 0 && /20 days to City Open/.test(await page.locator('#compTitle').innerText()));
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.comps[0].date = new Date(Date.now() - 2*864e5).toLocaleDateString('en-CA'); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }); await page.reload(); await settle(300);
ok('after the event Home asks for the result', /How did it go/.test(await page.locator('#compCard').innerText()));
await page.locator('#compCard [data-comp]').tap(); await page.waitForSelector('#compResult');
await page.locator('#compResult button', { hasText:'Medal' }).tap(); await page.locator('#compResult button', { hasText:'Gold' }).tap();
await page.locator('#compResult textarea').fill('Three subs, one points win.'); await page.locator('.sheet [data-save]').tap(); await settle(400);
d = await db(); ok('past comp keeps result + notes', d.comps[0].result === 'medal' && d.comps[0].medal === 'gold' && d.comps[0].notes === 'Three subs, one points win.');
await page.goto(BASE + '#/history'); await settle(200); await page.locator('.histseg a', { hasText:'Comps' }).tap(); await settle(300);
ok('History > Comps shows past results', /City Open/.test(await page.locator('#pastComps').innerText()) && /Gold/i.test(await page.locator('#pastComps').innerText()) && /1 medal/.test(await page.locator('#pastComps').innerText()));

/* 8. benchmarks */
ok('Epley: 200 × 5 → 233.3; 1 rep → weight', Math.abs((await T(() => window.DM_TEST.epley(200, 5))) - 233.333) < .01 && (await T(() => window.DM_TEST.epley(315, 1))) === 315);
await page.goto(BASE + '#/benchmarks'); await page.waitForSelector('#benchAll');
await page.locator('[data-benchlog]').tap(); await page.waitForSelector('#bSave');
await page.fill('[data-b="pullups"]', '10'); await page.fill('[data-b="hang"]', '60'); await page.fill('[data-bw="bench"]', '200'); await page.fill('[data-br="bench"]', '5'); await settle(100);
ok('test sheet shows the Epley estimate live', /≈ 233 1RM/.test(await page.locator('[data-e1="bench"]').innerText()));
await page.locator('#bSave').tap(); await settle(400);
d = await db(); ok('benchmarks saved (bench est. 1RM 233.3)', d.benchmarks.length === 3 && d.benchmarks.find(b => b.key === 'bench').value === 233.3);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); const f = n => new Date(Date.now() - n*864e5).toLocaleDateString('en-CA');
  d.benchmarks.forEach(b => b.date = f(43)); d.benchmarks.push({ id:'old', date:f(90), key:'pullups', value:6 });
  d.sessions.push({ id:'sq', date:f(2), category:'weights', discipline:'strength', duration:50, rpe:7, exercises:[{ name:'Back squat', sets:[{ reps:5, weight:300 }, { reps:3, weight:315 }] }], createdAt:9 });
  localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await settle(300);
ok('retest reminder after 6 weeks (Benchmarks page + Home nudge)', /retest due/.test(await page.locator('#retestDue').innerText()) && (await page.goto(BASE + '#/'), await settle(300), await page.locator('#benchNudge').count()) === 1);
await page.goto(BASE + '#/benchmarks'); await settle(300);
const pu = page.locator('.benchrow[data-bench="pullups"]'), sq = page.locator('.benchrow[data-bench="squat"]');
ok('latest, best, change and sparkline', (await pu.locator('[data-v="latest"]').innerText()) === '10' && (await pu.locator('[data-v="best"]').innerText()) === '10' && /\+4 reps/.test(await pu.innerText()) && await pu.locator('svg.spark').count() === 1);
ok('squat est. 1RM computed from logged sets (Epley 300×5 = 350)', (await sq.locator('[data-v="latest"]').innerText()) === '350' && /from logs/.test(await sq.innerText()));
await page.evaluate(() => window.scrollTo(0, 0)); await hideToast(); await page.screenshot({ path:`${SHOTS}/44-benchmarks.png` });

/* 9. injuries */
await page.goto(BASE + '#/settings'); await page.waitForSelector('#injuryCard');
ok('no injury card on Home while nothing is active', (await page.goto(BASE + '#/'), await settle(200), await page.locator('[data-injcard]').count()) === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#injuryCard'); await page.locator('#injuryCard [data-addinj]').tap(); await page.waitForSelector('#injDate');
await page.locator('.sheet button[data-area="Knee"]').tap(); await page.locator('.sheet .seg button', { hasText:/^Left$/ }).tap(); await page.locator('.sheet .field', { hasText:'Severity' }).locator('button', { hasText:/^3$/ }).tap();
await page.fill('#injDate', D(-8)); await page.dispatchEvent('#injDate', 'change'); await page.locator('.sheet textarea').fill('Sore after leg locks.');
await page.locator('.sheet [data-save]').tap(); await settle(300);
await page.goto(BASE + '#/'); await settle(300);
ok('Home card while active: "Left knee · day 9 · severity 3"', (await page.locator('[data-injcard] [data-inj="label"]').innerText()) === 'Left knee · day 9 · severity 3');
await page.locator('[data-injupd]').tap(); await page.locator('.sheet .seg button', { hasText:/^2$/ }).tap(); await page.locator('#injUpdSave').tap(); await settle(300);
d = await db(); ok('severity update stored over time + small chart', d.injuries[0].severity === 2 && d.injuries[0].updates.length === 2 && await page.locator('[data-injcard] svg.sev').count() === 1 && /severity 2/.test(await page.locator('[data-injcard]').innerText()));
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats');
ok('log form shows a reminder while active', /Left knee \(severity 2\)/.test(await page.locator('#injReminder').innerText()));
await page.goto(BASE + '#/'); await settle(300); await page.locator('[data-injcard]').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -80)); await hideToast(); await settle(); await page.screenshot({ path:`${SHOTS}/45-injury.png` });
await page.locator('[data-injheal]').tap(); await settle(300);
d = await db(); ok('mark healed: card disappears, entry kept as healed', await page.locator('[data-injcard]').count() === 0 && !!d.injuries[0].healed && (await T(() => window.DM_TEST.activeInjuries().length)) === 0);
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); ok('no reminder once healed', await page.locator('#injReminder').count() === 0);

/* 10. programs: data, Pro gate, start, today's workout, progression, swap */
const P = await T(() => { const P = window.FORGED_PROGRAMS; return { t:P.templates.map(t => t.id), f:P.finishers.map(f => f.id), lib:Object.keys(P.library).length, miss:[...P.templates.flatMap(t => t.sessions.flatMap(s => s.ex)), ...P.finishers.flatMap(f => f.ex)].filter(e => !P.library[e.name] || !P.library[e.name].cue || !e.rest || !e.sets || !e.reps).length, alts:Object.values(P.library).every(x => x.alts.length && x.alts.every(a => P.library[a] && P.library[a].pattern)), disc:P.disclaimer }; });
ok('templates: 2-day, 3-day, home, comp prep + grip/neck/core/joint finishers', JSON.stringify(P.t) === '["full2","luf3","home","comp"]' && JSON.stringify(P.f) === '["grip","neck","core","joints"]');
ok('every exercise has sets, reps, rest, a cue and valid swaps', P.miss === 0 && P.alts && P.lib > 40);
ok('isPro() gate exists (true for now)', (await T(() => window.DM_TEST.isPro())) === true);
await page.goto(BASE + '#/programs'); await page.waitForSelector('#progList'); await settle();
ok('programs list + disclaimer (not medical advice, consult a coach)', await page.locator('#progList .tmpl').count() === 4 && /not medical advice/.test(await page.locator('#progDisclaimer').innerText()) && /coach/.test(await page.locator('#progDisclaimer').innerText()));
await hideToast(); await page.screenshot({ path:`${SHOTS}/47-programs.png` });
// comp prep block: peak then taper
const cp = await T(() => { const T = window.DM_TEST, p = { uid:'x', tid:'comp', start:new Date().toLocaleDateString('en-CA'), weeks:6, days:[2,4], finishers:[], swaps:{} };
  return [1,4,5,6].map(w => { const rx = T.prescription(p, { w, key:'A' }); const tb = rx.ex.find(e => e.name === 'Trap bar deadlift'); return [rx.phase, tb.sets, tb.reps, rx.ex.length]; }); });
ok('comp prep: build → peak (3×3) → taper (2×3, accessories cut) → comp week (2×2, main lifts only)', JSON.stringify(cp) === JSON.stringify([['Build',3,6,4],['Peak',3,3,4],['Taper',2,3,4],['Comp week',2,2,2]]), JSON.stringify(cp));
await page.locator('#progList .tmpl[data-tmpl="full2"]').tap(); await page.waitForSelector('#startProg'); await page.locator('#startProg').tap(); await page.waitForSelector('#progGo');
const td0 = new Date().getDay(), dA = td0, dB = (td0 + 3) % 7;
while (await page.locator('.sheet .daypick button.on').count()) await page.locator('.sheet .daypick button.on').first().tap();
await page.locator(`.sheet .daypick button[data-d="${dA}"]`).tap(); await page.locator(`.sheet .daypick button[data-d="${dB}"]`).tap();
await page.locator('#progGo').tap(); await settle(400);
d = await db(); ok('start program schedules 8 weeks × 2 days', d.program?.tid === 'full2' && (await T(() => window.DM_TEST.progSchedule(window.DM_TEST.activeProgram()).length)) === 16 && (await T(() => window.DM_TEST.progSchedule(window.DM_TEST.activeProgram())[0].date)) === D(0));
ok("today's workout on Home", /^Today/i.test(await page.locator('#progCard h2').innerText()) && /Week 1 · Day A/.test(await page.locator('#progCard').innerText()));
// seed last logs: trap bar all sets done (5×3 @ 300) → +5%; bench missed reps → repeat; pull-ups bodyweight done → +1 rep
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); const f = new Date(Date.now() - 3*864e5).toLocaleDateString('en-CA');
  d.sessions.push({ id:'pl', date:f, category:'weights', discipline:'strength', duration:50, rpe:7, createdAt:10, exercises:[
    { name:'Trap bar deadlift', plan:{ sets:3, lo:5, hi:5, unit:'reps' }, sets:[{ reps:5, weight:300 },{ reps:5, weight:300 },{ reps:5, weight:300 }] },
    { name:'Bench press', plan:{ sets:3, lo:6, hi:6, unit:'reps' }, sets:[{ reps:6, weight:185 },{ reps:6, weight:185 },{ reps:4, weight:185 }] },
    { name:'Pull-up', plan:{ sets:3, lo:5, hi:8, unit:'reps' }, sets:[{ reps:8, weight:'' },{ reps:8, weight:'' },{ reps:8, weight:'' }] },
    { name:'One-arm dumbbell row', plan:{ sets:3, lo:8, hi:10, unit:'reps' }, sets:[{ reps:10, weight:70 },{ reps:10, weight:70 },{ reps:10, weight:70 }] } ] });
  localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await settle(300);
const sg = await T(() => { const T = window.DM_TEST; return { tb:T.suggest('Trap bar deadlift', { sets:3, reps:5 }), be:T.suggest('Bench press', { sets:3, reps:6 }), pu:T.suggest('Pull-up', { sets:3, reps:[5,8] }), row:T.suggest('One-arm dumbbell row', { sets:3, reps:[8,10] }), none:T.suggest('Hip thrust', { sets:3, reps:8 }) }; });
ok('progression: all sets done → +5% lower body (300 → 315), reps reset', sg.tb.weight === 315 && sg.tb.reps === 5 && sg.tb.basis === 'up', JSON.stringify(sg.tb));
ok('progression: +2.5% upper body rounded to 5 lb (70 → 75)', sg.row.weight === 75 && sg.row.reps === 8);
ok('missed reps → repeat the weight', sg.be.weight === 185 && sg.be.basis === 'repeat');
ok('bodyweight: all sets done → +1 rep', sg.pu.reps === 9 && sg.pu.weight === '');
ok('no history → you pick the weight', sg.none.weight === '' && sg.none.reps === 8);
await page.locator('#progStart').tap(); await page.waitForSelector('.excard'); await settle(300);
const ex0 = await page.locator('.excard').first();
ok('workout opens the Weights log pre-filled with targets and suggested weights', await page.locator('.cats button.on[data-c="weights"]').count() === 1 && (await ex0.locator('.exname').inputValue()) === 'Trap bar deadlift' && (await ex0.locator('input[data-f="weight"]').first().inputValue()) === '315' && await ex0.locator('.setrow').count() === 3 && /Target 3 × 5/.test(await ex0.locator('.excue').innerText()) && await page.locator('#progBanner').count() === 1);
await page.locator('.excard', { has:page.locator('.exname[value="Bench press"]') }).locator('[data-swap]').tap(); await page.waitForSelector('.swaplist');
ok('swap offers same-pattern alternatives', JSON.stringify(await page.locator('.swaplist [data-swap]').evaluateAll(x => x.map(b => b.dataset.swap))) === '["Bench press","Dumbbell bench press","Push-up","Feet-elevated push-up"]');
await page.locator('.swaplist [data-swap="Push-up"]').tap(); await settle(300);
ok('swap replaces the exercise (bodyweight: no weight) and is remembered for the program', (await db()).program.swaps['Bench press'] === 'Push-up' && await page.locator('.exname[value="Push-up"]').count() === 1 && await page.locator('.exname[value="Bench press"]').count() === 0);
await page.locator('.excard').first().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -260)); await hideToast(); await settle(); await page.screenshot({ path:`${SHOTS}/48-program-workout.png` });
await page.locator('.actions [data-save]').tap(); await settle(400);
d = await db(); const ps = d.sessions.find(s => s.prog);
ok('saved program session links to the schedule; next item becomes the next workout', ps && ps.prog.i === 0 && ps.exercises[0].plan.sets === 3 && (await T(() => window.DM_TEST.progNext(window.DM_TEST.activeProgram()).item.i)) === 1);
const swapped = await T(() => { const T = window.DM_TEST, p = T.activeProgram(); return T.prescription(p, T.progSchedule(p)[2]).ex.map(e => e.name); });
ok('swap applies to future sessions', swapped.includes('Push-up') && !swapped.includes('Bench press'));
ok('deload week 4: one set fewer', (await T(() => { const T = window.DM_TEST, p = T.activeProgram(); return T.prescription(p, { w:4, key:'A' }).ex[0].sets; })) === 2);

/* 11. export/import round trip + clear + countdown screenshot with sample data */
await page.goto(BASE + '#/settings'); await page.waitForSelector('#exp');
const b4 = await db();
[dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]); await dl.saveAs('/tmp/feat-exp2.json');
exp = JSON.parse(fs.readFileSync('/tmp/feat-exp2.json','utf8'));
ok('export has comps, benchmarks, injuries, challenges, program', exp.comps.length === 1 && exp.benchmarks.length === b4.benchmarks.length && exp.injuries.length === 1 && exp.challenges.length === 1 && exp.program?.tid === 'full2');
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(300);
d = await db(); ok('clear all data removes the new collections and the archive', d.comps.length === 0 && d.benchmarks.length === 0 && d.injuries.length === 0 && d.challenges.length === 0 && d.program === null && !d.archive);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', '/tmp/feat-exp2.json'); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db(); const K = x => JSON.stringify([x.comps, x.benchmarks, x.injuries, x.challenges, x.program, x.sessions.length, x.profile.schedule, x.profile.challengeTarget]);
ok('import restores everything', K(d) === K(b4));
// sample data
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(300);
await page.goto(BASE); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await page.waitForSelector('#compCard'); await settle(400);
d = await db();
ok('sample data: comps, benchmarks, active + healed injury, challenge months, program, effort/feel', d.comps.length === 3 && d.benchmarks.length >= 12 && d.injuries.length === 2 && d.challenges.length >= 2 && d.program?.sample && d.sessions.filter(s => s.rpe).length > 50 && d.sessions.some(s => s.feel) && Object.keys(d.profile.schedule).length >= 3);
await hideToast(); await page.evaluate(() => window.scrollTo(0, 0)); await settle();
const cc = await page.locator('#compCard').boundingBox(); await page.evaluate(y => window.scrollTo(0, y - 70), cc.y); await settle(200); await hideToast();
await page.screenshot({ path:`${SHOTS}/43-comp-countdown.png` });
await page.locator('#weekCard').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -60)); await settle(200); await hideToast();
await page.screenshot({ path:`${SHOTS}/40-week-strip.png` });
// ring screenshot: hit the goal with sample data present
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); const m = new Date().toLocaleDateString('en-CA').slice(0,7); d.sessions.forEach(s => { if (s.date.startsWith(m)) s.sample = false; }); d.profile.challengeTarget = d.sessions.filter(s => s.date.startsWith(m)).length + 1; d.challenges = d.challenges.filter(x => x.month !== m); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await settle(300);
await page.locator('.quick [data-rep]').first().tap(); await page.waitForSelector('.confetti'); await page.waitForTimeout(450);
await page.locator('#challenge').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -330)); await page.waitForTimeout(150);
await page.screenshot({ path:`${SHOTS}/46-challenge-ring.png` });
await page.waitForTimeout(2600);
await page.goto(BASE + '#/settings'); await page.locator('#rmS').tap(); await settle(400);
d = await db(); ok('remove sample removes sample comps/benchmarks/injuries/program', d.comps.length === 0 && d.benchmarks.length === 0 && d.injuries.length === 0 && !d.program && d.challenges.every(x => !x.sample));
/* Striking/MMA: Open mat → Pad work (grappling keeps Open mat) */
await seed({ schema:6, profile:prof({ enabled:{ grappling:true, striking:true, mma:true } }), nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[],
  sessions:[S('po1', D(-3), { type:'open' }), S('po2', D(-2), { category:'striking', discipline:'muaythai', type:'open', strike:{ roundLen:3, mix:{}, spar:[] } }), S('po3', D(-1), { category:'mma', discipline:'mma', type:'open', strike:{ roundLen:5, mix:{}, spar:[] } })] });
d = await db();
ok('migration: Striking/MMA Open mat sessions become Pad work; BJJ Open mat kept', d.sessions.find(s => s.id === 'po1').type === 'open' && d.sessions.find(s => s.id === 'po2').type === 'pads' && d.sessions.find(s => s.id === 'po3').type === 'pads', JSON.stringify(d.sessions.map(s => [s.id, s.type])));
await page.goto(BASE + '#/session/po2'); await settle();
ok('Striking detail shows Pad work', /Pad work/i.test(await page.locator('#title').innerText() + await page.locator('#view').innerText()));
await page.goto(BASE + '#/edit/po3'); await page.waitForSelector('.cats');
ok('editing an MMA session: Pad work selected, no Open mat option', (await page.locator('.field', { has:page.locator('label', { hasText:/^Session type$/ }) }).locator('button.on').innerText()) === 'Pad work' && await page.getByRole('radio', { name:'Open mat' }).count() === 0);
await page.goto(BASE + '#/edit/po1'); await page.waitForSelector('.cats');
ok('editing a BJJ session: Open mat kept', (await page.locator('.field', { has:page.locator('label', { hasText:/^Session type$/ }) }).locator('button.on').innerText()) === 'Open mat');
await page.goto(BASE + '#/'); await settle(200);
fs.writeFileSync('/tmp/feat-pads.json', JSON.stringify({ app:'forged', version:'3.0.0', schema:6, profile:prof(), sessions:[S('pi1', D(-2), { category:'striking', discipline:'boxing', type:'open' })], nutrition:{ entries:[], foods:[], water:[] } }));
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', '/tmp/feat-pads.json'); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db(); ok('importing an old backup maps Striking Open mat to Pad work', d.sessions.find(s => s.id === 'pi1')?.type === 'pads', JSON.stringify(d.sessions.map(s => [s.id, s.type])));
await page.evaluate(() => localStorage.clear()); await page.goto(BASE + '#/'); await page.reload(); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await settle(500);
d = await db(); ok('sample data: Striking/MMA use Pad work, never Open mat', d.sessions.some(s => (s.category === 'striking' || s.category === 'mma') && s.type === 'pads') && !d.sessions.some(s => (s.category === 'striking' || s.category === 'mma') && s.type === 'open'));
ok('storage key unchanged', await page.evaluate(() => !!localStorage.getItem('dm.bjj.v1')));
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
