#!/usr/bin/env python3
"""Готовит данные для дополнительных тайлов Yoobi Map из выгрузки OpenStreetMap.

  python3 scripts/extras.py data/sources/tajikistan.osm.pbf data/extras.osm.pbf data/tajikistan-mask.geojson

Что получается (дальше Planetiler режет это в тайлы по схеме tiles/extra.yml):

  * Объёмные деревья: каждое дерево — несколько ярусов кроны (восьмиугольники с
    высотой), которые стиль рисует через fill-extrusion. Так деревья выглядят
    объёмно и правильно заслоняются зданиями. Источники:
      - реальные деревья и аллеи из OSM (natural=tree, natural=tree_row);
      - декоративные ряды вдоль городских улиц и посадки в парках — только в
        городах, не внутри зданий, не на дорогах и дорожках (помечены decor=yes).
  * Подъезды: точка чуть перед дверью, номер (ref), квартиры (addr:flats) и угол
    стены — стиль рисует стрелку, указывающую на вход.
  * Маска страны: контур Таджикистана из OSM (admin_level=2) для «заморозки» соседей.

Нужен только pyosmium: pip install osmium
"""
import json
import math
import random
import sys
from collections import defaultdict

import osmium
from osmium.osm.mutable import Node, Way

COUNTRY = 'TJ'
M_LAT = 110540.0
STREET_CLASSES = {  # полуширина проезжей части, м
    'primary': 9.0, 'secondary': 7.5, 'tertiary': 6.5, 'residential': 4.5,
    'living_street': 4.0, 'unclassified': 4.5, 'pedestrian': 4.0,
}
ROAD_CLASSES = set(STREET_CLASSES) | {'motorway', 'trunk', 'motorway_link', 'trunk_link', 'primary_link',
                                      'secondary_link', 'tertiary_link', 'service'}
PATH_CLASSES = {'footway', 'path', 'cycleway', 'steps', 'pedestrian', 'track'}
PARK_TAGS = [('leisure', 'park'), ('leisure', 'garden'), ('landuse', 'forest'), ('natural', 'wood'),
             ('landuse', 'village_green')]
URBAN_RADIUS = {'city': 9000, 'town': 3500}
STREET_SPACING, PARK_SPACING = 12.0, 13.0
CELL = 60.0


def mx(lon, lat):
    return lon * 111320.0 * math.cos(math.radians(lat))


def to_xy(lon, lat, lat0):
    return lon * 111320.0 * math.cos(math.radians(lat0)), lat * M_LAT


def to_lonlat(x, y, lat0):
    return x / (111320.0 * math.cos(math.radians(lat0))), y / M_LAT


class Grid:
    """Простой пространственный индекс по ячейкам."""

    def __init__(self):
        self.cells = defaultdict(list)

    def add_bbox(self, item, x1, y1, x2, y2):
        for i in range(int(x1 // CELL), int(x2 // CELL) + 1):
            for j in range(int(y1 // CELL), int(y2 // CELL) + 1):
                self.cells[(i, j)].append(item)

    def near(self, x, y):
        return self.cells.get((int(x // CELL), int(y // CELL)), ())


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def signed_area(ring):
    return sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
               for i in range(len(ring))) / 2


class Collector(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.places = []          # (lon, lat, radius)
        self.trees = []           # (lon, lat, crown_m, height_m)
        self.tree_rows = []       # [(lon, lat)]
        self.streets = []         # (cls, [(lon, lat)], [node ids])
        self.paths = []           # [(lon, lat)]
        self.node_use = defaultdict(int)
        self.entrances = {}       # node id -> (lon, lat, tags)
        self.entrance_out = []    # (lon, lat, angle, tags)
        self.buildings = []       # [(lon, lat)] внешний контур
        self.parks = []           # (outer [(lon, lat)], inners)
        self.water = []
        self.country = []         # кольца границы страны

    def node(self, n):
        t = n.tags
        if 'place' in t and t['place'] in URBAN_RADIUS:
            self.places.append((n.location.lon, n.location.lat, URBAN_RADIUS[t['place']]))
        if t.get('natural') == 'tree':
            self.trees.append((n.location.lon, n.location.lat, num(t.get('diameter_crown'), 7.0), num(t.get('height'), 9.0)))
        if 'entrance' in t:
            self.entrances[n.id] = (n.location.lon, n.location.lat, {
                k: t[k] for k in ('entrance', 'ref', 'addr:flats') if k in t})

    def way(self, w):
        t = w.tags
        try:
            coords = [(n.location.lon, n.location.lat) for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        hw = t.get('highway')
        if hw in ROAD_CLASSES and t.get('area') != 'yes':
            for n in w.nodes:
                self.node_use[n.ref] += 1
            if hw in STREET_CLASSES and t.get('bridge') is None and t.get('tunnel') is None:
                self.streets.append((hw, coords, [n.ref for n in w.nodes]))
            else:
                self.streets.append(('_' + hw, coords, [n.ref for n in w.nodes]))
        elif hw in PATH_CLASSES:
            self.paths.append(coords)
        if t.get('natural') == 'tree_row':
            self.tree_rows.append(coords)
        if 'building' in t and len(coords) > 3 and w.is_closed():
            self.entrance_angles(w, coords)

    def entrance_angles(self, w, coords):
        ring = coords[:-1]
        lat0 = ring[0][1]
        xy = [to_xy(lon, lat, lat0) for lon, lat in ring]
        ccw = signed_area(xy) > 0
        refs = [n.ref for n in w.nodes][:-1]
        for i, ref in enumerate(refs):
            if ref not in self.entrances:
                continue
            (ax, ay), (bx, by) = xy[i - 1], xy[(i + 1) % len(xy)]
            dx, dy = bx - ax, by - ay
            length = math.hypot(dx, dy) or 1.0
            # Наружная нормаль: справа от направления для кольца против часовой стрелки.
            ox, oy = (dy / length, -dx / length) if ccw else (-dy / length, dx / length)
            angle = math.degrees(math.atan2(-ox, -oy)) % 360  # стрелка смотрит внутрь, на дверь
            x, y = xy[i]
            lon, lat = to_lonlat(x + ox * 2.5, y + oy * 2.5, lat0)
            self.entrance_out.append((lon, lat, round(angle), self.entrances.pop(ref)[2]))

    def area(self, a):
        t = a.tags
        rings = []
        for outer in a.outer_rings():
            try:
                o = [(n.lon, n.lat) for n in outer]
                inners = [[(n.lon, n.lat) for n in inner] for inner in a.inner_rings(outer)]
            except osmium.InvalidLocationError:
                continue
            rings.append((o, inners))
        if not rings:
            return
        if 'building' in t:
            self.buildings.extend(o for o, _ in rings)
        elif any(t.get(k) == v for k, v in PARK_TAGS):
            self.parks.extend(rings)
        elif t.get('natural') == 'water':
            self.water.extend(rings)
        if (t.get('boundary') == 'administrative' and t.get('admin_level') == '2'
                and (t.get('ISO3166-1') == COUNTRY or t.get('ISO3166-1:alpha2') == COUNTRY)):
            self.country.extend(rings)


def num(value, default):
    try:
        return float(str(value).split()[0].replace(',', '.'))
    except (TypeError, ValueError):
        return default


def main(src, dst, mask_path):
    c = Collector()
    c.apply_file(src, locations=True)
    rnd = random.Random(7)
    lat0 = sum(p[1] for p in c.places) / len(c.places) if c.places else 38.5
    P = lambda lon, lat: to_xy(lon, lat, lat0)
    urban = [(P(lon, lat), r) for lon, lat, r in c.places]

    def is_urban(x, y):
        return any((x - px) ** 2 + (y - py) ** 2 < r * r for (px, py), r in urban)

    # Индексы препятствий: здания, дороги, дорожки, вода.
    blocks, lines = Grid(), Grid()
    polys = []
    for ring in c.buildings + [o for o, _ in c.water]:
        xy = [P(*p) for p in ring]
        xs, ys = [p[0] for p in xy], [p[1] for p in xy]
        polys.append(xy)
        blocks.add_bbox(len(polys) - 1, min(xs) - 3, min(ys) - 3, max(xs) + 3, max(ys) + 3)
    segs = []
    for cls, coords, _ in c.streets:
        half = STREET_CLASSES.get(cls.lstrip('_'), 5.0) + 1.0
        xy = [P(*p) for p in coords]
        for a, b in zip(xy, xy[1:]):
            segs.append((a, b, half))
            lines.add_bbox(len(segs) - 1, min(a[0], b[0]) - half, min(a[1], b[1]) - half,
                           max(a[0], b[0]) + half, max(a[1], b[1]) + half)
    for coords in c.paths:
        xy = [P(*p) for p in coords]
        for a, b in zip(xy, xy[1:]):
            segs.append((a, b, 2.2))
            lines.add_bbox(len(segs) - 1, min(a[0], b[0]) - 3, min(a[1], b[1]) - 3, max(a[0], b[0]) + 3, max(a[1], b[1]) + 3)

    def free(x, y, r):
        for i in blocks.near(x, y):
            poly = polys[i]
            if point_in_ring(x, y, poly) or any(seg_dist(x, y, *poly[k], *poly[k - 1]) < r * 0.6 for k in range(len(poly))):
                return False
        for i in lines.near(x, y):
            (ax, ay), (bx, by), half = segs[i]
            if seg_dist(x, y, ax, ay, bx, by) < half + r * 0.5:
                return False
        return True

    trees = []  # (x, y, crown, height, decor)
    real = Grid()
    for lon, lat, crown, height in c.trees:
        x, y = P(lon, lat)
        trees.append((x, y, crown, height, False))
    for coords in c.tree_rows:
        for x, y in along([P(*p) for p in coords], 8.0, 0.0, rnd):
            trees.append((x, y, 6.5, 9.0, False))
    for i, (x, y, *_rest) in enumerate(trees):
        real.add_bbox(i, x, y, x, y)

    def near_real(x, y, d):
        return any(math.hypot(x - trees[i][0], y - trees[i][1]) < d for i in real.near(x, y))

    # Декоративные ряды вдоль городских улиц.
    junction = {nid for nid, k in c.node_use.items() if k > 1}
    for cls, coords, ids in c.streets:
        if cls.startswith('_'):
            continue
        xy = [P(*p) for p in coords]
        if not is_urban(*xy[0]):
            continue
        stops = [xy[i] for i, nid in enumerate(ids) if nid in junction] + [xy[0], xy[-1]]
        crown = 6.5
        offset = STREET_CLASSES[cls] + 1.8 + crown / 2
        for side in (-1, 1):
            for x, y in along(xy, STREET_SPACING, side * offset, rnd):
                if any(math.hypot(x - sx, y - sy) < offset + 9 for sx, sy in stops):
                    continue
                if free(x, y, crown) and not near_real(x, y, 7):
                    trees.append((x, y, crown, rnd.uniform(8, 12), True))

    # Посадки в городских парках.
    for outer, inners in c.parks:
        xy = [P(*p) for p in outer]
        if not is_urban(*xy[0]):
            continue
        hxy = [[P(*p) for p in h] for h in inners]
        xs, ys = [p[0] for p in xy], [p[1] for p in xy]
        yy = min(ys)
        while yy < max(ys):
            xx = min(xs)
            while xx < max(xs):
                x, y = xx + rnd.uniform(-3, 3), yy + rnd.uniform(-3, 3)
                if rnd.random() < 0.8 and point_in_ring(x, y, xy) and not any(point_in_ring(x, y, h) for h in hxy):
                    crown = rnd.uniform(5.5, 8.5)
                    if free(x, y, crown) and not near_real(x, y, 8):
                        trees.append((x, y, crown, rnd.uniform(8, 13), True))
                xx += PARK_SPACING
            yy += PARK_SPACING

    # Подъезды не на контуре здания — без направления.
    for lon, lat, tags in c.entrances.values():
        c.entrance_out.append((lon, lat, None, tags))
    write(dst, trees, c.entrance_out, lat0, rnd)
    write_mask(mask_path, c.country)
    print(f'деревьев: {len(trees)} (декоративных {sum(t[4] for t in trees)}), подъездов: {len(c.entrance_out)}, '
          f'граница страны: {"да" if c.country else "нет"}')


def along(xy, spacing, offset, rnd):
    """Точки вдоль ломаной через каждые spacing метров, сдвинутые вбок на offset."""
    carry = spacing / 2
    for (ax, ay), (bx, by) in zip(xy, xy[1:]):
        length = math.hypot(bx - ax, by - ay)
        if length == 0:
            continue
        nx, ny = (by - ay) / length, -(bx - ax) / length
        d = carry
        while d < length:
            t = d / length
            yield ax + (bx - ax) * t + nx * offset, ay + (by - ay) * t + ny * offset
            d += spacing * rnd.uniform(0.85, 1.15)
        carry = d - length


# Ярусы кроны по профилю шара: (доля радиуса, низ, верх в долях высоты).
# Нижний узкий ярус изображает ствол, дальше — округлая «шапка» кроны.
TIERS = [(0.16, 0.0, 0.34), (0.72, 0.30, 0.46), (0.95, 0.42, 0.60), (1.0, 0.56, 0.74),
         (0.86, 0.70, 0.86), (0.52, 0.83, 0.97)]
SIDES = 12


def write(dst, trees, entrances, lat0, rnd):
    w = osmium.SimpleWriter(dst)
    nid, wid = [1], [1]
    ways = []

    def node(x, y, tags=None):
        lon, lat = to_lonlat(x, y, lat0)
        w.add_node(Node(id=nid[0], location=(lon, lat), tags=tags or {}, version=1))
        nid[0] += 1
        return nid[0] - 1

    for lon, lat, angle, tags in entrances:
        x, y = to_xy(lon, lat, lat0)
        t = {'yoobi': 'entrance', **({'angle': str(angle)} if angle is not None else {}), **{('flats' if k == 'addr:flats' else k): v for k, v in tags.items()}}
        node(x, y, t)
    for x, y, crown, height, decor in trees:
        r = crown / 2
        shade = str(rnd.randrange(3))
        rot = rnd.uniform(0, math.pi / 4)
        for k, (scale, lo, hi) in enumerate(TIERS):
            sides = 6 if k == 0 else SIDES
            ids = [node(x + r * scale * math.cos(rot + a * 2 * math.pi / sides), y + r * scale * math.sin(rot + a * 2 * math.pi / sides))
                   for a in range(sides)]
            ways.append((ids + [ids[0]], {
                'yoobi': 'tree', 'tier': str(k), 'shade': shade,
                'min_height': f'{height * lo:.1f}', 'height': f'{height * hi:.1f}',
                **({'decor': 'yes'} if decor else {})}))
    for ids, tags in ways:
        w.add_way(Way(id=wid[0], nodes=ids, tags=tags, version=1))
        wid[0] += 1
    w.close()


def write_mask(path, rings):
    if not rings:
        return
    world = [[40, 20], [110, 20], [110, 60], [40, 60], [40, 20]]
    holes = []
    for outer, _ in rings:
        ring = simplify([list(p) for p in outer], 0.0004)
        if signed_area(ring) > 0:
            ring.reverse()
        holes.append([[round(x, 5), round(y, 5)] for x, y in ring])
    feature = {'type': 'Feature', 'properties': {}, 'geometry': {'type': 'Polygon', 'coordinates': [world, *holes]}}
    with open(path, 'w') as f:
        json.dump(feature, f)


def simplify(points, tol):
    """Дуглас — Пекер, чтобы маска была лёгкой."""
    if len(points) < 3:
        return points
    (ax, ay), (bx, by) = points[0], points[-1]
    idx, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        d = seg_dist(points[i][0], points[i][1], ax, ay, bx, by)
        if d > dmax:
            idx, dmax = i, d
    if dmax <= tol:
        return [points[0], points[-1]]
    return simplify(points[:idx + 1], tol)[:-1] + simplify(points[idx:], tol)


if __name__ == '__main__':
    sys.setrecursionlimit(100000)
    main(*sys.argv[1:4])
