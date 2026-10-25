import { chromium, devices } from 'playwright'; import fs from 'fs';
const B='http://localhost:8787/?uname=1', MOCK=fs.readFileSync('./mock-supabase.js','utf8'), O='/workspace/forged-shots/';
const br=await chromium.launch();
const mk=async()=>{const c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}}); await c.addInitScript(()=>{window.FORGED_CONFIG={social:true};window.__FORGED_QUIET_MEDALS=true;}); await c.addInitScript(MOCK); return [c,await c.newPage()];};
const db0=n=>({schema:7,sessions:[],profile:{name:n,unit:'lb',distUnit:'mi',setupDone:true,tips:false,enabled:{grappling:true,food:false}},nutrition:{entries:[],foods:[],water:[]},weights:[],belts:[],comps:[],injuries:[],strength:[]});
const seen=JSON.stringify({home:1,weight:1,friends:1,settings:1,badges:1,rank:1});
const signin=async(p,email)=>{await p.goto(B+'#/friends'); await p.waitForSelector('#goSignin'); await p.locator('#goSignin').tap(); await p.waitForSelector('#siEmail');
 await p.locator('#siEmail').fill(email); await p.locator('#siSend').tap(); await p.waitForSelector('#siCodeWrap:not([hidden])'); await p.locator('#siCode').fill('123456'); await p.waitForSelector('#youCard',{timeout:8000});};
const setup=async(p,n)=>{await p.goto(B); await p.evaluate(([d,s])=>{localStorage.clear();localStorage.setItem('forged.uname.preview','1');localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',s)},[db0(n),seen]); await p.reload();};
const typ=async(p,v,f)=>{await p.fill('#unIn',v); await p.waitForTimeout(700); const t=await p.locator('#unMsg').innerText(); console.log(f,'|',v,'=>',t); await p.screenshot({path:O+f});};
let [c,p]=await mk(); await setup(p,'CRUSHER CALDWELL');
await p.evaluate(()=>{const m=window.__mockSb; m.addUser({name:'Taken Guy',username:'steve_bjj'}); });
await signin(p,'steve@example.com');
await p.waitForSelector('#unameSheet',{timeout:8000}); await p.waitForTimeout(1500);
console.log('forced:',await p.locator('#unMsg').innerText()); await p.screenshot({path:O+'share-forced-rename.png'});
await typ(p,'steve!','share-err-chars.png'); await typ(p,'st','share-err-short.png'); await typ(p,'steve_the_crusher_caldwell','share-err-long.png');
await typ(p,'steve..bjj','share-err-period.png'); await typ(p,'admin','share-err-reserved.png'); await typ(p,'sh1thead','share-err-offensive.png');
await typ(p,'Steve_BJJ','share-err-taken.png'); await typ(p,'steve caldwell','share-err-space.png'); await typ(p,'Crusher_Caldwell','share-username-claim.png');
await p.locator('#unGo').tap(); await p.waitForTimeout(800);
// friends to search / tag
await p.evaluate(()=>{const m=window.__mockSb; const a=m.addUser({name:'Alex',username:'alex.rolls',belt:'blue'}); const j=m.addUser({name:'Jordan',username:'jordan_bjj'}); const k=m.addUser({name:'Kim',username:'alexa_k',allowTags:false}); m.befriend(m.me(),j); m.befriend(m.me(),k);});
await p.goto(B+'#/settings'); await p.goto(B+'#/friends'); await p.waitForTimeout(1200); await p.waitForSelector('#findUname'); await p.locator('#unameCard').scrollIntoViewIfNeeded();
await p.fill('#findUname','@Alex.Rolls'); await p.locator('#findGo').tap(); await p.waitForSelector('#findAdd'); await p.screenshot({path:O+'share-friend-search.png'});
await p.locator('#findAdd').tap(); await p.waitForTimeout(800);
await p.goto(B+'#/settings'); await p.waitForSelector('#shareProfile'); await p.locator('#shareProfileCard').scrollIntoViewIfNeeded(); await p.evaluate(()=>scrollBy(0,-200)); await p.screenshot({path:O+'share-button.png'});
await p.evaluate(()=>{ navigator.share=async o=>{window.__shared=o; const d=document.createElement('div'); d.id='fakeShare';d.style.cssText='position:fixed;left:0;right:0;bottom:0;background:#1c1c1e;color:#fff;padding:20px 18px 40px;border-radius:16px 16px 0 0;z-index:9999;font:15px -apple-system,sans-serif'; d.innerHTML='<div style="opacity:.6;font-size:12px;margin-bottom:6px">iOS share sheet (simulated)</div><b>'+o.text+'</b><div style="color:#4ea3ff;margin-top:6px;word-break:break-all">'+o.url+'</div><div style="margin-top:16px;opacity:.85">💬 Messages &nbsp; 📋 Copy &nbsp; 📸 Instagram &nbsp; ✉️ Mail</div>'; document.body.appendChild(d);}; });
await p.locator('#shareProfile').tap(); await p.waitForTimeout(700); await p.screenshot({path:O+'share-sheet.png'}); console.log('shared',JSON.stringify(await p.evaluate(()=>window.__shared))); await p.evaluate(()=>document.getElementById('fakeShare').remove());
await p.goto(B+'#/'); await p.goto(B+'#/settings'); await p.waitForSelector('#allowTagsRow'); await p.locator('#allowTagsRow').scrollIntoViewIfNeeded(); await p.evaluate(()=>scrollBy(0,150)); await p.screenshot({path:O+'share-allow-tags.png'});
// tag picker
await p.goto(B+'#/friends'); await p.waitForSelector('#unameCard');
const du=await p.evaluate(()=>{const cv=document.createElement('canvas'); cv.width=600; cv.height=400; const x=cv.getContext('2d'); x.fillStyle='#333'; x.fillRect(0,0,600,400); x.fillStyle='#ff6a2b'; x.font='bold 48px sans-serif'; x.fillText('Open mat',170,215); return cv.toDataURL('image/jpeg');});
const fc=p.waitForEvent('filechooser'); await p.locator('#shareMedia').tap(); (await fc).setFiles({name:'mat.jpg',mimeType:'image/jpeg',buffer:Buffer.from(du.split(',')[1],'base64')});
await p.waitForSelector('#tagIn'); await p.fill('#mediaCap','Rolls tonight'); await p.locator('#tagIn').tap(); await p.fill('#tagIn','@'); await p.waitForTimeout(600);
await p.locator('#tagSug [data-tag="alex.rolls"]').tap(); await p.fill('#tagIn','jo'); await p.waitForTimeout(300); await p.locator('#tagIn').scrollIntoViewIfNeeded(); await p.screenshot({path:O+'share-tag-picker.png'});
console.log('sugs (Kim must be absent):',await p.locator('#tagSug').innerText());
await p.locator('#tagSug [data-tag="jordan_bjj"]').tap({timeout:5000}); await p.locator('#mediaPost').tap({timeout:5000}); await p.waitForTimeout(2000); console.log('toast:',await p.locator('.toast').allInnerTexts().catch(()=>''), 'calls', JSON.stringify(await p.evaluate(()=>window.__mockSb.calls.slice(-4))));
await p.waitForSelector('.mtags',{timeout:5000}); await p.locator('.mpost').first().scrollIntoViewIfNeeded(); await p.screenshot({path:O+'share-tagged-clip.png'}); console.log('tags:',await p.locator('.mtags').first().innerText());
// toggle off removes tags (as jordan? test server logic directly)
await c.close();
// new user via link
[c,p]=await mk(); await p.goto(B); await p.evaluate(()=>{localStorage.clear();localStorage.setItem('forged.uname.preview','1')}); await p.evaluate(()=>window.__mockSb.addUser({name:'CRUSHER',username:'crusher_caldwell'}));
await p.goto('http://localhost:8787/?uname=1&add=crusher_caldwell&n=CRUSHER'); await p.waitForTimeout(1500); await p.screenshot({path:O+'share-invite-new.png'}); console.log('new:',p.url()); await c.close();
// existing user via link
[c,p]=await mk(); await setup(p,'Alex'); await signin(p,'alex@example.com'); await p.evaluate(()=>{window.__mockSb.addUser({name:'CRUSHER',username:'crusher_caldwell',belt:'purple'}); localStorage.setItem('forged.social.uname','"alex.rolls"');});
await p.goto('http://localhost:8787/?uname=1&add=crusher_caldwell&n=CRUSHER'); await p.waitForSelector('#addGo',{timeout:8000}); await p.waitForTimeout(500); await p.screenshot({path:O+'share-add-prompt.png'});
await p.locator('#addGo').tap(); await p.waitForTimeout(1000); console.log('after add:',p.url());
await br.close();
