// Tighten an SVG's viewBox to its painted content (getBBox) plus padding. Usage: node tightsvg.mjs pad file.svg...
import { chromium } from 'playwright'; import fs from 'fs';
const [pad, ...files] = process.argv.slice(2); const b = await chromium.launch(); const p = await b.newPage();
for (const f of files) { let s = fs.readFileSync(f, 'utf8'); await p.setContent(s);
  const bb = await p.evaluate(() => { const sv = document.querySelector('svg'); const r = [...sv.children].filter(c => c.tagName !== 'defs').map(c => c.getBBox()); const x = Math.min(...r.map(q => q.x)), y = Math.min(...r.map(q => q.y)); return { x, y, w:Math.max(...r.map(q => q.x + q.width)) - x, h:Math.max(...r.map(q => q.y + q.height)) - y }; });
  // getBBox ignores transforms on the element itself; groups/paths with transform attr: use getBoundingClientRect at 1:1 instead
  const bc = await p.evaluate(() => { const sv = document.querySelector('svg'); sv.setAttribute('viewBox', '-2000 -2000 6000 6000'); sv.setAttribute('width', 6000); sv.setAttribute('height', 6000); const r = [...sv.children].filter(c => c.tagName !== 'defs').map(c => c.getBoundingClientRect()); const x = Math.min(...r.map(q => q.left)) - 2000, y = Math.min(...r.map(q => q.top)) - 2000; return { x, y, w:Math.max(...r.map(q => q.right)) - 2000 - x, h:Math.max(...r.map(q => q.bottom)) - 2000 - y }; });
  const P = Number(pad), vb = [bc.x - P, bc.y - P, bc.w + 2*P, bc.h + 2*P].map(v => Math.round(v*10)/10);
  s = s.replace(/viewBox="[^"]*"/, `viewBox="${vb.join(' ')}"`).replace(/ width="[^"]*" height="[^"]*"/, ` width="${Math.round(vb[2])}" height="${Math.round(vb[3])}"`);
  fs.writeFileSync(f, s); console.log(f, vb.join(' ')); }
await b.close();
