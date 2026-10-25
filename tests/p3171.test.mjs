// 3.17.1: iOS black camera preview. Video must be live-document, playsinline/webkit-playsinline/muted/autoplay before srcObject, play() awaited,
// frames actually painting, and a real EAN-13 decoding end to end. Runs on Chromium and WebKit (fake camera = canvas.captureStream drawing a barcode).
import { chromium, webkit, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8787/', SHOTS = process.env.SHOTS || '/workspace/forged-shots';
const results = []; const ok = (n, c, x='') => { results.push(`${c?'PASS':'FAIL'} ${n} ${c?'':x}`); if (!c) process.exitCode = 1; };
const CAM = () => {
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'], G = L.map(c => [...c].map(b => b === '1' ? '0' : '1').reverse().join('')), R = L.map(c => [...c].map(b => b === '1' ? '0' : '1').join(''));
  const P = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'], n = '4006381333931'.split('').map(Number);
  let bits = '101'; for (let i = 1; i < 7; i++) bits += (P[n[0]][i-1] === 'L' ? L : G)[n[i]]; bits += '01010'; for (let i = 7; i < 13; i++) bits += R[n[i]]; bits += '101';
  window.__plays = 0; const op = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function(){ window.__plays++; window.__attrsAtPlay = ['playsinline','webkit-playsinline','muted','autoplay'].filter(a => this.hasAttribute(a)).join(','); return op.call(this); };
  const od = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable:true, get(){ return od.get.call(this); }, set(s){ window.__attrsAtSrc = ['playsinline','webkit-playsinline','muted','autoplay'].filter(a => this.hasAttribute(a)).join(',') + (this.muted ? '|muted-prop' : '') + (this.isConnected && this.ownerDocument === document ? '|live-doc' : ''); od.set.call(this, s); } });
  window.__hold = false;
  navigator.mediaDevices = navigator.mediaDevices || {};
  window.addEventListener('unhandledrejection', e => window.__err = String(e.reason)); const gum = async () => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480; const x = cv.getContext('2d'); let t = 0;
    const draw = () => { t++; x.fillStyle = '#fff'; x.fillRect(0, 0, 640, 480); x.fillStyle = '#000'; if (!window.__hold) [...bits].forEach((b, i) => { if (b === '1') x.fillRect(110 + i * 4, 140, 4, 200); }); x.fillStyle = `hsl(${t*7%360},90%,50%)`; x.fillRect(0, 0, 40, 40); requestAnimationFrame(draw); };
    draw(); return cv.captureStream(30); };
  Object.defineProperty(MediaDevices.prototype, 'getUserMedia', { configurable:true, writable:true, value:gum }); try { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable:true, value:gum }); } catch(e) {}
  try { delete window.BarcodeDetector; } catch(e) {}
};
for (const [name, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  let b; try { b = await bt.launch(); } catch(e) { ok(`${name}: launch`, false, e.message.split('\n')[0]); continue; }
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile: name !== 'webkit' ? true : undefined, hasTouch:true, userAgent:devices['iPhone 13'].userAgent });
  await ctx.route(/supabase\.co|openfoodfacts/, r => r.abort()); await ctx.addInitScript(CAM);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'sw.js'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dm.bjj.v1', JSON.stringify({ schema:7, sessions:[], profile:{ setupDone:true, unit:'lb', enabled:{ grappling:true, food:true } }, nutrition:{ entries:[], foods:[], water:[] }, weights:[], belts:[] })); window.__hold = true; });
  await page.goto(BASE + '#/food'); await page.waitForSelector('[data-add]'); await page.evaluate(() => { window.__hold = true; });
  await page.locator('[data-add]').first().click(); await page.waitForTimeout(400); await page.locator('#fpScan').click();
  await page.waitForSelector('#scVideo', { timeout:8000 }).catch(() => {}); await page.waitForTimeout(1500);
  const st = await page.evaluate(() => { const v = document.querySelector('#scVideo'); if (!v) return null; const r = v.getBoundingClientRect();
    return { attrsSrc:window.__attrsAtSrc, attrsPlay:window.__attrsAtPlay, plays:window.__plays, paused:v.paused, rs:v.readyState, vw:v.videoWidth, w:r.width, h:r.height, live:v.ownerDocument === document }; });
  ok(`${name}: video built in the live document with playsinline, webkit-playsinline, muted, autoplay set before srcObject`, st && /playsinline,webkit-playsinline,muted,autoplay\|muted-prop\|live-doc/.test(st.attrsSrc), JSON.stringify(st));
  ok(`${name}: play() called and video playing`, st && st.plays >= 1 && !st.paused && st.rs >= 2, JSON.stringify(st));
  ok(`${name}: frames render (videoWidth 640, visible size)`, st && st.vw === 640 && st.w > 300 && st.h > 200, JSON.stringify(st));
  const px = await page.evaluate(async () => { const v = document.querySelector("#scVideo"); if (!v || !v.videoWidth) return { a:[], b2:[], mid:[0], none:!v, err:String(window.__err||"") }; const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d');
    const a = (x.drawImage(v, 0, 0, 64, 48), [...x.getImageData(2, 2, 1, 1).data]); await new Promise(r => setTimeout(r, 300)); const b2 = (x.drawImage(v, 0, 0, 64, 48), [...x.getImageData(2, 2, 1, 1).data]); const mid = [...x.getImageData(40, 30, 1, 1).data];
    return { a, b2, mid }; });
  ok(`${name}: preview pixels are not black and change between frames`, px.mid[0] > 200 && px.a.join() !== px.b2.join(), JSON.stringify(px));
  if (name === 'webkit') await page.screenshot({ path:`${SHOTS}/p3171-scan.png` });
  await page.evaluate(() => { window.__hold = false; }); await page.waitForTimeout(2500);
  const code = await page.locator('#scCode').inputValue().catch(() => '');
  ok(`${name}: live EAN-13 decodes from the camera stream (ZXing, no BarcodeDetector)`, code === '4006381333931', code);
  ok(`${name}: no page errors`, !errs.length, errs.join(' | '));
  await b.close();
}
console.log(results.join('\n'));
