import { chromium } from 'playwright';
const B = 'http://localhost:8787/brand/forged/';
const b = await chromium.launch(); const p = await b.newPage({ viewport:{ width:1200, height:820 }, deviceScaleFactor:1 });
await p.setContent(`<body style="margin:0;background:#1c1c1e;font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#aaa;padding:32px">
<div style="display:flex;gap:36px;align-items:flex-end">
 <figure style="margin:0"><img src="${B}icon-1024.png" width="300" height="300" style="border-radius:67px;display:block"><figcaption>iOS home screen (1024, rounded by iOS)</figcaption></figure>
 <figure style="margin:0"><img src="${B}icon-maskable-512.png" width="220" height="220" style="border-radius:50%;display:block"><figcaption>Android maskable (circle mask)</figcaption></figure>
 <figure style="margin:0"><img src="${B}icon-maskable-512.png" width="220" height="220" style="border-radius:44px;display:block"><figcaption>maskable (squircle)</figcaption></figure>
 <figure style="margin:0"><img src="${B}apple-touch-icon.png" width="60" height="60" style="border-radius:13px;display:block"><figcaption>60pt</figcaption></figure>
 <figure style="margin:0"><img src="${B}favicon-32.png" width="32" height="32" style="display:block"><img src="${B}favicon-16.png" width="16" height="16" style="display:block;margin-top:6px"><figcaption>favicons</figcaption></figure>
</div>
<div style="display:flex;gap:30px;margin-top:34px;align-items:center">
 <div style="background:#0B0B0C;padding:26px 30px;border-radius:16px"><img src="${B}wordmark.svg" style="height:150px;display:block"></div>
 <div style="background:#f4f4f4;padding:26px 30px;border-radius:16px"><img src="${B}wordmark-light-bg.svg" style="height:110px;display:block"></div>
</div>
<div style="display:flex;gap:30px;margin-top:30px;align-items:center">
 <div style="background:#0B0B0C;padding:18px 22px;border-radius:12px"><img src="${B}wordmark-header.svg" style="height:40px;display:block"><div style="font:600 11px Barlow,sans-serif;letter-spacing:.24em;color:#9c9c9c;margin-top:8px">FOR THE FIGHT</div><figcaption style="margin-top:8px">app header</figcaption></div>
 <div style="display:flex;gap:10px">${['#F2711C','#F58A45','#0B0B0C','#9C9C9C','#F4F4F4'].map(c => `<div style="text-align:center"><div style="width:70px;height:46px;border-radius:8px;background:${c};border:1px solid #333"></div>${c}</div>`).join('')}</div>
</div></body>`);
await p.waitForTimeout(800); await p.screenshot({ path:'/workspace/bjj-tracker/brand/forged/icon-preview.png', fullPage:true }); await b.close();
