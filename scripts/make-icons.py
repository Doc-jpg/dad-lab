# Dad Lab icon: deep slate square with a simple flexed arm in cream (an original silhouette: shoulder,
# upper arm, bent forearm, fist) and a small copper band on the forearm. Drawn at 4x then downsampled.
from PIL import Image, ImageDraw
import sys, os
out = sys.argv[1]
SLATE = (36, 59, 94); COPPER = (192, 112, 58); CREAM = (246, 244, 239)

def icon(size, pad_ratio, rounded):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.225, fill=SLATE)
    else: d.rectangle([0, 0, S - 1, S - 1], fill=SLATE)
    p = pad_ratio * S
    u = (S - 2 * p) / 100.0  # unit grid inside the padding
    X = lambda x: p + x * u
    Y = lambda y: p + y * u
    # Classic flexed arm: upper arm along the bottom, bicep bump on top of it, forearm straight up on the right,
    # fist on top, a copper band on the forearm. Built from simple shapes so it reads at 60 pixels.
    d.rounded_rectangle([X(8), Y(66), X(80), Y(88)], radius=int(11 * u), fill=CREAM)   # upper arm
    d.ellipse([X(18), Y(36), X(60), Y(80)], fill=CREAM)                                   # bicep
    d.ellipse([X(60), Y(62), X(90), Y(90)], fill=CREAM)                                   # elbow
    d.rounded_rectangle([X(66), Y(22), X(86), Y(78)], radius=int(9 * u), fill=CREAM)    # forearm
    d.ellipse([X(60), Y(2), X(92), Y(34)], fill=CREAM)                                    # fist
    d.rectangle([X(66), Y(40), X(86), Y(49)], fill=COPPER)                                # band
    return img.resize((size, size), Image.LANCZOS)

for name, size, pad, rounded in [('icon-192.png', 192, 0.08, True), ('icon-512.png', 512, 0.08, True), ('icon-512-maskable.png', 512, 0.16, False), ('apple-touch-icon.png', 180, 0.08, False), ('favicon.png', 64, 0.06, True)]:
    icon(size, pad, rounded).save(os.path.join(out, name))
print('ok')
