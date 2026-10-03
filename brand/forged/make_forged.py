#!/usr/bin/env python3
"""FORGED brand assets: anvil+flame mark (hand-built SVG) and wordmark text converted to outlines."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import os, json
HERE = os.path.dirname(os.path.abspath(__file__))
ORANGE = '#F2711C'; ORANGE_DK = '#C94F0C'; ORANGE_LT = '#FF9A3D'; BG = '#0B0B0C'; GRAY = '#9C9C9C'; WHITE = '#F4F4F4'

def text_path(fontfile, text, size, x0=0, y0=0, tracking=0):
    f = TTFont(fontfile); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm; s = size / upm
    pen = SVGPathPen(gs); x = 0
    for ch in text:
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, x0 + x, y0)); gs[g].draw(tp)
        x += gs[g].width * s + tracking
    return pen.getCommands(), x - tracking

MARK_DEFS = f'''<linearGradient id="fgSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9EBEE"/><stop offset=".45" stop-color="#A9AEB5"/><stop offset="1" stop-color="#5E636B"/></linearGradient>
<linearGradient id="fgSteelH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F5F6F7"/><stop offset=".55" stop-color="#B9BDC3"/><stop offset="1" stop-color="#7C8189"/></linearGradient>
<linearGradient id="fgTop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C9CDD2"/></linearGradient>
<linearGradient id="fgSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E939A"/><stop offset="1" stop-color="#3F434A"/></linearGradient>
<linearGradient id="fgBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C3C7CC"/><stop offset=".5" stop-color="#8A8F96"/><stop offset="1" stop-color="#4B4F56"/></linearGradient>
<linearGradient id="fgFlame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="{ORANGE_DK}"/><stop offset=".45" stop-color="{ORANGE}"/><stop offset="1" stop-color="{ORANGE_LT}"/></linearGradient>
<linearGradient id="fgCore" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#FFF4E8"/><stop offset="1" stop-color="#FFD9B0"/></linearGradient>'''

# mark drawn in a 512 box, bbox ~ x 72..420, y 64..448
MARK_BODY = '''<path d="M232 294C210 266 208 228 228 196C232 214 242 224 252 228C244 190 258 146 290 112C284 146 294 168 312 182C318 150 330 122 318 64C356 104 374 150 366 198C376 188 382 172 384 156C406 194 404 248 374 294Z" fill="url(#fgFlame)"/>
<path d="M256 294C242 270 244 240 262 216C264 234 272 244 282 248C280 216 294 186 316 162C312 190 320 208 334 218C342 204 346 190 344 176C362 210 362 258 346 294Z" fill="url(#fgCore)"/>
<path d="M292 294C282 278 284 260 296 244C300 256 306 262 314 264C316 250 322 240 330 232C336 254 334 276 326 294Z" fill="#FFFFFF" opacity=".9"/>
<path d="M216 286H420L404 300H200Z" fill="url(#fgTop)"/>
<path d="M404 300L420 286V326L404 340Z" fill="url(#fgSide)"/>
<path d="M200 300H404V340H200Z" fill="url(#fgSteelH)"/>
<path d="M216 286C176 288 120 298 72 318C116 306 164 301 200 300Z" fill="#FFFFFF"/>
<path d="M200 300C162 301 114 306 72 318C116 326 160 338 200 352Z" fill="url(#fgSteelH)"/>
<path d="M226 340H382C366 356 354 374 352 398C360 410 380 414 398 420V448H330C322 436 306 432 301 432C296 432 280 436 272 448H204V420C222 414 242 410 250 398C248 374 238 356 226 340Z" fill="url(#fgBase)"/>
<path d="M204 420H398" stroke="#E2E4E7" stroke-width="2" opacity=".55"/>
<path d="M200 300H404" stroke="#FFFFFF" stroke-width="1.5" opacity=".7"/>'''
MARK_BBOX = (70, 62, 352, 388)  # x, y, w, h

def mark_group(cx, cy, size):
    x, y, w, h = MARK_BBOX; s = size / max(w, h)
    return f'<g transform="translate({cx - (x + w/2)*s:.2f} {cy - (y + h/2)*s:.2f}) scale({s:.4f})">{MARK_BODY}</g>'

def svg(w, h, body, defs=MARK_DEFS):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><defs>{defs}</defs>{body}</svg>\n'

def write(name, s):
    open(os.path.join(HERE, name), 'w').write(s); print('wrote', name)

FORGED_FONT = os.path.join(HERE, 'BarlowCondensed-ExtraBold.ttf')
TAG_FONT = os.path.join(HERE, '..', 'fonts', 'Barlow-SemiBold.ttf')

# mark alone (transparent) + icons
write('forged-mark.svg', svg(512, 512, mark_group(256, 256, 480)))
write('app_icon.svg', svg(1024, 1024, f'<rect width="1024" height="1024" fill="{BG}"/><radialGradient id="glow" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="{ORANGE}" stop-opacity=".22"/><stop offset="1" stop-color="{ORANGE}" stop-opacity="0"/></radialGradient><rect width="1024" height="1024" fill="url(#glow)"/>' + mark_group(512, 520, 800)))
# maskable: keep the mark inside the 80% safe circle (r = 409.6). Mark diagonal must fit: size chosen so the bbox corners stay inside.
write('app_icon_maskable.svg', svg(1024, 1024, f'<rect width="1024" height="1024" fill="{BG}"/><radialGradient id="glow" cx=".5" cy=".42" r=".45"><stop offset="0" stop-color="{ORANGE}" stop-opacity=".2"/><stop offset="1" stop-color="{ORANGE}" stop-opacity="0"/></radialGradient><rect width="1024" height="1024" fill="url(#glow)"/>' + mark_group(512, 516, 600)))
write('favicon.svg', svg(64, 64, f'<rect width="64" height="64" rx="12" fill="{BG}"/>' + mark_group(32, 33, 58)))

# wordmark: text outlines
fp, fw = text_path(FORGED_FONT, 'FORGED', 200, 0, 0, tracking=4)
tp, tw = text_path(TAG_FONT, 'FOR THE FIGHT', 52, 0, 0, tracking=15)
# FORGED cap height for Barlow Condensed ≈ 0.7em -> 140px. Layout: caps from y=0..140, tagline baseline at 140+30+37
cap = 140; tag_cap = 37
def lockup(mark=True, tag=True, color=WHITE, tagcolor=GRAY, msize=None):
    gap = 40 if not msize else 22; mw = (300 if not msize else msize * 0.9) if mark else 0
    textx = (mw + gap) if mark else 0
    width = max(fw, tw)
    # scale tagline to the FORGED width (like the logo)
    ts = fw / tw
    H = cap + (36 + tag_cap * ts if tag else 0)
    body = f'<path d="{fp}" fill="{color}" transform="translate({textx} {cap})"/>'
    if tag: body += f'<path d="{tp}" fill="{tagcolor}" transform="translate({textx} {cap + 36 + tag_cap*ts:.1f}) scale({ts:.4f})"/>'
    if mark: body = mark_group(mw/2, H/2 - 6, msize or max(H, mw) * 1.02) + body
    W = textx + fw
    return W, H, body
W, H, body = lockup()
pad = 16
write('wordmark.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {W+2*pad:.0f} {H+2*pad:.0f}" width="{W+2*pad:.0f}" height="{H+2*pad:.0f}"><defs>{MARK_DEFS}</defs>{body}</svg>\n')
W2, H2, body2 = lockup(mark=False)
write('wordmark-text.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 {W2+4:.0f} {H2+4:.0f}" width="{W2+4:.0f}" height="{H2+4:.0f}">{body2}</svg>\n')
W3, H3, body3 = lockup(mark=True, tag=True, color='#111111', tagcolor='#555555')
write('wordmark-light-bg.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {W3+2*pad:.0f} {H3+2*pad:.0f}" width="{W3+2*pad:.0f}" height="{H3+2*pad:.0f}"><defs>{MARK_DEFS}</defs>{body3}</svg>\n')
# header: mark + FORGED only (tagline is rendered as live text under it)
W4, H4, body4 = lockup(mark=True, tag=False, msize=190)
write('wordmark-header.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -14 {W4+8:.0f} {H4+28:.0f}" width="{W4+8:.0f}" height="{H4+28:.0f}"><defs>{MARK_DEFS}</defs>{body4}</svg>\n')
json.dump([[os.path.join(HERE, a), os.path.join(HERE, b), w, h] for a, b, w, h in [
  ('app_icon.svg','icon-1024.png',1024,1024), ('app_icon.svg','icon-512.png',512,512), ('app_icon.svg','icon-192.png',192,192), ('app_icon.svg','apple-touch-icon.png',180,180),
  ('app_icon_maskable.svg','icon-maskable-512.png',512,512), ('app_icon_maskable.svg','icon-maskable-192.png',192,192),
  ('favicon.svg','favicon-32.png',32,32), ('favicon.svg','favicon-16.png',16,16), ('forged-mark.svg','forged-mark-1024.png',1024,1024)]], open(os.path.join(HERE, 'icon-jobs.json'), 'w'))
