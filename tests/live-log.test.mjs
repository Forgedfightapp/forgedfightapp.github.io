// 3.15.0: draft autosave/restore, live set logging, cardio in Weights, Quick workout dedupe + injuries
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = '/workspace/bjj-tracker/screenshots';
const results = [], errors = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
const settle = (ms=400) => page.waitForTimeout(ms);
const tut = async () => { while (await page.locator('.sheet [data-ok]').count()) { await page.locator('.sheet [data-ok]').first().tap(); await settle(250); } };
await page.goto(BASE); await page.locator('#loadSample').tap(); await page.waitForSelector('#weekCard'); await settle(1000);
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.profile.enabled.weights = true; d.profile.wgroups = ['back','legs','chest']; localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); });
await page.reload(); await page.waitForSelector('#weekCard');
// 3.18.0: a generated session (Build a workout) starts in the live logger
await page.goto(BASE + '#/build'); await page.waitForSelector('#buildCard'); await settle(300); await tut();
await page.screenshot({ path:`${SHOTS}/97-build-workout.png` });
await page.locator('#buildCard [data-startgen]').tap(); await page.waitForSelector('.excard'); await settle(600);
// live logging
const ex = await page.locator('.excard:not(.carow)').count(); ok('workout loaded into log', ex >= 4, String(ex));
await page.locator('.excard').first().locator('[data-done]').first().tap(); await settle(200);
ok('Done check marks set', await page.locator('.setrow.done').count() === 1);
const before = await page.locator('.excard').first().locator('.setrow').count();
await page.locator('.excard').first().locator('[data-addset]').tap(); await settle(150);
ok('add set copies last', await page.locator('.excard').first().locator('.setrow').count() === before + 1);
const tw = await page.locator('.setdone').first().boundingBox(); ok('Done target ≥ 44px', tw.width >= 44 && tw.height >= 44, JSON.stringify(tw));
await page.locator('#addCardio').tap(); await settle(150);
await page.locator('#cardioAdd select').selectOption('stairs');
await page.locator('#cardioAdd [data-ca="min"]').fill('15'); await page.locator('#cardioAdd [data-ca="distance"]').fill('1.2');
const opts = await page.locator('#cardioAdd select option').allInnerTexts(); ok('cardio types match Cardio incl. Stairs', opts.includes('Stairs') && opts.length === 6, opts.join(','));
await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
// pretend the workout started 25 min ago (applied before the app boots on relaunch)
await page.addInitScript(() => { if (location.protocol !== 'http:' || sessionStorage.getItem('aged')) return; const f = JSON.parse(localStorage.getItem('forged.draft') || 'null'); if (!f) return; f.form.startedAt -= 25*60000; localStorage.setItem('forged.draft', JSON.stringify(f)); sessionStorage.setItem('aged', '1'); });
// simulate iOS killing the page while locked: reload at home
await page.goto('about:blank'); await page.goto(BASE); await settle(800); await tut();
ok('relaunch reopens the log', page.url().includes('#/log'), page.url());
ok('draft restored: sets done kept', await page.locator('.setrow.done').count() === 1);
ok('draft restored: cardio kept', await page.locator('#cardioAdd [data-ca="min"]').inputValue() === '15');
const el = await page.locator('#liveBar [data-elapsed]').innerText(); ok('elapsed timer from start timestamp', /^2[5-6]:\d\d$/.test(el), JSON.stringify(el));
await page.evaluate(() => { const c = document.querySelector('#liveBar'); c.scrollIntoView({ block:'start' }); window.scrollBy(0, -80); }); await settle(300);
await page.screenshot({ path:`${SHOTS}/98-live-log.png` });
await page.evaluate(() => { document.querySelector('#cardioAdd').scrollIntoView({ block:'center' }); }); await settle(300);
await page.screenshot({ path:`${SHOTS}/99-live-log-cardio.png` });
// home banner: app reopened on another screen, then Home
const fresh = async h => { await page.goto('about:blank'); await page.goto(BASE + h); await settle(600); await tut(); };
await fresh('#/stats'); await page.evaluate(() => { location.hash = '#/'; }); await settle(500);
ok('Home banner shows Workout in progress', await page.locator('#draftBanner').count() === 1);
await page.screenshot({ path:`${SHOTS}/100-home-banner.png` });
await page.locator('#draftResume').tap(); await settle(500);
ok('Resume reopens the log', page.url().includes('#/log') && await page.locator('.setrow.done').count() === 1);
await page.locator('[data-save]').tap(); await settle(600);
const saved = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); return { s:d.sessions.filter(s => s.category === 'weights').sort((a,b) => b.createdAt - a.createdAt)[0], draft:localStorage.getItem('forged.draft') }; });
ok('draft cleared on save', saved.draft === null);
ok('cardio saved in the same workout', saved.s.cardioAdd && saved.s.cardioAdd[0].type === 'stairs' && saved.s.cardioAdd[0].min === 15 && saved.s.cardioAdd[0].distance === 1.2, JSON.stringify(saved.s.cardioAdd));
ok('duration from live timer', saved.s.duration >= 25 && saved.s.duration <= 27, String(saved.s.duration));
await page.goto(BASE + '#/history'); await settle(400);
ok('history shows the cardio', (await page.locator('#view').innerText()).includes('15 min 1.2'));
await page.goto(BASE + '#/session/' + saved.s.id); await settle(300);
ok('session view has Cardio card', await page.locator('#sessCardio').count() === 1);
await page.goto(BASE + '#/'); await settle(300);
ok('no banner after save', await page.locator('#draftBanner').count() === 0);
// discard path
await page.goto(BASE + '#/log'); await settle(300); await tut(); await page.locator('.cats button[data-c="weights"]').tap(); await settle(200); await tut();
await page.locator('#addCardio').tap(); await page.locator('#cardioAdd [data-ca="min"]').fill('10'); await settle(100);
await page.waitForTimeout(300); await fresh('#/stats'); await page.evaluate(() => { location.hash = '#/'; }); await settle(400);
ok('banner after leaving via reload', await page.locator('#draftBanner').count() === 1);
await page.locator('#draftDiscard').tap(); await settle(300); await page.locator('.sheet .btn.danger, .sheet [data-ok]').last().tap(); await settle(400);
ok('Discard clears the draft', await page.evaluate(() => localStorage.getItem('forged.draft')) === null && await page.locator('#draftBanner').count() === 0);
ok('no page errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n')); await browser.close();
