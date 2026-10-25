// 3.17.0: username in About you, iOS-compatible barcode scanning (ZXing fallback), tap a week-strip day to review it.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/', SHOTS = process.env.SHOTS || '/workspace/forged-shots';
const results = [], errors = []; const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c?'':x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch({ args:['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, permissions:['camera'] });
await ctx.route(/supabase\.co/, r => r.abort());   // offline backend: setup must never block
// iOS Safari / WKWebView have no BarcodeDetector: remove it so the ZXing path is what runs
await ctx.addInitScript(() => { try { delete window.BarcodeDetector; } catch(e) {} window.BarcodeDetector = undefined; delete window.BarcodeDetector; });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
const W = ms => page.waitForTimeout(ms);

/* 1. username in About you */
await page.goto(BASE + 'sw.js'); await page.evaluate(() => localStorage.clear()); await page.goto(BASE); await page.waitForSelector('#catTiles');
ok('step 1 no longer has the username field', await page.locator('#unIn').count() === 0);
await page.locator('#go').tap(); await page.waitForSelector('#aboutForm');
ok('About you has a username field', await page.locator('#aboutUname #unIn').count() === 1);
await page.fill('#unIn', 'bad name'); await W(500);
ok('3.16.0 rules apply (no spaces)', /spaces/i.test(await page.locator('#unMsg').innerText()));
await page.locator('#skipAbout').tap(); await W(300);
ok('invalid username blocks moving on', await page.locator('#aboutForm').count() === 1);
await page.fill('#unIn', 'steve_bjj'); await W(600);
await page.screenshot({ path:`${SHOTS}/p3170-1-about-username.png` });
await page.locator('#skipAbout').tap(); await W(400);
ok('offline/signed out: valid username kept for sign-in, setup continues', await page.evaluate(() => JSON.parse(localStorage.getItem('forged.social.v1') || '{}')) && await page.locator('#aboutForm').count() === 0
  && await page.evaluate(() => Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('steve_bjj'))));
await page.locator('#setupBack').tap(); await W(300); await page.fill('#unIn', ''); await page.locator('#skipAbout').tap(); await W(300);
ok('blank username is fine and clears the pending one', await page.locator('#aboutForm').count() === 0 && !(await page.evaluate(() => Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('steve_bjj')))));

/* 2. ZXing decodes EAN-13 without BarcodeDetector */
const D = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toLocaleDateString('en-CA'); };
const S = (id, date, o={}) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', rolls:[], createdAt:1, ...o });
await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, { schema:7, sessions:[S('a', D(0)), S('b', D(0), { category:'weights', discipline:'strength', exercises:[], createdAt:2 })],
  profile:{ setupDone:true, unit:'lb', enabled:{ grappling:true, weights:true, food:true } }, nutrition:{ entries:[{ id:'e1', date:D(0), name:'Eggs', cal:140, p:12, c:1, f:10, qty:2 }], foods:[], water:[] }, weights:[], belts:[] });
await page.goto(BASE + '#/'); await page.waitForSelector('#weekStrip');
ok('no BarcodeDetector in this page (iOS-like)', await page.evaluate(() => !('BarcodeDetector' in window)));
const dec = await page.evaluate(async () => { const Z = await window.DM_TEST.loadZXing(); const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'], G = L.map(c => [...c].map(b => b === '1' ? '0' : '1').reverse().join('')), R = L.map(c => [...c].map(b => b === '1' ? '0' : '1').join(''));
  const P = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'], n = '4006381333931'.split('').map(Number);
  let bits = '101'; for (let i = 1; i < 7; i++) bits += (P[n[0]][i-1] === 'L' ? L : G)[n[i]]; bits += '01010'; for (let i = 7; i < 13; i++) bits += R[n[i]]; bits += '101';
  const sc = 3, cv = document.createElement('canvas'); cv.width = bits.length * sc + 60; cv.height = 160; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#000';
  [...bits].forEach((b, i) => { if (b === '1') x.fillRect(30 + i * sc, 20, sc, 120); });
  Object.defineProperty(cv, 'videoWidth', { value:cv.width }); Object.defineProperty(cv, 'videoHeight', { value:cv.height });
  return (await window.DM_TEST.barcodeReader())(cv); });
ok('vendored ZXing reads an EAN-13 (no CDN, no BarcodeDetector)', dec === '4006381333931', String(dec));
ok('ZXing loaded from vendor/', await page.evaluate(() => [...document.scripts].some(s => /vendor\/zxing-library-0\.21\.3\.min\.js$/.test(s.src))));

/* 3. week strip day sheet */
await page.goto(BASE + '#/'); await page.waitForSelector('#weekStrip'); await W(300);
await page.locator(`#weekStrip .wday[data-day="${D(0)}"]`).tap(); await page.waitForSelector('#daySheet'); await W(400);
ok('day sheet lists that day\'s 2 workouts with Edit + Delete', await page.locator('#daySheet .dayitem').count() === 2 && await page.locator('#daySheet [data-dedit]').count() === 2 && await page.locator('#daySheet [data-ddel]').count() === 2);
ok('day sheet food line: 1 item (x2) · 280 kcal', /1 item · 280 kcal/.test(await page.locator('#dayFood').innerText()), await page.locator('#dayFood').innerText());
await page.screenshot({ path:`${SHOTS}/p3170-3-day-sheet.png` });
await page.locator('#daySheet [data-dedit]').first().tap(); await W(1200);
ok('Edit opens the existing edit form', /^#\/edit\//.test(await page.evaluate(() => location.hash)) && await page.locator('#sheet').isHidden());
await page.goto(BASE + '#/'); await page.waitForSelector('#weekStrip'); await W(300);
await page.locator(`#weekStrip .wday[data-day="${D(0)}"]`).tap(); await page.waitForSelector('#daySheet [data-ddel]'); await page.locator('#daySheet [data-ddel]').last().tap(); await W(400);
await page.locator('.sheet .btn.danger, .sheet [data-ok]').last().tap(); await W(700);
ok('Delete removes it and the sheet shows 1 left', (await page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')).sessions.length)) === 1 && await page.locator('#daySheet .dayitem').count() === 1);
await page.keyboard.press('Escape'); await W(500); await page.goto(BASE + '#/'); await page.waitForSelector('#weekStrip'); await W(300);
const empty = [...Array(7).keys()].map(i => D(-i)).find(x => x !== D(0));
const has = await page.locator(`#weekStrip .wday[data-day="${empty}"]`).count();
if (has) { await page.locator(`#weekStrip .wday[data-day="${empty}"]`).tap(); await page.waitForSelector('#daySheet'); await W(400);
  ok('empty day shows an empty state + Log a workout for that day', await page.locator('#dayEmpty').count() === 1 && await page.locator('#dayAdd').count() === 1);
  await page.screenshot({ path:`${SHOTS}/p3170-3b-day-empty.png` });
  await page.locator('#dayAdd').tap(); await W(1200);
  ok('Add opens the log form dated that day', await page.evaluate(() => location.hash) === '#/log' && await page.evaluate(d => document.querySelector('#view input[type=date]')?.value === d, empty)); }

/* 4. scan screen in the browser with a (fake) camera and no BarcodeDetector */
await page.goto(BASE + '#/food'); await page.waitForTimeout(600);
await page.locator('[data-add]').first().tap(); await W(500); await page.locator('#fpScan').tap(); await page.waitForSelector('#scanView'); await W(1500);
const hint = await page.locator('#scHint').innerText();
ok('scan screen opens the camera (video live) instead of "isn\'t available"', await page.locator('#scVideo').count() === 1 && !/isn't available/.test(hint) && await page.evaluate(() => !!document.querySelector('#scVideo')?.srcObject), hint);
ok('manual barcode entry still there', await page.locator('#scCode').count() === 1 && await page.locator('#scGo').count() === 1);
await page.screenshot({ path:`${SHOTS}/p3170-2-scan.png` });
ok('no page errors', !errors.length, errors.join(' | '));
console.log(results.join('\n')); await browser.close();
