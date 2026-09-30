#!/usr/bin/env python3
"""Проверка поиска перемен по снимкам (scripts/imagery.py) и старых домов под новыми (scripts/cleanup.py)
на искусственных картинках: высотка с тенью, этажность по тени, выравнивание яркости, правки."""

import json
import math
import os
import sys
import tempfile

sys.path.insert(0, __file__.rsplit('/', 1)[0])
import numpy as np  # noqa: E402

import cleanup  # noqa: E402
import imagery  # noqa: E402

failed = 0


def check(name, cond):
    global failed
    print(('✓ ' if cond else '✗ ') + name)
    failed += not cond


SUN = (180.0, 45.0)  # солнце с юга, 45°: тень длиной в высоту дома, строго на север (вверх картинки)


def scene(h=60, w=60, seed=1):
    """Частный сектор: пёстрая земля и крыши с зеленью."""
    rnd = np.random.default_rng(seed)
    base = 0.12 + rnd.normal(0, 0.012, (h, w))
    c = {'r': base.copy(), 'g': base.copy() * 0.95, 'b': base.copy() * 0.85, 'n': base.copy() + 0.1}
    return {k: v.astype('f4') for k, v in c.items()}


def tower(c, r0, r1, c0, c1, shadow_px):
    """Высотка: светлая крыша строк r0…r1, столбцов c0…c1 и тень над ней (к северу)."""
    for k in 'rgb':
        c[k][r0:r1, c0:c1] = 0.26
        c[k][r0 - shadow_px:r0, c0:c1] = 0.045
    c['n'][r0:r1, c0:c1] = 0.28
    c['n'][r0 - shadow_px:r0, c0:c1] = 0.07


old = scene(seed=1)
now = scene(seed=2)
tower(now, 30, 33, 20, 28, 4)  # крыша 3×8 пикселей (30×80 м), тень 4 пикселя = 40 м
fo, fn = imagery.features(old), imagery.features(now)
found = imagery.towers(fn, fo, SUN)
check('новая высотка найдена одна', len(found) == 1)
if found:
    t = found[0]
    xs = [p[0] for p in t['rect']]
    ys = [p[1] for p in t['rect']]
    check('контур — на месте крыши, а не тени', 29.5 <= min(ys) and max(ys) <= 33.5 and 19.5 <= min(xs) and max(xs) <= 28.5)
    check('этажность по длине тени: 40–50 м → 12–16 этажей', 12 <= t['levels'] <= 16)
mapped = np.zeros((60, 60), bool)
mapped[30:33, 20:28] = True
check('дом, который уже есть в OSM, не повторяется', imagery.towers(fn, fo, SUN, mapped) == [])
check('без перемен — ничего', imagery.towers(fo, fo, SUN) == [])

# Этажность дома из OSM без этажей: тот же дом, контур сдвинут на пиксель к югу (как бывает).
ids = np.zeros((60, 60), 'int32')
ids[31:34, 20:28] = 1
lv = imagery.heights(fn, SUN, ids, [('w', 5)])
check('этажность по тени у дома OSM со сдвигом контура', 11 <= lv.get('w5', 0) <= 16)
ids2 = np.zeros((60, 60), 'int32')
ids2[45:48, 40:48] = 1  # дом без тени — частный, этажность не ставим
check('без тени этажность не выдумывается', imagery.heights(fn, SUN, ids2, [('w', 6)]) == {})

# Выравнивание яркости: старый снимок темнее на 20% — после сопоставления квантилей перемен нет.
dark = {k: v * 0.8 for k, v in now.items()}
matched = imagery.match(dark, now)
check('выравнивание яркости снимков разных лет', abs(float(np.nanmedian(matched['r'])) - float(np.nanmedian(now['r']))) < 0.005)

# Прямоугольник наименьшей площади для повёрнутого квадрата.
sq = [(math.cos(a) * 2, math.sin(a) * 2) for a in (0.3, 0.3 + math.pi / 2, 0.3 + math.pi, 0.3 + 3 * math.pi / 2)]
rect = imagery.min_rect(sq)
check('прямоугольник вокруг повёрнутого квадрата', rect and abs(math.dist(rect[0], rect[1]) * math.dist(rect[1], rect[2]) - 8) < 1e-6)

# Правки для сборки из файла результатов.
tmp = tempfile.mkdtemp()
path = os.path.join(tmp, 'imagery.geojson')
ring = [[68.7, 38.5], [68.701, 38.5], [68.701, 38.5005], [68.7, 38.5005], [68.7, 38.5]]
with open(path, 'w', encoding='utf-8') as f:
    json.dump({'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [ring]},
         'properties': {'kind': 'tower', 'levels': 14, 'date': '2026-09-27'}}],
        'hide': {'w10': 'tower|2026-09-27'}, 'levels': {'w11': [12, '2026-09-27'], 'w12': [9, '2026-09-27']}}, f)
fix, stats = imagery.corrections(path, keep_removed={('w', 12)})
check('новая высотка — контур с этажностью и пометкой «по снимку»', len(fix['add']) == 1
      and fix['add'][0]['tags'].get('building:levels') == '14' and fix['add'][0]['tags']['yoobi:imagery'] == 'tower|2026-09-27'
      and len(fix['add'][0]['area']) == 4)
check('старый дом под высоткой убирается', ('w', 10) in fix['remove'])
check('этажность по тени', fix['change'].get(('w', 11), ({},))[0].get('building:levels') == '12')
check('дому, убранному как старый, этажность не ставится', ('w', 12) not in fix['change'])

# Старые дома под новыми: домик 2017 года внутри башни, нарисованной позже, — убирается.
box = lambda x, y, dx, dy: [(x, y), (x + dx, y), (x + dx, y + dy), (x, y + dy)]  # noqa: E731
buildings = [
    (('w', 100), box(0, 0, 10, 10), {'building': 'house'}),          # старый домик
    (('w', 101), box(40, 0, 10, 10), {'building': 'house'}),         # старый домик в стороне
    (('w', 102), box(60, 0, 8, 8), {'building': 'kiosk', 'shop': 'kiosk'}),  # киоск с магазином
    (('w', 900), box(-5, -5, 30, 30), {'building': 'apartments'}),   # новая башня поверх первого
    (('w', 901), box(55, -5, 30, 30), {'building': 'roof'}),         # навес рынка над киоском
    (('w', 50), box(38, -2, 20, 20), {'building': 'yes'}),           # здание старше домика рядом
]
gone = cleanup.covered(buildings)
check('домик под новой башней убран', ('w', 100) in gone)
check('дом рядом остаётся', ('w', 101) not in gone)
check('киоск под навесом и заведение остаются', ('w', 102) not in gone)
check('под зданием, нарисованным раньше домика, домик остаётся', ('w', 101) not in gone)

print('\nСнимки в порядке' if not failed else f'\nОшибок: {failed}')
sys.exit(1 if failed else 0)
