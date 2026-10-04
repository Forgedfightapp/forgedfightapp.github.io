// 3.4.0 competitions for every sport + belts/ranks for every art (BJJ data unchanged).
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
const seed = async (data) => { await page.goto(BASE); await page.evaluate(d => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify(d)); }, data); await page.reload(); await page.waitForSelector('.statrow'); await settle(300); };
const EN = o => ({ grappling:false, striking:false, mma:false, weights:false, cardio:false, mobility:false, food:false, weight:false, ...o });
const prof = (x={}) => ({ name:'', unit:'lb', distUnit:'mi', setupDone:true, tips:false, enabled:EN({ grappling:true }), ...x });
const S = (id, date, o={}) => ({ id, date, category:'grappling', discipline:'bjj', gi:'gi', type:'class', duration:60, rounds:5, intensity:3, rpe:5, techniques:[], notes:'', weight:'', rolls:[], sample:false, createdAt:1, ...o });
const base = (o = {}) => ({ schema:7, sessions:[S('a', D(-2))], profile:prof(), nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[], comps:[], injuries:[], strength:[], ...o });
const radio = (root, name) => page.locator(`${root} [role="radio"]`, { hasText:name }).first();
const radioX = (root, name) => page.locator(`${root} [role="radio"]`).filter({ hasText:new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`) }).first();

/* ===== 1. competitions ===== */
await seed(base({ profile:prof({ enabled:EN({ grappling:true }) }) }));
let sp = await T(() => window.DM_TEST.compSports());
ok('grappling only: sport list is BJJ, Submission grappling, Judo, Wrestling, Sambo + Other (no striking)', JSON.stringify(sp) === JSON.stringify(['BJJ','Submission grappling','Judo','Wrestling','Sambo','Other']), JSON.stringify(sp));
await seed(base({ profile:prof({ enabled:EN({ grappling:true, striking:true, mma:true }) }) }));
sp = await T(() => window.DM_TEST.compSports());
ok('grappling + striking + MMA: all sports incl. Boxing, Muay Thai, Kickboxing, Karate, Taekwondo, MMA', ['Boxing','Muay Thai','Kickboxing','Karate','Taekwondo','MMA','Judo','Wrestling','Sambo'].every(x => sp.includes(x)));
ok('striking only: no grappling sports', await T(() => { const d = window.DM_TEST.db; const was = d.profile.enabled; d.profile.enabled = { ...was, grappling:false, mma:false }; const l = window.DM_TEST.compSports(); d.profile.enabled = was; return !l.includes('BJJ') && l.includes('Boxing') && !l.includes('MMA'); }));
ok('an existing comp keeps its sport in the list (legacy "No-Gi grappling")', await T(() => window.DM_TEST.compSports('No-Gi grappling').includes('No-Gi grappling')) && await T(() => window.DM_TEST.compKind('No-Gi grappling')) === 'grappling');

/* add a Muay Thai bout */
await page.goto(BASE + '#/comps'); await page.waitForSelector('#compsCard');
await page.locator('#compsCard [data-addcomp]').tap(); await page.waitForSelector('#compName');
await page.fill('#compName', 'Thai Fight Night'); await page.fill('#compDate', D(5)); await page.dispatchEvent('#compDate', 'change');
ok('default for a grappler: BJJ tournament with Gi/No-Gi and Division', await radioX('#compSport', 'BJJ').getAttribute('aria-checked') === 'true' && await page.locator('#compGi').count() === 1 && await page.locator('#compDiv').count() === 1 && await page.locator('#compBout').count() === 0);
await radioX('#compSport', 'Muay Thai').tap(); await settle(150);
ok('striking fields: bout type (amateur / pro / smoker), rounds × minutes, weight class, weigh-in time; no gi/division', await page.locator('#compBout').count() === 1 && /Smoker/.test(await page.locator('#compBout').innerText()) && await page.locator('#compRounds').count() === 1 && await page.locator('#compRoundMin').count() === 1 && await page.locator('#compWeighIn').count() === 1 && await page.locator('#compClass').count() === 1 && await page.locator('#compGi, #compDiv').count() === 0);
ok('striking defaults to a single bout', await radioX('#compFmt', 'Single bout').getAttribute('aria-checked') === 'true');
await radioX('#compBout', 'Amateur').tap(); await page.fill('#compRounds', '3'); await page.fill('#compRoundMin', '2'); await page.fill('#compClass', '67 kg'); await page.fill('#compWeighIn', `${D(4)}T18:00`); await page.dispatchEvent('#compWeighIn', 'change');
await page.locator('.sheet [data-save]').tap(); await settle(400);
let d = await db(), mt = d.comps.find(c => c.name === 'Thai Fight Night');
ok('saved: sport, bout type, rounds, minutes, weigh-in, fmt bout', mt && mt.sport === 'Muay Thai' && mt.bout === 'am' && mt.rounds === 3 && mt.roundMin === 2 && mt.weighIn === `${D(4)}T18:00` && mt.fmt === 'bout' && !mt.gi && !mt.division, JSON.stringify(mt));
await page.goto(BASE + '#/'); await page.waitForSelector('#compCard');
ok('Home countdown shows the bout details and weigh-in', /Amateur · 3 × 2 min/.test(await page.locator('#compDetail').innerText()) && /Weigh-in/.test(await page.locator('#compWeigh').innerText()) && /6:00 PM/.test(await page.locator('#compWeigh').innerText()));
ok('striking fight-week tips: sparring taper, pad sharpness, weigh-in rehydration', await page.locator('#taperTips').getAttribute('data-kind') === 'striking' && /Fight week/i.test(await page.locator('#taperTips').innerText()) && /sparring/i.test(await page.locator('#taperTips').innerText()) && /pads/i.test(await page.locator('#taperTips').innerText()) && /rehydration/i.test(await page.locator('#taperTips').innerText()));

/* MMA taper */
await T(() => { const x = JSON.parse(localStorage.getItem('dm.bjj.v1')); x.comps[0].sport = 'MMA'; localStorage.setItem('dm.bjj.v1', JSON.stringify(x)); }); await page.reload(); await page.waitForSelector('#taperTips');
ok('MMA fight-week tips mix both (sparring + rolling)', await page.locator('#taperTips').getAttribute('data-kind') === 'mma' && /rolling/i.test(await page.locator('#taperTips').innerText()));
ok('tip of the day comp context follows the comp sport (MMA → no gi/BJJ-only tips)', await T(() => window.DM_TEST.tipDeck(undefined, 'comp').deck.slice(0, window.DM_TEST.tipDeck(undefined, 'comp').pri).every(t => !t.s.length || t.s.includes('mma'))));

/* results: past comps of several sports */
const past = [
  { id:'p1', name:'Spring Open', date:D(-60), sport:'BJJ', fmt:'tournament', gi:'gi', division:'Adult · Blue', result:'medal', medal:'gold', mw:3, ml:0, createdAt:1 },
  { id:'p2', name:'No-Gi Champs', date:D(-40), sport:'BJJ', fmt:'tournament', gi:'nogi', result:'nomedal', mw:1, ml:1, createdAt:2 },
  { id:'p3', name:'Smoker', date:D(-30), sport:'Muay Thai', fmt:'bout', bout:'smoker', rounds:3, roundMin:2, result:'win', method:'decision', createdAt:3 },
  { id:'p4', name:'Regional', date:D(-20), sport:'Muay Thai', fmt:'bout', bout:'am', rounds:3, roundMin:3, result:'loss', method:'ko', createdAt:4 },
  { id:'p5', name:'Cage Night', date:D(-10), sport:'MMA', fmt:'bout', bout:'am', rounds:3, roundMin:3, result:'draw', createdAt:5 },
  { id:'p6', name:'Judo Cup', date:D(-3), sport:'Judo', fmt:'tournament', createdAt:6 },
  { id:'old', name:'Old comp', date:D(-400), sport:'BJJ', result:'win', createdAt:0 } ];
await seed(base({ profile:prof({ enabled:EN({ grappling:true, striking:true, mma:true }) }), comps:past }));
d = await db();
ok('old comps migrate without losing anything (win → single match)', d.comps.find(c => c.id === 'old').result === 'win' && d.comps.find(c => c.id === 'old').fmt === 'bout');
await page.goto(BASE + '#/comps'); await page.waitForSelector('#compRecord');
const rec = await page.locator('#compRecord .recrow').evaluateAll(r => r.map(x => [x.dataset.sport, x.querySelector('span').textContent]));
ok('Past: W-L record per sport (tournament match wins/losses + bouts; draws; medals)', JSON.stringify(rec) === JSON.stringify([['BJJ','5W · 1L · 🥇'],['Muay Thai','1W · 1L'],['Judo','0W · 0L'],['MMA','0W · 0L · 1D']]), JSON.stringify(rec));
ok('Past header totals', /6W · 2L · 1D · 1 medal/.test(await page.locator('#pastComps h2').innerText()), await page.locator('#pastComps h2').innerText());
ok('result pills show method / medal / draw', /Win · Decision/i.test(await page.locator('[data-comp="p3"]').innerText()) && /Loss · KO\/TKO/i.test(await page.locator('[data-comp="p4"]').innerText()) && /Gold/i.test(await page.locator('[data-comp="p1"]').innerText()) && /Draw/i.test(await page.locator('[data-comp="p5"]').innerText()));
ok('list rows show sport details (Gi · division; Smoker · 3 × 2 min)', /Gi · Adult · Blue/.test(await page.locator('[data-comp="p1"]').innerText()) && /Smoker \/ interclub · 3 × 2 min/.test(await page.locator('[data-comp="p3"]').innerText()));
/* enter a result for the judo tournament */
await page.locator('[data-comp="p6"]').tap(); await page.waitForSelector('#compResult');
ok('judo: tournament result asks for medal + matches won/lost; no bout fields', await page.locator('#compMW').count() === 1 && await page.locator('#compBout').count() === 0 && await page.locator('#compGi').count() === 0);
await radioX('#compResult', 'Medal').tap(); await radioX('#compResult', '🥉 Bronze').tap(); await page.fill('#compMW', '2'); await page.fill('#compML', '1');
await page.locator('.sheet [data-save]').tap(); await settle(400);
d = await db(); const jc = d.comps.find(c => c.id === 'p6');
ok('judo medal + record saved', jc.result === 'medal' && jc.medal === 'bronze' && jc.mw === 2 && jc.ml === 1);
/* a bout result with a method */
await page.locator('[data-comp="p5"]').tap(); await page.waitForSelector('#compResult');
await radioX('#compResult', 'Win').tap(); await settle(100);
ok('MMA win methods: KO/TKO, Submission, Decision, DQ', JSON.stringify(await page.locator('#compMethod [role="radio"]').allInnerTexts()) === JSON.stringify(['KO/TKO','Submission','Decision','DQ']));
await radioX('#compMethod', 'Submission').tap(); await page.locator('.sheet [data-save]').tap(); await settle(400);
d = await db(); ok('MMA win by submission saved', d.comps.find(c => c.id === 'p5').result === 'win' && d.comps.find(c => c.id === 'p5').method === 'sub');
await page.waitForSelector('#compRecord');
await page.evaluate(() => window.scrollTo(0, document.querySelector('#pastComps').getBoundingClientRect().top + window.scrollY - 60)); await settle(200); await hideToast(); await settle(500);
await page.screenshot({ path:`${SHOTS}/66-comps-multi.png` });

/* ===== 2. belts for every art ===== */
const bjj = [{ id:'b1', date:'2021-03-01', belt:'white', stripes:0, kind:'belt', instructor:'', academy:'', notes:'', createdAt:1 }, { id:'b2', date:'2023-01-10', belt:'blue', stripes:0, kind:'belt', instructor:'Prof. Silva', academy:'', notes:'', createdAt:2 }, { id:'b3', date:'2024-02-01', belt:'blue', stripes:1, kind:'stripe', instructor:'', academy:'', notes:'', createdAt:3 }];
const judoSess = [S('j1', D(-3), { discipline:'judo' }), S('j2', D(-2), { discipline:'judo' }), S('j3', D(-1), { discipline:'judo' }), S('bj', D(-1))];
await seed(base({ profile:prof({ enabled:EN({ grappling:true, striking:true }) }), belts:bjj, sessions:judoSess }));
d = await db();
ok('existing BJJ belt data unchanged (no art field added)', JSON.stringify(d.belts) === JSON.stringify(bjj), JSON.stringify(d.belts));
ok('Home: just the BJJ belt card (as before)', await page.locator('.beltcard').count() === 1 && await page.locator('#beltCard').count() === 1 && /^Blue belt/i.test(await page.locator('#beltCard h2').innerText()));
ok('BJJ sessions since last promotion count only BJJ sessions (1 BJJ, 3 judo ignored)', (await page.locator('#beltCard [data-b="sessions"]').innerText()).startsWith('1 '), await page.locator('#beltCard [data-b="sessions"]').innerText());
await page.goto(BASE + '#/belts'); await page.waitForSelector('#timeline');
ok('one art: no art switcher; offers "Track another art"', await page.locator('#artSwitch').count() === 0 && await page.locator('#addArt').count() === 1);
await page.locator('#addArt').tap(); await page.waitForSelector('[data-pickart]');
const offered = await page.locator('[data-pickart]').evaluateAll(b => b.map(x => x.dataset.pickart));
ok('arts offered: Judo, Sambo (grappling) + Karate, Taekwondo, Muay Thai (striking); no wrestling / sub grappling', JSON.stringify(offered) === JSON.stringify(['judo','sambo','karate','taekwondo','muaythai']), JSON.stringify(offered));
await page.locator('[data-pickart="judo"]').tap(); await page.waitForSelector('.sheet [data-art="judo"]'); await settle(200);
const jb = await page.locator('#beltPick button').evaluateAll(b => b.map(x => x.dataset.belt));
ok('Judo sheet: kyu colours white → yellow → orange → green → blue → brown → black, kyu shown, no kids toggle, no stripes', JSON.stringify(jb) === JSON.stringify(['white','yellow','orange','green','blue','brown','black']) && /6th kyu/.test(await page.locator('#beltPick').innerText()) && await page.locator('#kidsT').count() === 0 && await page.locator('#pKind').count() === 0);
await page.locator('#beltPick [data-belt="yellow"]').tap(); await page.fill('#pDate', D(-200)); await page.locator('#pSave').tap(); await settle(400); await hideToast();
await page.locator('[data-promo]').first().tap(); await page.waitForSelector('#beltPick');
ok('next judo promotion defaults to orange', await page.locator('#beltPick [data-belt="orange"]').getAttribute('aria-pressed') === 'true');
await page.fill('#pDate', D(-20)); await page.locator('#pSave').tap(); await settle(400); await hideToast();
d = await db(); const je = d.belts.filter(e => e.art === 'judo');
ok('judo events stored with art: judo; BJJ events untouched', je.length === 2 && je.every(e => e.kind === 'belt') && JSON.stringify(d.belts.filter(e => !e.art)) === JSON.stringify(bjj));
ok('art switcher appears with BJJ and Judo', await page.locator('#artSwitch a').count() === 2 && await page.locator('#artSwitch a.on').innerText() === 'Judo');
ok('Judo timeline: Orange belt (4th kyu) current, Yellow before, judo-coloured graphic', await page.locator('#timeline').getAttribute('data-art') === 'judo' && await page.locator('#timeline .tl-group').count() === 2 && /Orange belt/.test(await page.locator('#timeline .tl-group.current').innerText()) && /4th kyu/.test(await page.locator('#timeline .tl-group.current').innerText()) && await page.locator('#timeline .beltsvg[data-art="judo"][data-belt="orange"]').count() === 1);
ok('Judo card: time at belt, belt earned date, judo sessions since last promotion', /Time at belt/.test(await page.locator('#beltCard-judo').innerText()) && /3 Judo sessions since last promotion/.test(await page.locator('#beltCard-judo [data-b="sessions"]').innerText()), await page.locator('#beltCard-judo').innerText());
/* black belt + dan */
await T(([a, b]) => { const x = JSON.parse(localStorage.getItem('dm.bjj.v1')); x.belts.push({ id:'jb', art:'judo', date:a, belt:'black', kind:'belt', stripes:0, createdAt:9 }, { id:'jd2', art:'judo', date:b, belt:'black', kind:'stripe', stripes:2, createdAt:10 }); localStorage.setItem('dm.bjj.v1', JSON.stringify(x)); }, [D(-10), D(-5)]);
await page.reload(); await page.waitForSelector('#timeline');
ok('judo black belt with 2nd dan: card + gold dan bar on the graphic', /Black belt · 2nd dan/i.test(await page.locator('#beltCard-judo h2').innerText()) && await page.locator('#beltCard-judo .beltsvg[data-stripes="2"]').count() === 1 && /Time since last dan/.test(await page.locator('#beltCard-judo').innerText()));
await page.locator('#timeline [data-addstripe]').tap(); await page.waitForSelector('#pStripe');
ok('add dan: options 2–10, preset to 3rd', JSON.stringify(await page.locator('#pStripe [role="radio"]').allInnerTexts()) === JSON.stringify(['2','3','4','5','6','7','8','9','10']) && await radioX('#pStripe', '3').getAttribute('aria-checked') === 'true');
await page.locator('.sheet [data-close], .sheet [data-cancel]').first().tap(); await settle(300);
/* remove the black belt rows again for the screenshot */
await T(() => { const x = JSON.parse(localStorage.getItem('dm.bjj.v1')); x.belts = x.belts.filter(e => !['jb','jd2'].includes(e.id)); localStorage.setItem('dm.bjj.v1', JSON.stringify(x)); }); await page.reload(); await page.waitForSelector('#timeline');
await page.goto(BASE + '#/'); await page.waitForSelector('#beltCard-judo');
ok('Home: a belt card per art (BJJ + Judo), each labelled', await page.locator('.beltcard').count() === 2 && /^BJJ · Blue belt/i.test(await page.locator('#beltCard h2').innerText()) && /^Judo · Orange belt/i.test(await page.locator('#beltCard-judo h2').innerText()));
await page.locator('#beltCard-judo').tap(); await page.waitForURL(/#\/belts\/judo/);
ok('tapping the Judo card opens the Judo timeline', await page.locator('#timeline').getAttribute('data-art') === 'judo');
await page.locator('#artSwitch a[data-art="bjj"]').tap(); await page.waitForSelector('#timeline[data-art="bjj"]');
ok('switch back to BJJ: BJJ timeline unchanged (Blue belt current, stripe 1)', /Blue belt/.test(await page.locator('#timeline .tl-group.current').innerText()) && /Stripe 1 earned/.test(await page.locator('#timeline').innerText()));
await page.locator('#artSwitch a[data-art="judo"]').tap(); await page.waitForSelector('#timeline[data-art="judo"]'); await settle(200); await hideToast();
await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path:`${SHOTS}/67-belts-judo.png` });

/* Muay Thai prajied */
await page.locator('#addArt').tap(); await page.waitForSelector('[data-pickart="muaythai"]'); await page.locator('[data-pickart="muaythai"]').tap(); await page.waitForSelector('.sheet [data-art="muaythai"]'); await settle(200);
ok('Muay Thai uses prajied wording, no stripes', /Prajied/i.test(await page.locator('#beltLbl').innerText()) && await page.locator('#pKind').count() === 0 && await page.locator('#beltPick [data-belt="red"]').count() === 1);
await page.locator('#beltPick [data-belt="yellow"]').tap(); await page.locator('#pSave').tap(); await settle(400); await hideToast();
ok('prajied timeline with armband graphic', /Yellow prajied/.test(await page.locator('#timeline').innerText()) && await page.locator('#timeline .beltsvg.prajied').count() >= 1 && await page.locator('#artSwitch a').count() === 3);
/* karate + taekwondo systems */
const sys = await T(() => { const A = window.DM_TEST.BELT_ARTS; return { k:A.karate.belts, t:A.taekwondo.belts, s:A.sambo.belts, wr:!!A.wrestling }; });
ok('karate, taekwondo, sambo rank systems; no wrestling', sys.k.includes('purple') && sys.t.includes('red') && sys.t[sys.t.length - 1] === 'black' && sys.s.length >= 6 && !sys.wr);
/* invalid art belts are dropped, BJJ legacy snapshots still migrate */
const san = await T(() => window.DM_TEST.sanitizeBelts([{ id:'x', art:'judo', date:'2024-01-01', belt:'purple', kind:'belt' }, { id:'y', art:'muaythai', date:'2024-01-01', belt:'red', kind:'stripe', stripes:3 }, { id:'z', date:'2020-01-01', belt:'blue', stripes:2 }]));
ok('sanitize: judo has no purple (dropped); prajied stripes become a belt event; BJJ snapshot → belt + 2 stripe events', !san.some(e => e.id === 'x') && san.find(e => e.id === 'y').kind === 'belt' && san.filter(e => !e.art).length === 3);

ok('no console errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
