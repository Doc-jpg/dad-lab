# Dad Lab icon: deep slate square, a copper "D" ring with a bar through it (a band around a bar) and a small
# teal check tick. Distinct from Athletic Lab (navy with an orange bolt), Dugout Dad (green) and Dugout Lab
# (navy diamond). Drawn at 4x then downsampled.
from PIL import Image, ImageDraw
import sys, os
out = sys.argv[1]
SLATE = (36, 59, 94); COPPER = (192, 112, 58); TEAL = (15, 107, 107); CREAM = (246, 244, 239)

def icon(size, pad_ratio, rounded):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.225, fill=SLATE)
    else: d.rectangle([0, 0, S - 1, S - 1], fill=SLATE)
    p = pad_ratio * S
    cx = cy = S / 2
    # the band: a thick copper ring, open at the bottom right
    w = max(6, int(S * 0.085))
    r = S * 0.30 - p * 0.5
    d.arc([cx - r, cy - r, cx + r, cy + r], start=300, end=240, fill=COPPER, width=w)
    # the bar through it
    bw = max(5, int(S * 0.07))
    d.line([(cx - r * 1.15, cy), (cx + r * 1.15, cy)], fill=CREAM, width=bw)
    d.ellipse([cx - r * 1.15 - bw, cy - bw, cx - r * 1.15 + bw, cy + bw], fill=CREAM)
    d.ellipse([cx + r * 1.15 - bw, cy - bw, cx + r * 1.15 + bw, cy + bw], fill=CREAM)
    # the tick: every day
    tw = max(5, int(S * 0.06))
    d.line([(cx + r * 0.35, cy + r * 0.55), (cx + r * 0.62, cy + r * 0.85), (cx + r * 1.1, cy + r * 0.3)], fill=TEAL, width=tw, joint='curve')
    return img.resize((size, size), Image.LANCZOS)

for name, size, pad, rounded in [('icon-192.png', 192, 0.03, True), ('icon-512.png', 512, 0.03, True), ('icon-512-maskable.png', 512, 0.12, False), ('apple-touch-icon.png', 180, 0.04, False), ('favicon.png', 64, 0.03, True)]:
    icon(size, pad, rounded).save(os.path.join(out, name))
print('ok')
