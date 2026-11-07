# Dad Lab icon: the flexed-arm emoji (Noto Color Emoji, Google's open-source emoji font, SIL Open Font
# License) on a deep slate square. Rendered at the font's native 109 px bitmap size and scaled.
from PIL import Image, ImageDraw, ImageFont
import sys, os
out = sys.argv[1]
SLATE = (36, 59, 94)
FONT = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'

def emoji_image():
    f = ImageFont.truetype(FONT, 109)  # Noto Color Emoji only renders at 109
    im = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((80, 80), '\U0001F4AA', font=f, embedded_color=True, anchor='mm')
    return im.crop(im.getbbox())

ARM = emoji_image()

def icon(size, pad_ratio, rounded):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.225, fill=SLATE)
    else: d.rectangle([0, 0, S - 1, S - 1], fill=SLATE)
    inner = int(S * (1 - 2 * pad_ratio) * 0.78)
    w, h = ARM.size
    scale = inner / max(w, h)
    arm = ARM.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    img.alpha_composite(arm, ((S - arm.width) // 2, (S - arm.height) // 2))
    return img.resize((size, size), Image.LANCZOS)

for name, size, pad, rounded in [('icon-192.png', 192, 0.03, True), ('icon-512.png', 512, 0.03, True), ('icon-512-maskable.png', 512, 0.12, False), ('apple-touch-icon.png', 180, 0.03, False), ('favicon.png', 64, 0.03, True)]:
    icon(size, pad, rounded).save(os.path.join(out, name))
print('ok')
