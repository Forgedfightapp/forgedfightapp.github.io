import { chromium, devices } from 'playwright'; import fs from 'fs';
const [,,B,OUT,MP]=process.argv; const MOCK=fs.readFileSync(MP,'utf8');
const br=await chromium.launch(); const c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}});
await c.addInitScript(()=>{window.FORGED_CONFIG={social:true};window.__FORGED_QUIET_MEDALS=true;}); await c.addInitScript(MOCK); const p=await c.newPage();
const d={schema:7,sessions:[],profile:{name:'CRUSHER CALDWELL',unit:'lb',distUnit:'mi',setupDone:true,tips:false,enabled:{grappling:true,food:false}},nutrition:{entries:[],foods:[],water:[]},weights:[],belts:[],comps:[],injuries:[],strength:[]};
await p.goto(B); await p.evaluate(d=>{localStorage.clear();localStorage.setItem('forged.uname.preview','1');localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',JSON.stringify({home:1,weight:1,friends:1,settings:1,badges:1,rank:1}))},d); await p.reload();
await p.goto(B+'#/friends'); await p.waitForSelector('#goSignin'); await p.locator('#goSignin').tap(); await p.waitForSelector('#siEmail');
await p.locator('#siEmail').fill('steve@example.com'); await p.locator('#siSend').tap(); await p.waitForSelector('#siCodeWrap:not([hidden])'); await p.locator('#siCode').fill('123456'); await p.waitForSelector('#youCard',{timeout:8000});
await p.evaluate(()=>{localStorage.setItem('forged.social.uname','"crusher_caldwell"'); window.__mockSb.addUser({name:'Alex',username:'alex.rolls'});}); await p.reload(); await p.waitForTimeout(1500);
const sel=await p.locator('#unameCard:not([hidden])').count()?'#unameCard':'#inviteCard'; const card=p.locator(sel);
if(sel==='#unameCard'){ await p.fill('#findUname','alex.rolls'); await p.locator('#findGo').tap(); await p.waitForSelector('#findRow'); }
await card.scrollIntoViewIfNeeded(); await card.screenshot({path:OUT}); console.log(sel, await card.innerText()); await br.close();
