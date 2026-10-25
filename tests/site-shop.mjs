import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8790/shop/';
const r = [], errs = []; const ok = (n, c, x='') => { r.push(`${c?'PASS':'FAIL'} ${n} ${c?'':x}`); if (!c) process.exitCode = 1; };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE); await p.waitForTimeout(500);
const slugs = await p.$$eval('.card[data-slug]', a => a.map(x => x.dataset.slug));
ok('8 product cards', slugs.length === 8, slugs.join());
for (const s of slugs) {
  await p.click(`.card[data-slug="${s}"]`); await p.waitForSelector('#productDetail:not([hidden])');
  ok(`${s}: detail opens + hash`, (await p.evaluate(() => location.hash)) === '#p/' + s && await p.locator('#pdSizes button').count() === 7 && await p.locator('#pdNotify').count() === 1);
  await p.goBack(); await p.waitForTimeout(200);
  ok(`${s}: back closes`, await p.locator('#productDetail').isHidden());
}
await p.focus('.card[data-slug="forged-tee"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
ok('keyboard Enter opens', await p.locator('#productDetail').isVisible()); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('Escape closes', await p.locator('#productDetail').isHidden());
await p.goto(BASE + '#p/forged-set'); await p.waitForSelector('#productDetail:not([hidden])'); await p.waitForTimeout(500);
ok('direct link opens', (await p.locator('#pdTitle').textContent()) === 'FORGED Set');
await p.screenshot({ path:'/workspace/forgedfight-site-product-detail-1.png' });
await p.goto(BASE + '#p/based-savage-long'); await p.waitForSelector('#pdBelts'); await p.click('[data-belt="blue"]'); await p.click('[data-size="L"]'); await p.waitForTimeout(500);
ok('belt picker swaps photo', (await p.getAttribute('#pdImg','src')).includes('blue-long') && /blue belt.*size L/.test(decodeURIComponent(await p.getAttribute('#pdNotify','href'))));
await p.click('[data-sleeve="based-savage-short"]'); await p.waitForTimeout(300);
ok('sleeve switch keeps belt', (await p.getAttribute('#pdImg','src')).includes('blue-short')); await p.click('[data-sleeve="based-savage-long"]'); await p.waitForTimeout(500);
await p.screenshot({ path:'/workspace/forgedfight-site-product-detail-2.png' });
await p.click('#pdClose'); await p.waitForTimeout(200); ok('close button', await p.locator('#productDetail').isHidden());
ok('store placeholder intact', (await p.content()).includes('STORE_URL PLACEHOLDER'));
ok('no errors', !errs.length, errs.join('|'));
console.log(r.join('\n')); await b.close();
