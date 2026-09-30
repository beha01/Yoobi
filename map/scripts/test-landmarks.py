#!/usr/bin/env python3
"""Проверка геометрии моделей ориентиров (scripts/landmarks.py) без выгрузки OSM."""

import math
import sys

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from landmarks import Frame, Landmarks, circle, polylabel, ring_area, rounded  # noqa: E402

failed = 0


def check(name, cond):
    global failed
    print(('✓ ' if cond else '✗ ') + name)
    failed += not cond


# Плоскость в метрах: to_xy / to_lonlat — тождественные.
ident = (lambda x, y: (x, y), lambda x, y: (x, y))

square = [(0, 0), (40, 0), (40, 40), (0, 40)]
x, y, d = polylabel([square])
check('центр вписанного круга квадрата', abs(x - 20) < 1 and abs(y - 20) < 1 and abs(d - 20) < 1)

ell = [(0, 0), (60, 0), (60, 20), (20, 20), (20, 60), (0, 60)]
x, y, d = polylabel([ell])
check('центр вписанного круга буквы «Г» — внутри', 0 < x < 20 or 0 < y < 20)

a = math.radians(30)
rect = [(u * math.cos(a) - v * math.sin(a), u * math.sin(a) + v * math.cos(a))
        for u, v in ((-50, -30), (50, -30), (50, 30), (-50, 30))]
f = Frame(rect)
check('прямоугольник по контуру: размеры', abs(f.hu - 50) < 0.01 and abs(f.hv - 30) < 0.01)
check('прямоугольник по контуру: угол', abs(math.sin(f.angle - a)) < 1e-6)
u, v = f.uv(*f.pt(12, -7))
check('перевод координат туда и обратно', abs(u - 12) < 1e-9 and abs(v + 7) < 1e-9)

ring = rounded(60, 40, 10, 6)
check('скруглённый прямоугольник: 4 угла по 7 точек', len(ring) == 28)
check('скруглённый прямоугольник: площадь', abs(ring_area(ring) - (120 * 80 - (4 - math.pi) * 100)) < 60)

# Стадион 200×140 м с полем 105×68 внутри: трибуны и разметка.
lm = Landmarks(*ident)
stadium = [(-100, -70), (100, -70), (100, 70), (-100, 70)]
pitch = [(-52.5, -34), (52.5, -34), (52.5, 34), (-52.5, 34)]
lm.stadiums.append(([stadium], {'leisure': 'stadium', 'name': 'Стадион'}))
lm.site(stadium, 'stadium', 0)
lm.pitches.append(([pitch], {'leisure': 'pitch', 'sport': 'soccer'}))
lm.build_stadiums()
stands = [m for m in lm.models if m[1]['kind'] in ('stand', 'stand2')]
check('трибуны вокруг поля', lm.stats.get('stands') == 1 and len(stands) >= 8)
check('трибуны не выходят за стадион', all(abs(px) <= 100.5 and abs(py) <= 70.5 for ring, _ in stands for px, py in ring))
check('трибуны не заходят на поле', all(not (abs(px) < 52 and abs(py) < 33.5) for ring, _ in stands for px, py in ring))
check('разметка футбольного поля', any(t['kind'] == 'goal' for _, t in lm.lines) and len(lm.lines) > 10)
check('полосы газона', sum(t['kind'] == 'stripe' for _, t in lm.areas) == 6)

# Мечеть 40×30 м без высоты в OSM: зал 5–12 м, купол по центру, барабан под куполом.
lm = Landmarks(*ident)
hall = [(0, 0), (40, 0), (40, 30), (0, 30)]
lm.mosques.append((('w', 1), [hall], {'amenity': 'place_of_worship', 'religion': 'muslim', 'building': 'yes'}, True))
lm.build_mosques()
domes = [o for o in lm.objects if o[2]['kind'] == 'dome']
check('купол на мечети', len(domes) == 1 and abs(domes[0][0] - 20) < 1 and abs(domes[0][1] - 15) < 1)
check('высота зала записана для основных тайлов', 5 <= float(lm.overrides[('w', 1)]['height']) <= 12)
base = float(lm.overrides[('w', 1)]['height'])
check('купол стоит на барабане над крышей', float(domes[0][2]['zmin']) > base)
check('без минаретов у маленькой мечети', lm.stats.get('minarets') == 0)

lm = Landmarks(*ident)
big = [(0, 0), (80, 0), (80, 60), (0, 60)]
lm.mosques.append((('w', 2), [big], {'amenity': 'place_of_worship', 'religion': 'muslim', 'building': 'yes',
                                     'height': '14'}, True))
lm.build_mosques()
minarets = [m for m in lm.models if m[1]['kind'] == 'minaret']
check('у большой мечети — минареты у углов', lm.stats.get('minarets') == 2 and minarets)
check('высота из OSM не переписывается', ('w', 2) not in lm.overrides)

lm = Landmarks(*ident)
lm.monuments.append((10, 10, 'statue', 1.0, None))
lm.monuments.append((10.5, 10.5, 'statue', 1.0, None))  # та же статуя точкой и контуром
lm.monuments.append((50, 50, 'stele', 1.0, 20.0))
lm.build_monuments()
check('статуя на постаменте — одна', lm.stats.get('statues') == 1
      and sum(o[2]['kind'] == 'figure' for o in lm.objects) == 1)
check('стела заданной высоты', lm.stats.get('steles') == 1
      and max(float(m[1]['height']) for m in lm.models if m[1]['kind'] == 'stele') == 20.0)

# Флагшток 165 м с флагом Таджикистана: мачта, три полосы 2:3:2, корона, шар; контур-мачта не столб.
lm = Landmarks(*ident)
lm.flagpoles.append((0.0, 0.0, 165.0, True))
lm.special.append(('flag_pole', ('w', 7), [[circle(0.5, 0.5, 1.8, 20)]], {'building': 'yes', 'height': '165',
                                                                         'tower:type': 'flag_pole'}))
lm.build_special()
kinds = [m[1]['kind'] for m in lm.models]
check('флагшток — одна мачта на точку и контур', lm.stats.get('flagpoles') == 1 and kinds.count('mast') == 3)
check('флаг Таджикистана — три полосы и корона', all(k in kinds for k in ('flag-red', 'flag-white', 'flag-green', 'gold')))
red = next(m for m in lm.models if m[1]['kind'] == 'flag-red')
green = next(m for m in lm.models if m[1]['kind'] == 'flag-green')
check('красная полоса сверху, у вершины мачты', float(red[1]['height']) < 165 and float(red[1]['min_height'])
      > float(green[1]['height']))
check('контур-мачта не выдавливается столбом', 'building' not in lm.overrides[('w', 7)]
      and 'height' not in lm.overrides[('w', 7)])

lm = Landmarks(*ident)
block = [(0, 0), (76, 0), (76, 83), (0, 83)]
lm.special.append(('istiqlol', ('w', 8), [[block]], {'building': 'yes', 'historic': 'monument'}))
lm.build_special()
top = max(float(m[1]['height']) for m in lm.models)
check('монумент «Истиқлол» — башня до 112 м, корона выше', abs(top - 115.6) < 0.01
      and any(o[2]['kind'] == 'dome' and o[2]['tone'] == 'gold' for o in lm.objects))
check('стилобат монумента — по контуру OSM', lm.overrides[('w', 8)]['height'] == '8')

# Маленький контур далеко от начала координат (миллионы метров): центр не должен уплывать.
from landmarks import centroid  # noqa: E402

far = [(5962104.0, 4264523.0), (5962107.6, 4264523.0), (5962107.6, 4264526.6), (5962104.0, 4264526.6)]
cx, cy = centroid(far)
check('центр маленького контура вдали от начала координат', abs(cx - 5962105.8) < 0.01 and abs(cy - 4264524.8) < 0.01)

print('\nМодели в порядке' if not failed else f'\nОшибок: {failed}')
sys.exit(1 if failed else 0)
