// 3.4.0 Tip of the day: library, daily rotation, sport filter, context (injury / comp / high load), expand, Next, Hide + Profile toggle.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/workspace/bjj-tracker/screenshots';
const errors = [], results = [];
const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c ? '' : x}`); if (!c) process.exitCode = 1; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push('pageerror: '+e.message)); page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const settle = (ms=300) => page.waitForTimeout(ms);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dm.bjj.v1')));
const T = (fn, arg) => page.evaluate(fn, arg);
const hideToast = () => page.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show','act'); });
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const seed = async (data, extra = {}) => { await page.goto(BASE); await page.evaluate(([d, x]) => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); Object.entries(x).forEach(([k, v]) => localStorage.setItem(k, v)); }, [data, extra]); await page.reload(); await page.waitForSelector('.statrow'); await settle(300); };
const EN = (o) => ({ grappling:false, striking:false, mma:false, weights:false, cardio:false, mobility:false, food:false, weight:false, ...o });
const prof = (x={}) => ({ name:'', unit:'lb', distUnit:'mi', setupDone:true, enabled:EN({ grappling:true }), ...x });
const S = (id, date, o={}) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', weight:'', rolls:[], sample:false, createdAt:1, ...o });
const base = (o = {}) => ({ schema:7, sessions:[S('a', D(-2))], profile:prof(), nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], ...o });

/* 1. library */
await seed(base());
const lib = await T(() => window.FORGED_TIPS);
const topics = ['recovery','sleep','nutrition','hydration','cut','drilling','rolling','injury','care','mobility','strength','striking','cardio','mindset','comp'];
ok(`library: 120+ tips (${lib.length}) with unique ids`, lib.length >= 120 && new Set(lib.map(t => t.id)).size === lib.length);
ok('every topic is covered (recovery, sleep, nutrition, hydration, safe weight cutting, drilling, rolling, injury prevention + care, mobility, strength, striking, cardio, mindset, comp prep)', topics.every(k => lib.filter(t => t.t === k).length >= 8), JSON.stringify(topics.map(k => [k, lib.filter(t => t.t === k).length])));
const sentences = b => (b.replace(/\d\.\d/g, '0').match(/[.!?](\s|$)/g) || []).length;
ok('every tip is short: headline ≤ 40 chars, body 1–2 sentences ≤ 180 chars', lib.every(t => t.h.length <= 40 && t.b.length <= 180 && sentences(t.b) >= 1 && sentences(t.b) <= 2), JSON.stringify(lib.filter(t => !(t.h.length <= 40 && t.b.length <= 180 && sentences(t.b) <= 2)).map(t => t.id)));
const claims = /\b(cures?|treats?|treatment|heals?|diagnos\w*|guarantee\w*|prevents?|miracle|detox|burns? fat|boosts? (your )?immun\w*|proven to)\b/i;
ok('no medical claims (cure / treat / heal / prevent / guarantee / detox …)', lib.every(t => !claims.test(t.h + ' ' + t.b)), JSON.stringify(lib.filter(t => claims.test(t.h + ' ' + t.b)).map(t => t.id)));
ok('weight-cutting tips steer away from dehydration', lib.filter(t => t.t === 'cut').some(t => /dehydration/i.test(t.b) && /dangerous|harm/i.test(t.b)));
ok('sport tags are valid', lib.every(t => t.s.every(k => ['grappling','striking','mma','weights','cardio','mobility'].includes(k))));

/* 2. Home card: small, below the main stats, collapsed */
ok('tip card shows on Home right below the main stats', await page.locator('#tipCard').count() === 1 && await T(() => document.querySelector('.statrow').nextElementSibling?.id === 'tipCard'));
const hgt = await page.locator('#tipCard').evaluate(e => e.getBoundingClientRect().height);
ok('collapsed card is small and unobtrusive (one line, < 80px), full text hidden', hgt < 80 && await page.locator('#tipBody').isHidden() && await page.locator('#tipToggle').getAttribute('aria-expanded') === 'false', `h=${hgt}`);
ok('label reads "Tip of the day · <topic>"', /Tip of the day · /i.test(await page.locator('#tipCard .tiptxt small').innerText()));

/* 3. daily rotation by date */
const id0 = await page.locator('#tipCard').getAttribute('data-tip');
await page.reload(); await page.waitForSelector('#tipCard');
ok('same tip all day (stable across reloads)', await page.locator('#tipCard').getAttribute('data-tip') === id0 && await T(d => window.DM_TEST.tipFor(d, 0).id, D(0)) === id0);
const month = await T(days => days.map(d => window.DM_TEST.tipFor(d, 0).id), Array.from({ length:30 }, (_, i) => D(i)));
ok('rotates daily: 30 different tips over the next 30 days', new Set(month).size === 30 && month[0] !== month[1]);
ok('deterministic by date seed', JSON.stringify(month) === JSON.stringify(await T(days => days.map(d => window.DM_TEST.tipFor(d, 0).id), Array.from({ length:30 }, (_, i) => D(i)))));

/* 4. filtered by your sports */
const deckFor = cats => T(c => window.DM_TEST.tipDeck(undefined, '', c).deck.map(t => t.t + ':' + t.s.join(',')), cats);
const g = await deckFor(['grappling']), st = await deckFor(['striking']), wc = await deckFor(['weights','cardio']);
ok('grappling only: rolling tips yes, striking tips no', g.some(x => x.startsWith('rolling:')) && !g.some(x => x.startsWith('striking:')));
ok('striking only: striking tips yes, rolling / gi tips no', st.some(x => x.startsWith('striking:')) && !st.some(x => x.startsWith('rolling:')) && !st.some(x => /:grappling$/.test(x)));
ok('weights + cardio only: no weight cutting, rolling or striking; strength and cardio yes', !wc.some(x => /^(cut|rolling|striking|comp):/.test(x)) && wc.some(x => x.startsWith('strength:')) && wc.some(x => x.startsWith('cardio:')));
ok('injury-care tips stay out of the rotation when nothing is logged', !g.some(x => x.startsWith('care:')));

/* 5. context awareness */
await seed(base({ injuries:[{ id:'i1', area:'Knee', side:'left', severity:3, date:D(-3), notes:'', healed:'', updates:[], createdAt:1 }], comps:[{ id:'c1', name:'Open', date:D(10), sport:'BJJ', createdAt:1 }] }));
ok('active injury: injury-care tip (beats an upcoming comp), with the reason', await page.locator('#tipCard').getAttribute('data-topic') === 'care' && await T(() => window.DM_TEST.tipContext()) === 'injury');
await page.locator('#tipToggle').tap(); await settle(200);
ok('reason shown: "Because you have an injury logged"', /injury logged/i.test(await page.locator('#tipBody').innerText()));
const injWeek = await T(days => days.map(d => window.DM_TEST.tipFor(d, 0).t), Array.from({ length:10 }, (_, i) => D(i)));
ok('injury-care tips every day while the injury is active', injWeek.every(t => t === 'care'), injWeek.join(','));
await seed(base({ comps:[{ id:'c1', name:'Open', date:D(20), sport:'BJJ', createdAt:1 }] }));
ok('comp within 3 weeks: taper / comp-prep tip', await page.locator('#tipCard').getAttribute('data-topic') === 'comp' && await T(() => window.DM_TEST.tipContext()) === 'comp');
await seed(base({ comps:[{ id:'c1', name:'Open', date:D(30), sport:'BJJ', createdAt:1 }] }));
ok('comp 30 days out: normal rotation', await T(() => window.DM_TEST.tipContext()) === '');
const heavy = [...[8,15,22,29].map((n, i) => S('o' + i, D(-n), { duration:45, rpe:4 })), ...[0,1,2,3,4,5].map(n => S('h' + n, D(-n), { duration:90, rpe:8 }))];
await seed(base({ sessions:heavy }));
ok('High load week: recovery / sleep tip', await T(() => window.DM_TEST.tipContext()) === 'load' && ['recovery','sleep'].includes(await page.locator('#tipCard').getAttribute('data-topic')));

/* 6. expand, Next tip */
await seed(base());
const first = await page.locator('#tipCard').getAttribute('data-tip'), full = await T(id => window.FORGED_TIPS.find(t => t.id === id).b, first);
await page.locator('#tipToggle').tap(); await settle(200);
ok('tapping expands to the full tip with Next tip and Hide tips', await page.locator('#tipBody').isVisible() && (await page.locator('#tipBody p').innerText()) === full && await page.locator('#tipNext').isVisible() && await page.locator('#tipHide').isVisible() && await page.locator('#tipToggle').getAttribute('aria-expanded') === 'true');
ok('not medical advice note', /not medical advice/i.test(await page.locator('#tipBody').innerText()));
await page.locator('#tipNext').tap(); await settle(200);
const second = await page.locator('#tipCard').getAttribute('data-tip');
ok('Next tip shows a different tip and stays open', second !== first && await page.locator('#tipBody').isVisible());
await hideToast();
await page.evaluate(() => window.scrollTo(0, 0)); await settle(200);
await page.screenshot({ path:`${SHOTS}/65-tip.png` });
await page.reload(); await page.waitForSelector('#tipCard');
ok('Next tip sticks for the rest of the day', await page.locator('#tipCard').getAttribute('data-tip') === second);
await page.locator('#tipToggle').tap(); await settle(150); await page.locator('#tipToggle').tap(); await settle(150);
ok('tap again collapses', await page.locator('#tipBody').isHidden());

/* 7. Hide tips + Profile toggle */
await page.locator('#tipToggle').tap(); await settle(150);
await page.locator('#tipHide').tap(); await settle(300);
ok('Hide tips removes the card, saves the choice, offers Undo', await page.locator('#tipCard').count() === 0 && (await db()).profile.tips === false && /Turn them back on in Profile/i.test(await page.locator('#toast').innerText()));
await page.locator('#toast .tbtn').tap(); await page.waitForSelector('#tipCard');
ok('Undo brings it back', (await db()).profile.tips === true);
await page.locator('#tipToggle').tap(); await settle(150); await page.locator('#tipHide').tap(); await settle(300); await hideToast();
await page.reload(); await page.waitForSelector('.statrow');
ok('stays hidden after reload', await page.locator('#tipCard').count() === 0);
await page.goto(BASE + '#/settings'); await page.waitForSelector('#tipsToggle', { state:'attached' });
ok('Profile → What I track has a Tip of the day switch (off)', !(await page.locator('#tipsToggle').isChecked()));
await page.locator('#tipsRow').tap(); await settle(300);
ok('switching it on saves', (await db()).profile.tips === true);
await page.goto(BASE + '#/'); await page.waitForSelector('#tipCard');
ok('tip is back on Home', await page.locator('#tipCard').count() === 1);

ok('no console errors', errors.length === 0, errors.join(' | '));
if (!process.env.QUIET) console.log(results.join('\n')); else console.log(results.join('\n'));
await browser.close();
