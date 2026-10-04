import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));

/* branding */
await page.goto(BASE); await page.waitForSelector('#catTiles');
ok('title + manifest say Forged', (await page.title()) === 'Forged · For the fight' && (await page.evaluate(async () => (await (await fetch('manifest.webmanifest')).json()).short_name)) === 'Forged');
ok('first-run shows the FORGED lockup; no Discipline > Motivation copy anywhere', await page.locator('.welcome img.lockup[src*="forged/wordmark.svg"]').count() === 1 && !/discipline|motivation|training log/i.test(await page.locator('body').innerText()));
ok('accent is flame orange with dark ink', await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return cs.getPropertyValue('--brand').trim().toUpperCase() === '#F2711C' && cs.getPropertyValue('--accent-ink').trim().toUpperCase() === '#0B0B0C'; }));

/* first-run: six sports, unused stay hidden */
const tiles = await page.locator('#catTiles .tile').evaluateAll(ts => ts.map(t => t.querySelector('b').textContent));
ok('first-run offers Grappling, Striking, MMA, Weights, Cardio, Mobility', JSON.stringify(tiles) === '["Grappling","Striking","MMA","Weights","Cardio","Mobility"]', JSON.stringify(tiles));
await page.locator('.tile[data-k="mobility"]').tap(); await page.locator('#go').tap(); await page.locator('#skipAbout').tap(); await page.locator('#skipGoals').tap(); await page.waitForSelector('.statrow');
await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await settle();
ok('log form shows only picked sports (Grappling + Mobility)', JSON.stringify(await page.locator('.cats button').evaluateAll(bs => bs.map(b => b.dataset.c))) === '["grappling","mobility"]');
await page.locator('.cats button[data-c="grappling"]').tap(); await settle(150);
const sports = await page.locator('.field', { has:page.locator('label', { hasText:/^Sport$/ }) }).locator('button').allTextContents();
ok('Grappling sport picker: BJJ default, Wrestling, Judo, Sambo, Submission grappling; Gi/No-Gi for BJJ', JSON.stringify(sports) === '["BJJ","Wrestling","Judo","Sambo","Submission grappling"]' && (await page.locator('.field', { has:page.locator('label', { hasText:/^Sport$/ }) }).locator('button.on').textContent()) === 'BJJ' && await page.locator('.field', { has:page.locator('label', { hasText:/^Uniform$/ }) }).count() === 1);
await page.goto(BASE + '#/settings'); await settle();
const secs = await page.locator('input[data-sec]').evaluateAll(is => is.map(i => i.dataset.sec));
ok('"What I track" lists all six sports', ['grappling','striking','mma','weights','cardio','mobility'].every(k => secs.includes(k)), JSON.stringify(secs));

/* v5 (2.3.0) data with archived striking: sessions come back, MMA-style ones become MMA */
const strike1 = { id:'s1', date:'2026-09-10', category:'striking', discipline:'muaythai', type:'class', duration:60, rounds:10, intensity:4, techniques:['Teep'], notes:'Pads', weight:'', rolls:[], strike:{ roundLen:3, mix:{ shadow:2, pads:4, bag:2, drills:0, sparring:2 }, spar:[{ partner:'Mo', notes:'Check kicks' }] }, hr:{ avg:150, max:180, cal:600, zones:[1,2,3,4,0] }, sample:false, createdAt:1 };
const strikeMma = { ...strike1, id:'s2', date:'2026-09-17', discipline:'mma', strike:{ ...strike1.strike, spar:[] } };
const bjj = { id:'g1', date:'2026-09-12', category:'grappling', discipline:'bjj', gi:'nogi', type:'class', duration:75, rounds:5, intensity:3, techniques:[], notes:'', weight:'', rolls:[], sample:false, createdAt:2 };
const v5 = { schema:5, sessions:[bjj], archive:{ striking:[strike1, strikeMma] }, profile:{ name:'', belt:'white', stripes:0, unit:'lb', distUnit:'mi', setupDone:true, enabled:{ grappling:true, weights:false, cardio:false, food:false, supps:false } }, nutrition:{ entries:[], foods:[], water:[] }, supps:{ items:[], log:[] }, weights:[], belts:[] };
await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, v5);
await page.goto(BASE + '#/'); await page.reload(); await page.waitForSelector('.statrow',{timeout:5000}).catch(()=>{console.log('ERR',errors, page.url())}); await settle(400);
let d = await db();
const back1 = d.sessions.find(s => s.id === 's1'), back2 = d.sessions.find(s => s.id === 's2');
ok('v5 → v7: archived striking sessions are back in the normal list, unchanged', d.schema === 7 && !d.archive && d.sessions.length === 3 && JSON.stringify(back1) === JSON.stringify({ ...strike1, rpe:strike1.intensity * 2 }), JSON.stringify(d.sessions.map(s => [s.id, s.category])));
ok('old striking "MMA" style session becomes the MMA category (data kept)', back2.category === 'mma' && back2.strike.mix.pads === 4 && back2.notes === 'Pads');
ok('Striking and MMA switched on because they have sessions; Mobility stays off', d.profile.enabled.striking === true && d.profile.enabled.mma === true && d.profile.enabled.mobility === false);
ok('v5 backup kept', !!(await page.evaluate(() => localStorage.getItem('dm.bjj.v1.backup.v5'))));
await page.goto(BASE + '#/history'); await settle(400);
ok('history shows the restored sessions', /muay thai/i.test(await page.locator('#view').innerText()) && await page.locator('.sess').count() === 3);
// user turns striking off again: it must stay off on reload (no re-enable on every load)
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.profile.enabled.striking = false; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await page.waitForSelector('#view .sess'); await settle(300);
ok('turning a sport off sticks across reloads', (await db()).profile.enabled.striking === false);
/* importing a 2.3.0 backup file restores its archived striking sessions too */
fs.writeFileSync('/tmp/catmig-v5.json', JSON.stringify({ app:'discipline-motivation', version:'2.3.0', ...v5 }));
await page.goto(BASE + '#/settings'); await settle(300);
await page.setInputFiles('#impFile', '/tmp/catmig-v5.json'); await page.locator('.sheet [data-ok]').tap(); await settle(400);
d = await db(); ok('importing an old D>M (2.3.0) backup works and un-archives striking', d.sessions.length === 3 && d.sessions.some(s => s.category === 'striking') && d.sessions.some(s => s.category === 'mma') && !d.archive);
/* export from 3.0 */
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/tmp/catmig-export.json'; await dl.saveAs(path); const exp = JSON.parse(fs.readFileSync(path, 'utf8'));
ok('export: app forged, schema 7, all sessions, no archive', exp.app === 'forged' && exp.schema === 7 && exp.sessions.length === 3 && !exp.archive);
ok('storage key unchanged (dm.bjj.v1)', await page.evaluate(() => !!localStorage.getItem('dm.bjj.v1')));
/* sample data covers every category */
await page.locator('#ldS').tap(); await settle(500);
d = await db(); const cats = new Set(d.sessions.filter(s => s.sample).map(s => s.category));
ok('sample data: grappling, striking, MMA, weights, cardio, mobility', ['grappling','striking','mma','weights','cardio','mobility'].every(c => cats.has(c)), JSON.stringify([...cats]));
await page.goto(BASE + '#/history'); await settle(400);
const filt = await page.locator('.filters button, .filters a').evaluateAll(xs => xs.map(x => x.textContent.trim()));
ok('history filters include all six sports + Gi/No-Gi', ['Grappling','Striking','MMA','Weights','Cardio','Mobility','Gi','No-Gi'].every(x => filt.includes(x)), JSON.stringify(filt));
await page.locator('.filters button, .filters a', { hasText:/^Mobility$/ }).first().tap(); await settle(300);
ok('Mobility filter shows only mobility sessions', await page.locator('.sess').count() > 0 && (await page.locator('.sess').evaluateAll(xs => xs.every(x => /yoga|stretching|foam rolling|mobility flow|recovery/i.test(x.innerText)))));
await page.goto(BASE + '#/stats'); await page.waitForSelector('#catCard'); await settle(300);
const st = await page.locator('#catCard').innerText();
ok('stats hours-by-category include MMA and Mobility', /MMA/.test(st) && /Mobility/.test(st) && /Striking/.test(st));
await page.goto(BASE + '#/'); await settle(300);
ok('belt card still shown (BJJ)', await page.locator('#beltCard').count() === 1);
/* 3.4.0: Cardio "Jump rope" replaced by "Stairs"; old Jump rope sessions keep their label */
{
  const t = new Date().toLocaleDateString('en-CA'), rope = { id:'rope1', date:t, category:'cardio', discipline:'rope', duration:20, intensity:3, rpe:7, notes:'', sample:false, createdAt:Date.now() - 864e5, cardio:{ distance:'', unit:'mi', sec:1200 } };
  await page.goto(BASE); await page.evaluate(r => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:7, sessions:[r], profile:{ setupDone:true, unit:'lb', distUnit:'mi', enabled:{ grappling:true, cardio:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[] })); }, rope);
  await page.reload(); await page.goto(BASE + '#/log'); await page.waitForSelector('.cats'); await settle(200);
  if (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').tap(); await settle(); }
  await page.locator('.cats button[data-c="cardio"]').tap(); await settle(200);
  const acts = await page.locator('#view .seg').first().locator('button').allInnerTexts();
  ok('cardio picker: Stairs replaces Jump rope', acts.join('|') === 'Run|Bike|Row|Swim|Stairs|Other', acts.join('|'));
  ok('new cardio form does not default to the retired Jump rope', !acts.some(a => /jump rope/i.test(a)) && await page.locator('#view .seg').first().locator('button.on').count() === 1);
  await page.locator('#view .seg').first().locator('button', { hasText:'Stairs' }).tap();
  await page.locator('.actions [data-save]').tap(); await settle(600);
  let d = await db();
  ok('a Stairs session saves as discipline "stairs"', d.sessions.some(s => s.discipline === 'stairs'), JSON.stringify(d.sessions.map(s => s.discipline)));
  ok('old Jump rope session is kept as-is (not remapped)', d.sessions.find(s => s.id === 'rope1').discipline === 'rope');
  await page.goto(BASE + '#/history'); await settle(500);
  const hist = await page.locator('#view').innerText();
  ok('history still labels the old session "Jump rope" and the new one "Stairs"', /Jump rope/i.test(hist) && /Stairs/i.test(hist));
  await page.goto(BASE + '#/edit/rope1'); await page.waitForSelector('.actions [data-save]'); await settle(200);
  const eacts = await page.locator('#view .seg').first().locator('button').allInnerTexts();
  ok('editing an old Jump rope session keeps it selected (shown only there)', /Jump rope/i.test(eacts.join('|')) && /Jump rope/i.test(await page.locator('#view .seg').first().locator('button.on').innerText()), eacts.join('|'));
  await page.locator('.actions [data-save]').tap(); await settle(500);
  ok('saving the edit without changes keeps Jump rope', (await db()).sessions.find(s => s.id === 'rope1').discipline === 'rope');
  ok('Profile "What I track" lists Stairs, not Jump rope', await page.goto(BASE + '#/settings').then(() => page.waitForSelector('#sectionsCard')).then(async () => { const x = await page.locator('#sectionsCard').innerText(); return /Stairs/.test(x) && !/Jump rope/i.test(x); }));
}
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
