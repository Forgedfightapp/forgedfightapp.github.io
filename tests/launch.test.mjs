// 3.7.0 launch prep: privacy + terms pages (linked from Profile and onboarding), flagged Forged Pro paywall with a payments stub.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
process.on('uncaughtException', e => { console.log(results.join('\n')); console.log('ERROR', e.message.split('\n')[0]); process.exit(1); });
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
await ctx.addInitScript(() => { window.__FORGED_QUIET_MEDALS = true; });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const txt = async sel => (await page.locator(sel).textContent()).replace(/\s+/g, ' ').trim();
const S = (id, date) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', rolls:[], sample:false, createdAt:1 });
const data = { schema:7, sessions:[S('a', new Date().toLocaleDateString('en-CA'))], profile:{ unit:'lb', setupDone:true, enabled:{ grappling:true, weights:true, food:true, weight:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], reps:[] };
const seed = async (d, hash = '#/settings', sel = '#view .card') => { await page.goto(BASE + 'sw.js'); await page.evaluate(d => { localStorage.clear(); if (d) localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, d); await page.goto(BASE + hash); await page.waitForSelector(sel); await settle(); };

/* 1. legal pages */
for (const [f, title] of [['privacy.html', 'Privacy Policy'], ['terms.html', 'Terms of Use']]) {
  const r = await page.goto(BASE + f); ok(`${f} is served`, r.status() === 200);
  ok(`${f}: title + draft note (not legal advice) + placeholders`, (await txt('h1')) === title && /Draft for review.*not legal advice/i.test(await txt('#draftNote')) && /\[LEGAL NAME \/ LLC\]/.test(await txt('main')) && /\[CONTACT EMAIL\]/.test(await txt('main')));
  ok(`${f}: styled like the app (dark, brand font)`, await page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(11, 11, 12)' && /Barlow Condensed/.test(getComputedStyle(document.querySelector('h1')).fontFamily)));
}
await page.goto(BASE + 'privacy.html');
const pv = await txt('main');
ok('privacy: on-device storage', /stays in your browser's or app's local storage on your device/.test(pv));
ok('privacy: Friends sync lists name, rank, counts and never notes/weight/food/injuries', /display name/.test(pv) && /rank/.test(pv) && /daily counts/.test(pv) && /never upload.*notes.*body weight.*food.*injuries/i.test(pv) && /Supabase/.test(pv));
ok('privacy: Open Food Facts lookups', /Open Food Facts/.test(pv) && /barcode/.test(pv));
ok('privacy: no selling, health data never used for ads', /don't sell/.test(pv) && /health.*for advertising/i.test(pv));
ok('privacy: account deletion, 13+, not medical advice', /Delete account/.test(pv) && /13 and over/.test(pv) && /not medical advice/i.test(pv));
await page.screenshot({ path:`${SHOTS}/75-privacy.png` });
await page.goto(BASE + 'terms.html');
const tv = await txt('main');
ok('terms: not medical advice, 13+, subscriptions + trial + cancellation', /not medical, nutritional or professional advice/i.test(tv) && /at least 13/.test(tv) && /free trial/i.test(tv) && /renew automatically/i.test(tv));
ok('legal pages link back to the app', await page.locator('a[href="./"], a[href="./#/settings"]').count() >= 2);

/* 2. links from Profile > Your data and onboarding */
await seed(data);
ok('Profile > Your data links Privacy + Terms', await page.locator('#legalLinks a[href="privacy.html"]').count() === 1 && await page.locator('#legalLinks a[href="terms.html"]').count() === 1 && /Your data/.test(await page.locator('#legalLinks').evaluate(e => e.closest('.card').querySelector('h2').textContent)));
await seed(null, '', '#setupLegal');
ok('onboarding links Terms + Privacy', await page.locator('#setupLegal a[href="terms.html"]').count() === 1 && await page.locator('#setupLegal a[href="privacy.html"]').count() === 1);
await page.locator('#setupLegal a[href="privacy.html"]').tap(); await page.waitForURL(/privacy\.html/);
ok('tapping the link opens the policy', (await txt('h1')) === 'Privacy Policy');

/* 3. paywall is hidden without the flag */
await seed(data);
ok('flag off: no Pro row, no PRO tags', await page.locator('#proRow, .protag').count() === 0);
await page.goto(BASE + '#/pro'); await settle(500);
ok('flag off: #/pro goes back to Profile', !/#\/pro/.test(page.url()) && await page.locator('#paywall').count() === 0);
ok('config ships with pro:false', await page.evaluate(() => window.FORGED_CONFIG.pro === false));

/* 4. ?pro=1 preview */
await page.goto(BASE + '?pro=1#/settings'); await page.waitForSelector('#proRow'); await settle();
ok('?pro=1: Pro row at the top of Profile', await page.locator('#view > .card').first().getAttribute('id') === 'proRow');
ok('PRO tags on Pro features (looks)', await page.locator('#looks .protag').count() === 3);
await page.goto(BASE + '?pro=1#/programs'); await page.waitForSelector('#wplanList'); await settle();
ok('PRO tag on weight plans', await page.locator('#wplanList h2 .protag').count() === 1);
await page.goto(BASE + '#/pro'); await page.waitForSelector('#paywall'); await settle(400);
ok('paywall: monthly $4.99 and yearly $35.99', /\$4\.99/.test(await txt('[data-plan="forged_pro_monthly"]')) && /\$35\.99/.test(await txt('[data-plan="forged_pro_yearly"]')));
ok('paywall: 7-day free trial label and CTA', /7-day free trial/.test(await txt('#pwTrial')) && /Start 7-day free trial/.test(await txt('#pwBuy')));
const feats = await txt('#pwFeats');
ok('paywall: features listed', ['Programs & weight plans', 'Lifting templates', 'Advanced stats', 'Extra looks', 'Social feed'].every(f => feats.includes(f)), feats);
ok('yearly is preselected, renewal terms shown', await page.locator('[data-plan="forged_pro_yearly"].on').count() === 1 && /then \$35\.99 per year.*Renews automatically/.test(await txt('#pwFine')));
await page.addStyleTag({ content:'.tabbar{display:none!important}' }); await page.screenshot({ path:`${SHOTS}/76-paywall.png`, fullPage:true }); await page.reload(); await page.waitForSelector('#paywall'); await settle(300);
await page.locator('[data-plan="forged_pro_monthly"]').tap(); await settle(150);
ok('picking monthly updates the terms', /\$4\.99 per month/.test(await txt('#pwFine')) && await page.locator('[data-plan="forged_pro_monthly"][aria-checked="true"]').count() === 1);
await page.locator('#pwBuy').tap(); await page.waitForFunction(() => /nothing was charged/.test(document.querySelector('#toast').textContent), null, { timeout:4000 }).catch(() => {});
ok('buy goes to the payments stub: nothing charged', /nothing was charged/.test(await txt('#toast')) && await page.evaluate(() => window.DM_TEST.Payments.stub));
ok('isPro() still true for everyone', await page.evaluate(() => typeof window.DM_TEST.isPro === 'function' ? window.DM_TEST.isPro() : true));
await page.locator('#pwRestore').tap(); await settle(400);
ok('restore is stubbed too', /no purchases to restore/.test(await txt('#toast')));
ok('paywall links Terms + Privacy', await page.locator('#paywall .pw-links a').count() === 2);
await page.goto(BASE + '?pro=0#/settings'); await page.waitForSelector('#sectionsCard'); await settle();
ok('?pro=0 turns the preview off', await page.locator('#proRow, .protag').count() === 0);

ok('no console errors', errors.length === 0, JSON.stringify(errors));
await browser.close();
console.log(results.join('\n'));
