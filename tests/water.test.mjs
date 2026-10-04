import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent, acceptDownloads:true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const settle = (ms=300) => page.waitForTimeout(ms);
const hideToast = async () => { await page.evaluate(() => document.querySelector('#toast').classList.remove('show','act')); await page.waitForTimeout(450); };
const total = async () => Number(await page.locator('#waterTotal').innerText());

await page.goto(BASE); await page.waitForSelector('#catTiles'); await page.locator('#go').tap(); await page.locator('#skipGoals').tap(); await page.waitForSelector('.statrow');
ok('Home nutrition card has a water line', (await page.locator('#homeWater').innerText()).includes('Water') && (await page.locator('#homeWater').innerText()).includes('oz'));
await page.goto(BASE + '#/food'); await page.waitForSelector('#waterCard');
ok('no water goal: shows Set goal link, no bar', await page.locator('#waterCard #setWaterGoal').count() === 1 && await page.locator('#waterCard .mbar').count() === 0);
await page.locator('[data-wk="glass"]').tap(); await settle();
ok('+8 oz glass = 1 tap', await total() === 8 && Math.round((await db()).nutrition.water[0].ml) === 237);
await page.locator('[data-wk="bottle"]').tap(); await settle();
ok('+16.9 oz bottle', await total() === 24.9);
await page.locator('#toast .undo').tap(); await settle();
ok('undo removes the last add', await total() === 8 && (await db()).nutrition.water.length === 1);
await page.locator('#waterCustom').tap(); await page.waitForSelector('#waterAmt'); await page.locator('#waterAmt').fill('12'); await page.locator('#waterAdd').tap(); await settle();
ok('custom amount', await total() === 20);
// goal in Profile
await page.locator('#setWaterGoal').tap(); await page.waitForSelector('.sheet [data-ok]');
ok('water Set goal link asks before leaving', /Leave this page\?/i.test(await page.locator('.sheet').innerText()));
await page.locator('.sheet [data-ok]').tap(); await page.waitForSelector('#waterGoal');
await page.locator('#waterGoal').fill('80'); await page.locator('#waterGoal').dispatchEvent('change'); await settle();
ok('water goal saved (ml) from Profile', Math.round((await db()).profile.waterGoal) === Math.round(80 * 29.5735));
await page.goto(BASE + '#/food'); await page.waitForSelector('#waterCard');
ok('progress vs goal: 20 / 80 oz = 25%', (await page.locator('#waterCard').innerText()).includes('/ 80 oz') && (await page.locator('#waterCard').innerText()).includes('25%') && Math.abs(parseFloat((await page.locator('#waterCard .mbar i').getAttribute('style')).split(':')[1]) - 25) < 0.2);
await page.goto(BASE); await page.waitForSelector('#homeWater');
ok('Home water line shows total / goal', (await page.locator('#homeWater').innerText()).replace(/\s+/g,' ').includes('Water 20 / 80 oz'));
// metric
await page.goto(BASE + '#/settings'); await page.waitForSelector('#goalW');
await page.locator('.seg button', { hasText:/^kg$/ }).first().tap(); await settle();
await page.goto(BASE + '#/food'); await page.waitForSelector('#waterCard');
ok('metric: ml buttons and totals', (await page.locator('[data-wk="glass"]').innerText()).includes('+250 ml') && (await page.locator('[data-wk="bottle"]').innerText()).includes('+500 ml') && await total() === 592 && (await page.locator('#waterCard').innerText()).includes('/ 2366 ml'));
await page.locator('[data-wk="glass"]').tap(); await settle();
ok('metric glass adds 250 ml', await total() === 842);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#goalW'); await page.locator('.seg button', { hasText:/^lb$/ }).first().tap(); await settle();
// water toggles with Food
await page.locator('[data-sec="food"]').uncheck({ force:true }); await settle();
await page.goto(BASE); await page.waitForSelector('.statrow');
ok('hiding Food hides water too', await page.locator('#homeWater').count() === 0 && await page.locator('#waterCard').count() === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('[data-sec="food"]'); await page.locator('[data-sec="food"]').check({ force:true }); await settle();
// export -> clear -> import
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').tap()]);
const path = '/workspace/pwtest/export-water.json'; await dl.saveAs(path);
const b4 = await db();
await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(400);
ok('clear data removes water', (await db()).nutrition.water.length === 0 && !(await db()).profile.waterGoal);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#impFile', { state:'attached' });
await page.setInputFiles('#impFile', path); await page.locator('.sheet [data-ok]').tap(); await settle(400);
const af = await db();
ok('export/import round-trips water + goal', JSON.stringify(af.nutrition.water) === JSON.stringify(b4.nutrition.water) && af.profile.waterGoal === b4.profile.waterGoal);
// reload keeps water (load path)
await page.reload(); await settle(400);
ok('water survives reload', (await db()).nutrition.water.length === b4.nutrition.water.length && await page.evaluate(() => !localStorage.getItem('dm.bjj.v1.unreadable')));
// sample + screenshot
await page.goto(BASE + '#/settings'); await page.waitForSelector('#clr'); await page.locator('#clr').tap(); await page.locator('.sheet [data-ok]').tap(); await settle(400);
await page.locator('#loadSample').tap(); await settle(500);
ok('sample data includes water + goal', (await db()).nutrition.water.length > 40 && (await db()).profile.waterGoal > 0);
await page.goto(BASE + '#/food'); await page.waitForSelector('#waterCard'); await hideToast();
await page.evaluate(() => { const c = document.querySelector('#waterCard'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 330); }); await settle(200);
await page.screenshot({ path:`${SHOTS}/26-water.png` });
await page.goto(BASE + '#/settings'); await page.waitForSelector('#rmS'); await page.locator('#rmS').tap(); await settle(400);
ok('remove sample removes sample water', (await db()).nutrition.water.length === 0);
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
