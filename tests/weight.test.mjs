// 3.5.0 weight management: Lose / Maintain / Gain modes, migration, mode-aware calculator, gain wording + ETA,
// pace notes, weekly-average trend, onboarding + Profile + Home choice, weight plans with auto-adjust + lifting pairing.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
process.on('uncaughtException', e => { console.log(results.join('\n')); console.log('ERROR', e.message.split('\n')[0]); process.exit(1); });
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const T = (fn, arg) => page.evaluate(fn, arg);
const hideToast = async () => { await page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); }); await settle(500); };
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const seed = async (data, hash = '', sel = '#weightCard') => { await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data); await page.goto(BASE + hash); await page.reload(); await page.waitForSelector(sel); await settle(300); };
const EN = (o) => ({ grappling:true, striking:false, mma:false, weights:false, cardio:false, mobility:false, food:true, weight:true, ...o });
const prof = (x={}) => ({ name:'', unit:'lb', distUnit:'mi', setupDone:true, enabled:EN(), ...x });
const S = (id, date, o={}) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', weight:'', rolls:[], sample:false, createdAt:1, ...o });
const W = (n, w) => ({ id:'w'+n+'_'+w, date:D(-n), w, u:'lb', createdAt:Date.now() - n*864e5 });
// weigh-ins every 2 days for `days`, linear from w0 at -days to w1 today
const series = (days, w0, w1) => { const out = []; for (let n = days; n >= 0; n -= 2) out.push(W(n, Math.round((w1 + (w0 - w1) * n / days) * 10) / 10)); return out; };
const base = (o = {}) => ({ schema:7, sessions:[S('a', D(-2))], profile:prof(), nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], ...o });
const txt = sel => page.locator(sel).innerText();
const wv = async k => (await page.locator(`#weightCard [data-w="${k}"]`).innerText()).replace(/[^\d.–-]/g, '');

/* 1. inference + migration */
await seed(base());
ok('inferMode: goal < current = lose, > = gain, none/equal = maintain', await T(() => { const f = window.DM_TEST.inferMode; return f(180, 190) === 'lose' && f(200, 190) === 'gain' && f('', 190) === 'maintain' && f(190, 190) === 'maintain'; }));
ok('inferMode: goal already passed keeps the start → goal direction', await T(() => window.DM_TEST.inferMode(195, 190, 215) === 'lose'));
for (const [name, p, ws, want] of [['goal < current → Lose', { goalWeight:'180', startWeight:'200' }, [W(1, 195)], 'lose'], ['goal > current → Gain', { goalWeight:'170', startWeight:'150' }, [W(1, 155)], 'gain'], ['no goal → Maintain', { goalWeight:'' }, [W(1, 175)], 'maintain']]) {
  await seed(base({ profile:prof(p), weights:ws }));
  const d = await db(); ok(`migration: ${name} (saved as weightMode)`, d.profile.weightMode === want && await page.locator('#weightCard').getAttribute('data-mode') === want, d.profile.weightMode);
}
await seed(base({ profile:prof({ setupDone:false }), sessions:[], weights:[] }), '', '#view');
ok('migration skips brand-new users (onboarding asks)', !(await db())?.profile?.weightMode);

/* 2. Home card: 3-way choice, Maintain range + in-range status */
await seed(base({ profile:prof({ weightMode:'maintain', maintainW:'180' }), weights:series(20, 181, 179.6) }));
ok('Home weight card has a clear 3-way choice', await page.locator('#homeMode [data-wmode]').count() === 3 && /Lose weight/i.test(await txt('#homeMode')) && /Maintain/i.test(await txt('#homeMode')) && /Gain weight/i.test(await txt('#homeMode')) && await page.locator('#homeMode [data-wmode="maintain"]').getAttribute('aria-checked') === 'true');
ok('Maintain: no goal weight, ±3 lb range 177–183 and "In range" status', await page.locator('#weightCard [data-w="goal"]').count() === 0 && await wv('range') === '177–183' && /in range/i.test(await txt('#weightCard [data-w="status"]')) && /In range ✓/.test(await txt('#weightHint')));
ok('Maintain: status uses the 7-day average', Math.abs(Number(await wv('avg')) - 179.8) < 0.3, await wv('avg'));
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.weights.push({ id:'x1', date:new Date().toLocaleDateString('en-CA'), w:186, u:'lb', createdAt:Date.now()+5 }); d.weights = d.weights.filter(w => w.date >= new Date(Date.now() - 7*864e5).toLocaleDateString('en-CA')); d.weights.forEach(w => w.w = 186); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await page.waitForSelector('#weightCard');
ok('Maintain: out of range shows how far above', /above range/i.test(await txt('#weightCard')) && /3 lb above your range/.test(await txt('#weightHint')), await txt('#weightHint'));
// weekly average trend line
await seed(base({ profile:prof({ weightMode:'lose', goalWeight:'185', startWeight:'200' }), weights:series(42, 200, 194) }));
ok('weight card: weekly-average trend line over the daily weigh-ins', await page.locator('#weightCard svg.spark path.wavg').count() === 1 && await page.locator('#weightCard svg.spark path.daily').count() === 1);
ok('weight card: "Weekly avg" line with change vs last week', /Weekly avg [\d.]+ lb · −[\d.]+ vs last week/i.test((await page.locator('#wAvg').textContent()).replace(/\s+/g, ' ')), await txt('#wAvg'));
ok('Lose wording: Lost so far / To lose / "9 lb to lose"', /Lost so far/i.test(await txt('#weightCard')) && /To lose/i.test(await txt('#weightCard')) && /9 lb to lose/.test(await txt('#weightHint')) && /lost 6 lb/.test(await txt('#weightHint')), await txt('#weightHint'));

/* 3. Gain: wording, progress, ETA; switching from Home */
await seed(base({ profile:prof({ weightMode:'gain', goalWeight:'160', startWeight:'150' }), weights:series(28, 150, 152) }));
ok('Gain wording: "Gained so far" / "To gain"', /Gained so far/i.test(await txt('#weightCard')) && /To gain/i.test(await txt('#weightCard')) && await wv('done') === '2' && await wv('left') === '8');
ok('Gain hint: "8 lb to gain · gained 2 lb · 20%"', /8 lb to gain · gained 2 lb · 20%/.test(await txt('#weightHint')), await txt('#weightHint'));
{ const h = await txt('#weightHint'); const m = h.match(/est\. (.+)$/); const want = new Date(); want.setDate(want.getDate() + 112);
  ok('Gain: estimated goal date (~16 weeks at +0.5 lb/wk)', !!m && Math.abs(new Date(m[1] + (/\d{4}/.test(m[1]) ? '' : ', ' + want.getFullYear())) - want) < 10*864e5, h); }
ok('gain at +0.5 lb/wk: no pace warning', await page.locator('#weightWarn').count() === 0);
await page.locator('#weightMore').tap(); await page.waitForSelector('#weightStats');
ok('Trend page: gain goal "8 lb to gain" + projected date', /8 lb to gain/.test(await txt('#weightStats')) && await page.locator('#eta').count() === 1);
await page.goto(BASE); await page.waitForSelector('#weightCard');
await page.locator('#homeMode [data-wmode="maintain"]').tap(); await settle();
let d = await db();
ok('Home: tapping Maintain switches mode, centres the range on your weekly average', d.profile.weightMode === 'maintain' && Math.abs(Number(d.profile.maintainW) - 151.7) < 0.6 && await page.locator('#weightCard').getAttribute('data-mode') === 'maintain', d.profile.maintainW);
await page.locator('#homeMode [data-wmode="gain"]').tap(); await settle();
ok('Home: back to Gain restores the goal', (await db()).profile.weightMode === 'gain' && await wv('goal') === '160');

/* 4. pace notes */
await seed(base({ profile:prof({ weightMode:'gain', goalWeight:'175', startWeight:'160' }), weights:series(21, 160, 164.5) }));
ok('gaining ~1.5 lb/wk: gentle "mostly fat at this pace" note', /mostly fat/i.test(await txt('#weightWarn')), await page.locator('#weightCard').innerText());
await seed(base({ profile:prof({ weightMode:'lose', goalWeight:'170', startWeight:'190' }), weights:series(21, 190, 183.5) }));
ok('losing > 1% body weight a week: caution note', /more than 1% of your body weight/i.test(await txt('#weightWarn')));
await seed(base({ profile:prof({ weightMode:'lose', goalWeight:'170', startWeight:'190' }), weights:series(21, 190, 187) }));
ok('losing 1 lb/wk at 187 lb: no caution', await page.locator('#weightWarn').count() === 0);

/* 5. calculator respects the mode */
const mc = await T(() => { const c = window.DM_TEST.macroCalc, b = { sex:'m', age:30, cm:178, kg:81.6, goalKg:81.6, act:'active' };
  return { g:['slow','steady','aggressive'].map(p => c({ ...b, mode:'gain', pace:p })), m:c({ ...b, mode:'maintain', goalKg:75 }), l:c({ ...b, goalKg:75, pace:'steady' }), lm:c({ ...b, goalKg:75, pace:'steady', mode:'lose' }), old:c({ ...b, goalKg:90, pace:'steady' }) }; });
ok('Gain: lean-bulk surplus +250 / +350 / +500', mc.g.map(r => r.cal - r.maint).every((x, i) => Math.abs(x - [250, 350, 500][i]) <= 5), JSON.stringify(mc.g.map(r => r.cal - r.maint)));
ok('Gain: protein ~1 g/lb (180 lb → ~180 g)', mc.g.every(r => r.p >= 170 && r.p <= 182), JSON.stringify(mc.g.map(r => r.p)));
ok('Gain: higher carbs than maintenance', mc.g[1].c > mc.m.c && mc.g[1].c > mc.l.c);
ok('Maintain: maintenance calories even with a goal typed', mc.m.cal === Math.round(mc.m.maint / 10) * 10 && mc.m.dir === 0);
ok('Lose: same numbers as before (with or without the mode)', mc.l.cal === mc.lm.cal && mc.l.p === mc.lm.p && mc.l.cal === Math.round((mc.l.maint - 500) / 10) * 10);
ok('Gain with a goal: goal date estimated', !!mc.old.goalDate && mc.old.dir === 1);

/* 6. onboarding: step 2 + step 3 */
await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#go');
await page.locator('.tile[data-k="weight"]').tap(); await page.locator('#go').tap(); await page.waitForSelector('#aboutForm');
ok('step 2 "About you": Lose / Maintain / Gain choice', await page.locator('#mcMode [data-wmode]').count() === 3);
await page.locator('#aboutForm .seg button', { hasText:/^Male$/ }).tap(); await page.locator('#mcAge').fill('28'); await page.locator('#mcFt').fill('5'); await page.locator('#mcIn2').fill('9');
await page.locator('#mcW').fill('160'); await page.locator('#mcGw').fill('170'); await settle(100);
ok('step 2: defaults from goal vs current (170 > 160 → Gain)', await page.locator('#mcMode [data-wmode="gain"]').getAttribute('aria-checked') === 'true' && /How fast to gain/i.test(await page.locator('#aboutForm').innerText()) && /\+350 kcal/.test(await page.locator('#aboutForm').innerText()));
await page.locator('#mcMode [data-wmode="maintain"]').tap(); await settle(100);
ok('step 2: Maintain hides goal weight + pace', await page.locator('#mcGw').isHidden() && /±3 lb/.test(await page.locator('#mcModeSub').innerText()));
await page.locator('#mcMode [data-wmode="gain"]').tap(); await page.locator('#mcGw').fill('150'); await settle(100);
ok('step 2: explicit choice sticks (typing a lower goal does not flip it)', await page.locator('#mcMode [data-wmode="gain"]').getAttribute('aria-checked') === 'true');
await page.locator('#aboutNext').tap(); await settle(200);
ok('step 2: goal on the wrong side for Gain is caught', /below your current weight/i.test(await page.locator('#toast').innerText()));
await page.locator('#mcGw').fill('170'); await page.locator('#aboutNext').tap(); await page.waitForSelector('#setupMode');
ok('step 3: mode prefilled from step 2 (Gain)', await page.locator('#setupMode [data-wmode="gain"]').getAttribute('aria-checked') === 'true' && await page.locator('#setupGoal').inputValue() === '170');
const calGain = Number(await page.locator('#setupT-cal').inputValue());
await page.locator('#setupMode [data-wmode="maintain"]').tap(); await settle(100);
const calMaint = Number(await page.locator('#setupT-cal').inputValue());
ok('step 3: switching to Maintain re-runs the targets (−350 kcal) and hides the goal', calGain - calMaint >= 340 && calGain - calMaint <= 360 && await page.locator('#setupGoal').isHidden() && /maintain/i.test(await txt('#setupCalcNote')), `${calGain}→${calMaint}`);
await page.locator('#setupMode [data-wmode="gain"]').tap(); await settle(100);
await hideToast(); await page.locator('#setupMode').scrollIntoViewIfNeeded();
const shotStep3 = await page.locator('#setupMode').evaluate(e => e.closest('.card').getBoundingClientRect().height);
const stepBuf = await page.locator('#setupMode').evaluate(e => e.closest('.card').id = 'setupWeightCard');
const s3 = await page.locator('#setupWeightCard').screenshot();
await page.locator('#setupDone').tap(); await page.waitForSelector('#weightCard');
d = await db();
ok('step 3: finish saves the mode + goal', d.profile.weightMode === 'gain' && d.profile.goalWeight === '170' && d.profile.calc.mode === 'gain');
ok('Home card after onboarding: "10 lb to gain"', /10 lb to gain/.test(await txt('#weightHint')), await txt('#weightHint'));
const s1 = await page.locator('#weightCard').screenshot();

/* 7. Profile: mode choice; Maintain swaps goal fields for a range */
await page.goto(BASE + '#/settings'); await page.waitForSelector('#modeSeg');
ok('Profile: 3-way choice with Gain selected + goal weight', await page.locator('#modeSeg [data-wmode="gain"]').getAttribute('aria-checked') === 'true' && await page.locator('#goalW').count() === 1);
await page.locator('#modeSeg [data-wmode="maintain"]').tap(); await settle(250);
ok('Profile: Maintain hides goal weight/date, shows "Maintain around" + range', await page.locator('#goalW').count() === 0 && await page.locator('#maintainW').inputValue() === '160' && /Range 157–163 lb/.test(await page.locator('#maintainW').locator('..').innerText()));
ok('Profile: offers to update calorie targets', /Update/i.test(await page.locator('#toast').innerText()));
await page.locator('#toast button').first().tap(); await page.waitForSelector('#mcMode');
ok('Update opens the calculator in Maintain', await page.locator('#mcMode [data-wmode="maintain"]').getAttribute('aria-checked') === 'true');
await page.locator('#mcGo').tap(); await page.waitForSelector('#mcResult');
ok('calculator result: maintain', /maintain/i.test(await page.locator('[data-r="wk"]').innerText()));
await page.locator('#mcUse').tap(); await settle(300);
d = await db();
ok('Use: maintenance targets saved, mode stays Maintain', d.profile.weightMode === 'maintain' && d.profile.targets.cal === d.profile.targets.cal && d.profile.calc.mode === 'maintain');
await page.locator('#maintainW').fill('165'); await page.locator('#maintainW').dispatchEvent('change'); await settle(200);
ok('Profile: range centre editable', (await db()).profile.maintainW === '165');
await page.goto(BASE); await page.waitForSelector('#weightCard');
const s2 = await page.locator('#weightCard').screenshot();
await page.goto(BASE + '#/settings'); await page.waitForSelector('#modeSeg');
await page.locator('#modeSeg [data-wmode="lose"]').tap(); await settle(250);
await page.locator('#goalW').fill('175'); await page.locator('#goalW').dispatchEvent('change'); await settle(250);
{ const dd = await db(), tt = await page.locator('#toast').innerText(); ok('Profile: a goal above current while on Lose switches to Gain', dd.profile.weightMode === 'gain' && dd.profile.goalWeight === '175' && await page.locator('#modeSeg [data-wmode="gain"]').getAttribute('aria-checked') === 'true', `${dd.profile.weightMode} ${dd.profile.goalWeight} ${tt}`); }

/* 8. mismatch hint on Home */
await seed(base({ profile:prof({ weightMode:'lose', goalWeight:'190', startWeight:'180' }), weights:[W(1, 182)] }));
ok('Home: goal on the wrong side offers to switch', /above your current weight/i.test(await txt('#weightHint')) && await page.locator('#modeFix').count() === 1);
await page.locator('#modeFix').tap(); await settle();
ok('switch fixes it: Gain, "8 lb to gain"', (await db()).profile.weightMode === 'gain' && /8 lb to gain/.test(await txt('#weightHint')));

/* screenshot 68: the three modes on the Home card + step 3 choice */
{ const p2 = await ctx.newPage(); const im = b => `data:image/png;base64,${b.toString('base64')}`;
  await p2.setViewportSize({ width:390, height:844 });
  await p2.setContent(`<html><body style="margin:0;background:#0B0B0C;font:600 13px -apple-system,system-ui,sans-serif;color:#a3a3a8"><div style="padding:14px 12px;display:flex;flex-direction:column;gap:8px">
    <div>Onboarding step 3 · Your goal</div><img src="${im(s3)}" style="width:100%;border-radius:18px">
    <div>Gain weight</div><img src="${im(s1)}" style="width:100%;border-radius:18px"><div>Maintain (range + in-range status)</div><img src="${im(s2)}" style="width:100%;border-radius:18px"></div></body></html>`);
  await p2.screenshot({ path:`${SHOTS}/68-weight-modes.png`, fullPage:true }); await p2.close(); }

/* 9. weight plans on Programs */
const calcS = { sex:'m', age:30, hu:'ftin', ft:5, inch:10, cm:'', w:170, gw:'', u:'lb', act:'active', pace:'steady', mode:'maintain', at:D(-30) };
await seed(base({ profile:prof({ weightMode:'maintain', calc:calcS, enabled:EN({ weights:true }) }), weights:series(14, 170, 170) }), '#/programs', '#wplanList');
ok('Programs: weight plans alongside the lifting programs', await page.locator('#wplanList [data-wplan]').count() === 3 && /Lean Gain/.test(await txt('#wplanList')) && /Maintain & Perform/.test(await txt('#wplanList')) && /Cut for Comp \/ Fat Loss/.test(await txt('#wplanList')) && await page.locator('#progList').count() === 1);
await page.locator('[data-wplan="lean"]').tap(); await page.waitForSelector('#wpTable');
const maint = await T(() => window.DM_TEST.planBase().maint);
const rows = await page.locator('#wpTable .wpr').allInnerTexts();
ok('Lean Gain: 8 / 10 / 12 weeks, 10 by default', await page.locator('#wpLen button').count() === 3 && rows.length === 10);
const kc = r => Number(r.split('\n')[1].replace(/\D/g, ''));
ok('Lean Gain: weekly calories +250 then +350 over maintenance', Math.abs(kc(rows[0]) - maint - 250) <= 5 && Math.abs(kc(rows[2]) - maint - 350) <= 5, `${maint} ${rows[0]} | ${rows[2]}`);
ok('Lean Gain: protein ~1 g/lb (170 g) and expected weekly-average weight', /170 g/.test(rows[0]) && /~170\.4/.test(rows[0]) && /~173\.8/.test(rows[9]), rows[0] + ' / ' + rows[9]);
ok('plan page: check-ins say weigh 3–4×/week and use the weekly average', /3–4 mornings a week/.test(await txt('#wpCheck')) && /weekly average/i.test(await txt('#wpCheck')));
ok('plan page: auto-adjust tips (+150 kcal when flat for 2 weeks)', /flat for 2 weeks: add 150 kcal/i.test(await txt('#wpAdjust')));
ok('Lean Gain pairs with the 3-day strength program', /3-day lower \/ upper \/ full/i.test(await txt('#wpPair')) && await page.locator('#wpPair a[href="#/program/luf3"]').count() === 1 && await page.locator('#wpStartLift').count() === 1);
ok('plan page: conservative, not medical advice', /not medical advice/i.test(await txt('#wpDisclaimer')) && /dehydrating/i.test(await txt('#wpDisclaimer')));
await page.locator('#wpLen button', { hasText:/^12 weeks$/ }).tap(); await settle(100);
ok('length choice updates the table', await page.locator('#wpTable .wpr').count() === 12);
await page.locator('#wpLen button', { hasText:/^10 weeks$/ }).tap(); await settle(100);
await page.locator('#wpStart').tap(); await settle(300);
d = await db();
ok('Start plan: Gain mode, week-1 targets, plan saved', d.profile.weightMode === 'gain' && d.profile.wplan?.id === 'lean' && d.profile.wplan.weeks === 10 && Math.abs(d.profile.targets.cal - maint - 250) <= 5 && d.profile.targets.p === 170, JSON.stringify(d.profile.wplan));
ok('Start plan: a matching goal weight + date are filled in', Number(d.profile.goalWeight) > 173 && Number(d.profile.goalWeight) < 175 && !!d.profile.goalDate);
await page.goto(BASE + '#/program/wp-lean'); await page.waitForSelector('#wpTable');
ok('plan page when active: current week marked + End plan', await page.locator('#wpTable .wpr.now').count() === 1 && await page.locator('#wpEnd').count() === 1);
await hideToast(); await page.screenshot({ path:`${SHOTS}/69-gain-program.png`, fullPage:true });
await page.goto(BASE); await page.waitForSelector('#weightCard');
ok('Home: plan status line (Lean Gain · week 1 of 10 · kcal · protein)', /Lean Gain · week 1 of 10 · [\d,]+ kcal · 170 g protein/i.test(await txt('#planLine')), await txt('#planLine'));
await page.locator('#wpStartLift').count();
await page.goto(BASE + '#/program/wp-lean'); await page.waitForSelector('#wpStartLift'); await page.locator('#wpStartLift').tap(); await page.waitForSelector('#progGo');
ok('pairing: Start the 3-day program from the plan', /Start 3-day lower/i.test(await page.locator('.sheet').innerText()));
await page.locator('.sheet [data-close]').first().tap(); await settle();

/* 10. auto-adjust: flat for 2 weeks → +150 */
await seed(base({ profile:prof({ weightMode:'gain', goalWeight:'175', startWeight:'170', calc:calcS, targets:{ cal:3000, p:170, c:380, f:80 }, wplan:{ id:'lean', start:D(-21), weeks:10, maint:2650, floor:1700, est:false, startW:170, u:'lb', adj:0, cal:3000, adjAt:'', snooze:'' } }), weights:series(21, 170, 170.1) }));
ok('auto-adjust: flat weekly average for 2 weeks suggests +150 kcal', /hasn’t gone up in 2 weeks/i.test(await txt('#planAdvice')) && /Apply \+150/i.test(await txt('#planApply')), await page.locator('#planLine').innerText().catch(() => ''));
await page.locator('#planApply').tap(); await settle(300);
d = await db();
ok('Apply: +150 kcal (carbs up), adjustment remembered', d.profile.targets.cal === 3150 && d.profile.targets.c === 380 + 38 && d.profile.wplan.adj === 150 && d.profile.wplan.adjAt === D(0), JSON.stringify(d.profile.targets));
ok('after applying, no new suggestion for 2 weeks', await page.locator('#planAdvice').count() === 0);
// gaining too fast → −150 ; Not now snoozes
await seed(base({ profile:prof({ weightMode:'gain', goalWeight:'180', startWeight:'170', targets:{ cal:3000, p:170, c:400, f:80 }, wplan:{ id:'lean', start:D(-21), weeks:10, maint:2650, floor:1700, est:false, startW:170, u:'lb', adj:0, cal:3000, adjAt:'', snooze:'' } }), weights:series(21, 170, 174) }));
ok('auto-adjust: gaining > 1 lb/wk suggests −150 kcal', /more than 1 lb a week/i.test(await txt('#planAdvice')) && /Apply −150/.test(await txt('#planApply')));
await page.locator('#planSnooze').tap(); await settle();
ok('Not now hides it for a week', await page.locator('#planAdvice').count() === 0 && (await db()).profile.wplan.snooze === D(7));

/* 11. Cut + Maintain plans */
await seed(base({ profile:prof({ weightMode:'lose', goalWeight:'175', calc:{ ...calcS, w:190 } }), weights:series(14, 190, 190) }), '#/program/wp-cut', '#wpTable');
{ const r = await page.locator('#wpTable .wpr').allInnerTexts(), m = await T(() => window.DM_TEST.planBase().maint);
  ok('Cut: −500 kcal, protein ~1 g/lb, about 1 lb a week', Math.abs(kc(r[0]) - (m - 500)) <= 5 && /190 g/.test(r[0]) && /~189/.test(r[0]), r[0]);
  ok('Cut: last week eases off (no crash cut)', /Ease off/i.test(r[r.length - 1]) && kc(r[r.length - 1]) > kc(r[0]));
  ok('Cut pairs with the 2-day program', /2-day full body/i.test(await txt('#wpPair'))); }
ok('Cut: deficit capped at 1% of body weight a week', await T(() => { const pl = window.DM_TEST.wplanOf('cut'); const r = window.DM_TEST.planRows(pl, 8, { maint:2000, floor:1200, lb:80 }); return r[0].delta === -400 + 0 || Math.abs(r[0].delta + 400) <= 10; }));
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.comps = [{ id:'c1', name:'Spring Open', date:new Date(Date.now() + 35*864e5).toLocaleDateString('en-CA'), sport:'BJJ', createdAt:1 }]; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await page.waitForSelector('#wpPair');
ok('Cut with a comp 5 weeks out pairs with the comp prep block', /Comp prep block/i.test(await txt('#wpPair')) && /Spring Open/.test(await txt('#wpPair')));
await page.goto(BASE + '#/program/wp-maintain'); await page.waitForSelector('#wpTable');
{ const r = await page.locator('#wpTable .wpr').allInnerTexts(), m = await T(() => window.DM_TEST.planBase().maint);
  ok('Maintain & Perform: maintenance calories, pairs with 2-day', Math.abs(kc(r[0]) - m) <= 5 && /2-day full body/i.test(await txt('#wpPair'))); }
await page.locator('#wpStart').tap(); await settle(300);
d = await db();
ok('Start Maintain & Perform: Maintain mode around the current average', d.profile.weightMode === 'maintain' && d.profile.wplan.id === 'maintain' && d.profile.maintainW === '190');
ok('switching mode away ends a plan for the other goal', await T(() => { window.DM_TEST.setWeightMode('gain', { quiet:true }); return !window.DM_TEST.db.profile.wplan; }));
// rough maintenance without calculator details
await seed(base({ profile:prof({ weightMode:'gain' }), weights:[W(0, 160)] }), '#/program/wp-lean', '#wpTable');
ok('no calculator details: rough maintenance (×15) with a Calculate link', /body weight × 15/.test(await txt('#wpWeeks')) && await page.locator('#wpCalc').count() === 1 && /2,650/.test(await page.locator('#wpTable .wpr').first().innerText()));

/* 12. kg users */
await seed(base({ profile:prof({ unit:'kg', weightMode:'maintain', maintainW:'80' }), weights:[{ id:'k', date:D(0), w:80.4, u:'kg', createdAt:1 }] }));
ok('kg: Maintain range is ±1.5 kg', await wv('range') === '78.5–81.5');

ok('no console errors', errors.length === 0, JSON.stringify(errors));
await browser.close();
console.log(results.join('\n'));
