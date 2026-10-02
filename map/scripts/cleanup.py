#!/usr/bin/env python3
"""Старые дома под новыми: когда в OSM поверх снесённого частного сектора рисуют новую
многоэтажку, старые домики под ней часто забывают удалить. На карте тогда поверх высотки
торчат десятки мелких крыш (так в Казаконе в Душанбе: башни 2026 года нарисованы поверх
домов 2017-го).

Маленький дом (до 400 м², до трёх этажей), который почти целиком лежит внутри большего
здания, нарисованного позже (номер линии OSM больше — её создали позже), уже снесён: при
сборке он убирается (правкой «remove», как в tiles/corrections.json). Навесы, крыши
рынков и теплицы не в счёт: под ними законно стоят киоски.

  python3 scripts/cleanup.py data/sources/tajikistan.osm.pbf     # сколько домов уберётся
"""

import math
import sys
from collections import defaultdict

SMALL_M2 = 400
BIG_MIN_M2 = 150
RATIO = 2.0         # большое здание хотя бы вдвое больше
COVER = 0.6         # доля точек маленького дома (центр и углы) внутри большого
CELL = 100.0
OVER = {'roof', 'canopy', 'carport', 'greenhouse', 'ruins', 'construction_site', 'shelter', 'grandstand'}
KEEP = ('amenity', 'shop', 'office', 'tourism', 'historic', 'healthcare', 'craft', 'name', 'building:part')


def levels(t):
    try:
        return float((t.get('building:levels') or '0').split(';')[0].replace(',', '.'))
    except ValueError:
        return 0.0


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def area(ring):
    ox, oy = ring[0]
    return abs(sum((ax - ox) * (by - oy) - (bx - ox) * (ay - oy)
                   for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]))) / 2


def covered(buildings):
    """buildings — [(ключ ('w'|'r', id), кольцо в метрах, теги)]. Возвращает ключи маленьких домов,
    которые лежат внутри большего, нарисованного позже."""
    big, small = [], []
    for key, ring, t in buildings:
        if len(ring) < 3:
            continue
        a = area(ring)
        kind = t.get('building')
        if a >= BIG_MIN_M2 and kind not in OVER and key[0] == 'w':
            big.append((key, ring, a))
        if a < SMALL_M2 and levels(t) <= 3 and kind not in OVER and not any(k in t for k in KEEP):
            small.append((key, ring, a))
    grid = defaultdict(list)
    for i, (_k, ring, _a) in enumerate(big):
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        box = (min(xs), min(ys), max(xs), max(ys))
        big[i] = big[i] + (box,)
        for cx in range(int(box[0] // CELL), int(box[2] // CELL) + 1):
            for cy in range(int(box[1] // CELL), int(box[3] // CELL) + 1):
                grid[(cx, cy)].append(i)
    out = set()
    for key, ring, a in small:
        cx = sum(p[0] for p in ring) / len(ring)
        cy = sum(p[1] for p in ring) / len(ring)
        points = [(cx, cy)] + ring
        for i in grid.get((int(cx // CELL), int(cy // CELL)), ()):
            bkey, bring, barea, box = big[i]
            if bkey == key or bkey[1] <= key[1] or barea < RATIO * a:
                continue
            if not (box[0] <= cx <= box[2] and box[1] <= cy <= box[3]):
                continue
            inside = sum(in_ring(x, y, bring) for x, y in points)
            if inside >= COVER * len(points) and in_ring(cx, cy, bring):
                out.add(key)
                break
    return out


def read(src):
    """Здания выгрузки: [(ключ, кольцо в метрах, теги)]."""
    import osmium
    out = []
    fp = (osmium.FileProcessor(src).with_locations()
          .with_areas(osmium.filter.KeyFilter('building')).with_filter(osmium.filter.KeyFilter('building')))
    k = 111320 * math.cos(math.radians(38.8))  # один масштаб на всю страну: дома сравниваются между собой
    for o in fp:
        if not o.is_area():
            continue
        try:
            ll = [(p.lon, p.lat) for p in next(iter(o.outer_rings()))][:-1]
        except (StopIteration, osmium.InvalidLocationError):
            continue
        if len(ll) < 3:
            continue
        ring = [(lon * k, lat * 111320) for lon, lat in ll]  # метры
        t = {tag.k: tag.v for tag in o.tags
             if tag.k in ('building', 'building:levels') or tag.k in KEEP}
        out.append((('w' if o.from_way() else 'r', o.orig_id()), ring, t))
    return out


def corrections(src):
    """Правки в формате corrections.load: убрать старые дома под новыми. Второе — счётчики."""
    gone = covered(read(src))
    return {'change': {}, 'remove': gone, 'add': []}, {'старых домов под новыми': len(gone)}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    _, stats = corrections(sys.argv[1])
    print(stats)
