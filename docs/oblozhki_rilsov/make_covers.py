# Обложки рилсов Юли 30.10–05.11: фото на весь кадр 9:16, затемнение снизу, Oswald белый + золото #C9A24B
import glob, pillow_heif
from PIL import Image, ImageOps, ImageDraw, ImageFont
pillow_heif.register_heif_opener()
BANK = 'D:/yulia_zavod_syrye/karusel2/bank/'
FONTS = 'D:/yulia_shablony/rilsy_animaciya3_yulii/public/fonts/'
OUT = 'D:/yulia_zavod_syrye/oblozhki_rilsov/'
GOLD = (201, 162, 75)
W, H = 1080, 1920
COVERS = [  # рилс, серия, фото, центр по ширине, строка белым, строка золотом
    ('08', 1, '9090', 0.42, ['Инженер', 'и первая машина'], 'в 18 лет'),
    ('07', 2, '7566', 0.50, ['Почему я всегда'], 'говорю как есть'),
    ('09', 3, '1734', 0.50, ['Команда'], 'идёт за мной'),
    ('04', 4, '9580', 0.55, ['Боитесь', 'зарабатывать'], 'больше мужа?'),
    ('05', 5, '6060', 0.56, ['Хочу, чтобы ты'], 'была девочкой'),
    ('12', 6, '1148', 0.62, ['Всё есть,'], 'а кажется мало'),
    ('10', 7, '6019', 0.50, ['Не руби с плеча:'], 'план отхода'),
]

def fit(lines, maxw, start):
    s = start
    while True:
        f = ImageFont.truetype(FONTS + 'Oswald-SemiBold.ttf', s)
        if all(f.getlength(l) <= maxw for l in lines):
            return f
        s -= 4

for reel, ser, photo, cx, white, gold in COVERS:
    im = ImageOps.exif_transpose(Image.open(glob.glob(BANK + f'IMG_{photo}.*')[0])).convert('RGB')
    w, h = im.size
    cw = min(w, int(h * 9 / 16)); ch = int(cw * 16 / 9)
    x0 = min(max(int(cx * w - cw / 2), 0), w - cw); y0 = (h - ch) // 2
    im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS)
    # затемнение снизу без чёткой границы
    shade = Image.new('L', (1, H))
    for y in range(H):
        t = min(1, max(0, (y - 700) / 700))
        shade.putpixel((0, y), int(232 * t ** 1.2))
    im = Image.composite(Image.new('RGB', (W, H), (12, 9, 6)), im, shade.resize((W, H)))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONTS + 'Oswald-SemiBold.ttf', 104)
    lh = 116
    n = len(white) + 1
    ytop = 1560 - n * lh
    lab = ImageFont.truetype(FONTS + 'JetBrainsMono-Regular.ttf', 26)
    x = 84
    for ch in f'СЕРИЯ {ser} · СИЛЬНАЯ. БЕЗ ШАБЛОНОВ':
        d.text((x, ytop - 60), ch, font=lab, fill=GOLD); x += lab.getlength(ch) + 5
    for i, l in enumerate(white):
        d.text((84, ytop + i * lh), l.upper(), font=f, fill='white')
    yg = ytop + len(white) * lh + 14
    g = gold.upper(); gw = f.getlength(g); bb = f.getbbox(g)
    d.rectangle((84 - 20, yg + bb[1] - 18, 84 + gw + 20, yg + bb[3] + 18), fill=GOLD)
    d.text((84, yg), g, font=f, fill='white')
    man = ImageFont.truetype(FONTS + 'Manrope-Variable.ttf', 34)
    d.text((84, yg + bb[3] + 60), 'Юлия Павлова', font=man, fill='white')
    assert max(f.getlength(l.upper()) for l in white + [gold]) < W - 168, reel
    im.save(OUT + f'{reel}_oblozhka.jpg', quality=93)
    print(reel)
