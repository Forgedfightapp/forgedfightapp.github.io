import { chromium, devices } from 'playwright';
const BASE='http://localhost:8787/';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
const p=await ctx.newPage(); await p.goto(BASE); await p.locator('#loadSample').tap(); await p.waitForSelector('#weekCard'); await p.waitForTimeout(1200);
for (const r of ['','settings','stats']){ await p.goto(BASE+'#/'+r); await p.waitForTimeout(800); await p.screenshot({path:`/tmp/a-${r||'home'}.png`,fullPage:true}); console.log(r, (await p.evaluate(()=>[...document.querySelectorAll('#view h2')].map(h=>h.innerText.split('\n')[0]).join(' | '))));}
await b.close();
