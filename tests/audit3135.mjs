import { chromium, devices } from 'playwright';
const BASE='http://localhost:8787/';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE); await p.locator('#loadSample').tap(); await p.waitForSelector('#weekCard'); await p.waitForTimeout(1200);
const RE=/\b(badges?|medals?|ranks?|levels?|XP|unlock\w*|looks?|flair|Pro\b|Pro week|supplements?|supps|drilling|jump rope|promotion hours)\b/gi;
const routes=['','history','stats','food','settings','challenges','friends','belts','comps','benchmarks','programs','log','rank','badges','pro','signin'];
for (const r of routes){ await p.goto(BASE+'#/'+r); await p.waitForTimeout(700);
  const t=await p.evaluate(()=>document.body.innerText);
  const lines=t.split('\n').filter(l=>RE.test(l)&&(RE.lastIndex=0,true)); RE.lastIndex=0;
  const hits=[...new Set(t.split('\n').filter(l=>{RE.lastIndex=0;return RE.test(l)}))];
  console.log('## /'+r, '->', await p.evaluate(()=>location.hash)); hits.forEach(h=>console.log('   ',h.slice(0,160)));
}
console.log('errors',errs); await b.close();
