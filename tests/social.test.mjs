// 3.4.0 social: feature flag, sign-in (email code), friends, invites, head-to-head, leaderboard, sync + offline queue,
// privacy, account deletion. Supabase is mocked (tests/mock-supabase.js); a last block drives the real vendored
// supabase-js against intercepted HTTP. No request ever reaches supabase.co.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const MOCK = fs.readFileSync(new URL('./mock-supabase.js', import.meta.url), 'utf8');
const SB = 'https://ftnhmeqpzqpfdwhjfvnk.supabase.co';
const errors = [], results = [];
const ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
let sbHits = 0;
async function mkPage({ flag, mock }){
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  if (flag) await ctx.addInitScript(() => { window.FORGED_CONFIG = { social:true }; });
  if (mock) await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page };
}
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const at = (date, h = 12) => Date.parse(date + 'T00:00:00') + h * 36e5;
const S = (id, date, o = {}) => ({ id, date, category:'grappling', discipline:'bjj', type:'class', duration:60, intensity:3, rpe:6, rounds:4, notes:'secret notes about my knee', sample:false, createdAt:at(date), ...o });
const seedDb = () => ({ schema:7, profile:{ name:'Steve', unit:'lb', setupDone:true, challengeTarget:8, enabled:{ grappling:true, weights:true, food:true, weight:true } },
  sessions:[S('a', D(0)), S('b', D(0)), S('smp', D(0), { sample:true }), S('w', D(-3), { category:'weights', discipline:'strength', duration:45, exercises:[] }), S('old', D(-10))],
  nutrition:{ entries:[{ id:'f1', date:D(0), name:'Secret burrito', cal:900, p:40, c:90, f:30, meal:'lunch', createdAt:Date.now() }], foods:[], water:[] },
  weights:[{ id:'bw', date:D(0), w:187, u:'lb', createdAt:Date.now() }], belts:[], reps:[{ id:'r1', date:D(0), ex:'pushups', n:120, createdAt:Date.now() }] });
const settle = (p, ms = 300) => p.waitForTimeout(ms);
const toastText = p => p.locator('#toast').innerText();
const hideToast = async p => { await p.evaluate(() => document.querySelector('#toast').classList.remove('show', 'act')); await p.waitForTimeout(400); };
async function seed(page, hash = '#/'){ await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, seedDb()); await page.reload(); await page.goto(BASE + hash); await settle(page, 500); }

/* ---------- A. flag off (the live default) ---------- */
{
  const { ctx, page } = await mkPage({ flag:false, mock:false });
  const reqs = []; page.on('request', r => reqs.push(r.url()));
  await seed(page, '#/challenges'); await page.waitForSelector('#ch-d');
  ok('flag off: no Friends button on Challenges', await page.locator('#friendsTop, #friendsLink').count() === 0);
  await page.goto(BASE + '#/settings'); await page.waitForSelector('#sectionsCard');
  ok('flag off: no Friends card in Profile', await page.locator('#friendsCard').count() === 0);
  for (const r of ['#/friends', '#/signin', '#/invite/ABCD2345', '#/h2h/x']) { await page.goto(BASE + r); await settle(page, 300); }
  ok('flag off: social routes fall back to Home', (await page.evaluate(() => location.hash)) === '#/' || (await page.evaluate(() => location.hash)) === '');
  ok('flag off: config default is social:false', await page.evaluate(() => window.FORGED_CONFIG.social === false && !window.DM_TEST.socialOn()));
  ok('flag off: supabase-js not loaded, no Supabase requests', !reqs.some(u => u.includes('supabase')) && await page.evaluate(() => !window.supabase && !window.ForgedCloud.loaded), reqs.filter(u => u.includes('supabase')).join(','));
  ok('service worker precaches the vendored supabase-js (offline)', /vendor\/supabase-js-2\.117\.2\.js/.test(fs.readFileSync('/workspace/bjj-tracker/sw.js', 'utf8')));
  await ctx.close();
}

/* ---------- B. flag on, mocked Supabase ---------- */
const { ctx, page } = await mkPage({ flag:true, mock:true });
await ctx.route('**/*supabase.co/**', r => { sbHits++; r.abort(); });
await seed(page, '#/challenges'); await page.waitForSelector('#ch-d');
ok('flag on: Friends button on Challenges + link in the friend card', await page.locator('#friendsTop').count() === 1 && await page.locator('#friendsLink').count() === 1);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#friendsCard');
ok('flag on: Friends card in Profile (above Rank, badges & looks)', /optional account/i.test(await page.locator('#friendsCard').innerText()) && await page.evaluate(() => document.querySelector('#friendsCard').nextElementSibling.id === 'gameProfile'));
await page.goto(BASE + '#/friends'); await page.waitForSelector('#friendsIntro');
ok('signed out: intro + Sign in with email; app stays usable without an account', /sign in with email/i.test(await page.locator('#goSignin').innerText()) && /optional/i.test(await page.locator('#friendsIntro').innerText()));
const priv = await page.locator('#privacyCard').innerText();
ok('privacy on screen: only summaries; never notes, weight, food', /rank, level, XP/i.test(priv) && /never shared/i.test(priv) && /notes/i.test(priv) && /weight/i.test(priv) && /food/i.test(priv));
ok('Sign in with Apple hidden until enabled (hook only)', await page.locator('#appleSignin').count() === 0 && await page.evaluate(() => typeof window.ForgedCloud.signInWithApple === 'function'));
// a friend exists on the server
const alex = await page.evaluate(D0 => { const m = window.__mockSb; const id = m.addUser({ name:'Alex', color:'sky', rank:2, level:12, xp:5200, invite:'ALEX2345' });
  m.progress(id, 'sessions', D0, 4); m.progress(id, 'xp', D0, 30); m.progress(id, 'pushups', D0, 80); return id; }, D(0));
// sign in
await page.locator('#goSignin').tap(); await page.waitForSelector('#signinCard');
await page.locator('#siEmail').fill('steve@'); await page.locator('#siSend').tap(); await settle(page, 150);
ok('sign-in: rejects a bad email', /enter your email/i.test(await toastText(page)));
await page.locator('#siEmail').fill('steve@example.com'); await page.locator('#siSend').tap(); await page.waitForSelector('#siCodeWrap:not([hidden])');
const otp = await page.evaluate(() => window.__mockSb.lastOtp);
ok('sign-in: one-time code requested, redirect URL is the live site', otp.email === 'steve@example.com' && otp.options.emailRedirectTo === 'https://forgedfightapp.github.io/' && otp.options.shouldCreateUser === true, JSON.stringify(otp));
ok('sign-in: code field is numeric with one-time-code autofill', await page.locator('#siCode').getAttribute('autocomplete') === 'one-time-code' && await page.locator('#siCode').getAttribute('inputmode') === 'numeric');
await hideToast(page); await page.locator('#siCode').fill('1234'); await settle(page, 100);
await page.screenshot({ path:`${SHOTS}/64-signin.png` });
await page.locator('#siCode').fill('000000'); await settle(page, 400);
ok('sign-in: wrong code explains what to do', /wrong or expired/i.test(await toastText(page)));
await page.locator('#siCode').fill('123456'); await page.waitForSelector('#youCard', { timeout:8000 });
ok('sign-in: correct code signs in and opens Friends', /steve@example\.com/.test(await page.locator('#youCard').innerText()) && (await page.evaluate(() => location.hash)) === '#/friends');
// sync: summaries only
await page.waitForFunction(() => window.__mockSb.calls.some(c => c.fn === 'submit_progress'), null, { timeout:8000 });
const calls = await page.evaluate(() => window.__mockSb.calls);
const sub = calls.filter(c => c.fn === 'submit_progress' && c.entries).flatMap(c => c.entries), up = calls.find(c => c.fn === 'upsert_profile');
const val = (m, d) => (sub.find(e => e.metric === m && e.day === d) || {}).value;
ok('sync: today = 2 sessions (sample excluded), 20 XP, 120 push-ups, 120 mat minutes', val('sessions', D(0)) === 2 && val('xp', D(0)) === 20 && val('pushups', D(0)) === 120 && val('mat_minutes', D(0)) === 120, JSON.stringify(sub));
ok('sync: weights session counts as a session, not mat time', val('sessions', D(-3)) === 1 && val('mat_minutes', D(-3)) === undefined);
ok('sync: nothing older than 7 days is sent (server backdate limit)', sub.every(e => e.day >= D(-6)) && val('sessions', D(-10)) === undefined);
ok('sync: only count metrics leave the phone', sub.every(e => ['sessions','xp','pushups','mat_minutes','daily_done'].includes(e.metric) && Number.isInteger(e.value)) && !JSON.stringify(calls).match(/secret|burrito|187|knee/i));
ok('sync: public profile = name, colour, rank, level, XP, belt only', up && up.args.p_display_name === 'Steve' && Object.keys(up.args).sort().join() === 'p_avatar_color,p_belt,p_display_name,p_level,p_rank_idx,p_xp', JSON.stringify(up && up.args));
ok('sync: server accepted everything (rules mirrored)', await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('forged.social.queue') || '{}')).length === 0, null, { timeout:8000 }).then(() => true, () => false));
// invite code + link
await page.waitForFunction(() => /^[A-HJ-NP-Z2-9]{8}$/.test(document.querySelector('#myCode')?.textContent || ''));
const myCode = await page.locator('#myCode').innerText();
await page.evaluate(() => { navigator.share = undefined; });
await page.locator('#shareInvite').tap(); await settle(page, 200);
ok('invite: your code + shareable #/invite/<code> link', (await page.evaluate(() => window.__lastInviteUrl)).endsWith('#/invite/' + myCode));
// add friend by code
await page.locator('#addCode').fill('alex2345'); await page.locator('#addFriend').tap();
await page.waitForSelector('#h2hFriends', { timeout:8000 });
ok('add friend by code: friends both ways, then offers a head-to-head', /now friends/i.test(await toastText(page)) && await page.evaluate(id => window.__mockSb.state.friends.some(([a, b]) => b === id), alex));
// head-to-head: push-ups
await page.locator('.sheet [role="radio"]', { hasText:'Push-ups' }).tap();
await page.locator('#h2hGo').tap(); await page.waitForURL(/#\/h2h\//); await page.waitForSelector('#h2hBoard .brow');
const h2hId = (await page.evaluate(() => location.hash)).split('/')[2];
let rows = await page.locator('#h2hBoard .brow').allInnerTexts();
ok('head-to-head: live standings, you lead 120 to 80', rows.length === 2 && /Steve[\s\S]*120/.test(rows[0]) && /Alex[\s\S]*80/.test(rows[1]) && /\(invited\)/.test(rows[1]), JSON.stringify(rows));
ok('head-to-head: challenge stored with friend invited', await page.evaluate(id => { const s = window.__mockSb.state; return s.challenges[id].metric === 'pushups' && s.challenges[id].kind === 'h2h'; }, h2hId));
await page.evaluate(([id, D0]) => { window.__mockSb.progress(id, 'pushups', D0, 150); }, [alex, D(0)]);
await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.goto(BASE + '#/friends'); await page.goto(BASE + '#/h2h/' + h2hId);
await page.waitForFunction(() => /Alex[\s\S]*150/.test(document.querySelector('#h2hBoard')?.innerText || ''), null, { timeout:8000 });
rows = await page.locator('#h2hBoard .brow').allInnerTexts();
ok('head-to-head: standings update from the friend\'s synced progress', /Alex[\s\S]*150/.test(rows[0]) && /Steve[\s\S]*120/.test(rows[1]));
await hideToast(page); await page.screenshot({ path:`${SHOTS}/63-h2h.png` });
// incoming challenge from Alex
await page.evaluate(([id]) => window.__mockSb.challengeFrom(id, 'sessions', [window.__mockSb.me()], 7), [alex]);
await page.goto(BASE + '#/friends'); await page.waitForSelector('#h2hCard [data-acc]', { timeout:8000 });
ok('incoming head-to-head shows Accept / Decline', await page.locator('#h2hCard [data-acc][data-yes="1"]').count() === 1);
await page.locator('#h2hCard [data-acc][data-yes="1"]').tap(); await page.waitForFunction(() => !document.querySelector('#h2hCard [data-acc]'), null, { timeout:8000 });
ok('accepting joins the challenge', await page.evaluate(() => window.__mockSb.state.parts.filter(p => p.u === window.__mockSb.me()).every(p => p.status === 'joined')));
// leaderboard / friend list
const board = await page.locator('#boardCard .frow').allInnerTexts();
ok('friend list: rank + this week\'s sessions, ranked by weekly XP', board.length === 2 && /^1[\s\S]*Alex[\s\S]*Journeyman[\s\S]*\n4\nsessions/i.test(board[0]) && /^2[\s\S]*Steve[\s\S]*You[\s\S]*\n[23]\nsessions/i.test(board[1]), JSON.stringify(board));
await hideToast(page); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 200);
await page.screenshot({ path:`${SHOTS}/62-friends.png` });
await page.locator('#h2hCard').evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70)); await settle(page, 200);
await page.screenshot({ path:`${SHOTS}/62b-friends-board.png` });
// offline queue
await ctx.setOffline(true);
await page.goto(BASE + '#/challenges'); await page.waitForSelector('#logRepsTop');
await page.locator('#logRepsTop').tap(); await page.waitForSelector('.reprow[data-ex="pushups"]');
await page.locator('.reprow[data-ex="pushups"] [data-add-rep="10"]').tap(); await settle(page, 300);
await page.locator('.sheet [data-close]').first().tap(); await settle(page, 4000);
const qd = await page.evaluate(() => JSON.parse(localStorage.getItem('forged.social.queue') || '{}'));
ok('offline: new reps wait in the offline queue', qd[`pushups|${D(0)}`] === 130, JSON.stringify(qd));
await page.goto(BASE + '#/friends'); await page.waitForSelector('#offlineNote');
ok('offline: Friends shows the last synced data + an offline note', /offline/i.test(await page.locator('#offlineNote').innerText()) && await page.locator('#boardCard .frow').count() === 2 && /waiting to sync/i.test(await page.locator('#sSync').innerText()));
await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForFunction(D0 => window.__mockSb.state.progress[`${window.__mockSb.me()}|pushups|${D0}`] === 130, D(0), { timeout:8000 });
ok('back online: the queue flushes to the server', await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('forged.social.queue') || '{}')).length === 0, null, { timeout:5000 }).then(() => true, () => false));
// server rules mirrored in the mock/server: bad entries are rejected, not retried forever
const rej = await page.evaluate(async D10 => window.ForgedCloud.submit([{ metric:'sessions', day:D10, value:1 }, { metric:'xp', day:D10, value:40 }, { metric:'weight', day:D10, value:80 }]), D(-10));
ok('server-side rules: too old / over the cap / unknown metric rejected', rej.accepted === 0 && rej.rejected.length === 3);
// challenge link carries the invite when signed in
await page.goto(BASE + '#/challenges'); await page.waitForSelector('#challengeFriend');
await page.locator('#challengeFriend').tap(); await page.locator('#friendSend').tap(); await settle(page, 400);
const url = await page.evaluate(() => window.__lastFriendUrl);
const fc = await page.evaluate(u => window.DM_TEST.readFriendCode(u.split('#/join/')[1]), url);
ok('challenge links carry your invite code when signed in (#/join upgrade)', fc && fc.inv === myCode, JSON.stringify(fc));
await page.goto(BASE + '#/join/' + url.split('#/join/')[1]); await page.waitForSelector('#joinLive');
ok('join link (signed in): "Add <name> as a friend" via the server', /add steve as a friend/i.test(await page.locator('#joinFriend').innerText()));
// invite route
await page.goto(BASE + '#/invite/ALEX2345'); await page.waitForSelector('#invGo');
ok('invite link signed in: shows the inviter and Add', /Alex invited you/i.test(await page.locator('#inviteView').innerText()) && /^Add Alex$/i.test(await page.locator('#invGo').innerText()));
// remove friend
await page.goto(BASE + '#/friends'); await page.waitForSelector('#boardCard [data-fmenu]');
await page.locator('#boardCard [data-fmenu]').first().tap(); await page.locator('#fmRemove').tap();
await page.waitForFunction(() => document.querySelectorAll('#boardCard .frow').length === 1, null, { timeout:8000 });
ok('remove friend', await page.evaluate(() => window.__mockSb.state.friends.length === 0));
// delete account
await page.locator('#delAcct').tap(); await page.locator('.sheet [data-ok]').tap(); await page.waitForSelector('#friendsIntro', { timeout:8000 });
const after = await page.evaluate(() => ({ prof:Object.keys(window.__mockSb.state.profiles).length, sess:JSON.parse(localStorage.getItem('dm.bjj.v1')).sessions.length, auth:localStorage.getItem('forged.auth'), sq:localStorage.getItem('forged.social.cache') }));
ok('delete account: server data gone, signed out, local workouts kept', after.prof === 1 && after.sess === 5 && !after.auth && !after.sq, JSON.stringify(after));
// signed out: invite + join links ask to sign in, and remember the invite
await page.goto(BASE + '#/invite/ALEX2345'); await page.waitForSelector('#invGo');
ok('invite link signed out: "Sign in to add Alex"', /sign in to add alex/i.test(await page.locator('#invGo').innerText()));
await page.locator('#invGo').tap(); await page.waitForSelector('#signinCard');
ok('the invite is remembered through sign-in', await page.evaluate(() => JSON.parse(localStorage.getItem('forged.social.invite')) === 'ALEX2345') && /add your friend/i.test(await page.locator('#signinCard').innerText()));
await page.locator('#siEmail').fill('new@example.com'); await page.locator('#siSend').tap(); await page.waitForSelector('#siCodeWrap:not([hidden])');
await page.locator('#siCode').fill('123456'); await page.waitForFunction(() => /now friends/i.test(document.querySelector('#toast').innerText), null, { timeout:8000 });
ok('after sign-in the pending invite is accepted automatically', await page.evaluate(id => window.__mockSb.state.friends.some(([a, b]) => b === id), alex));
ok('mock mode: zero requests to supabase.co', sbHits === 0, String(sbHits));
await ctx.close();

/* ---------- C. real vendored supabase-js against intercepted HTTP (no network) ---------- */
{
  const { ctx, page } = await mkPage({ flag:true, mock:false });
  const seen = [];
  await ctx.route(`${SB}/**`, async r => {
    const req = r.request(), u = new URL(req.url()); seen.push({ m:req.method(), p:u.pathname, q:u.search, h:req.headers(), b:req.postData() });
    const json = (body, status = 200) => r.fulfill({ status, contentType:'application/json', headers:{ 'access-control-allow-origin':'*' }, body:JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return r.fulfill({ status:204, headers:{ 'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-allow-methods':'*' } });
    if (u.pathname === '/auth/v1/otp') return json({});
    if (u.pathname === '/auth/v1/verify') return json({ access_token:'tok-123', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now() / 1000) + 3600, refresh_token:'ref', user:{ id:'11111111-1111-1111-1111-111111111111', aud:'authenticated', role:'authenticated', email:'steve@example.com' } });
    if (u.pathname === '/rest/v1/rpc/create_invite') return json('QWER2345');
    if (u.pathname === '/rest/v1/rpc/my_challenges') return json([]);
    if (u.pathname === '/rest/v1/rpc/submit_progress') return json({ accepted:1, rejected:[] });
    if (u.pathname === '/rest/v1/rpc/upsert_profile') return json({});
    if (u.pathname === '/rest/v1/friends_leaderboard') return json([{ user_id:'11111111-1111-1111-1111-111111111111', display_name:'Steve', avatar_initial:'S', avatar_color:'flame', rank_idx:0, level:3, xp:300, belt:'white', week_sessions:2, week_xp:20, place:1, is_me:true }]);
    return json({ message:'unexpected ' + u.pathname }, 404);
  });
  const vendor = []; page.on('request', q => { if (q.url().includes('vendor/supabase-js')) vendor.push(q.url()); });
  await seed(page, '#/signin'); await page.waitForSelector('#siEmail');
  await page.locator('#siEmail').fill('steve@example.com'); await page.locator('#siSend').tap(); await page.waitForSelector('#siCodeWrap:not([hidden])', { timeout:10000 });
  const otpReq = seen.find(x => x.p === '/auth/v1/otp');
  ok('real supabase-js: vendored copy loaded from this site (no CDN)', vendor.length >= 1 && vendor.every(u => u.startsWith(BASE)), vendor.join());
  ok('real supabase-js: OTP request uses the publishable key + redirect to the live site', otpReq && otpReq.h.apikey === 'sb_publishable_hspLZBFgnh5VhAeMXnBaSA_2agWNO41' && decodeURIComponent(otpReq.q).includes('redirect_to=https://forgedfightapp.github.io/') && JSON.parse(otpReq.b).email === 'steve@example.com', JSON.stringify(otpReq && { q:otpReq.q, b:otpReq.b }));
  ok('real supabase-js: PKCE flow (code challenge sent)', otpReq && /code_challenge/.test(otpReq.b));
  await page.locator('#siCode').fill('123456'); await page.waitForSelector('#youCard', { timeout:10000 });
  await page.waitForFunction(() => document.querySelector('#myCode')?.textContent === 'QWER2345', null, { timeout:10000 });
  const rpc = seen.filter(x => x.p.startsWith('/rest/v1/'));
  ok('real supabase-js: RPCs + leaderboard view called with the session token', rpc.length >= 4 && rpc.every(x => x.h.authorization === 'Bearer tok-123') && rpc.some(x => x.p === '/rest/v1/rpc/submit_progress') && rpc.some(x => x.p === '/rest/v1/friends_leaderboard'), rpc.map(x => x.p).join());
  ok('real supabase-js: session stored under forged.auth (separate from dm.bjj.v1)', await page.evaluate(() => !!localStorage.getItem('forged.auth') && !localStorage.getItem('dm.bjj.v1').includes('tok-123')));
  await ctx.close();
}

ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(process.env.QUIET ? results.filter(r => !r.startsWith('PASS')).concat(results.filter(r => r.startsWith('PASS'))).join('\n') : results.join('\n'));
