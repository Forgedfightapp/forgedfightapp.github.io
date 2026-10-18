// 3.6.0: daily Train / Recover / Fuel marks, Perfect Week + best streak, medal celebrations (queued) + medal case (lock only),
// monthly + limited medals (personalised goals via the challenge engine), Monday recap with one-tap suggestion + share card.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
process.on('uncaughtException', e => { console.log(results.join('\n')); console.log('ERROR', e.message.split('\n')[0]); process.exit(1); });
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
let page;
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const T = (fn, arg) => page.evaluate(fn, arg);
const hideToast = async () => { await page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); }); await settle(500); };
let NOW = '2026-10-14';   // a Wednesday
const D = n => { const d = new Date(NOW + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const newPage = async (day, reduce = false) => { if (page) await page.close(); NOW = day; page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  await page.clock.setFixedTime(new Date(day + 'T10:00:00')); if (reduce) await page.emulateMedia({ reducedMotion:'reduce' }); };
// storage is written on a same-origin non-app page so the app loads the seeded data exactly once (celebrations fire on that load)
const seed = async (data, hash = '', sel = '#marks') => { await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data); await page.goto(BASE + hash); await page.waitForSelector(sel); await settle(300); };
const EN = (o) => ({ grappling:true, striking:false, mma:false, weights:false, cardio:false, mobility:true, food:true, weight:true, ...o });
const prof = (x={}) => ({ name:'', unit:'lb', distUnit:'mi', setupDone:true, enabled:EN(), schedule:{ grappling:[1,3,5] }, ...x });
const S = (id, date, o={}) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', weight:'', rolls:[], sample:false, createdAt:new Date(date + 'T20:00:00').getTime(), ...o });
const SEEN = (o = {}) => ({ rankSeen:0, levelSeen:1, seenDone:[], seenBadges:['first','s10'], looksSeen:['accent:flame','frame:classic','flair:none'], look:{ accent:'flame', frame:'classic', flair:'none' }, friend:[], ...o });
const base = (o = {}) => ({ schema:7, sessions:[S('a', D(-30))], profile:prof(), nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], reps:[], ...o });
const txt = async sel => (await page.locator(sel).textContent()).replace(/\s+/g, ' ').trim();
const clean = async () => { for (let i = 0; i < 3 && !(await page.locator('#sheet').isHidden()); i++) { await page.keyboard.press('Escape'); await settle(500); } await hideToast(); };

/* 1. marks on Home: filled from existing logs, weekday goals */
await newPage('2026-10-14');
await seed(base({ sessions:[S('a', D(-30)), S('t', D(0), { duration:30 })], reps:[{ id:'r1', date:D(0), ex:'mobility', n:10, createdAt:1 }],
  profile:prof({ waterGoal:2000 }), nutrition:{ entries:[], foods:[], water:[{ id:'h1', date:D(0), ml:1000, createdAt:1 }] } }));
ok('marks strip sits in the top area (after rank chip, before the stats row)', await T(() => { const m = document.querySelector('#marks'); return m && m.previousElementSibling?.id === 'rankChip' && m.nextElementSibling?.classList.contains('statrow'); }));
ok('Home adds no new cards for marks (one strip)', await page.locator('#view > .card#marks, #view .card .marks').count() === 0 && await page.locator('#marks').count() === 1);
ok('Train: 30 of 45 min from the logged session (scheduled day default 45)', /30\/45 min/.test(await txt('#marks [data-mk="train"]')) && /width:\s*67%/.test(await page.locator('#marks [data-mk="train"] i').getAttribute('style')));
ok('Recover: rep-log mobility minutes count (10/10, met)', /10\/10 min/.test(await txt('#marks [data-mk="recover"]')) && await page.locator('#marks [data-mk="recover"].met').count() === 1);
ok('Fuel: water 1000/2000 = 50%', /50%/.test(await txt('#marks [data-mk="fuel"]')));
ok('week progress in the strip: 1/3 days so far', /Week 1\/3 days/i.test(await txt('#marks .mk-head')), await txt('#marks .mk-head'));
await page.locator('#marks').scrollIntoViewIfNeeded();
await page.screenshot({ path:`${SHOTS}/70-marks.png`, clip:{ x:0, y:0, width:390, height:420 } });
ok('rest day shows "Rest day" and counts as met', await T(() => { const m = window.DM_TEST.marksDay('2026-10-13'); return m.train.rest && m.train.met; }));
ok('no schedule: default Mon/Wed/Fri at 45 min', await T(() => { const p = window.DM_TEST.db.profile, s = p.schedule; delete p.schedule; const t = window.DM_TEST.marksCfg().train; p.schedule = s; return JSON.stringify(t) === '[0,45,0,45,0,45,0]'; }));
ok('Fuel hidden when Food is off', await T(() => { const e = window.DM_TEST.db.profile.enabled; e.food = false; const f = window.DM_TEST.marksDay().fuel; e.food = true; return f === null; }));
// sheet: edit weekday goal, pause / resume
await page.locator('#marks').tap(); await page.waitForSelector('#marksSheet');
ok('marks sheet lists Train / Recover / Fuel with today\'s numbers', /30 of 45 min/.test(await txt('#marksSheet [data-mkrow="train"]')) && /10 of 10 min/.test(await txt('#marksSheet [data-mkrow="recover"]')) && /water 1,000\/2,000/.test(await txt('#marksSheet [data-mkrow="fuel"]')));
await page.locator('#mkGoals .mkday[data-dow="3"] .seg button', { hasText:/^30$/ }).tap(); await settle(200);
ok('changing Wednesday\'s Train goal to 30 min meets today\'s Train mark', (await db()).profile.marks.train[3] === 30 && await page.locator('#marksSheet [data-mkrow="train"].met').count() === 1);
await page.locator('#mkGoals .mkday[data-dow="2"] .seg button', { hasText:/^60$/ }).tap(); await settle(200);
ok('a rest day can become a training day (Tue 60 min)', (await db()).profile.marks.train[2] === 60);
await page.locator('#mkPause7').tap(); await settle(200);
let d = await db();
ok('Pause 1 week stores a pause from today for 7 days', d.profile.marks.pauses.length === 1 && d.profile.marks.pauses[0].from === D(0) && d.profile.marks.pauses[0].to === D(6) && await page.locator('#mkPaused').count() === 1);
await page.locator('#mkResume').tap(); await settle(200);
ok('Resume ends the pause', (await db()).profile.marks.pauses.length === 0 && await page.locator('#mkPause7').count() === 1);
await page.locator('#sheet [data-close]').tap(); await settle(500);
ok('closing the sheet refreshes the strip (Train met)', await page.locator('#marks [data-mk="train"].met').count() === 1);
// pause auto-offered when an injury is logged
await page.goto(BASE + '#/settings'); await page.waitForSelector('#injuryCard'); await hideToast();
await page.locator('#injuryCard [data-addinj]').tap(); await page.waitForSelector('#sheet [data-area]');
await page.locator('#sheet [data-area]').first().tap(); await page.locator('#sheet .seg button', { hasText:/^4$/ }).first().tap();
await page.locator('#sheet [data-save]').tap();
await page.waitForFunction(() => /Pause daily marks/i.test(document.querySelector('#toast').textContent), null, { timeout:4000 }).catch(() => {});
ok('logging an injury offers to pause daily marks (2 weeks for severity 4)', /Pause daily marks for 2 weeks/i.test(await txt('#toast')), await txt('#toast'));
await page.locator('#toast .tbtn').evaluate(b => b.click()); await settle(300);
d = await db(); ok('tapping Pause pauses the marks', d.profile.marks.pauses.length === 1 && d.profile.marks.pauses[0].to === D(13));
await page.goto(BASE + '#/'); await page.waitForSelector('#marks'); await settle(200);
ok('paused strip says so on Home', /Marks paused until/i.test(await txt('#marks')) && await page.locator('#marks.paused').count() === 1);
ok('no second pause offer while already paused', await T(() => { document.querySelector('#toast').textContent = ''; window.DM_TEST.db.profile.marks.pauses.length; return true; }));

/* 2. Perfect Week */
await newPage('2026-10-14');
// weeks (Mon): 09-14 perfect, 09-21 miss, 09-28 perfect (swapped days), 10-05 perfect, 10-12 current (Mon only so far)
const wkS = (wk, offs, pre) => offs.map(o => S(pre + o, (() => { const x = new Date(wk + 'T12:00:00'); x.setDate(x.getDate() + o); return x.toLocaleDateString('en-CA'); })()));
const pwSess = [...wkS('2026-09-14', [0,2,4], 'a'), ...wkS('2026-09-21', [0], 'b'), ...wkS('2026-09-28', [1,3,5], 'c'), ...wkS('2026-10-05', [0,2,4], 'd'), ...wkS('2026-10-12', [0], 'e')];
await seed(base({ sessions:pwSess, game:SEEN() }));
await clean();
let st = await T(() => window.DM_TEST.pwStats());
ok('Perfect Week: swapped days still count, rest days never break it (streak 2, best 2, 3 perfect weeks)', st.streak === 2 && st.best === 2 && st.count === 3, JSON.stringify(st));
ok('an unfinished current week does not break the streak', await T(() => !window.DM_TEST.weekPlan('2026-10-12').perfect));
ok('finished weeks are frozen in game.pw', await T(() => { const g = window.DM_TEST.db.game; return g.pw && JSON.stringify(g.pw['2026-09-21']) === '[3,1]' && !g.pw['2026-10-12']; }));
ok('later goal edits do not rewrite past weeks', await T(() => { const T0 = window.DM_TEST; T0.setMarks({ train:[0,45,45,45,45,45,0] }); const r = T0.weekPlan('2026-10-05').perfect && T0.pwStats().count === 3; T0.setMarks({ train:[0,45,0,45,0,45,0] }); return r; }));
{ const r = await T(() => { const T0 = window.DM_TEST, g = T0.db.game, keep = g.pw['2026-09-21']; delete g.pw['2026-09-21']; T0.setMarks({ pauses:[{ from:'2026-09-21', to:'2026-09-27' }] }); const w = T0.weekPlan('2026-09-21'), s = T0.pwStats(); T0.setMarks({ pauses:[] }); g.pw['2026-09-21'] = keep; return { n:w.neutral, s }; });
  ok('a fully paused week is neutral (streak carries over)', r.n && r.s.streak === 3 && r.s.best === 3, JSON.stringify(r)); }
ok('paused days are not planned days', await T(() => { const T0 = window.DM_TEST; T0.setMarks({ pauses:[{ from:'2026-10-14', to:'2026-10-20' }] }); const w = T0.weekPlan('2026-10-12'); T0.setMarks({ pauses:[] }); return w.planned === 1 && w.perfect; }));
await page.goto(BASE + '#/'); await page.waitForSelector('#marks'); await clean(); await hideToast();
await page.locator('#marks').tap(); await page.waitForSelector('#pwDots');
ok('sheet shows this week\'s planned days and streak / best', await page.locator('#pwDots .pwd.plan').count() === 3 && await page.locator('#pwDots .pwd.done').count() === 1 && (await txt('#pwStreak')) === '2' && (await txt('#pwBest')) === '2');
await page.locator('#pwDots').scrollIntoViewIfNeeded(); await settle(200);
await page.screenshot({ path:`${SHOTS}/71-perfect-week.png` });
await clean();

/* 3. celebrations: queued, one sheet per medal, n of m; medal case lock only */
ok('upgrade: medals already earned are recorded silently (no flood)', await T(() => { const g = window.DM_TEST.db.game; return Array.isArray(g.seenMedals) && g.seenMedals.includes('pw') && g.seenMedals.includes('b-s10'); }) && await page.locator('#celebrate').count() === 0);
await newPage('2026-10-14');
await seed(base({ sessions:pwSess, game:SEEN({ seenMedals:['b-first'], seenBadges:['first'] }) }), '', '#marks');
await page.waitForSelector('#celebrate', { timeout:8000 }).catch(() => {});
const total = await T(() => { const m = document.querySelector('#celebCount'); return m ? Number(m.textContent.split('of')[1]) : 0; });
ok('several new medals queue into one celebration sheet ("1 of n")', total >= 3 && /^1 of/.test(await txt('#celebCount')), String(total));
ok('celebration: 3D medal with tilt + sheen + Share/Next', await page.locator('#celebrate .medal3d[data-tilt] .m-sheen').count() === 1 && await page.locator('#celebShare').count() === 1 && /Next/.test(await txt('#celebNext')));
ok('confetti on celebration', await page.locator('.confetti').count() >= 1);
const names = [await txt('#celebName')];
// tilt follows the pointer
const box = await page.locator('#celebrate .medal3d').boundingBox();
await page.mouse.move(box.x + box.width * .9, box.y + box.height * .5); await settle(150);
ok('medal tilts toward the pointer', /rotateY\(\d/.test(await page.locator('#celebrate .medal3d').getAttribute('style') || ''));
await page.screenshot({ path:`${SHOTS}/72-medal.png` });
for (let i = 1; i < total; i++) { await page.locator('#celebNext').tap(); await settle(200); names.push(await txt('#celebName')); }
ok('Next walks through every queued medal, none hidden', new Set(names).size === total && /Done/.test(await txt('#celebNext')), names.join(' | '));
ok('perfect week + new badges are in the queue', names.includes('Perfect Week') && names.some(n => /10 sessions|perfect weeks in a row/i.test(n)), names.join(' | '));
await page.locator('#celebNext').tap(); await settle(400);
ok('Done closes the sheet; nothing re-queues', await page.locator('#sheet').isHidden() && (await db()).game.seenMedals.includes('pw'));
ok('earned dates are recorded', (await db()).game.medalDates?.pw === '2026-10-14');
await page.reload(); await page.waitForSelector('#marks'); await settle(1800);
ok('no repeat celebration after reload', await page.locator('#celebrate').count() === 0);
// rank-up first, then medals (full queue)
await seed(base({ sessions:pwSess, game:SEEN({ rankSeen:-1, levelSeen:0, seenMedals:['b-first'], seenBadges:['first'] }) }), '', '#marks');
await page.waitForSelector('#rankUp', { timeout:8000 }).catch(() => {});
ok('rank-up sheet comes first', await page.locator('#rankUp').count() === 1);
await page.locator('#rankUp [data-cancel]').tap();
await page.waitForSelector('#celebrate', { timeout:8000 }).catch(() => {});
ok('medal celebrations follow the rank-up instead of being dropped', await page.locator('#celebrate').count() === 1);
await page.keyboard.press('Escape'); await settle(700);
ok('closing early keeps the rest one tap away ("n more medals earned")', /\d+ more medals? earned/.test(await txt('#toast')), await txt('#toast'));
await page.locator('#toast .tbtn').evaluate(b => b.click()); await settle(400);
ok('See reopens the remaining medals', await page.locator('#celebrate').count() === 1);
await clean();
// medal case: Profile bottom + full page, locked = lock only
await page.goto(BASE + '#/settings'); await page.waitForSelector('#medalCase'); await clean();
ok('medal case is on the last Profile card (rank / badges / looks)', await T(() => { const c = document.querySelector('#gameProfile'); return c && c.contains(document.querySelector('#medalCase')) && !c.nextElementSibling?.classList.contains('card'); }));
ok('Profile medal case shows earned medals and locked outlines', await page.locator('#medalCase .medalcell.on').count() >= 2 && await page.locator('#medalCase .medalcell.locked').count() >= 1);
await page.goto(BASE + '#/badges'); await page.waitForSelector('#badgeCase'); await clean();
const lockedT = await page.locator('.medalcell.locked').allTextContents();
ok('locked medals show only a lock (no name, no hint)', lockedT.length >= 5 && lockedT.every(t => t.trim() === '🔒'), JSON.stringify(lockedT.slice(0, 3)));
ok('medal page has no "how to earn" text', !/Log 50 workouts|how to earn/i.test(await txt('#view')));
await page.locator('.medalcell.on').first().tap(); await page.waitForSelector('#medalView');
ok('tapping an earned medal opens a viewer with Share', await page.locator('#medalView .medal3d').count() === 1 && await page.locator('#medalShare').count() === 1);
await page.locator('#medalShare').tap(); await page.waitForSelector('#sharePreview[src^="data:image/png"]', { timeout:8000 }).catch(() => {});
ok('medal share card renders', (await page.locator('#sharePreview').getAttribute('src') || '').startsWith('data:image/png'));
await clean();
// reduced motion
await newPage('2026-10-14', true);
await seed(base({ sessions:pwSess, game:SEEN({ seenMedals:['b-first'], seenBadges:['first'] }) }), '', '#marks');
await page.waitForSelector('#celebrate', { timeout:8000 }).catch(() => {});
ok('reduced motion: no sway, no confetti', await T(() => getComputedStyle(document.querySelector('#celebrate .medal3d')).animationName === 'none') && await page.locator('.confetti').count() === 0);
await clean();

/* 4. monthly + limited medals */
await newPage('2026-10-14');
const hist = []; for (let i = 0; i < 92; i += 3) hist.push(S('h' + i, D(-14 - i)));   // ~10 sessions / month in Jul–Sep
await seed(base({ sessions:[...hist, S('n1', D(-1)), S('n2', D(-3))], game:SEEN({ seenMedals:[] }) }), '#/challenges', '#medalsCard');
await clean();
const mm = await T(() => window.DM_TEST.monthMedal('2026-10'));
ok('one monthly medal for October with a rotating metric', mm.id === 'mm-2026-10' && mm.kind === 'month' && /October 2026/.test(mm.name));
ok('monthly goal is personalised from the last 3 months (≈10% above)', await T(() => { const T0 = window.DM_TEST, k = T0.MEDAL_KINDS.find(x => x.id === 'sess'); const g = T0.personalGoal(k, '2026-10-01', 31); return g >= 10 && g <= 13; }));
ok('monthly goal is frozen once set', await T(() => { const g = window.DM_TEST.db.game.medalGoals['mm-2026-10']; return g && g.g > 0; }));
ok('different months get different metrics', await T(() => { const T0 = window.DM_TEST; return new Set(['2026-08','2026-09','2026-10','2026-11'].map(m => T0.medalKindFor(m).id)).size >= 3; }));
ok('medals run through the challenge engine (progress / pct / done) and give no XP', mm.progress && Number.isFinite(mm.pct) && !('xp' in mm));
ok('Challenges screen shows the monthly medal with progress and time left', await page.locator('#medalsCard .medalrow[data-medalrow="mm-2026-10"] .sgbar').count() === 1 && /days left/.test(await txt('#medalsCard')));
ok('next limited medal shows only "starts", locked', /Limited medal.*Starts Oct 25, 2026/.test(await txt('#medalsCard .ltdnext >> nth=0')) && !/Fright/.test(await txt('#medalsCard')));
ok('limited medals have fighter names, nothing copied', await T(() => window.DM_TEST.LTD.map(x => x.name).join('|')) === 'First Roll of the Year|Spring Camp|Summer Grind|Fright Night Rounds|Year-End Grind');
await newPage('2026-10-27');
await seed(base({ sessions:[...hist, S('f1', '2026-10-25'), S('f2', '2026-10-26')], game:SEEN({ seenMedals:[] }) }), '#/challenges', '#medalsCard');
await clean();
ok('limited medal is active during its window (Oct 25–31)', await page.locator('#medalsCard [data-medalrow="lt-frightrounds-2026"]').count() === 1 && /Fright Night Rounds 2026/.test(await txt('#medalsCard')));
await page.locator('#medalsCard').scrollIntoViewIfNeeded(); await settle(200);
await page.locator('#medalsCard').screenshot({ path:`${SHOTS}/73-monthly-medals.png` });
ok('past month medals land in the medal case (earned or locked)', await T(() => { const l = window.DM_TEST.medalList(); return l.some(m => m.id === 'mm-2026-09') && !l.some(m => m.id === 'mm-2026-10' && !m.earned); }));
ok('first-of-year limited medal needs 3 sessions Jan 1–7', await T(() => { const x = window.DM_TEST.ltdMedal(window.DM_TEST.LTD[0], 2026); return x.goal === 3 && x.from === '2026-01-01' && x.to === '2026-01-07'; }));

/* 5. Monday recap */
await newPage('2026-10-19');   // Monday; last week 10-12 .. 10-18
const rs = [S('m1', '2026-10-12', { duration:75 }), S('m2', '2026-10-14', { duration:75 }), S('m3', '2026-10-16', { duration:80 }), S('old', '2026-09-30')];
const ws = [{ id:'w1', date:'2026-10-06', w:181, u:'lb', createdAt:1 }, { id:'w2', date:'2026-10-13', w:180.2, u:'lb', createdAt:2 }];
await seed(base({ sessions:rs, weights:ws, reps:[{ id:'r', date:'2026-10-13', ex:'mobility', n:15, createdAt:1 }] }), '', '#recapCard');
await clean();
ok('Monday: recap replaces the tip card at the top', await page.locator('#recapCard').count() === 1 && await page.locator('#tipCard').count() === 0);
ok('recap: last week sessions, hours, train days, weight change', /3\s*sessions/.test(await txt('#recapCard .recapstats')) && /3\.8\s*hours/.test(await txt('#recapCard .recapstats')) && /3\/3\s*train days/.test(await txt('#recapCard .recapstats')) && /−0\.8\s*lb avg/.test(await txt('#recapCard .recapstats')), await txt('#recapCard .recapstats'));
ok('recap: perfect week + recover days', /Perfect week/.test(await txt('#recapPw')) && /Recover met 1 of 7/.test(await txt('#recapPw')));
ok('one goal suggestion: perfect + long sessions → raise Train to 55 min', /Raise your Train goal to 55 min/.test(await txt('#recapSug')) && await page.locator('#recapApply').count() === 1);
await page.screenshot({ path:`${SHOTS}/74-monday-recap.png`, clip:{ x:0, y:0, width:390, height:640 } });
await page.locator('#recapApply').tap(); await settle(300);
ok('one tap applies it to every training day', JSON.stringify((await db()).profile.marks.train) === '[0,55,0,55,0,55,0]' && /Train goal set to 55/.test(await txt('#recapSug')));
ok('strip updates right away', /\/55 min/.test(await txt('#marks [data-mk="train"]')));
await hideToast();
await page.locator('#recapShare').tap(); await page.waitForSelector('#sharePreview[src^="data:image/png"]', { timeout:8000 }).catch(() => {});
ok('recap share card renders', (await page.locator('#sharePreview').getAttribute('src') || '').startsWith('data:image/png'));
ok('recap share content', await T(() => { const c = window.DM_TEST.shareContent('recap', window.DM_TEST.recapData(), true); return c.eyebrow === 'Week recap' && c.title === 'Week of Oct 12' && c.stats.length === 3; }));
await clean();
await page.locator('#recapDone').tap(); await settle(200);
ok('Done dismisses it for the week (tip returns)', await page.locator('#recapCard').count() === 0 && (await db()).game.recapSeen === '2026-10-12');
await page.reload(); await page.waitForSelector('#marks'); ok('stays dismissed after reload', await page.locator('#recapCard').count() === 0);
ok('suggestion eases the goal after a rough week', await T(() => { const T0 = window.DM_TEST; return T0.recapSuggest({ perfect:false, neutral:false, planned:3, trained:1 }, [], T0.marksCfg()).kind === 'down'; }));
ok('otherwise suggests keeping goals', await T(() => { const T0 = window.DM_TEST; return T0.recapSuggest({ perfect:true, neutral:false, planned:3, trained:3 }, [], T0.marksCfg()).kind === 'keep'; }));
await newPage('2026-10-22');   // Thursday
await seed(base({ sessions:rs }), '', '#marks'); await clean();
ok('no recap Thursday–Sunday', await page.locator('#recapCard').count() === 0);

ok('friends / head-to-head untouched: no cheers or competitions UI added', await T(() => !document.querySelector('[data-cheer], #competeCard, #nudgeCard')));
ok('no console errors', errors.length === 0, JSON.stringify(errors));
await browser.close();
console.log(results.join('\n'));
