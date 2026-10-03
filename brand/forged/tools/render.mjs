// Render SVG -> PNG at exact pixel size using headless Chromium. Usage: node render.mjs in.svg out.png W H
import { chromium } from 'playwright';
import fs from 'fs';
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = await chromium.launch(); const p = await b.newPage();
for (const [inp, out, w, h] of jobs) {
  const svg = fs.readFileSync(inp, 'utf8');
  await p.setViewportSize({ width:w, height:h });
  await p.setContent(`<html><body style="margin:0;background:transparent"><img style="display:block;width:${w}px;height:${h}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  await p.waitForFunction(() => document.images[0].complete);
  await p.screenshot({ path:out, omitBackground:true, clip:{x:0,y:0,width:w,height:h} });
  console.log('rendered', out, w, h);
}
await b.close();
