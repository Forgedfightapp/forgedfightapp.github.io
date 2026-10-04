// 3.3.0 food calculator: offline food list + search, serving picker with live macros, recent/saved one-tap, Open Food Facts search + barcode (mocked), offline handling, manual fallback, export/import.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message));
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const T = (fn, arg) => page.evaluate(fn, arg);
const hideToast = () => page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); });
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const seed = async (data, hash = '') => { await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data); await page.reload(); if (hash) await page.goto(BASE + hash); await settle(500); };
const base = { schema:7, profile:{ name:'Steve', unit:'lb', setupDone:true, targets:{ cal:2400, p:180, c:250, f:75 }, enabled:{ grappling:true, food:true, weight:false } }, sessions:[], weights:[], belts:[], game:{ rankSeen:0, levelSeen:1, seenDone:[], seenBadges:[] },
  nutrition:{ entries:[{ id:'e1', date:D(-1), meal:'breakfast', name:'Overnight oats (mine)', serving:'1 jar', qty:1, cal:420, p:30, c:50, f:12, fiber:'', sugar:'', sodium:'', createdAt:Date.now() - 864e5 }],
    foods:[{ id:'f1', name:'Shake: whey + milk', serving:'1 shaker', cal:260, p:40, c:14, f:5, fiber:'', sugar:'', sodium:'' }], water:[] } };
const off = { products:[
  { code:'602652171000', product_name:'Dark Chocolate Nuts & Sea Salt', brands:'KIND', serving_size:'1 bar (40 g)', serving_quantity:40, nutriments:{ 'energy-kcal_100g':500, proteins_100g:15, carbohydrates_100g:40, fat_100g:37.5, fiber_100g:17.5, sugars_100g:12.5, sodium_100g:0.4 } },
  { code:'000', product_name:'No energy listed', brands:'X', nutriments:{} } ] };
let offCalls = 0;
await ctx.route('**/world.openfoodfacts.org/cgi/search.pl**', r => { offCalls++; r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(off) }); });
await ctx.route('**/world.openfoodfacts.org/api/v2/product/**', r => { const code = r.request().url().match(/product\/(\d+)/)[1];
  r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(code === '012345678905' ? { status:1, product:{ product_name:'Greek Yogurt Vanilla', brands:'Chobani', serving_size:'1 cup (150 g)', serving_quantity:150, nutriments:{ 'energy-kcal_100g':80, proteins_100g:8, carbohydrates_100g:10.7, fat_100g:0 } } } : { status:0 }) }); });

/* 1. data + search */
await seed(base);
let r = await T(() => { const T = window.DM_TEST, all = T.foodsDb(), by = n => all.find(f => f.name === n);
  return { n:all.length, bad:all.filter(f => !(f.per100.cal >= 0) || !(f.per100.p >= 0) || !(f.per100.c >= 0) || !(f.per100.f >= 0) || !f.units.length).map(f => f.name), cb:by('Chicken breast, cooked (skinless)').per100, ban:by('Banana').per100, egg:by('Egg, whole (large)').units,
    groups:[...new Set(all.map(f => f.grp))].length }; });
ok('bundled list has 300–500 common foods, each with per-100 g values and serving units', r.n >= 300 && r.n <= 500 && !r.bad.length, `${r.n} ${r.bad.join(',')}`);
ok('USDA-style values: chicken breast 165 kcal / 31 P / 3.6 F, banana 89 kcal', r.cb.cal === 165 && r.cb.p === 31 && r.cb.f === 3.6 && r.ban.cal === 89);
ok('common units: 1 egg = 50 g', JSON.stringify(r.egg[0]) === '["egg",50]');
r = await T(() => { const s = q => window.DM_TEST.searchFoods(q).slice(0, 3).map(f => f.name); return { chick:s('chick'), cb:s('chicken br'), egg:s('egg'), oats:s('oats'), banana:s('banana'), gb:s('ground beef'), salmon:s('salmon'), shake:s('protein shake'), pb:s('pb'), rice:s('rice'), none:s('zzqx') }; });
ok('as-you-type: "chicken br" → chicken breast first', r.cb[0] === 'Chicken breast, cooked (skinless)', JSON.stringify(r.cb));
ok('egg, oats, banana, salmon, ground beef, protein shake all found', r.egg[0].startsWith('Egg') && r.oats.some(n => /^Oats/.test(n)) && r.banana[0] === 'Banana' && /^Salmon/.test(r.salmon[0]) && /^Ground beef/.test(r.gb[0]) && r.shake.some(n => /Protein shake/.test(n)), JSON.stringify(r));
ok('plurals and shorthand work (oats, pb)', r.pb[0] === 'Peanut butter' && r.rice.some(n => /rice, cooked/i.test(n)), JSON.stringify([r.pb, r.rice]));
ok('nonsense finds nothing', r.none.length === 0);
r = await T(() => { const T = window.DM_TEST, cb = T.foodsDb().find(f => f.name === 'Chicken breast, cooked (skinless)'); return [T.foodFor(cb, 1, 172), T.foodFor(cb, 6, 28.35), T.foodUnits(cb).map(u => u[0])]; });
ok('math: 1 breast (172 g) = 284 kcal, 53.3 g protein', r[0].cal === 284 && r[0].p === 53.3, JSON.stringify(r[0]));
ok('math: 6 oz = 281 kcal', r[1].cal === 281, JSON.stringify(r[1]));
ok('units offered: the food\'s own, plus g and oz', JSON.stringify(r[2]) === '["breast","oz","cup diced","g"]', JSON.stringify(r[2]));

/* 2. picker: recent + saved first, one tap re-add */
await page.goto(BASE + '#/food'); await page.waitForSelector('[data-add="lunch"]');
await page.locator('[data-add="lunch"]').tap(); await page.waitForSelector('#foodPicker');
ok('picker opens with search, barcode button and manual entry', await page.locator('#fpQ').count() === 1 && await page.locator('#fpScan').count() === 1 && await page.locator('#fpManual').count() === 1);
ok('recent and saved foods are listed first', await page.locator('.fprow[data-kind="recent"]', { hasText:'Overnight oats (mine)' }).count() === 1 && await page.locator('.fprow[data-kind="saved"]', { hasText:'Shake: whey + milk' }).count() === 1);
await page.locator('.fprow[data-kind="saved"]').first().tap(); await settle(300);
let d = await db();
ok('one tap re-adds a saved food to this meal', d.nutrition.entries.length === 2 && d.nutrition.entries[1].name === 'Shake: whey + milk' && d.nutrition.entries[1].meal === 'lunch' && d.nutrition.entries[1].cal === 260);
ok('with Undo', await page.locator('#toast .undo').count() === 1);
await page.locator('#toast .undo').tap(); await settle(300);
ok('undo removes it', (await db()).nutrition.entries.length === 1);

/* 3. search → serving picker → live macros → Add */
await page.locator('[data-add="lunch"]').tap(); await page.waitForSelector('#foodPicker');
await page.locator('#fpQ').pressSequentially('chicken br', { delay:20 }); await settle(150);
ok('results update as you type', /Chicken breast, cooked/.test(await page.locator('.fprow[data-kind="db"]').first().innerText()));
await page.locator('.fprow[data-kind="db"]').first().tap(); await page.waitForSelector('#servingPicker');
ok('serving picker defaults to 1 breast = 284 kcal', await page.locator('#spAmt').inputValue() === '1' && await page.locator('#spCal').textContent() === '284' && await page.locator('#spP').textContent() === '53.3');
await page.locator('#spAmt').fill('2'); await settle(100);
ok('calories and macros update live with the amount', await page.locator('#spCal').textContent() === '568' && await page.locator('#spP').textContent() === '106.6');
await page.locator('#spUnit [data-u]', { hasText:/^g$/ }).tap(); await settle(100);
ok('switching unit to g converts the amount (2 breasts = 344 g)', await page.locator('#spAmt').inputValue() === '344' && await page.locator('#spCal').textContent() === '568');
await page.locator('#spAmt').fill('200'); await settle(100);
ok('200 g = 330 kcal · 62 P · 0 C · 7.2 F', await page.locator('#spCal').textContent() === '330' && await page.locator('#spP').textContent() === '62' && await page.locator('#spC').textContent() === '0' && await page.locator('#spF').textContent() === '7.2');
await page.locator('#spUnit [data-u]', { hasText:/^oz$/ }).tap(); await settle(100);
ok('oz: 200 g → 7 oz', await page.locator('#spAmt').inputValue() === '7' && await page.locator('#spCal').textContent() === String(Math.round(165 * 7 * 28.35 / 100)));
await page.locator('#spUnit [data-u]', { hasText:/^g$/ }).tap(); await page.locator('#spAmt').fill('200'); await settle(100);
await hideToast(); await page.evaluate(() => { document.activeElement?.blur(); document.querySelector('.sheet .panel')?.scrollTo(0, 0); }); await settle(200);
await page.screenshot({ path:`${SHOTS}/60-food-calc.png` });
if (process.env.SHOTX) { await page.locator('#spBack').tap(); await settle(200); await page.screenshot({ path:'/workspace/fp-list.png' }); await page.locator('.fprow[data-kind="db"]').first().tap(); await page.waitForSelector('#servingPicker'); await page.locator('#spUnit [data-u]', { hasText:/^g$/ }).tap(); await page.locator('#spAmt').fill('200'); }
await page.locator('#spAdd').tap(); await settle(400);
d = await db(); let e = d.nutrition.entries[d.nutrition.entries.length - 1];
ok('Add logs the calculated food', e.name === 'Chicken breast, cooked (skinless)' && e.serving === '200 g' && e.cal === 330 && e.p === 62 && e.f === 7.2 && e.meal === 'lunch' && e.qty === 1, JSON.stringify(e));
ok('entry keeps per-100 g values, amount and unit', e.per100?.cal === 165 && e.amt === 200 && e.unit === 'g' && e.src === 'db');
ok('Food screen totals include it', Number(await page.locator('.ring-v').textContent()) === 330);
await page.locator('[data-add="dinner"]').tap(); await page.waitForSelector('#foodPicker');
ok('the new food shows in Recent', await page.locator('.fprow[data-kind="recent"]', { hasText:'Chicken breast' }).count() === 1);
await page.locator('.sheet [data-close]').first().tap(); await settle();

/* 4. online search (Open Food Facts, mocked) */
await page.locator('[data-add="snack"]').tap(); await page.waitForSelector('#foodPicker');
await page.locator('#fpQ').fill('kind bar'); await settle(100);
ok('online search is a tap away (no automatic network calls)', await page.locator('#fpOnline').count() === 1 && offCalls === 0);
await page.locator('#fpOnline').tap(); await page.waitForSelector('.fprow[data-kind="online"]');
ok('branded results from Open Food Facts; items without calories skipped', await page.locator('.fprow[data-kind="online"]').count() === 1 && /Dark Chocolate Nuts & Sea Salt \(KIND\)/.test(await page.locator('.fprow[data-kind="online"]').innerText()));
await page.locator('.fprow[data-kind="online"]').tap(); await page.waitForSelector('#servingPicker');
ok('branded serving size is the default unit (1 bar = 40 g = 200 kcal)', /serving \(1 bar \(40 g\)\)/.test(await page.locator('#spUnit button.on').innerText()) && await page.locator('#spCal').textContent() === '200');
await page.locator('#spSave').check(); await page.locator('#spAdd').tap(); await settle(400);
d = await db(); e = d.nutrition.entries[d.nutrition.entries.length - 1];
ok('logged with sodium in mg and source', e.cal === 200 && e.p === 6 && e.sodium === 160 && e.src === 'off' && e.code === '602652171000', JSON.stringify(e));
ok('Save to My foods keeps it for next time (with per-100 g values)', d.nutrition.foods.some(f => /KIND/.test(f.name) && f.per100?.cal === 500 && f.unit && f.amt === 1));
await page.locator('[data-add="snack"]').tap(); await page.waitForSelector('#foodPicker');
await page.locator('#fpQ').fill('kind'); await settle(100);
await page.locator('.fprow[data-kind="saved"]', { hasText:'KIND' }).tap(); await page.waitForSelector('#servingPicker');
ok('searching a saved food reopens its serving picker with the last amount', await page.locator('#spAmt').inputValue() === '1' && await page.locator('#spCal').textContent() === '200');
await page.locator('.sheet [data-close]').first().tap(); await settle();

/* 5. barcode (typed fallback when the camera API is missing) */
await page.locator('[data-add="breakfast"]').tap(); await page.waitForSelector('#foodPicker');
await page.locator('#fpScan').tap(); await page.waitForSelector('#scanView');
const hasBD = await page.evaluate(() => 'BarcodeDetector' in window);
ok('barcode: typed number when BarcodeDetector is unavailable', hasBD ? await page.locator('#scVideo').count() === 1 : /Type the numbers/i.test(await page.locator('#scHint').innerText()));
await page.locator('#scCode').fill('999'); await page.locator('#scGo').tap(); await settle(150);
await page.locator('#scCode').fill('111111111111'); await page.locator('#scGo').tap(); await page.waitForSelector('#scNone');
ok('unknown barcode offers manual entry', /Not found/.test(await page.locator('#scNone').innerText()));
await page.locator('#scCode').fill('012345678905'); await page.locator('#scGo').tap(); await page.waitForSelector('#servingPicker');
ok('barcode lookup opens the serving picker (1 cup = 150 g = 120 kcal)', /Greek Yogurt Vanilla \(Chobani\)/i.test(await page.locator('#spName').innerText()) && await page.locator('#spCal').textContent() === '120');
await page.locator('.sheet [data-close]').first().tap(); await settle();

/* 6. offline: local search works, online fails gracefully */
await ctx.setOffline(true);
await page.locator('[data-add="dinner"]').tap(); await page.waitForSelector('#foodPicker');
await page.locator('#fpQ').fill('salmon'); await settle(100);
ok('offline: common foods still search', await page.locator('.fprow[data-kind="db"]').count() >= 3);
await page.locator('#fpOnline').tap(); await page.waitForSelector('#fpErr');
ok('offline: online search explains and suggests manual entry', /offline/i.test(await page.locator('#fpErr').innerText()));
await page.locator('#fpScan').tap(); await page.waitForSelector('#scanView'); await page.locator('#scCode').fill('012345678905'); await page.locator('#scGo').tap(); await page.waitForSelector('#scErr');
ok('offline: barcode lookup fails gracefully', /offline/i.test(await page.locator('#scErr').innerText()));
await page.locator('#scBack').tap(); await page.waitForSelector('#foodPicker');
await ctx.setOffline(false);
await ctx.unroute('**/world.openfoodfacts.org/cgi/search.pl**'); await ctx.route('**/world.openfoodfacts.org/cgi/search.pl**', r => r.fulfill({ status:503, body:'down' }));
await page.locator('#fpQ').fill('quest'); await settle(100); await page.locator('#fpOnline').tap(); await page.waitForSelector('#fpErr');
ok('server error: friendly message, local results still shown', /Couldn't reach/.test(await page.locator('#fpErr').innerText()) && await page.locator('.fprow[data-kind="db"]', { hasText:'Quest bar' }).count() === 1);

/* 7. manual fallback */
await page.locator('#fpQ').fill('Grandma lasagna'); await settle(100);
await page.locator('#fpManual').tap(); await page.waitForSelector('.foodform');
ok('Enter manually opens the manual form with the name filled in', await page.locator('.foodform input[placeholder="e.g. Chicken breast"]').inputValue() === 'Grandma lasagna');
await page.locator('input[data-k="cal"]').fill('600'); await page.locator('input[data-k="p"]').fill('35'); await page.locator('.foodform [data-save]').tap(); await settle(400);
ok('manual entry still saves', (await db()).nutrition.entries.some(x => x.name === 'Grandma lasagna' && x.cal === 600));

/* 8. export / import keeps calculator fields */
await page.goto(BASE + '#/settings'); await page.waitForSelector('#exp');
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-food.json'; await dl.saveAs(path);
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(400);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await settle(500);
d = await db(); e = d.nutrition.entries.find(x => x.name === 'Chicken breast, cooked (skinless)');
ok('export/import keeps per-100 g values, amount, unit and barcode', e && e.per100.cal === 165 && e.amt === 200 && e.unit === 'g' && d.nutrition.entries.some(x => x.code === '602652171000') && d.nutrition.foods.some(f => f.per100?.cal === 500));
fs.unlinkSync(path);

/* 9. the food list is cached for offline use */
ok('foods.js is in the offline app shell', fs.readFileSync('/workspace/bjj-tracker/sw.js', 'utf8').includes("'foods.js'") && fs.readFileSync('/workspace/bjj-tracker/index.html', 'utf8').indexOf('foods.js') < fs.readFileSync('/workspace/bjj-tracker/index.html', 'utf8').indexOf('app.js'));

ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(results.join('\n'));
if (!process.env.QUIET) console.log(`${results.filter(x => x.startsWith('PASS')).length}/${results.length}`);
