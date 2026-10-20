// Store screenshots: app with sample data, captioned on brand backgrounds.
// App Store 6.7" 1290x2796, 6.5" 1242x2688; Google Play phone 1080x1920.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const OUT = '/workspace/bjj-tracker/store/screenshots';
const SIZES = [['ios-6.7', 1290, 2796, 430], ['ios-6.5', 1242, 2688, 414], ['play-phone', 1080, 1920, 360]];
const SHOTS = [
  ['01-home', '#/', '#marks', 'YOUR TRAINING', 'AT A GLANCE', 'Train, recover and fuel marks for every day'],
  ['02-log', '#/log', '#view > *', 'LOG A SESSION', 'IN SECONDS', 'BJJ, striking, MMA, weights, cardio, mobility'],
  ['03-stats', '#/stats', '#view > *', 'SEE THE WORK', 'ADD UP', 'Hours, rounds, PRs and training load'],
  ['04-challenges', '#/challenges', '#medalsCard', 'EARN MEDALS', 'KEEP THE STREAK', 'Daily challenges, ranks and monthly medals'],
  ['05-food', '#/food', '#view > *', 'FUEL', 'FOR THE FIGHT', 'Calories, protein and water, with barcode lookup'],
];
const browser = await chromium.launch();
const files = [];
for (const [tag, W, H, cssW] of SIZES) {
  const scale = W / cssW, frameW = Math.round(W * .80), appCssW = cssW, appCssH = Math.round((H * .76) / (frameW / cssW));
  const ctx = await browser.newContext({ viewport:{ width:appCssW, height:appCssH }, deviceScaleFactor:frameW / cssW, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  await ctx.addInitScript(() => { window.__FORGED_QUIET_MEDALS = true; });
  const page = await ctx.newPage();
  await page.goto(BASE + 'sw.js'); await page.evaluate(() => localStorage.clear());
  await page.goto(BASE); await page.waitForSelector('#loadSample'); await page.locator('#loadSample').tap(); await page.waitForTimeout(1500);
  const raw = {};
  for (const [id, hash, sel] of SHOTS) {
    await page.goto(BASE + hash); await page.waitForSelector(sel); await page.waitForTimeout(700);
    await page.evaluate(id => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); document.querySelectorAll('#view .banner').forEach(b => b.remove()); window.scrollTo(0, 0);
      if (id === '04-challenges') { const m = document.querySelector('#medalsCard'); window.scrollTo(0, m.getBoundingClientRect().top + scrollY - 80); } }, id);
    await page.waitForTimeout(300);
    raw[id] = (await page.screenshot()).toString('base64');
  }
  await ctx.close();
  const cctx = await browser.newContext({ viewport:{ width:W, height:H }, deviceScaleFactor:1 });
  const cp = await cctx.newPage(); await cp.goto(BASE + 'sw.js');
  for (const [id, , , l1, l2, sub] of SHOTS) {
    await cp.evaluate(({ W, H, frameW, img, l1, l2, sub }) => {
      document.documentElement.innerHTML = `<head><style>
        @font-face{font-family:BC;src:url(brand/forged/BarlowCondensed-ExtraBold.ttf)}
        @font-face{font-family:B;src:url(brand/fonts/Barlow-SemiBold.ttf)}
        html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#0B0B0C}
        .bg{position:absolute;inset:0;background:radial-gradient(ellipse 90% 45% at 50% 108%,rgba(242,113,28,.75),rgba(242,113,28,.18) 55%,transparent 75%),linear-gradient(#141416,#0B0B0C 40%)}
        .cap{position:absolute;top:${H*.045}px;left:0;right:0;text-align:center;color:#fff;font-family:BC;line-height:.95;font-size:${W*.105}px;letter-spacing:.01em}
        .cap span{display:block;color:#F58A45}
        .sub{font-family:B;font-size:${W*.036}px;color:#C7CDD4;margin-top:${W*.025}px;letter-spacing:0;line-height:1.25}
        .frame{position:absolute;left:${(W-frameW)/2}px;bottom:-${W*.06}px;width:${frameW}px;border-radius:${W*.07}px ${W*.07}px 0 0;overflow:hidden;border:${W*.012}px solid #2a2a2e;border-bottom:0;box-shadow:0 0 ${W*.08}px rgba(242,113,28,.35),0 ${W*.03}px ${W*.08}px rgba(0,0,0,.7)}
        .frame img{display:block;width:100%}
      </style></head><body><div class="bg"></div><div class="cap">${l1}<span>${l2}</span><div class="sub">${sub}</div></div><div class="frame"><img src="data:image/png;base64,${img}"></div></body>`;
    }, { W, H, frameW, img:raw[id], l1, l2, sub });
    await cp.evaluate(() => document.fonts.ready); await cp.waitForTimeout(400);
    const f = `${OUT}/${tag}-${id}.png`; await cp.screenshot({ path:f }); files.push(f);
  }
  await cctx.close();
}
await browser.close();
console.log(files.join('\n'));
