#!/usr/bin/env python3
"""Проверка свежей сборки перед публикацией: не сломалось ли что-то по дороге.

Сборка идёт сама каждый день, и плохие данные не должны дойти до курьеров: недокачанная
выгрузка OSM, пустой ответ Overture или сбой Planetiler дают карту, на которой пропали
целые районы. Скрипт сравнивает тайлы и поиск с прошлой удачной сборкой
(data/last-good.json) и падает, если что-то заметно уменьшилось или не на месте:

  python3 scripts/check-build.py           # проверить; код выхода 1 — публиковать нельзя
  python3 scripts/check-build.py --save    # проверить и запомнить сборку как удачную

Без прошлой сборки проверяются только абсолютные пороги (файлы на месте, страна целиком,
в поиске десятки тысяч записей).
"""

import json
import os
import struct
import sys

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
AREA = os.environ.get('AREA', 'tajikistan')
# Сколько может уменьшиться за день, доля прошлого значения.
DROP = {'main_tiles': 0.03, 'main_bytes': 0.08, 'extra_tiles': 0.05, 'extra_bytes': 0.15,
        'search_items': 0.04, 'search_addresses': 0.04}
GROW = 0.35  # и вырасти — больше обычно значит, что в тайлы попало лишнее
MINIMUM = {'main_bytes': 40e6, 'extra_bytes': 2e6, 'search_items': 15000, 'search_addresses': 8000,
           'main_tiles': 50000}
DUSHANBE = (68.78, 38.56)


def pmtiles(path):
    """Заголовок PMTiles v3: число тайлов, зумы, рамка."""
    with open(path, 'rb') as f:
        head = f.read(127)
    if len(head) < 127 or head[:7] != b'PMTiles' or head[7] != 3:
        raise ValueError(f'{path}: не PMTiles v3')
    addressed, entries, contents = struct.unpack_from('<QQQ', head, 72)
    minzoom, maxzoom = head[100], head[101]
    w, s, e, n = (v / 1e7 for v in struct.unpack_from('<iiii', head, 102))
    return {'tiles': addressed, 'contents': contents, 'minzoom': minzoom, 'maxzoom': maxzoom,
            'bounds': [w, s, e, n], 'bytes': os.path.getsize(path)}


def metrics(data):
    m, problems = {}, []
    for key, name in (('main', f'{AREA}.pmtiles'), ('extra', f'{AREA}-extra.pmtiles')):
        path = os.path.join(data, name)
        try:
            h = pmtiles(path)
        except (OSError, ValueError) as e:
            problems.append(f'{name}: {e}')
            continue
        m[f'{key}_tiles'] = h['tiles']
        m[f'{key}_bytes'] = h['bytes']
        m[f'{key}_maxzoom'] = h['maxzoom']
        w, s, e, n = h['bounds']
        if not (w <= DUSHANBE[0] <= e and s <= DUSHANBE[1] <= n):
            problems.append(f'{name}: рамка {h["bounds"]} не покрывает Душанбе')
    try:
        with open(os.path.join(data, f'{AREA}-search.json'), encoding='utf-8') as f:
            search = json.load(f)
        items = search.get('items', [])
        fields = search.get('fields') or []
        kind = fields.index('kind') if 'kind' in fields else None
        m['search_items'] = len(items)
        if kind is not None:
            m['search_addresses'] = sum(1 for it in items if isinstance(it, list) and len(it) > kind
                                        and it[kind] in ('address', 'a'))
        m['osm_date'] = (search.get('dates') or {}).get('osm_time') or (search.get('dates') or {}).get('osm')
    except (OSError, ValueError) as e:
        problems.append(f'поиск: {e}')
    try:
        with open(os.path.join(data, f'{AREA}-mask.geojson'), encoding='utf-8') as f:
            mask = json.load(f)['geometry']
        if mask['type'] not in ('Polygon', 'MultiPolygon'):
            problems.append('контур страны: не многоугольник')
    except (OSError, ValueError, KeyError) as e:
        problems.append(f'контур страны: {e}')
    return m, problems


def check(new, old):
    problems = []
    for key, low in MINIMUM.items():
        if key in new and new[key] < low:
            problems.append(f'{key}: {new[key]:,} — меньше порога {int(low):,}')
    for key, drop in DROP.items():
        if key in new and old.get(key):
            ratio = new[key] / old[key]
            if ratio < 1 - drop:
                problems.append(f'{key}: {new[key]:,} против {old[key]:,} в прошлой сборке (−{(1 - ratio) * 100:.1f} %)')
            elif ratio > 1 + GROW:
                problems.append(f'{key}: {new[key]:,} против {old[key]:,} (+{(ratio - 1) * 100:.0f} %) — подозрительно много')
    if old.get('main_maxzoom') and new.get('main_maxzoom', 0) < old['main_maxzoom']:
        problems.append(f'основные тайлы до {new.get("main_maxzoom")} зума, а были до {old["main_maxzoom"]}')
    if old.get('osm_date') and new.get('osm_date') and new['osm_date'] < old['osm_date']:
        problems.append(f'данные OSM старее прошлых: {new["osm_date"]} < {old["osm_date"]}')
    return problems


def main(save=False, data=None):
    data = data or os.path.join(HERE, 'data')
    good = os.path.join(data, 'last-good.json')
    new, problems = metrics(data)
    try:
        with open(good, encoding='utf-8') as f:
            old = json.load(f)
    except (OSError, ValueError):
        old = {}
    problems += check(new, old)
    for key in sorted(new):
        was = old.get(key)
        print(f'  {key}: {new[key]}' + (f' (было {was})' if was is not None and was != new[key] else ''))
    if problems:
        print('Сборку публиковать нельзя:\n  ' + '\n  '.join(problems), file=sys.stderr)
        return 1
    print('Сборка в порядке' + ('' if old else ' (прошлой удачной сборки нет — только пороги)'))
    if save:
        with open(good, 'w', encoding='utf-8') as f:
            json.dump(new, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    opts = dict((a[2:].split('=', 1) + [''])[:2] for a in sys.argv[1:] if a.startswith('--'))
    sys.exit(main(save='save' in opts, data=opts.get('data') or None))
