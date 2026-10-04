import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const mk = async () => { const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
  const page = await ctx.newPage(); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); }); page.on('pageerror', e => errors.push('pageerror: '+e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); }); return { ctx, page }; };
let { ctx, page } = await mk();
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const hash = () => page.evaluate(() => location.hash || '#/');
const sheetOpen = () => page.evaluate(() => !document.querySelector('#sheet').hidden);
const hideToast = async () => { await page.evaluate(() => document.querySelector('#toast').classList.remove('show','act')); await page.waitForTimeout(450); };
const settle = (ms=250) => page.waitForTimeout(ms);
const big = async loc => { const b = await loc.boundingBox(); return !!b && b.width >= 44 && b.height >= 44; };
const onHome = async () => (await hash()) === '#/' && await page.locator('#seeStats').count() === 1;

/* ---------- setup: sample data ---------- */
await page.goto(BASE); await page.waitForSelector('#loadSample');
await page.locator('#loadSample').tap(); await page.waitForSelector('#weightCard');

/* ---------- 1. log form: Cancel/back top-left, Home tab, discard confirm ---------- */
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
const back = page.locator('#backBtn');
ok('log form: back button top-left, big, labelled Cancel', await back.isVisible() && (await back.innerText()).trim() === 'Cancel' && await big(back) && (await back.boundingBox()).x < 40 && (await back.boundingBox()).y < 80);
await hideToast(); await page.screenshot({ path:`${SHOTS}/22-log-form-back-button.png` });
await back.tap(); await settle();
ok('Cancel on untouched form returns Home (no prompt)', await onHome() && !(await sheetOpen()));

await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.tabbar a[data-tab="home"]').tap(); await settle();
ok('Home tab closes the log form', await onHome() && await page.locator('.cats').count() === 0);

await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.stepper button[aria-label="Increase"]').first().tap();
const durVal = await page.locator('.stepper input').first().inputValue();
const n0 = (await db()).sessions.length;
await page.locator('.tabbar a[data-tab="home"]').tap(); await settle();
ok('discard confirm when leaving a filled-in form (Home tab)', await page.locator('.sheet h3', { hasText:'Discard this workout?' }).count() === 1 && (await hash()) === '#/log');
await page.locator('.sheet [data-cancel]').tap(); await settle();
ok('"Cancel" keeps the form and its input', (await hash()) === '#/log' && await page.locator('.stepper input').first().inputValue() === durVal && !(await sheetOpen()));
await back.tap(); await settle();
ok('back button also asks to discard', await page.locator('.sheet h3', { hasText:'Discard this workout?' }).count() === 1);
await page.locator('.sheet [data-ok]').tap(); await settle(400);
ok('Discard closes the form and goes back, nothing saved', await onHome() && (await db()).sessions.length === n0);

// browser / iOS back gesture
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.goBack(); await settle();
ok('back gesture on untouched form returns Home', await onHome());
await page.locator('.tabbar a.fab').tap(); await page.waitForSelector('.cats');
await page.locator('.stepper button[aria-label="Increase"]').first().tap();
await page.goBack(); await settle();
ok('back gesture on filled-in form asks to discard', await page.locator('.sheet h3', { hasText:'Discard this workout?' }).count() === 1 && await page.locator('.cats').count() === 1);
await page.locator('.sheet [data-ok]').tap(); await settle(400);
ok('…and Discard then leaves', await onHome() && (await db()).sessions.length === n0);

/* ---------- 2. back button on full screens ---------- */
await page.locator('#seeStats').tap(); await page.waitForSelector('#catCard');
ok('stats: Back button', await back.isVisible() && (await back.innerText()).trim() === 'Back' && await big(back));
await back.tap(); await settle(); ok('stats Back → Home', await onHome());
await page.locator('.tabbar a[data-tab="history"]').tap(); await page.waitForSelector('a.sess');
ok('History tab has no back button (top level)', !(await back.isVisible()));
await page.locator('a.sess').first().tap(); await page.waitForSelector('#del');
ok('session detail: Back button', await back.isVisible() && await big(back));
await page.locator('#topAction a', { hasText:'Edit' }).tap(); await page.waitForSelector('.cats');
ok('edit form: Cancel button', (await back.innerText()).trim() === 'Cancel');
await back.tap(); await settle(); ok('edit Cancel → session detail', (await hash()).startsWith('#/session/'));
await back.tap(); await settle(); ok('session Back → History', (await hash()) === '#/history');
// direct deep link (no in-app history) still has a way out
{ const p2 = await ctx.newPage(); await p2.goto(BASE + '#/stats'); await p2.waitForSelector('#catCard'); await p2.locator('#backBtn').tap(); await p2.waitForTimeout(250);
  ok('deep-linked screen (fresh tab) Back goes to its parent', await p2.evaluate(() => location.hash) === '#/' && await p2.locator('#seeStats').count() === 1); await p2.close(); }

/* ---------- 3. every sheet: Close/Cancel top-left, history-safe ---------- */
const sheetCase = async (name, open, label) => {
  const before = await hash();
  await open(); await page.waitForSelector('.sheet .panel'); await settle(400);
  const btn = page.locator('.sheet [data-close]');
  const vis = await btn.isVisible(), bg = await big(btn), bx = (await btn.boundingBox())?.x, lt = (await btn.innerText()).trim();
  const good = vis && bg && bx < 60 && (!label || lt === label);
  await btn.tap(); await settle();
  const so = await sheetOpen(), hh = await hash();
  ok(`${name}: ${label||'Close'} button top-left closes it`, good && !so && hh === before, `vis=${vis} big=${bg} x=${bx} label=${lt} open=${so} ${before}->${hh}`);
};
await page.goto(BASE + '#/food'); await page.waitForSelector('[data-add]');
await sheetCase('add food', () => page.locator('[data-add]').first().tap(), 'Cancel');
await sheetCase('my foods', () => page.locator('#savedFoods').tap(), 'Close');
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats');
await page.locator('.cats button[data-c="grappling"]').tap();

await sheetCase('add roll', () => page.locator('#addRoll').tap(), 'Cancel');
await page.locator('.tabbar a[data-tab="home"]').tap(); await settle();
if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(400); }
await sheetCase('log weight', () => page.locator('#logWeight').tap(), 'Cancel');

// popstate closes the sheet and stays on the screen
await page.locator('.tabbar a[data-tab="food"]').tap(); await page.waitForSelector('#savedFoods');
await page.locator('#savedFoods').tap(); await page.waitForSelector('.sheet .panel');
await page.goBack(); await settle();
ok('back gesture (popstate) closes the sheet, stays on screen', !(await sheetOpen()) && (await hash()) === '#/food');
await page.goBack(); await settle();
ok('next back goes to the previous screen (no dead history entries)', await onHome());
// sheet replaced by another sheet (My foods → quick add) still closes with one back
await page.locator('.tabbar a[data-tab="food"]').tap(); await page.waitForSelector('#savedFoods');
await page.locator('#savedFoods').tap(); await page.waitForSelector('.sheet [data-quick]');
await page.locator('.sheet [data-quick]').first().tap(); await settle(300);
const formUp = await sheetOpen();
await page.goBack(); await settle();
ok('sheet opened from a sheet closes with back gesture', formUp && !(await sheetOpen()) && (await hash()) === '#/food');

// bottom nav is never covered, and tapping it closes the sheet
await page.locator('#savedFoods').tap(); await page.waitForSelector('.sheet .panel');
const covered = await page.evaluate(() => [...document.querySelectorAll('.tabbar a')].map(a => { const r = a.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width/2, r.bottom - 12); return !!el && !!el.closest('.tabbar'); }));
ok('bottom nav not covered by an open sheet', covered.every(Boolean), JSON.stringify(covered));
await page.locator('.tabbar a[data-tab="home"]').tap(); await settle();
ok('Home tab closes an open sheet and goes Home', !(await sheetOpen()) && await onHome());
await page.locator('.tabbar a[data-tab="food"]').tap(); await page.waitForSelector('#savedFoods');
await page.locator('#savedFoods').tap(); await page.waitForSelector('.sheet .panel');
await page.locator('.tabbar a[data-tab="food"]').tap(); await settle();
ok('tapping the current tab closes the sheet', !(await sheetOpen()) && (await hash()) === '#/food');

// swipe down on the sheet closes it
await page.locator('#savedFoods').tap(); await page.waitForSelector('.sheet .panel'); await settle(300);
const cdp = await ctx.newCDPSession(page);
const pb = await page.locator('.sheet .sheethead').boundingBox();
const tp = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: pb.x + pb.width/2, y }] });
await tp('touchStart', pb.y + 20); for (let i = 1; i <= 8; i++) await tp('touchMove', pb.y + 20 + i*25); await tp('touchEnd'); await settle(400);
ok('swipe down closes the sheet', !(await sheetOpen()) && (await hash()) === '#/food');

// safe-area top inset respected (standalone iOS notch)
await page.addStyleTag({ content: ':root{--safe-t:47px !important}' });
await page.goto(BASE + '#/log'); await page.waitForSelector('#backBtn'); await settle();
const bb = await page.locator('#backBtn').boundingBox();
await page.locator('.tabbar a[data-tab="food"]').tap(); await page.waitForSelector('#savedFoods'); await page.locator('#savedFoods').tap(); await page.waitForSelector('.sheet .panel'); await settle(300);
const sp = await page.locator('.sheet .panel').boundingBox();
ok('back buttons sit below the status-bar safe area', bb.y >= 47 && sp.y >= 47, `back y=${Math.round(bb.y)} sheet y=${Math.round(sp.y)}`);
await ctx.close();

/* ---------- 4. weight goal ---------- */
({ ctx, page } = await mk());
await page.goto(BASE); await page.waitForSelector('#catTiles');
await page.locator('.tile[data-k="weight"]').tap();
ok('setup step 1: no weight fields yet', await page.locator('#setupW').count() === 0);
await page.locator('#go').tap(); await page.waitForSelector('#setupStep');
ok('setup step 2: weight goal fields appear when picked', await page.locator('#setupW').isVisible() && await page.locator('#setupGoal').isVisible());
await page.locator('#setupW').fill('215'); await page.locator('#setupGoal').fill('195');
await page.locator('#setupDone').tap(); await page.waitForSelector('#weightCard');
let d = await db();
ok('setup saves start/goal and first weigh-in', d.profile.startWeight === '215' && d.profile.goalWeight === '195' && d.weights.length === 1 && d.weights[0].w === 215 && d.profile.enabled.weight === true);
const wv = async k => (await page.locator(`#weightCard [data-w="${k}"]`).innerText()).replace(/[^\d.]/g, '');
ok('card at start: 0 lost, 20 to go, 0%', await wv('done') === '0' && await wv('left') === '20' && (await page.locator('#weightCard [data-w="pct"]').getAttribute('style')).includes('width:0%'));
// 2 taps: Log weight → Save (prefilled with last value)
let taps = 0;
taps++; await page.locator('#logWeight').tap(); await page.waitForSelector('#wIn');
ok('log weight prefilled with last value', await page.locator('#wIn').inputValue() === '215');
await page.locator('#wIn').fill('205');
await hideToast(); await page.screenshot({ path:`${SHOTS}/21-log-weight.png` });
taps++; await page.locator('#wSave').tap(); await settle(350);
d = await db();
ok('weigh-in saved in 2 taps (same day replaces)', taps <= 2 && d.weights.length === 1 && d.weights[0].w === 205 && d.weights[0].u === 'lb', `taps=${taps}`);
ok('progress math: lost 10, left 10, 50%', await wv('current') === '205' && await wv('done') === '10' && await wv('left') === '10' && (await page.locator('#weightCard [data-w="pct"]').getAttribute('style')).includes('width:50%') && (await page.locator('#weightCard').innerText()).includes('Lost so far'));
await page.locator('#logWeight').tap(); await page.waitForSelector('#wIn');
await page.locator('[data-dec]').tap(); await page.locator('[data-dec]').tap();
ok('stepper nudges by 0.2 lb', await page.locator('#wIn').inputValue() === '204.6');
await page.locator('.sheet [data-close]').tap(); await settle();

// inject history: weigh-ins over 4 weeks (-1 lb/wk) + one workout body weight; projection + goal line
const iso = dt => dt.toISOString().slice(0,10);
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); const day = n => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  d.weights = [28, 21, 14, 7, 0].map((n, i) => ({ id:'w'+i, date:day(n), w:209 - (28-n)/7, u:'lb', createdAt:Date.now() - n*864e5 }));
  d.sessions.push({ id:'s1', date:day(3), category:'weights', discipline:'strength', type:'class', duration:45, rounds:0, intensity:3, techniques:[], rolls:[], weight:205.6, notes:'', createdAt:Date.now() - 3*864e5 });
  localStorage.setItem('dm.bjj.v1', JSON.stringify(d));
});
await page.reload(); await page.waitForSelector('#weightCard');
ok('home card: current from latest weigh-in, sparkline drawn', await wv('current') === '205' && await page.locator('#weightCard svg.spark path').count() === 1);
await page.locator('#weightMore').tap(); await page.waitForSelector('#weightStats');
const ws = await page.locator('#weightStats').innerText();
ok('stats: merged history (5 weigh-ins + 1 workout weight)', ws.includes('6 entries'), ws.split('\n')[0]);
{ const rt = await page.locator('#wRate').innerText(); const n = Number(rt.replace('−','-').replace(/[^\d.-]/g,'')); ok('stats: weekly average rate ≈ −1 lb/wk', n < -0.85 && n > -1.15, rt); }
ok('stats: goal line on chart', await page.locator('#weightStats svg line.goal').count() === 1);
const eta = await page.locator('#eta').innerText().catch(() => '');
const expect = new Date(); expect.setDate(expect.getDate() + 70);
ok('stats: projected goal date ≈ 10 weeks out', !!eta && Math.abs(new Date(eta) - expect) < 4*864e5, eta);
await hideToast(); await page.locator('#weightStats').scrollIntoViewIfNeeded(); await page.locator('#weightStats').screenshot({ path:`${SHOTS}/23-weight-stats.png` });

// gain goal + reached goal
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.profile.startWeight = '150'; d.profile.goalWeight = '160'; d.sessions = d.sessions.filter(s => s.id !== 's1'); d.weights = [{ id:'g1', date:new Date().toISOString().slice(0,10), w:155, u:'lb', createdAt:Date.now() + 1000 }]; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.goto(BASE); await page.reload(); await page.waitForSelector('#weightCard');
ok('gain goal: direction inferred (Gained so far 5, left 5, 50%)', (await page.locator('#weightCard').innerText()).includes('Gained so far') && await wv('done') === '5' && await wv('left') === '5' && (await page.locator('#weightCard [data-w="pct"]').getAttribute('style')).includes('width:50%'));
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.weights[0].w = 161; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await page.waitForSelector('#weightCard');
ok('goal reached: 100% + message', (await page.locator('#weightHint').innerText()).includes('Goal reached') && (await page.locator('#weightCard [data-w="pct"]').getAttribute('style')).includes('width:100%') && await wv('left') === '0');

// units: switching to kg converts goal/start; weigh-ins display converted
await page.goto(BASE + '#/settings'); await page.waitForSelector('#goalW');
await page.locator('.seg button', { hasText:/^kg$/ }).first().tap(); await settle();
d = await db();
ok('switch to kg converts start/goal', d.profile.unit === 'kg' && Math.abs(Number(d.profile.goalWeight) - 72.6) < 0.1 && Math.abs(Number(d.profile.startWeight) - 68) < 0.1, `${d.profile.startWeight}/${d.profile.goalWeight}`);
await page.goto(BASE); await page.waitForSelector('#weightCard');
ok('weigh-in shown in kg', await wv('current') === '73');
await page.goto(BASE + '#/settings'); await page.waitForSelector('#goalW');
await page.locator('.seg button', { hasText:/^lb$/ }).first().tap(); await settle();
await page.locator('#goalDate').fill('2027-01-15'); await page.locator('#goalDate').dispatchEvent('change');
ok('goal date saved in Profile', (await db()).profile.goalDate === '2027-01-15');

// toggle hides the card
await page.locator('[data-sec="weight"]').uncheck({ force:true }); await settle();
await page.goto(BASE); await page.waitForSelector('#seeStats');
ok('Weight goal section can be hidden', await page.locator('#weightCard').count() === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('[data-sec="weight"]'); await page.locator('[data-sec="weight"]').check({ force:true });

// clear data wipes weights
await page.goto(BASE + '#/settings'); await page.waitForSelector('#clr');
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db();
ok('clear data removes weigh-ins and goal', d.weights.length === 0 && !d.profile.goalWeight && !d.profile.startWeight);
await ctx.close();

/* ---------- 5. v2 -> v3 migration ---------- */
({ ctx, page } = await mk());
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:2, sessions:[{ id:'a', date:'2026-09-20', category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, techniques:[], rolls:[], weight:200, notes:'', createdAt:1 }], profile:{ belt:'blue', goalWeight:'190', unit:'lb', setupDone:true, enabled:{ grappling:true, food:false, supps:false } }, nutrition:{ entries:[], foods:[] }, supps:{ items:[], log:[] } })); });
await page.reload(); await page.waitForSelector('#weightCard'); await settle(200);
const mg = await page.evaluate(() => ({ d:JSON.parse(localStorage.getItem('dm.bjj.v1')), b:localStorage.getItem('dm.bjj.v1.backup.v2') }));
ok('v2 → v4 migration: weights added, data kept, backup saved', mg.d.schema === 7 && Array.isArray(mg.d.weights) && mg.d.sessions.length === 1 && mg.d.profile.goalWeight === '190' && mg.d.profile.enabled.weight === true && !!mg.b && JSON.parse(mg.b).schema === 2);
ok('migrated user sees weight card from workout body weight', await wv('current') === '200' && await wv('goal') === '190');
await ctx.close();

/* ---------- 6. screenshot: weight card with sample data ---------- */
({ ctx, page } = await mk());
await page.goto(BASE); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await page.waitForSelector('#weightCard');
await hideToast();
await page.evaluate(() => { const c = document.querySelector('#weightCard'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 120); }); await settle(200);
await page.screenshot({ path:`${SHOTS}/20-weight-goal-card.png` });
const sw = await page.locator('#weightCard').innerText();
ok('sample data includes weigh-ins + goal', (await db()).weights.length > 30 && sw.includes('Lost so far') && sw.includes('Left to go'));

ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
