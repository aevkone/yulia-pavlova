# Видео-аватарка «Канал Павловой»: портрет с медленным «дыханием», вращающееся кольцо текста,
# терракотовая «комета» по кольцу. Петля 9 с, 30 к/с, 800x800 (рисуем в 2x и сжимаем).
import math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'frames')
os.makedirs(OUT, exist_ok=True)
S, C = 1600, 800                      # холст 2x и центр
BG = (11, 11, 10); ACC = (217, 113, 79)
FPS, SEC = 30, 9; N = FPS * SEC
R_PHOTO, R_RING, R_TEXT = 500, 548, 650

# фон: тёплое свечение к центру
bg = Image.new('RGB', (S, S), BG)
glow = Image.new('L', (S, S), 0); ImageDraw.Draw(glow).ellipse((C-700, C-700, C+700, C+700), fill=90)
glow = glow.filter(ImageFilter.GaussianBlur(220))
bg = Image.composite(Image.new('RGB', (S, S), (60, 28, 18)), bg, glow)

# портрет: лицо (390, 500) исходника 720x1280 в центр круга
photo = Image.open(os.path.join(SRC, 'yulia_restaurant.jpg')).convert('RGB')
def portrait(scale):
    k = 2.55 * scale
    im = photo.resize((int(720*k), int(1280*k)), Image.LANCZOS)
    x, y = int(C - 390*k), int(C - 540*k)
    layer = Image.new('RGB', (S, S), BG); layer.paste(im, (x, y))
    return layer
mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse((C-R_PHOTO, C-R_PHOTO, C+R_PHOTO, C+R_PHOTO), fill=255)

# кольцо текста: фраза дважды, чтобы петля замыкалась поворотом на 180°
font = ImageFont.truetype(os.path.join(SRC, 'fonts', 'Oswald-SemiBold.ttf'), 64)
phrase = 'КАНАЛ ПАВЛОВОЙ  ●  ВИЖУ СУТЬ  ●  '
text = phrase * 2
widths = [font.getlength(ch) for ch in text]
gap = (2*math.pi*R_TEXT - sum(widths)) / len(text)
ring = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ang = -90.0
for ch, w in zip(text, widths):
    step = (w + gap) / R_TEXT * 180 / math.pi
    a = ang + step / 2
    if ch.strip():
        tile = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
        if ch == '●':   # в Oswald нет кружка — рисуем точку сами
            ImageDraw.Draw(tile).ellipse((68, 68, 92, 92), fill=ACC + (255,))
        else:
            ImageDraw.Draw(tile).text((80, 80), ch, font=font, fill=(255, 255, 255, 235), anchor='mm')
        tile = tile.rotate(-(a + 90), resample=Image.BICUBIC)
        x = C + R_TEXT * math.cos(math.radians(a)); y = C + R_TEXT * math.sin(math.radians(a))
        ring.alpha_composite(tile, (int(x - 80), int(y - 80)))
    ang += step

def comet(t):
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.ellipse((C-R_RING, C-R_RING, C+R_RING, C+R_RING), outline=ACC + (90,), width=4)   # тонкая база
    head = -90 + 360 * t
    for i in range(70):                                                              # хвост 105°
        a0 = head - i * 1.5
        al = int(255 * (1 - i / 70) ** 1.6)
        d.arc((C-R_RING, C-R_RING, C+R_RING, C+R_RING), a0 - 1.6, a0, fill=ACC + (al,), width=14)
    hx = C + R_RING * math.cos(math.radians(head)); hy = C + R_RING * math.sin(math.radians(head))
    halo = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((hx-60, hy-60, hx+60, hy+60), fill=ACC + (120,))
    lay = Image.alpha_composite(halo.filter(ImageFilter.GaussianBlur(28)), lay)
    ImageDraw.Draw(lay).ellipse((hx-22, hy-22, hx+22, hy+22), fill=ACC + (255,))
    return lay

for f in range(N):
    t = f / N
    fr = bg.copy()
    fr.paste(portrait(1 + 0.035 * (1 - math.cos(2*math.pi*t)) / 2), (0, 0), mask)
    fr = fr.convert('RGBA')
    fr.alpha_composite(ring.rotate(-180 * t, resample=Image.BICUBIC, center=(C, C)))
    fr.alpha_composite(comet(t))
    fr.convert('RGB').resize((800, 800), Image.LANCZOS).save(os.path.join(OUT, f'{f:04d}.png'))
print('кадров:', N)
