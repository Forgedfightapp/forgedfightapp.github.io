import { chromium, devices } from 'playwright'; import fs from 'fs';
const O='/workspace/forged-shots/'; const br=await chromium.launch();
// landing page
let c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}}); let p=await c.newPage();
await p.route('https://forgedfight.com/u/**',r=>r.fulfill({status:404,contentType:'text/html',body:fs.readFileSync('/workspace/forgedfight-site/404.html','utf8')}));
await p.route('https://forgedfightapp.github.io/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<p>app</p>'}));
await p.goto('https://forgedfight.com/u/crusher_caldwell'); await p.waitForTimeout(300); await p.screenshot({path:O+'share-landing.png'}); console.log(await p.locator('body').innerText());
await p.waitForTimeout(1500); console.log('redirect ->',p.url()); await c.close();
// Invite friends sheet from Friends card
const MOCK=fs.readFileSync('./mock-supabase.js','utf8'), B='http://localhost:8787/';
c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}}); await c.addInitScript(()=>{window.FORGED_CONFIG={social:true};window.__FORGED_QUIET_MEDALS=true;}); await c.addInitScript(MOCK); p=await c.newPage();
const d={schema:7,sessions:[],profile:{name:'CRUSHER CALDWELL',unit:'lb',distUnit:'mi',setupDone:true,tips:false,enabled:{grappling:true,food:false}},nutrition:{entries:[],foods:[],water:[]},weights:[],belts:[],comps:[],injuries:[],strength:[]};
await p.goto(B); await p.evaluate(d=>{localStorage.clear();localStorage.setItem('forged.uname.preview','1');localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',JSON.stringify({home:1,weight:1,friends:1,settings:1,badges:1,rank:1}))},d); await p.reload();
await p.goto(B+'#/friends'); await p.waitForSelector('#goSignin'); await p.locator('#goSignin').tap(); await p.waitForSelector('#siEmail');
await p.locator('#siEmail').fill('steve@example.com'); await p.locator('#siNma input').check(); await p.locator('#siSend').tap(); await p.waitForSelector('#siCodeWrap:not([hidden])'); await p.locator('#siCode').fill('123456'); await p.waitForSelector('#youCard',{timeout:8000});
await p.evaluate(()=>localStorage.setItem('forged.social.uname','"crusher_caldwell"')); await p.reload(); await p.waitForSelector('#shareUname'); await p.locator('#unameCard').scrollIntoViewIfNeeded();
await p.evaluate(()=>{ navigator.share=async o=>{window.__shared=o; const d=document.createElement('div'); d.style.cssText='position:fixed;left:0;right:0;bottom:0;background:#1c1c1e;color:#fff;padding:20px 18px 40px;border-radius:16px 16px 0 0;z-index:9999;font:15px -apple-system,sans-serif'; d.innerHTML='<div style="opacity:.6;font-size:12px;margin-bottom:6px">iOS share sheet (simulated)</div><b>'+o.text+'</b><div style="color:#4ea3ff;margin-top:6px;word-break:break-all">'+o.url+'</div><div style="margin-top:16px;opacity:.85">💬 Messages &nbsp; 📋 Copy &nbsp; 📸 Instagram &nbsp; ✉️ Mail</div>'; document.body.appendChild(d);}; });
await p.locator('#shareUname').tap(); await p.waitForTimeout(600); await p.screenshot({path:O+'share-invite-friends-sheet.png'}); console.log(JSON.stringify(await p.evaluate(()=>window.__shared))); await br.close();
