import { chromium } from 'playwright';
const B = 'http://localhost:8787/';
const b = await chromium.launch(); const p = await b.newPage({ viewport:{ width:1200, height:540 } });
await p.goto(B + 'manifest.webmanifest'); await p.setContent(`<html><head><style>
@font-face{font-family:Barlow;src:url(${B}brand/fonts/Barlow-Regular.ttf)}
body{margin:0;background:#111;color:#9a9a9a;font:15px Barlow,sans-serif;padding:36px}
.row{display:flex;gap:34px;align-items:flex-end;margin-bottom:34px}
figure{margin:0;text-align:center} figcaption{margin-top:10px;letter-spacing:.06em}
img{display:block} .sq{border-radius:22%} .circ{border-radius:50%}
.safe{position:relative}.safe::after{content:'';position:absolute;left:20px;top:20px;width:160px;height:160px;border-radius:50%;border:2px dashed #6fd3a8}
.wm{background:#111;padding:20px 0} .light{background:#fff;padding:20px;border-radius:10px}
</style></head><body>
<div class="wm"><img src="${B}brand/wordmark-header.svg" style="width:660px"></div>
<div class="row" style="margin-top:20px">
<figure><img src="${B}icons/icon-512.png" width="200" height="200"><figcaption>icon-512 (any)</figcaption></figure>
<figure><img class="sq" src="${B}icons/apple-touch-icon.png" width="180" height="180"><figcaption>apple-touch 180 (iOS mask)</figcaption></figure>
<figure class="safe"><img src="${B}icons/icon-maskable-512.png" width="200" height="200"><figcaption>maskable 512 + safe zone</figcaption></figure>
<figure><img class="circ" src="${B}icons/icon-maskable-512.png" width="200" height="200"><figcaption>maskable, circle mask</figcaption></figure>
<figure><img src="${B}icons/icon-192.png" width="96" height="96"><figcaption>192</figcaption></figure>
</div>
<div class="row">
<figure><img src="${B}icons/favicon-32.png" width="32" height="32" style="margin:auto"><figcaption>favicon 32</figcaption></figure>
<figure><img src="${B}icons/favicon-16.png" width="16" height="16" style="margin:auto"><figcaption>favicon 16</figcaption></figure>
<figure><img src="${B}icons/favicon-32.png" width="96" height="96" style="image-rendering:pixelated"><figcaption>32 @3×</figcaption></figure>
<figure class="light"><img src="${B}brand/wordmark_transparent_for_light_bg.svg" style="width:420px"></figure>
</div></body></html>`);
await p.waitForTimeout(500);
await p.screenshot({ path:'/workspace/bjj-tracker/brand/icon-preview.png', fullPage:true });
await b.close();
