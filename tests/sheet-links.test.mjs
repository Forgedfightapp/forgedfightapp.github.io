// 3.16.2: hash links inside sheets (Today's marks > Food / Log) must land on their screen, not bounce back to Home.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOT = process.env.SHOT || '';
const results = []; const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c?'':x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const D0 = new Date().toLocaleDateString('en-CA');
const data = { schema:7, sessions:[{ id:'a', date:D0, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:20, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', weight:'', rolls:[], createdAt:1 }],
  profile:{ name:'', unit:'lb', distUnit:'mi', setupDone:true, enabled:{ grappling:true, mobility:true, food:true, weight:true }, schedule:{ grappling:[0,1,2,3,4,5,6] }, waterGoal:3000, targets:{ protein:200 } },
  nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], reps:[] };
const page = await ctx.newPage();
await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data);
for (const [id, want] of [['#mkFood', '#/food'], ['#mkLog', '#/log']]) {
  await page.goto(BASE + '#/'); await page.waitForSelector('#marks'); await page.waitForTimeout(400);
  await page.locator('#marks').click(); await page.waitForSelector(id); await page.waitForTimeout(400);
  if (SHOT && id === '#mkFood') await page.screenshot({ path:`${SHOT}-1-sheet.png` });
  await page.locator(id).tap(); await page.waitForTimeout(1200);
  const hash = await page.evaluate(() => location.hash), hidden = await page.locator('#sheet').isHidden();
  if (SHOT && id === '#mkFood') await page.screenshot({ path:`${SHOT}-2-after-tap.png` });
  ok(`${id} closes sheet and lands on ${want}`, hidden && hash === want, `hash=${hash} sheetHidden=${hidden}`);
  if (id === '#mkFood') { await page.goBack(); await page.waitForTimeout(800); ok('back from Food returns Home', ['', '#/'].includes(await page.evaluate(() => location.hash))); }
}
console.log(results.join('\n')); await browser.close();
