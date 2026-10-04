import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const svgInfo = sel => page.locator(sel).evaluate(s => ({ belt:s.dataset.belt, stripes:Number(s.dataset.stripes), size:s.classList.contains('lg') ? 'lg' : 'sm', label:s.getAttribute('aria-label'),
  w:s.getBoundingClientRect().width, h:s.getBoundingClientRect().height, fills:[...s.querySelectorAll('rect')].map(r => r.getAttribute('fill')), tape:[...s.querySelectorAll('rect')].filter(r => r.getAttribute('fill') === '#f4f4f4').length }));
const setBelts = async (belts) => { await page.evaluate(b => { const d = JSON.parse(localStorage.getItem('dm.bjj.v1')); d.belts = b; const c = [...b].sort((x,y) => x.date.localeCompare(y.date)).pop(); if (c) { d.profile.belt = c.belt; d.profile.stripes = c.stripes; d.profile.promotedOn = c.date; } localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, belts); };
const E = (id, date, belt, stripes) => ({ id, date, belt, stripes, instructor:'', academy:'', notes:'', createdAt:1 });

/* empty state: white belt + prompt above the button, Home and Profile */
await page.goto(BASE); await page.waitForSelector('#catTiles'); await page.locator('#go').tap(); await page.locator('#skipGoals').tap(); await page.waitForSelector('#beltCard');
let i = await svgInfo('#beltCard svg.beltsvg');
ok('Home empty: large white belt illustration', i.belt === 'white' && i.size === 'lg' && i.stripes === 0 && i.w > 280, JSON.stringify(i));
const order = await page.evaluate(() => { const c = document.querySelector('#beltCard'), y = s => c.querySelector(s).getBoundingClientRect().top; return [y('svg'), y('.belt-prompt'), y('[data-promo]')]; });
ok('Home empty: "Track your belt journey" sits between the belt and Log promotion', (await page.locator('#beltCard .belt-prompt b').textContent()) === 'Track your belt journey' && order[0] < order[1] && order[1] < order[2], JSON.stringify(order));
await page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.style.display = 'none'; }); await page.evaluate(() => { document.querySelector('#beltCard').scrollIntoView({ block:'start' }); window.scrollBy(0, -90); }); await settle();
await page.locator('#beltCard').screenshot({ path:`${SHOTS}/28-belt-card-empty.png` });
await page.goto(BASE + '#/settings'); await page.waitForSelector('#rankCard');
i = await svgInfo('#rankCard svg.beltsvg');
ok('Profile empty: white belt + prompt', i.belt === 'white' && i.size === 'lg' && (await page.locator('#rankCard .belt-prompt').textContent()).includes('Track your belt journey'));

/* blue 2 stripes */
await setBelts([E('a','2023-01-10','white',0), E('b','2025-02-01','blue',0), E('c','2025-09-01','blue',2)]);
await page.goto(BASE); await page.waitForSelector('#beltCard.tappable'); await settle();
i = await svgInfo('#beltCard svg.beltsvg');
ok('Home: blue belt with 2 white stripes on a black bar', i.belt === 'blue' && i.stripes === 2 && i.tape === 2 && i.fills.includes('#2563eb') && i.fills.includes('#141414') && /Blue belt, 2 stripes/.test(i.label), JSON.stringify(i));
await page.evaluate(() => { document.querySelector('#beltCard').scrollIntoView({ block:'start' }); window.scrollBy(0, -90); }); await settle();
await page.locator('#beltCard').screenshot({ path:`${SHOTS}/29-belt-card-blue-2stripes.png` });
await page.goto(BASE + '#/settings'); await page.waitForSelector('#rankCard');
i = await svgInfo('#rankCard svg.beltsvg');
ok('Profile: same component, blue 2 stripes', i.belt === 'blue' && i.stripes === 2 && i.size === 'lg' && i.tape === 2);
await page.goto(BASE + '#/belts'); await page.waitForSelector('.tl-group');
const tl = await page.locator('.tl-head svg.beltsvg').evaluateAll(ss => ss.map(s => ({ belt:s.dataset.belt, st:Number(s.dataset.stripes), sm:s.classList.contains('sm'), w:Math.round(s.getBoundingClientRect().width) })));
ok('Timeline: small version of the same component per belt', tl.length === 2 && tl.every(t => t.sm && t.w <= 80) && tl[0].belt === 'blue' && tl[0].st === 2 && tl[1].belt === 'white', JSON.stringify(tl));

/* black belt: red bar + degrees */
await setBelts([E('a','2015-01-10','black',0), E('b','2021-02-01','black',3)]);
await page.goto(BASE); await page.waitForSelector('#beltCard.tappable'); await settle();
i = await svgInfo('#beltCard svg.beltsvg');
ok('Black belt: red bar with 3 white degree stripes', i.belt === 'black' && i.tape === 3 && i.fills.includes('#c8102e') && !i.fills.includes('#141414'), JSON.stringify(i));
await page.locator('#beltCard').screenshot({ path:'/tmp/belt-black.png' });
/* white belt with 4 stripes, purple 0 */
await setBelts([E('a','2024-01-10','white',4)]); await page.goto(BASE); await page.waitForSelector('#beltCard.tappable');
i = await svgInfo('#beltCard svg.beltsvg'); ok('White belt 4 stripes', i.belt === 'white' && i.tape === 4);
await page.locator('#beltCard').screenshot({ path:'/tmp/belt-white4.png' });
ok('no console errors', errors.length === 0, JSON.stringify(errors));
console.log(results.join('\n'));
await browser.close();
