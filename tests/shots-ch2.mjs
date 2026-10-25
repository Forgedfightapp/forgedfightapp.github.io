import { chromium, devices } from 'playwright';
const B='http://localhost:8787/'; const br=await chromium.launch(); const c=await br.newContext({...devices['iPhone 13'],viewport:{width:390,height:844}}); const p=await c.newPage();
const d={schema:7,sessions:[],profile:{name:'Steve',unit:'lb',distUnit:'mi',setupDone:true,tips:false,enabled:{grappling:true,weights:true,food:true,weight:true}},nutrition:{entries:[],foods:[],water:[]},weights:[],belts:[],comps:[],injuries:[],strength:[],benchmarks:[]};
await p.goto(B); await p.evaluate(d=>{localStorage.clear();localStorage.setItem('dm.bjj.v1',JSON.stringify(d));localStorage.setItem('forged.tut.seen',JSON.stringify({home:1,weight:1,friends:1,settings:1,badges:1,rank:1,challenges:1}))},d); await p.reload();
await p.goto(B+'#/challenges'); await p.waitForTimeout(1000);
const row=()=>p.locator('[data-chtick]').first().locator('xpath=ancestor::div[contains(@class,"list-row")][1]');
const txt=async()=>(await row().innerText()).split('\n').slice(0,3).join(' ');
for(let i=0;i<3;i++){ await p.locator('[data-chtick]').first().tap(); await p.waitForTimeout(250);} 
console.log('3 taps:',await txt(),'|',await p.locator('#toast').innerText());
await row().scrollIntoViewIfNeeded(); await p.evaluate(()=>scrollBy(0,-120)); await p.screenshot({path:'/workspace/forged-shots/challenges-multi-undo.png'});
await p.waitForTimeout(6000); console.log('still visible at 6.7s:',await p.locator('#toast.show').count());
await p.locator('#toast .undo').tap(); await p.waitForTimeout(200); console.log('undo1:',await txt(),'|',await p.locator('#toast').innerText());
await p.locator('#toast .undo').tap(); await p.waitForTimeout(200); console.log('undo2:',await txt());
await p.waitForTimeout(9500); console.log('hidden after 9s:',await p.locator('#toast.show').count()===0);
// daily
await p.locator('[data-chdone]').first().tap(); await p.waitForTimeout(200); console.log('daily toast:',await p.locator('#toast').innerText()); await p.locator('#toast .undo').tap(); await p.waitForTimeout(200); console.log('daily undone, Done buttons:',await p.locator('[data-chdone]').count());
await br.close();
