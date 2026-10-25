import { chromium, devices } from 'playwright';
const [,,B,MODE]=process.argv, O='/workspace/forged-shots/challenges-';
const br=await chromium.launch(); const c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}}); const p=await c.newPage();
const d={schema:7,sessions:[],profile:{name:'Steve',unit:'lb',distUnit:'mi',setupDone:true,tips:false,enabled:{grappling:true,weights:true,food:true,weight:true}},nutrition:{entries:[],foods:[],water:[]},weights:[],belts:[],comps:[],injuries:[],strength:[],benchmarks:[]};
await p.goto(B); await p.evaluate(d=>{localStorage.clear();localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',JSON.stringify({home:1,weight:1,friends:1,settings:1,badges:1,rank:1,challenges:1}))},d); await p.reload();
await p.goto(B+'#/challenges'); await p.waitForTimeout(1200);
const cards=p.locator('.chrow, .list-row').filter({hasText:/this week|this month|times|PR|benchmark|sessions|days/});
if(MODE==='before'){ await p.evaluate(()=>scrollTo(0,0)); await p.screenshot({path:O+'before.png',fullPage:true}); console.log(await p.locator('#view').innerText()); await br.close(); process.exit(); }
const btn=p.locator('[data-chtick]'); console.log('done buttons:',await btn.count());
const row=btn.first().locator('xpath=ancestor::div[contains(@class,"list-row")][1]'); console.log('first:',(await row.innerText()).replace(/\n/g,' | '));
await row.scrollIntoViewIfNeeded(); await p.evaluate(()=>scrollBy(0,-150)); await p.screenshot({path:O+'after-0.png'});
await btn.first().tap(); await p.waitForTimeout(400); console.log('after tap:',(await p.locator('[data-chtick]').first().locator('xpath=ancestor::div[contains(@class,"list-row")][1]').innerText()).replace(/\n/g,' | '), '| toast:', await p.locator('#toast').innerText());
await p.screenshot({path:O+'after-1.png'});
await p.locator('#toast .undo').tap(); await p.waitForTimeout(400); await p.screenshot({path:O+'undo.png'}); console.log('after undo:',(await p.locator('[data-chtick]').first().locator('xpath=ancestor::div[contains(@class,"list-row")][1]').innerText()).replace(/\n/g,' | '));
for(let i=0;i<20;i++){ const b=p.locator('[data-chtick]').first(); if(!await b.count()) break; await b.tap(); await p.waitForTimeout(150);} console.log('remaining done buttons after spamming:',await p.locator('[data-chtick]').count()); await p.screenshot({path:O+'after-complete.png',fullPage:true});
await p.goto(B+'#/'); await p.waitForTimeout(800); await p.locator('#challengeHome').scrollIntoViewIfNeeded(); await p.screenshot({path:O+'home.png'}); await br.close();
