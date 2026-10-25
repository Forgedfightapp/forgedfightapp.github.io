import { chromium, devices } from 'playwright'; import fs from 'fs';
const B='http://localhost:8787/', MOCK=fs.readFileSync('./mock-supabase.js','utf8'), O='/workspace/forged-shots/';
const br=await chromium.launch();
const mk=async()=>{const c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}}); await c.addInitScript(()=>{window.FORGED_CONFIG={social:true};window.__FORGED_QUIET_MEDALS=true;}); await c.addInitScript(MOCK); return [c,await c.newPage()];};
const db0={schema:7,sessions:[],profile:{name:'Steve',unit:'lb',distUnit:'mi',setupDone:true,tips:false,enabled:{grappling:true,food:false}},nutrition:{entries:[],foods:[],water:[]},weights:[],belts:[],comps:[],injuries:[],strength:[]};
const seen=JSON.stringify({home:1,weight:1,friends:1,settings:1,badges:1,rank:1});
// A: Steve shares
let [c,p]=await mk(); await p.goto(B); await p.evaluate(([d,s])=>{localStorage.clear();localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',s)},[db0,seen]);
await p.goto(B+'#/friends'); await p.waitForSelector('#goSignin'); await p.locator('#goSignin').tap(); await p.waitForSelector('#siEmail');
await p.locator('#siEmail').fill('steve@example.com'); await p.locator('#siSend').tap(); await p.waitForSelector('#siCodeWrap:not([hidden])'); await p.locator('#siCode').fill('123456'); await p.waitForSelector('#youCard',{timeout:8000});
await p.goto(B+'#/settings'); await p.waitForSelector('#shareProfile'); await p.locator('#shareProfileCard').scrollIntoViewIfNeeded(); await p.evaluate(()=>scrollBy(0,-200));
await p.screenshot({path:O+'share-button.png'});
await p.evaluate(()=>{ window.__shared=null; navigator.share=async o=>{window.__shared=o; const d=document.createElement('div'); d.id='fakeShare'; d.style.cssText='position:fixed;left:0;right:0;bottom:0;background:#1c1c1e;color:#fff;padding:20px 18px 40px;border-radius:16px 16px 0 0;z-index:9999;font:15px -apple-system,sans-serif'; d.innerHTML='<div style="opacity:.6;font-size:12px;margin-bottom:6px">iOS share sheet (simulated)</div><b>'+o.text+'</b><div style="color:#4ea3ff;margin-top:6px;word-break:break-all">'+o.url+'</div><div style="display:flex;gap:18px;margin-top:16px;opacity:.85">💬 Messages &nbsp; 📋 Copy &nbsp; 📸 Instagram &nbsp; ✉️ Mail</div>'; document.body.appendChild(d);}; });
await p.locator('#shareProfile').tap(); await p.waitForTimeout(800);
await p.screenshot({path:O+'share-sheet.png'}); const sh=await p.evaluate(()=>window.__shared); console.log('shared',JSON.stringify(sh)); await c.close();
const code=new URL(sh.url).searchParams.get('add');
// B: new user opens link
[c,p]=await mk(); await p.goto(B); await p.evaluate(()=>localStorage.clear());
await p.evaluate(code=>{window.__mockSb.addUser({name:'Steve',invite:code})},code);
await p.goto(B+'?add='+code+'&n=Steve'); await p.waitForTimeout(1500); await p.screenshot({path:O+'share-invite-new.png'});
console.log('url after',p.url()); await c.close();
// C: existing user opens link
[c,p]=await mk(); await p.goto(B); await p.evaluate(([d,s])=>{localStorage.clear();d.profile.name='Alex';localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',s)},[db0,seen]);
await p.evaluate(code=>{window.__mockSb.addUser({name:'Steve',invite:code})},code);
await p.goto(B+'?add='+code+'&n=Steve'); await p.waitForSelector('#invGo',{timeout:8000}); await p.waitForTimeout(500); await p.screenshot({path:O+'share-add-prompt.png'});
console.log('url after',p.url(), await p.locator('#inviteView').innerText()); await br.close();
