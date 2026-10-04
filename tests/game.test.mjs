// 3.2.0 game layer: challenges, XP/levels/ranks, rank-up + Pro week, badges, looks, share cards, friend links, export/import.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
await ctx.grantPermissions(['clipboard-read','clipboard-write'], { origin:new URL(BASE).origin });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('dialog', d => d.dismiss());
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const T = (fn, arg) => page.evaluate(fn, arg);
const hideToast = () => page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); });
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const at = (date, h = 20) => Date.parse(date + 'T00:00:00') + h * 36e5;
const seed = async (data, hash = '') => { await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data); await page.reload(); if (hash) await page.goto(BASE + hash); await settle(500); };
const G = (id, date, o = {}) => ({ id, date, category:'grappling', discipline:'bjj', type:'class', duration:60, intensity:3, rpe:6, rounds:4, notes:'', sample:false, createdAt:at(date), ...o });
const Wt = (id, date, ex, o = {}) => ({ id, date, category:'weights', discipline:'strength', type:'class', duration:60, intensity:3, rpe:7, exercises:ex, notes:'', sample:false, createdAt:at(date), ...o });
const prof = (en, o = {}) => ({ name:'Alex', unit:'lb', setupDone:true, challengeTarget:8, enabled:{ grappling:true, weights:false, striking:false, cardio:false, mobility:false, mma:false, food:false, weight:false, ...en }, ...o });
const mkDb = (sessions, en = {}, extra = {}) => ({ schema:7, profile:prof(en), sessions, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], ...extra });

/* 1. challenge engine */
await seed(mkDb([G('t1', D(0), { duration:30, rounds:2 })], { weights:true }));
let r = await T(() => { const T = window.DM_TEST, ids = (p, k) => T.pickChallenges(p, k).map(t => t.id);
  const days = []; for (let i = 0; i < 60; i++) { const d = new Date(2026, 0, 1 + i); days.push(d.toLocaleDateString('en-CA')); }
  const all = days.flatMap(d => ids('d', d));
  return { a:ids('d', '2026-10-03'), b:ids('d', '2026-10-03'), w:ids('w', 'w2026-09-28'), m:ids('m', 'm2026-10'), all, tiers:T.pickChallenges('d', '2026-10-03').map(t => t.tier),
    cur:T.currentChallenges().length, per:[T.periodOf('w', '2026-10-03'), T.periodOf('m', '2026-02-10')] }; });
ok('challenges are deterministic for the same day and sports', JSON.stringify(r.a) === JSON.stringify(r.b) && r.a.length === 3);
ok('one challenge per tier (easy/medium/hard)', JSON.stringify(r.tiers) === '[1,2,3]', JSON.stringify(r.tiers));
ok('3 daily + 3 weekly + 3 monthly current challenges', r.cur === 9 && r.w.length === 3 && r.m.length === 3);
const pools = await T(() => { const T = window.DM_TEST, ids = (p, k) => T.pickChallenges(p, k).map(t => t.id), wk = []; for (let i = 0; i < 40; i++) { const d = new Date(2026, 0, 5 + i * 7); wk.push(...ids('w', 'w' + d.toLocaleDateString('en-CA'))); }
  return { daily:T.CH_POOL.filter(t => t.p === 'd').map(t => ({ id:t.id, parts:!!t.parts, need:!!t.need, how:!!t.how })), wk:[...new Set(wk)] }; });
ok('daily challenges are quick no-equipment bodyweight workouts for everyone (with instructions)', pools.daily.length >= 12 && pools.daily.every(t => t.parts && !t.need && t.how) && r.all.every(id => pools.daily.some(t => t.id === id)) && new Set(r.all).size >= 8, JSON.stringify(pools.daily));
ok('session/sport challenges moved to weekly/monthly and still follow your sports', ['w-feel3','w-double','w-hard2','w-roll5x3'].every(id => pools.wk.includes(id)) && !pools.wk.some(id => ['w-spar8','w-cardio60','w-mob2'].includes(id)), JSON.stringify(pools.wk));
ok('periods: weeks run Mon–Sun, months to the last day', r.per[1].from === '2026-02-01' && r.per[1].to === '2026-02-28' && r.per[0].to > r.per[0].from);
await seed(mkDb([Wt('pw', D(0), [{ name:'Push-ups', sets:[{ reps:20, weight:'' }, { reps:15, weight:'' }] }, { name:'Back squat', sets:[{ reps:5, weight:225 }] }, { name:'Air squat', sets:[{ reps:30, weight:'' }] }])], { weights:true }, { reps:[{ id:'r1', date:D(0), ex:'pushups', n:10, createdAt:Date.now() }, { id:'r2', date:D(0), ex:'situps', n:50, createdAt:Date.now() }] }));
r = await T(() => { const T = window.DM_TEST, P = id => T.CH_POOL.find(x => x.id === id), per = T.periodOf('d'), e = T.evalChallenge(P('d-push50'), per, []), combo = T.evalChallenge(P('d-5rounds'), per, []);
  return { e, combo, sq:T.repTotal('squats', per.from, per.to), left:T.timeLeft(per.to), wl:T.timeLeft(T.periodOf('m', '2099-12-15').to) }; });
ok('rep progress auto-computes from the rep log + workout sets (10 logged + 35 in a workout = 45 / 50)', r.e.value === 45 && r.e.pct === 90 && r.e.progress === '45 / 50' && !r.e.done && r.e.xp === 50, JSON.stringify(r.e));
ok('weighted squats don\'t count as air squats; bodyweight sets do', r.sq === 30, String(r.sq));
ok('combo workout: progress follows the slowest part (30/50 squats = 60%)', r.combo.value === 60 && /45 \/ 50 push-ups · 30 \/ 50 squats · 50 \/ 50 sit-ups/.test(r.combo.progress) && r.combo.how, JSON.stringify(r.combo));
ok('time left reads naturally', /^(\d+h \d+m|\d+m) left$/.test(r.left) && /days left$/.test(r.wl), r.left + ' | ' + r.wl);
r = await T(([a, b]) => { const T = window.DM_TEST; return [T.gFair({ date:a, createdAt:Date.now() }), T.gFair({ date:b, createdAt:Date.now() }), T.gFair({ date:b })]; }, [D(-5), D(-20)]);
ok('backdating: entries logged within 7 days count, older backfills do not (legacy entries still count)', JSON.stringify(r) === '[true,false,true]', JSON.stringify(r));
await seed(mkDb([], {}, { reps:[{ id:'old', date:D(-20), ex:'pushups', n:100, createdAt:Date.now() }, { id:'ok', date:D(-3), ex:'pushups', n:100, createdAt:Date.now() }] }));
r = await T(([a, b]) => [window.DM_TEST.repTotal('pushups', a, a), window.DM_TEST.repTotal('pushups', b, b)], [D(-20), D(-3)]);
ok('reps backfilled weeks later don\'t count; within 7 days they do', r[0] === 0 && r[1] === 100, JSON.stringify(r));
r = await T(() => { const T = window.DM_TEST, d = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toLocaleDateString('en-CA'); };
  T.db.reps = [0,1,2,3,4,5,6].flatMap(n => [{ id:'p' + n, date:d(n), ex:'pushups', n:n === 2 ? 60 : 100, createdAt:Date.now() }]);
  const per = { key:'x', from:d(6), to:d(0) }; return T.evalChallenge(T.CH_POOL.find(x => x.id === 'w-push100x5'), per, []); });
ok('weekly "100 push-ups, 5 days" counts days that reached 100', r.value === 6 && r.done && r.progress === '6 / 5 days', JSON.stringify(r));

/* 2. XP math */
const xs = [G('x1', D(-8)), G('x2', D(-8)), G('x3', D(-8)), G('x4', D(-8)), G('x5', D(-1))];
await seed(mkDb(xs));
r = await T(() => { const T = window.DM_TEST, g = T.gameState(); return { parts:g.parts, xp:g.xp, level:g.level, lv:[T.levelOf(0), T.levelOf(199), T.levelOf(200), T.levelOf(599), T.levelOf(600)], need:[T.xpForLevel(2), T.xpForLevel(25)], ri:[T.rankIdx(1), T.rankIdx(4), T.rankIdx(5), T.rankIdx(25), T.rankIdx(99)], names:T.RANKS.map(r => r[0]) }; });
ok('logging XP: 10 per workout, capped at 30 a day', r.parts.log === 40, JSON.stringify(r.parts));
const sameWeek = await T(([a, b]) => { const T = window.DM_TEST; return T.periodOf('w', a).key === T.periodOf('w', b).key; }, [D(-8), D(-1)]);
ok('week streak bonus +20 for a week continuing a streak', r.parts.streak === (sameWeek ? 0 : 20), JSON.stringify(r.parts));
ok('total XP is the sum of its parts', r.xp === Object.values(r.parts).reduce((a, b) => a + b, 0));
ok('level curve 100·L·(L−1)', JSON.stringify(r.lv) === '[1,1,2,2,3]' && JSON.stringify(r.need) === '[200,60000]', JSON.stringify(r));
ok('ranks: Apprentice → Forged at levels 1/5/10/15/20/25/30/35', JSON.stringify(r.ri) === '[0,0,1,5,7]' && r.names.join(',') === 'Apprentice,Striker,Journeyman,Smith,Blacksmith,Master Smith,Forgemaster,Forged');
await seed(mkDb([Wt('p1', D(-6), [{ name:'Bench press', sets:[{ reps:5, weight:200 }] }]), Wt('p2', D(-3), [{ name:'Bench press', sets:[{ reps:5, weight:210 }] }, { name:'Squat', sets:[{ reps:5, weight:300 }] }])], { weights:true }));
r = await T(() => { const g = window.DM_TEST.gameState(); return { pr:g.parts.pr, prs:window.DM_TEST.prEvents().map(e => e.name) }; });
ok('PR XP: +25 when you beat your previous best (first lift is not a PR)', r.pr === 25 && JSON.stringify(r.prs) === '["Bench press"]', JSON.stringify(r));

/* 3. realistic month: Home, challenges, badges, share */
const month = []; for (let i = 27; i >= 0; i -= 2) month.push(G('m' + i, D(-i), { duration:i % 4 ? 60 : 90, rounds:i % 3 ? 5 : 7, rpe:i % 4 ? 6 : 8, feel:4 }));
month.push(Wt('mw1', D(-9), [{ name:'Deadlift', sets:[{ reps:5, weight:315 }] }]), Wt('mw2', D(-2), [{ name:'Deadlift', sets:[{ reps:5, weight:335 }] }]));
await seed(mkDb(month, { weights:true }));
await settle(1200);
let d = await db();
ok('first run records the starting rank silently (no rank-up sheet)', Number.isFinite(d.game.rankSeen) && await page.locator('#rankUp').count() === 0);
ok('Home shows the rank chip once', await page.locator('#rankChip').count() === 1 && /Lv \d+/i.test(await page.locator('#rankChip').innerText()));
ok('Home shows exactly one challenge (no list, no badges)', await page.locator('#challengeHome').count() === 1 && await page.locator('#challengeHome .chrow').count() <= 1 && await page.locator('#ch-d, #badgeCase, #looks').count() === 0);
await hideToast(); await page.evaluate(() => { const r = document.querySelector('#challengeHome').getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.bottom + window.scrollY - window.innerHeight + 110)); }); await settle(200);
await page.screenshot({ path:`${SHOTS}/57-home-challenge.png` });
await page.locator('#challengeHome a.lnk').tap(); await settle();
ok('See all opens the challenges screen', await page.evaluate(() => location.hash) === '#/challenges' && await page.locator('#ch-d .chrow').count() === 3 && await page.locator('#ch-w .chrow').count() === 3 && await page.locator('#ch-m .chrow').count() === 3);
ok('each challenge shows tier, progress and XP or Share', (await page.locator('#ch-d').innerText()).match(/easy|medium|hard/gi).length >= 3 && await page.locator('#ch-d .chrow [data-prog]').count() === 3);
ok('daily card shows time left', /left/i.test(await page.locator('#ch-d h2').innerText()));
await hideToast(); await settle(200);
await page.screenshot({ path:`${SHOTS}/52-challenges.png` });
// friend challenge link (no server)
await page.locator('#challengeFriend').tap(); await settle();
ok('friend sheet lists challenges to send', await page.locator('#friendPick button').count() >= 3);
await page.locator('#friendFrom').fill('Alex'); await page.locator('#friendSend').tap(); await settle(500);
const furl = await page.evaluate(() => window.__lastFriendUrl || '');
ok('friend link encodes the challenge in the URL (#/join/…)', /#\/join\/[A-Za-z0-9_-]+$/.test(furl), furl);
const fx = await T(c => window.DM_TEST.readFriendCode(c), furl.split('#/join/')[1]);
ok('friend code decodes (from, challenge, days)', fx && fx.from === 'Alex' && fx.title && fx.days >= 1, JSON.stringify(fx));
ok('a broken friend code is rejected', !(await T(() => window.DM_TEST.readFriendCode('%%%nope'))));
await page.locator('.sheet [data-close]').first().tap().catch(() => {}); await settle();
await page.goto(BASE + '#/join/' + furl.split('#/join/')[1]); await page.waitForSelector('#joinCard');
ok('join screen shows who challenged you', /Alex challenged you/i.test(await page.locator('#joinCard').innerText()));
await page.locator('#joinGo').tap(); await settle();
ok('accepting stores the friend challenge on this phone', (await db()).game.friend.length === 1 && await page.evaluate(() => location.hash) === '#/challenges' && await page.locator('#friendCard').count() === 1);
// badges
await page.goto(BASE + '#/badges'); await page.waitForSelector('#badgeCase'); await settle();
const nOn = await page.locator('.badge.on').count(), nLock = await page.locator('.badge.locked').count();
ok('badge case: some earned, the rest locked', nOn >= 2 && nLock >= 5 && nOn + nLock === 20, `${nOn}/${nLock}`);
ok('locked badges say how to earn them', /Log 50 workouts/i.test(await page.locator('.badge.locked[data-badge="s50"]').innerText()));
ok('First strike earned', await page.locator('.badge.on[data-badge="first"]').count() === 1);
await hideToast(); await page.evaluate(() => window.scrollTo(0, 0)); await settle(200);
await page.screenshot({ path:`${SHOTS}/54-badges.png` });
// share card
r = await T(async () => { const T = window.DM_TEST, gs = T.gameState(); const a = await T.renderShareCard('rank', gs, 'square', true), b = await T.renderShareCard('session', T.db.sessions[0], 'story', false);
  return { a:[a.width, a.height], b:[b.width, b.height], hid:JSON.stringify(T.shareContent('session', T.db.sessions[0], false)), shown:JSON.stringify(T.shareContent('session', T.db.sessions[0], true)) }; });
ok('share card renders 1080×1080 square and 1080×1920 story', JSON.stringify(r.a) === '[1080,1080]' && JSON.stringify(r.b) === '[1080,1920]', JSON.stringify(r));
ok('hide numbers masks the stats', r.hid.includes('•••') && !r.shown.includes('•••'));
await page.goto(BASE + '#/session/m1'); await settle(800);  await page.waitForSelector('#shareSession'); await page.locator('#shareSession').tap();
await page.waitForFunction(() => document.querySelector('#sharePreview')?.dataset.w);
ok('session share sheet previews a square card', await page.locator('#sharePreview').getAttribute('data-w') === '1080' && await page.locator('#sharePreview').getAttribute('data-h') === '1080');
const src1 = await page.locator('#sharePreview').getAttribute('src');
await page.locator('#shareNums').evaluate(el => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles:true })); }); await settle(400);
ok('numbers toggle re-renders the card', (await page.locator('#sharePreview').getAttribute('src')) !== src1);
await page.locator('#shareSheet .seg button', { hasText:'Story' }).tap(); await settle(400);
ok('story size is 1080×1920', await page.locator('#sharePreview').getAttribute('data-h') === '1920');
await page.locator('#shareSheet .seg button', { hasText:'Square' }).tap(); await settle(400);
await page.locator('#shareNums').evaluate(el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true })); }); await settle(400);
await page.screenshot({ path:`${SHOTS}/55-share-card.png` });
await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { value:undefined, configurable:true }); });
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#shareGo').tap()]);
ok('no Web Share with files: falls back to saving the PNG', /^forged-session-\d{4}-\d{2}-\d{2}\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
await settle(300);

/* 3b. quick rep log + Done on daily cards */
await seed(mkDb([]));
await settle(800); await hideToast();
ok('Home challenge card shows today\'s bodyweight workout with instructions, Log reps and Done', await page.locator('#challengeHome .chhow').count() === 1 && await page.locator('#challengeHome #homeLogReps').count() === 1 && await page.locator('#challengeHome [data-chdone]').count() === 1);
await page.locator('#homeLogReps').tap(); await page.waitForSelector('#repsSheet');
ok('rep tracker lists every exercise with +buttons and today\'s total', await page.locator('.reprow').count() === 10 && await page.locator('.reprow[data-ex="pushups"] [data-add-rep="10"]').count() === 1 && await page.locator('.reprow[data-ex="pushups"] [data-add-rep="25"]').count() === 1 && await page.locator('.reprow[data-ex="plank"] [data-add-rep="30"]').count() === 1);
for (const n of ['10','10','25']) { await page.locator(`.reprow[data-ex="pushups"] [data-add-rep="${n}"]`).tap(); await settle(60); }
ok('one tap +10/+25 updates the daily total', /^45 today/.test(await page.locator('.reprow[data-ex="pushups"] small').innerText()));
await page.locator('.reprow[data-ex="pushups"] [data-undo-rep]').tap(); await settle(60);
ok('undo removes the last tap', /^20 today/.test(await page.locator('.reprow[data-ex="pushups"] small').innerText()) && (await db()).reps.reduce((a, x) => a + x.n, 0) === 20);
await page.locator('.reprow[data-ex="plank"] [data-add-rep="60"]').tap(); await settle(60);
ok('timed holds log seconds (plank +1 min)', /^1 min today/.test(await page.locator('.reprow[data-ex="plank"] small').innerText()));
await page.locator('.sheet [data-close]').first().tap(); await settle(500);
await page.goto(BASE + '#/challenges'); await page.waitForSelector('#ch-d');
ok('challenges screen has Log reps, and each daily card shows how-to, scaling and Done', await page.locator('#logRepsTop').count() === 1 && await page.locator('#ch-d .chrow .chhow').count() === 3 && await page.locator('#ch-d .chscale').count() === 3 && await page.locator('#ch-d [data-chdone]').count() === 3);
const key0 = await page.locator('#ch-d [data-chdone]').first().getAttribute('data-chdone');
await page.locator('#ch-d [data-chdone]').first().tap(); await settle(400);
ok('Done fills in the remaining reps and completes the challenge', await page.locator(`#ch-d .chrow.done[data-ch="${key0}"]`).count() === 1 && /Done:/.test(await page.locator('#toast').innerText()));
await page.locator('#toast .undo').tap(); await settle(400);
ok('Done can be undone', await page.locator(`#ch-d .chrow.done[data-ch="${key0}"]`).count() === 0);
await page.locator('#ch-d [data-chdone]').first().tap(); await settle(400); await hideToast();
await page.goto(BASE); await page.waitForTimeout(2200);
ok('completing it celebrates on Home (challenge-complete toast with Share)', /Challenge complete/.test(await page.locator('#toast').innerText()) || (await db()).game.seenDone.includes(key0));
const exR = await T(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); return d.reps.length; });
ok('rep logs are saved (and included in export via db.reps)', exR >= 3);

/* 4. big history: rank-up to Master Smith + Pro week, looks, export/import */
const big = []; for (let i = 240; i >= 1; i--) for (let k = 0; k < 3; k++) big.push(G(`g${i}-${k}`, D(-i), { duration:95, rpe:9, rounds:6, feel:4 }));
const bigReps = []; for (let i = 240; i >= 1; i--) Object.entries({ pushups:160, squats:160, situps:60, lunges:60, burpees:40, dips:40, pullups:10, plank:300, wallsit:200, mobility:15 }).forEach(([ex, n]) => bigReps.push({ id:`r${i}${ex}`, date:D(-i), ex, n, createdAt:at(D(-i)) }));
await seed(mkDb(big, {}, { reps:bigReps, game:{ rankSeen:4, levelSeen:20, seenDone:[], seenBadges:[], look:{ accent:'flame', frame:'classic', flair:'none' } } }));
await page.waitForSelector('#rankUp', { timeout:8000 }).catch(() => {});
r = await T(() => { const g = window.DM_TEST.gameState(); return { level:g.level, ri:g.rankIdx, rank:g.rank }; });
d = await db();
ok('big history reaches Master Smith (level 25+)', r.ri >= 5, JSON.stringify(r));
ok('rank-up sheet appears with the new rank', await page.locator('#rankUp').count() === 1 && new RegExp(r.rank, 'i').test(await page.locator('#rankUp h3').innerText()));
ok('Master Smith grants a 7-day Pro week (proUntil)', d.game.proUntil === D(7) && d.game.proGranted === D(0) && await page.locator('#rankUp #proNote').count() === 1, JSON.stringify(d.game.proUntil));
ok('rank-up has a Share button', await page.locator('#rankUp #shareRank').count() === 1);
await settle(1800);
await page.screenshot({ path:`${SHOTS}/53-rank-up.png` });
await page.locator('#rankUp #shareRank').tap(); await page.waitForFunction(() => document.querySelector('#sharePreview')?.dataset.w);
ok('Share from rank-up opens the share sheet', await page.locator('#shareSheet').count() === 1);
await page.locator('.sheet [data-close]').first().tap(); await settle();
await page.goto(BASE); await settle(1500);
ok('rank-up is shown once (not again on the next visit)', await page.locator('#rankUp').count() === 0 && (await db()).game.rankSeen === r.ri);
await page.goto(BASE + '#/rank'); await page.waitForSelector('#rankHero');
ok('rank screen: level, XP to next, ladder and Pro note', /level \d+/i.test(await page.locator('#rankHero').innerText()) && await page.locator('#ladder .ladder').count() === 8 && await page.locator('#proNote').count() === 1 && /to level/i.test(await page.locator('#xpLine').innerText()));
// looks
await page.goto(BASE + '#/settings'); await page.waitForSelector('#looks');
ok('looks picker: gold accent unlocked at level 15', await page.locator('#looks [data-kind="accent"] [data-look="gold"].locked').count() === 0);
const crownLocked = r.level < 30;
ok('crown flair locked until Forgemaster', (await page.locator('#looks [data-kind="flair"] [data-look="crown"].locked').count() === 1) === crownLocked);
if (crownLocked) { await page.locator('#looks [data-kind="flair"] [data-look="crown"]').tap({ force:true }); await settle(200); ok('tapping a locked look explains how to unlock it', /Locked: Reach Forgemaster/i.test(await page.locator('#toast').innerText())); }
await page.locator('#looks [data-kind="accent"] [data-look="gold"]').tap(); await settle(400);
await page.locator('#looks [data-kind="flair"] [data-look="flame"]').tap(); await settle(400);
d = await db();
ok('picking a look saves it and recolours the app', d.game.look.accent === 'gold' && d.game.look.flair === 'flame' && await page.evaluate(() => document.documentElement.dataset.look) === 'gold');
await page.reload(); await page.waitForSelector('#looks');
ok('look survives reload', await page.evaluate(() => document.documentElement.dataset.look) === 'gold');
await hideToast(); await page.locator('#gameProfile').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -70)); await settle(200);
await page.screenshot({ path:`${SHOTS}/56-looks.png` });
// export / import keeps game state
const [ex] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-game.json'; await ex.saveAs(path);
const exj = JSON.parse(fs.readFileSync(path, 'utf8'));
ok('export includes rep logs', Array.isArray(exj.reps) && exj.reps.length === bigReps.length);
ok('export includes game state', exj.game && exj.game.look.accent === 'gold' && exj.game.proUntil === D(7));
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(400);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await settle(600);
d = await db();
ok('import restores rep logs', d.reps.length === bigReps.length);
ok('import restores looks, Pro week and seen rank', d.game.look.accent === 'gold' && d.game.proUntil === D(7) && d.game.rankSeen === r.ri && await page.locator('#rankUp').count() === 0);
fs.unlinkSync(path);

ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(results.join('\n'));
if (!process.env.QUIET) console.log(`${results.filter(x => x.startsWith('PASS')).length}/${results.length}`);
