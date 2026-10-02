"""Builds the Discipline > Motivation brand SVGs with all text converted to outlines (no font needed at runtime).
Fonts used (OFL / Liberation, local): Liberation Serif (Times-metric) for the D > M mark, Josefin Sans for the banner,
Arvo Bold for the TRAINING LOG lockup."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib import instancer
import os
G = '/usr/share/fonts/truetype/sand-box/google'
OUT = os.path.dirname(os.path.abspath(__file__))
WHITE, BLACK, RED = '#FFFFFF', '#0B0B0C', '#E8392F'

def load(path, wght=None):
    f = TTFont(path)
    if wght and 'fvar' in f: f = instancer.instantiateVariableFont(f, {'wght': wght})
    return f
SERIF_B = load('/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf')
SERIF_R = load('/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf')
JOSEFIN = load(f'{G}/Josefin Sans/JosefinSans-VariableFont_wght.ttf', 600)
ARVO = load(f'{G}/Arvo/Arvo-Bold.ttf')
JOSEFIN_B = load(f'{G}/Josefin Sans/JosefinSans-VariableFont_wght.ttf', 700)

def run(font, text, size, tracking=0.0):
    """Return (list of (glyphname, x)), advance width in px. tracking = extra space per char in em."""
    cmap, hmtx, upm = font.getBestCmap(), font['hmtx'], font['head'].unitsPerEm
    s = size / upm; x = 0; out = []
    for i, ch in enumerate(text):
        g = cmap.get(ord(ch)) or cmap.get(32)
        out.append((g, x)); adv = hmtx[g][0] * s
        x += adv + (tracking * size if i < len(text) - 1 else 0)
    return out, x, s

def text_path(font, text, size, x0, baseline, tracking=0.0, anchor='start'):
    glyphs, width, s = run(font, text, size, tracking)
    if anchor == 'middle': x0 -= width / 2
    elif anchor == 'end': x0 -= width
    gs = font.getGlyphSet(); pen = SVGPathPen(gs)
    for g, x in glyphs:
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x0 + x, baseline)))
    return pen.getCommands(), width

def cap_height(font, size):
    os2 = font['OS/2']; upm = font['head'].unitsPerEm
    ch = getattr(os2, 'sCapHeight', 0) or upm * 0.7
    return ch * size / upm

def save(name, w, h, body, title):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
    open(os.path.join(OUT, name), 'w').write(svg); print('wrote', name, len(svg), 'bytes')

# ---- 1. D > M mark ----
def dm_mark(W, H, caption=True, bg=True, radius=0, pad_scale=1.0, rule_w=None, cw_frac=0.80, txt_frac=0.86):
    """Centered D > M with rules above/below and optional caption. pad_scale<1 shrinks content into a safe zone."""
    cx = W / 2; body = ''
    if bg: body += f'<rect width="{W}" height="{H}" rx="{radius}" fill="{BLACK}"/>'
    cw = W * cw_frac * pad_scale  # content width
    size = cw / 2.6  # tuned so "D > M" spans ~cw
    _, tw, _ = run(SERIF_B, 'D > M', size)
    size *= cw / tw * txt_frac
    capH = cap_height(SERIF_B, size)
    rule = max(1.5, size * 0.022) if rule_w is None else rule_w
    gap = size * 0.16
    capsize = size * 0.155
    capC = cap_height(SERIF_R, capsize)
    total = rule + gap + capH + gap + rule + ((gap * 0.9 + capC) if caption else 0)
    top = (H - total) / 2
    rx0, rx1 = cx - cw / 2, cx + cw / 2
    body += f'<rect x="{rx0:.1f}" y="{top:.1f}" width="{cw:.1f}" height="{rule:.2f}" fill="{WHITE}"/>'
    base = top + rule + gap + capH
    d, _ = text_path(SERIF_B, 'D > M', size, cx, base, anchor='middle')
    body += f'<path d="{d}" fill="{WHITE}"/>'
    y2 = base + gap
    body += f'<rect x="{rx0:.1f}" y="{y2:.1f}" width="{cw:.1f}" height="{rule:.2f}" fill="{WHITE}"/>'
    if caption:
        d, w = text_path(SERIF_R, 'DISCIPLINE > MOTIVATION', capsize, 0, 0, tracking=0.02)
        # fit caption to rule width
        k = min(1.0, cw * 0.96 / w); cs = capsize * k
        d, _ = text_path(SERIF_R, 'DISCIPLINE > MOTIVATION', cs, cx, y2 + rule + gap * 0.9 + cap_height(SERIF_R, cs), tracking=0.02, anchor='middle')
        body += f'<path d="{d}" fill="{WHITE}"/>'
    return body

save('dm-logo.svg', 800, 384, dm_mark(800, 384, caption=True, radius=22), 'D > M · Discipline > Motivation')
save('dm-mark-square.svg', 512, 512, dm_mark(512, 512, caption=True, cw_frac=0.86, txt_frac=0.92), 'D > M')
save('dm-mark-square-nocaption.svg', 512, 512, dm_mark(512, 512, caption=False, cw_frac=0.86, txt_frac=0.94, rule_w=12), 'D > M')
# maskable: everything inside the central 80% safe circle (radius 205 of 256)
save('dm-mark-maskable.svg', 512, 512, dm_mark(512, 512, caption=True, pad_scale=0.80, cw_frac=0.86, txt_frac=0.92), 'D > M (maskable)')
save('dm-mark-maskable-nocaption.svg', 512, 512, dm_mark(512, 512, caption=False, pad_scale=0.80, cw_frac=0.86, txt_frac=0.94, rule_w=10), 'D > M (maskable)')
save('dm-mark-transparent.svg', 512, 512, dm_mark(512, 512, caption=True, bg=False), 'D > M')

# ---- 2. wide banner ----
def banner(W=1200, H=180, bg=True):
    body = f'<rect width="{W}" height="{H}" fill="{BLACK}"/>' if bg else ''
    stroke = H * 0.075; inset = stroke / 2 + H * 0.06
    body += f'<rect x="{inset:.1f}" y="{inset:.1f}" width="{W-2*inset:.1f}" height="{H-2*inset:.1f}" fill="none" stroke="{WHITE}" stroke-width="{stroke:.1f}"/>'
    # ">" is set smaller like the original
    size = H * 0.40; track = 0.14
    parts = [('DISCIPLINE', 1.0), (' ', 1.0), ('>', 0.72), (' ', 1.0), ('MOTIVATION', 1.0)]
    widths = [run(JOSEFIN, t, size * k, track)[1] + track * size for t, k in parts]
    total = sum(widths) - track * size
    target = (W - 2 * inset) * 0.86
    sc = target / total; size *= sc; widths = [w * sc for w in widths]
    x = (W - target) / 2; capH = cap_height(JOSEFIN, size); base = H / 2 + capH / 2
    for (t, k), w in zip(parts, widths):
        if t.strip():
            d, _ = text_path(JOSEFIN, t, size * k, x, base - (capH - cap_height(JOSEFIN, size*k)) / 2 if k != 1 else base, track)
            body += f'<path d="{d}" fill="{WHITE}"/>'
        x += w
    return body
save('banner-logo.svg', 1200, 180, banner(), 'Discipline > Motivation')
save('banner-logo-transparent.svg', 1200, 180, banner(bg=False), 'Discipline > Motivation')

# ---- 3. TRAINING LOG lockup (cover motif) ----
def training_log(W=900, H=300, color=WHITE, accent=RED):
    body = ''
    # dumbbell icon
    cx, cy, u = W / 2, H * 0.2, H * 0.06
    plates = [(-5.2, 1.1, 2.6), (-3.9, 1.1, 3.6), (2.8, 1.1, 3.6), (4.1, 1.1, 2.6)]
    for dx, w, hgt in plates:
        body += f'<rect x="{cx+dx*u:.1f}" y="{cy-hgt*u/2:.1f}" width="{w*u:.1f}" height="{hgt*u:.1f}" rx="{u*0.25:.1f}" fill="{color}"/>'
    body += f'<rect x="{cx-2.8*u:.1f}" y="{cy-0.35*u:.1f}" width="{5.6*u:.1f}" height="{0.7*u:.1f}" fill="{color}"/>'
    size = H * 0.30
    d, w = text_path(ARVO, 'TRAINING LOG', size, 0, 0, 0.02)
    k = min(1, W * 0.94 / w); size *= k
    base = H * 0.40 + cap_height(ARVO, size)
    d, w = text_path(ARVO, 'TRAINING LOG', size, W / 2, base, 0.02, 'middle')
    body += f'<path d="{d}" fill="{color}"/>'
    s2 = size * 0.30
    d2, w2 = text_path(JOSEFIN_B, 'TRACK YOUR PROGRESS', s2, W / 2, base + s2 * 1.55, 0.28, 'middle')
    body += f'<path d="{d2}" fill="{accent}"/>'
    return body
save('training-log-lockup.svg', 900, 300, training_log(), 'Training Log · Track your progress')
