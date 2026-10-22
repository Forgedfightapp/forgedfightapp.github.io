// 3.10.0 head-to-head: create (incl. Workout XP), accept/decline, live standings, final result with XP + badge, rematch.
// Supabase is mocked (tests/mock-supabase.js); nothing hits the network.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const MOCK = fs.readFileSync(new URL('./mock-supabase.js', import.meta.url), 'utf8');
const errors = [], results = [];
const ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
process.on('uncaughtException', e => { console.log(results.join('\n')); console.log('ERROR', e.message.split('\n')[0]); process.exit(1); });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{ width:393, height:852 }, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
await ctx.addInitScript(() => { window.FORGED_CONFIG = { social:true }; window.__FORGED_QUIET_MEDALS = true; });
await ctx.addInitScript(MOCK);
await ctx.route('**/*supabase.co/**', r => r.abort());
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const S = (id, date) => ({ id, date, category:'grappling', discipline:'bjj', type:'class', duration:60, intensity:3, rpe:6, rounds:4, notes:'', sample:false, createdAt:Date.parse(date + 'T12:00:00') });
const db0 = { schema:7, profile:{ name:'Steve', unit:'lb', setupDone:true, enabled:{ grappling:true, food:true } }, sessions:[S('a', D(0)), S('b', D(-1))], nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], reps:[] };
const settle = (ms = 400) => page.waitForTimeout(ms);
const toastText = () => page.locator('#toast').innerText();
const ev = (f, a) => page.evaluate(f, a);

await page.goto(BASE); await ev(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); localStorage.setItem('forged.tut.seen', JSON.stringify({ home:1, weight:1, friends:1, settings:1, badges:1, rank:1 })); }, db0);
await page.goto(BASE + '#/friends'); await page.waitForSelector('#goSignin');
const alex = await ev(() => { const m = window.__mockSb; return m.addUser({ name:'Alex', color:'sky', rank:2, level:12, xp:5200 }); });
await page.locator('#goSignin').tap(); await page.waitForSelector('#siEmail');
await page.locator('#siEmail').fill('steve@example.com'); await page.locator('#siSend').tap(); await page.waitForSelector('#siCodeWrap:not([hidden])');
await page.locator('#siCode').fill('123456'); await page.waitForSelector('#youCard', { timeout:8000 });
await ev(id => { const m = window.__mockSb; m.befriend(m.me(), id); }, alex);
await page.reload(); await page.waitForSelector('#newH2h:not([disabled])', { timeout:8000 });
ok('Friends: Challenge a friend enabled once you have a friend', true);

/* 1. create a 7-day Workout XP challenge */
await page.locator('#newH2h').tap(); await page.waitForSelector('#h2hGo');
const metrics = await page.locator('#sheet .seg button').allInnerTexts();
ok('metric options: sessions, push-ups, mat hours, streak (3.11: no Workout XP for new challenges)', ['Sessions','Push-ups','Mat hours','Daily challenge streak'].every(x => metrics.includes(x)) && !metrics.includes('Workout XP'), metrics.join());
ok('default length is 1 week', await page.locator('#sheet .seg button.on', { hasText:'1 week' }).count() === 1);
await page.locator('#h2hGo').tap(); await page.waitForFunction(() => location.hash.startsWith('#/h2h/'), null, { timeout:8000 });
const cid = await ev(() => location.hash.split('/')[2]);
const c = await ev(id => window.__mockSb.state.challenges[id], cid);
ok('Sessions challenge created: h2h, 7 days, Alex invited', c.metric === 'sessions' && c.kind === 'h2h' && c.ends_on === D(6) && await ev(([id, a]) => window.__mockSb.state.parts.some(p => p.c === id && p.u === a && p.status === 'invited'), [cid, alex]), JSON.stringify(c));
await page.waitForSelector('#h2hBoard .brow');
ok('standings show both, Alex marked invited', await page.locator('#h2hBoard .brow').count() === 2 && /invited/.test(await page.locator('#h2hBoard').innerText()));

/* 2. live standings update */
await ev(([a, d]) => { window.__mockSb.progress(a, 'sessions', d, 30); }, [alex, D(0)]);
await ev(([id, a]) => { const p = window.__mockSb.state.parts.find(p => p.c === id && p.u === a); p.status = 'joined'; localStorage.setItem('mock.sb', JSON.stringify(window.__mockSb.state)); }, [cid, alex]);
await page.reload(); await page.waitForSelector('#h2hBoard .brow'); await settle(800);
const rows = await page.locator('#h2hBoard .brow').allInnerTexts();
ok('live standings: scores from synced sessions, leader first', /Alex/.test(rows[0]) && /30/.test(rows[0]) && rows.length === 2, rows.join(' | '));
ok('in-progress: Leave available, no result yet', await page.locator('#h2hLeave').isVisible() && await page.locator('#h2hResult').count() === 0);

/* 2b. an existing Workout XP challenge still works */
const invX = await ev(a => window.__mockSb.challengeFrom(a, 'xp', [window.__mockSb.me()], 7), alex);
await page.goto(BASE + '#/h2h/' + invX); await page.waitForSelector('#h2hAccept'); await settle(300);
ok('existing Workout XP challenge still opens and is labelled', /Workout XP|XP/.test(await page.locator('#view').innerText()));
await page.locator('#h2hDecline').tap(); await settle(800);

/* 3. accept / decline invites from a friend */
const inv1 = await ev(a => window.__mockSb.challengeFrom(a, 'sessions', [window.__mockSb.me()], 7), alex);
const inv2 = await ev(a => window.__mockSb.challengeFrom(a, 'pushups', [window.__mockSb.me()], 7), alex);
await page.goto(BASE + '#/h2h/' + inv1); await page.waitForSelector('#h2hAccept');
await page.locator('#h2hAccept').tap(); await settle(800);
ok('accept: joins, shows standings + Leave', await ev(([id]) => window.__mockSb.state.parts.find(p => p.c === id && p.u === window.__mockSb.me()).status === 'joined', [inv1]) && await page.locator('#h2hLeave').count() === 1);
await page.goto(BASE + '#/h2h/' + inv2); await page.waitForSelector('#h2hDecline');
await page.locator('#h2hDecline').tap(); await settle(800);
ok('decline: marked declined, back to Friends', await ev(([id]) => window.__mockSb.state.parts.find(p => p.c === id && p.u === window.__mockSb.me()).status === 'declined', [inv2]) && (await ev(() => location.hash)) === '#/friends');

/* 4. finished challenge: winner, XP, badge (final one day after the end) */
const xp0 = await ev(() => DM_TEST.gameState().xp);
const mkEnded = (metric, mine, theirs, endAgo) => ev(([a, metric, mine, theirs, endAgo]) => { const m = window.__mockSb, s = m.state, me = m.me();
  const iso = d => d.toLocaleDateString('en-CA'), dd = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const id = 'e' + (++s.n); s.challenges[id] = { id, kind:'h2h', metric, title:'', starts_on:dd(endAgo + 6), ends_on:dd(endAgo), created_by:me };
  s.parts.push({ c:id, u:me, status:'joined' }, { c:id, u:a, status:'joined' });
  s.progress[`${me}|${metric}|${dd(endAgo + 6)}`] = mine; s.progress[`${a}|${metric}|${dd(endAgo + 6)}`] = theirs; localStorage.setItem('mock.sb', JSON.stringify(s)); return id; }, [alex, metric, mine, theirs, endAgo]);
const grace = await mkEnded('sessions', 3, 1, 1);
await page.goto(BASE + '#/h2h/' + grace); await page.waitForSelector('#h2hBoard .brow'); await settle(800);
ok('ended yesterday: no result yet, "Final results tomorrow"', await page.locator('#h2hResult').count() === 0 && /Final results tomorrow/.test(await page.locator('#h2hBoard').innerText()));
const won = await mkEnded('sessions', 4, 2, 3);
await page.goto(BASE + '#/h2h/' + won); await page.waitForSelector('#h2hResult', { timeout:8000 }); await settle(500);
ok('final: "You won!" banner, no XP', /You won!/i.test(await page.locator('#h2hResult').innerText()) && !/XP/.test(await page.locator('#h2hResult').innerText()));
ok('win toast (no XP)', /You won vs Alex!/.test(await toastText()) && !/XP/.test(await toastText()));
ok('win stored once with +50 XP', await ev(id => DM_TEST.db.game.h2h[id].r, won) === 'won' && (await ev(() => DM_TEST.gameState().xp)) === xp0 + 50);
ok('badge earned: Head-to-head winner', await ev(() => DM_TEST.badgeState().find(b => b.id === 'h2hwin').earned));
ok('Leave hidden after final', await page.locator('#h2hLeave').isHidden());
await page.screenshot({ path:`${SHOTS}/84-h2h.png` });
await page.reload(); await page.waitForSelector('#h2hResult'); await settle(500);
ok('reopening does not award twice', (await ev(() => DM_TEST.gameState().xp)) === xp0 + 50);
const lost = await mkEnded('pushups', 50, 120, 4), tied = await mkEnded('mat_minutes', 60, 60, 5), none = await mkEnded('pushups', 0, 0, 14);
await page.goto(BASE + '#/friends'); await page.waitForSelector('#h2hCard'); await settle(1200);
ok('Friends refresh records loss + tie: tie +25, loss 0', await ev(([l, t]) => [DM_TEST.db.game.h2h[l]?.r, DM_TEST.db.game.h2h[t]?.r].join(), [lost, tied]) === 'lost,tied' && (await ev(() => DM_TEST.gameState().xp)) === xp0 + 75);
await page.goto(BASE + '#/h2h/' + lost); await page.waitForSelector('#h2hResult');
ok('loss shows who won', /Alex won/i.test(await page.locator('#h2hResult').innerText()));

await page.goto(BASE + '#/h2h/' + none); await page.waitForSelector('#h2hResult'); await settle(800);
ok('0-0: no winner declared', /No winner/i.test(await page.locator('#h2hResult').innerText()), await page.locator('#h2hResult').innerText());
await page.goto(BASE + '#/h2h/' + lost); await page.waitForSelector('#h2hResult');
/* 5. rematch */
await page.locator('#h2hRematch').tap(); await page.waitForSelector('#h2hGo');
ok('rematch opens Challenge sheet with same friend + metric', await page.locator('#h2hFriends button.on').innerText() === 'Alex' && await page.locator('#sheet .seg button.on', { hasText:'Push-ups' }).count() === 1);
await page.locator('#h2hGo').tap(); await page.waitForFunction(() => location.hash.startsWith('#/h2h/') && !location.hash.includes('e'), null, { timeout:8000 }).catch(() => {});
ok('rematch creates a new challenge', await ev(() => Object.values(window.__mockSb.state.challenges).filter(c => c.metric === 'pushups' && c.ends_on >= new Date().toLocaleDateString('en-CA')).length) >= 2);

/* 6. pure outcome rules */
const r = await ev(() => { const T = DM_TEST, old = '2020-01-01', ch = { ends_on:old, my_status:'joined' };
  const b = (me, them, st = 'joined') => [{ is_me:true, status:'joined', score:me, display_name:'Me' }, { is_me:false, status:st, score:them, display_name:'Alex' }];
  return [T.h2hOutcome(ch, b(5, 3))?.r, T.h2hOutcome(ch, b(3, 5))?.r, T.h2hOutcome(ch, b(4, 4))?.r, T.h2hOutcome(ch, b(0, 0)), T.h2hOutcome(ch, b(5, 3, 'invited')), T.h2hOutcome({ ...ch, my_status:'invited' }, b(5, 3))].map(String).join(); });
ok('outcome rules: won, lost, tied, 0-0 none, opponent never joined none, invited none', r === 'won,lost,tied,null,null,null', r);
ok('no page errors', !errors.length, errors.join(' | '));
console.log(results.join('\n')); console.log(`\n${results.filter(x => x.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
