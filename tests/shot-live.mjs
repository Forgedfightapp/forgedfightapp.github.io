import { chromium, devices } from 'playwright'; import fs from 'fs';
const B='https://forgedfightapp.github.io/', O='/workspace/forged-shots/live-316-', MOCK=fs.readFileSync('./mock-supabase.js','utf8'); const br=await chromium.launch();
const ctx=async m=>{const c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}}); if(m){await c.addInitScript(()=>{window.__FORGED_QUIET_MEDALS=true;}); await c.addInitScript(MOCK);} return c.newPage();};
let p=await ctx(true); const d={schema:7,sessions:[],profile:{name:'CRUSHER CALDWELL',unit:'lb',distUnit:'mi',setupDone:true,tips:false,enabled:{grappling:true}},nutrition:{entries:[],foods:[],water:[]},weights:[],belts:[],comps:[],injuries:[],strength:[]};
await p.goto(B); await p.evaluate(d=>{localStorage.clear();localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',JSON.stringify({home:1,weight:1,friends:1,settings:1,badges:1,rank:1}))},d); await p.reload();
await p.goto(B+'#/friends'); await p.waitForSelector('#goSignin'); await p.locator('#goSignin').tap(); await p.locator('#siEmail').fill('steve@example.com'); await p.locator('#siSend').tap(); await p.waitForSelector('#siCodeWrap:not([hidden])'); await p.locator('#siCode').fill('123456');
await p.waitForSelector('#unameSheet',{timeout:10000}); await p.waitForTimeout(1500); await p.screenshot({path:O+'rename-prompt.png'}); console.log('prompt:',await p.locator('#unameSheet').innerText());
p=await ctx(false); await p.goto('https://forgedfight.com/u/crusher_caldwell'); await p.waitForTimeout(300); await p.screenshot({path:O+'landing.png'}); await p.waitForTimeout(3000); console.log('landed:',p.url()); await p.screenshot({path:O+'invite-new.png'});
await br.close();
