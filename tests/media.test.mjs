// 3.12.0 clips & photos with friends: pick/capture, client-side limits (photo -> 1600px JPEG, video <= 60 s / 25 MB),
// private upload, friends-only feed with signed URLs, owner delete, 30-day expiry, feature flag. Supabase is mocked.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const MOCK = fs.readFileSync(new URL('./mock-supabase.js', import.meta.url), 'utf8');
const FX = new URL('./fixtures/media/', import.meta.url).pathname;
const errors = [], results = [];
const ok = (n, c, x = '') => { results.push(`${c ? 'PASS' : 'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
process.on('uncaughtException', e => { console.log(results.join('\n')); console.log('ERROR', e.message.split('\n')[0]); process.exit(1); });
const browser = await chromium.launch();
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const S = (id, date) => ({ id, date, category:'grappling', discipline:'bjj', type:'class', duration:60, intensity:3, rpe:6, rounds:4, notes:'', sample:false, createdAt:Date.parse(date + 'T12:00:00') });
const db0 = { schema:7, profile:{ name:'Steve', unit:'lb', setupDone:true, enabled:{ grappling:true, food:true } }, sessions:[S('a', D(0))], nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], reps:[] };
const mk = async cfg => { const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  await ctx.addInitScript(c => { window.FORGED_CONFIG = c; window.__FORGED_QUIET_MEDALS = true; }, cfg); await ctx.addInitScript(MOCK); await ctx.route('**/*supabase.co/**', r => r.abort());
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: ' + e.message)); return { ctx, page }; };
const signIn = async page => {
  await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); localStorage.setItem('forged.tut.seen', JSON.stringify({ home:1, friends:1 })); }, db0);
  await page.goto(BASE + '#/friends'); await page.waitForSelector('#goSignin');
  await page.locator('#goSignin').tap(); await page.waitForSelector('#siEmail');
  await page.locator('#siEmail').fill('steve@example.com'); await page.locator('#siSend').tap(); await page.waitForSelector('#siCodeWrap:not([hidden])');
  await page.locator('#siCode').fill('123456'); await page.waitForSelector('#youCard', { timeout:8000 }); };

/* 1. flag off (before migration 004): no media UI at all */
{ const { ctx, page } = await mk({ social:true }); await signIn(page);
  ok('flag off: no Clips & photos card', await page.locator('#mediaCard, #shareMedia').count() === 0); await ctx.close(); }

const { ctx, page } = await mk({ social:true, media:true });
const ev = (f, a) => page.evaluate(f, a), settle = (ms = 400) => page.waitForTimeout(ms);
await signIn(page);
const [alex, sam] = await ev(() => [window.__mockSb.addUser({ name:'Alex', color:'sky' }), window.__mockSb.addUser({ name:'Sam', color:'gold' })]);
await ev(a => { const m = window.__mockSb; m.befriend(m.me(), a); m.postAs(a, 'photo', 'Morning drilling 🔥', 0.1); m.postAs(a, 'video', 'Old roll', 31); }, alex);
await ev(s => window.__mockSb.postAs(s, 'photo', 'Not my friend', 0), sam);
await page.reload(); await page.waitForSelector('#mediaFeed .mpost', { timeout:8000 }); await settle();
const feed = await page.locator('#mediaFeed').innerText();
ok('feed: friend post with name, caption and time', /Alex/.test(feed) && /Morning drilling/.test(feed) && /ago|just now/.test(feed));
ok('feed: non-friends hidden (RLS) and >30 day posts hidden', !/Not my friend/.test(feed) && !/Old roll/.test(feed));
ok('feed: viewed via signed URL', /#u-\d+\//.test(await page.locator('#mediaFeed img').first().getAttribute('src')));
ok('feed: no delete on a friend\'s post', await page.locator('#mediaFeed [data-mdel]').count() === 0);

/* 2. photo: picker accepts images + videos, resized to <= 1600 px JPEG */
let fc = page.waitForEvent('filechooser'); await page.locator('#shareMedia').tap(); let ch = await fc;
ok('picker: accept image/* and video/* (camera, camera roll or files)', await ch.element().getAttribute('accept') === 'image/*,video/*');
await ch.setFiles(FX + 'photo.jpg'); await page.waitForSelector('#mediaSheet'); await settle();
ok('photo preview + caption box', await page.locator('#mediaSheet img').count() === 1 && await page.locator('#mediaCap').count() === 1);
await page.screenshot({ path:`${SHOTS}/89-share-photo-sheet.png` });
await page.locator('#mediaCap').fill('Open mat w/ the crew'); await page.locator('#mediaPost').tap();
await page.waitForFunction(() => /Shared with friends/.test(document.querySelector('#toast').textContent), null, { timeout:8000 });
const up = await ev(() => window.__mockSb.calls.filter(c => c.fn === 'upload').pop());
ok('upload: JPEG, much smaller than the 4000px original, in my own folder', up.type === 'image/jpeg' && up.size < 222988 && /^u-\d+\/.+\.jpg$/.test(up.path), JSON.stringify(up));
const dims = await ev(() => new Promise(res => { const f = Object.values(window.__mockSb.state.media).pop(); res(f.caption); }));
ok('post saved with caption', dims === 'Open mat w/ the crew');
const px = await ev(async () => { const r = await fetch('tests/fixtures/media/photo.jpg'); const b = await r.blob(); const m = await window.DM_TEST.mediaPrepare(new File([b], 'p.jpg', { type:'image/jpeg' })); return [m.w, m.h, m.blob.type]; });
ok('resize: 4000x3000 -> 1600x1200 JPEG', px.join() === '1600,1200,image/jpeg', px.join());
await page.waitForSelector('#mediaFeed [data-mdel]'); await settle(400);
ok('my post appears first with Delete', /Open mat/.test(await page.locator('#mediaFeed .mpost').first().innerText()) && await page.locator('#mediaFeed [data-mdel]').count() === 1);
await page.evaluate(() => { const t = document.querySelector('#toast'); t.classList.remove('show','act'); document.querySelector('#mediaCard').scrollIntoView({ block:'start' }); window.scrollBy(0, -80); }); await settle(500);
await page.screenshot({ path:`${SHOTS}/88-friends-clips-feed.png` });

/* 3. video limits */
fc = page.waitForEvent('filechooser'); await page.locator('#shareMedia').tap(); ch = await fc; await ch.setFiles(FX + 'long.webm'); await settle(1500);
ok('video over 60 s is rejected with a trim hint', /up to 60 seconds/.test(await page.locator('#toast').innerText()) && await page.locator('#mediaSheet').count() === 0, await page.locator('#toast').innerText());
fc = page.waitForEvent('filechooser'); await page.locator('#shareMedia').tap(); ch = await fc;
await ch.setFiles({ name:'big.mp4', mimeType:'video/mp4', buffer:Buffer.alloc(26 * 1048576) }); await settle(800);
ok('video over 25 MB is rejected', /under 25 MB/.test(await page.locator('#toast').innerText()) && await page.locator('#mediaSheet').count() === 0);
fc = page.waitForEvent('filechooser'); await page.locator('#shareMedia').tap(); ch = await fc; await ch.setFiles(FX + 'short.webm'); await page.waitForSelector('#mediaSheet video'); await settle();
await page.locator('#mediaPost').tap(); await page.waitForFunction(() => /Shared with friends/.test(document.querySelector('#toast').textContent), null, { timeout:8000 });
const vu = await ev(() => window.__mockSb.calls.filter(c => c.fn === 'upload').pop());
ok('short clip uploads as-is (webm)', vu.type === 'video/webm' && /\.webm$/.test(vu.path), JSON.stringify(vu));
await page.waitForSelector('#mediaFeed video'); ok('clip plays inline in the feed', await page.locator('#mediaFeed video[playsinline][controls]').count() === 1);

/* 4. delete + expiry cleanup */
const before = await ev(() => window.__mockSb.state.media.length);
await page.locator('#mediaFeed [data-mdel]').first().tap(); await page.locator('.sheet [data-ok]').tap(); await settle(800);
ok('owner delete removes the row and the file', (await ev(() => window.__mockSb.state.media.length)) === before - 1 && (await ev(() => window.__mockSb.calls.some(c => c.fn === 'remove'))));
await ev(() => { const m = window.__mockSb; m.postAs(m.me(), 'photo', 'ancient', 40); });
await page.reload(); await page.waitForSelector('#mediaFeed .mpost'); await settle(1200);
ok('my posts older than 30 days are cleaned up (file + row)', !(await ev(() => window.__mockSb.state.media.some(x => x.caption === 'ancient'))));

/* 5. migration not run yet (flag on): friendly message, nothing breaks */
await ev(() => { window.__mockSb.mediaOff = true; });
fc = page.waitForEvent('filechooser'); await page.locator('#shareMedia').tap(); ch = await fc; await ch.setFiles(FX + 'photo.jpg'); await page.waitForSelector('#mediaSheet'); await settle();
await page.locator('#mediaPost').tap(); await settle(800);
ok('before migration: "not switched on yet" toast', /isn't switched on yet/.test(await page.locator('#toast').innerText()), await page.locator('#toast').innerText());
ok('no page errors', !errors.length, errors.join(' | '));
console.log(results.join('\n')); console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
