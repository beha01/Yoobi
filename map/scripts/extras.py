#!/usr/bin/env python3
"""Готовит данные для дополнительных тайлов Yoobi Map из выгрузки OpenStreetMap.

  python3 scripts/extras.py data/sources/tajikistan.osm.pbf data/extras.osm.pbf data/tajikistan-mask.geojson \\
      [data/tajikistan-clipped.osm.pbf] [--search=data/tajikistan-search.json] [--decor]

Что получается (extras.osm.pbf Planetiler режет в тайлы по схеме tiles/extra.yml):

  * Объёмные деревья: каждое дерево — несколько ярусов кроны (многоугольники с
    высотой), которые стиль рисует через fill-extrusion. Так деревья выглядят
    объёмно и правильно заслоняются зданиями. Источники:
      - реальные деревья и аллеи из OSM (natural=tree, natural=tree_row) — все;
      - леса, рощи и сады (landuse=forest, natural=wood, landuse=orchard) рядом с
        городами, посёлками и сёлами — не в домах, не на дорогах и не в воде;
      - с флагом --decor — ещё декоративные ряды вдоль городских улиц и посадки в
        парках (помечены decor=yes).
    Чтобы тайлы оставались лёгкими, в тайле 15-го зума (около 1 км²) не больше
    TILE_BUDGET деревьев: большие леса и сады засаживаются реже, но равномерно.
    Реальные деревья из OSM не выбрасываются.
  * Подъезды: точка чуть перед дверью, номер (ref), квартиры (addr:flats) и угол
    стены — стиль рисует стрелку, указывающую на вход.
  * Городские детали вблизи: «зебры» поперёк дороги (из точек highway=crossing и
    линий footway=crossing), заборы, стены и живые изгороди (объёмные), площадки
    парковок, светофоры, ворота и шлагбаумы, лавочки, фонтаны, туалеты, питьевая вода
    и названия зданий без организаций (одно на комплекс).
  * Индекс поиска (--search=…): населённые пункты, улицы, дома с номерами и
    организации с типом, часами работы, телефоном и сайтом — для src/search.js.
  * Маска страны: контур Таджикистана из OSM (admin_level=2) для «заморозки» соседей.
  * Выгрузка без подписей соседних стран (четвёртый аргумент) — из неё собираются
    основные тайлы. За границей убираются названия, адреса, населённые пункты и
    места, а дороги, дома и реки остаются и видны под «заморозкой». Поэтому стиль
    рисует подписи Таджикистана поверх «заморозки», и у границы они не обрезаются.

Выгрузка читается три раза: леса, сады, вода и деревья; дома, дороги, детали и
поиск; копия без подписей соседей. Вся страна — около трёх минут.

Нужен только pyosmium 4+: pip install osmium
"""
import json
import math
import random
import sys
from collections import defaultdict

import osmium
from osmium.osm.mutable import Node, Way

COUNTRY = 'TJ'
DECOR = '--decor' in sys.argv
Z = 15  # зум дополнительных тайлов (tiles/extra.yml)
NT = 1 << Z
# Леса и сады засаживаются, если до населённого пункта не дальше стольких метров.
SETTLEMENT_RADIUS = {'city': 6000, 'town': 3000, 'village': 800}
# Декоративные посадки (--decor) — только в городах и посёлках.
DECOR_RADIUS = {'city': 12000, 'town': 5000}
TILE_BUDGET = 1000  # деревьев на тайл 15-го зума
# Заливка: шаг, м; доля занятых мест; диаметр кроны, м; высота, м; разброс (доля шага).
FILLS = {
    'wood': (8.0, 0.9, (6.0, 9.0), (10.0, 16.0), 0.38),
    'orchard': (6.0, 0.95, (3.5, 4.5), (3.5, 5.0), 0.07),  # ровные ряды невысоких деревьев
    'park': (13.0, 0.8, (5.5, 8.5), (8.0, 13.0), 0.25),    # только с --decor
}
STREET_CLASSES = {  # полуширина проезжей части, м
    'primary': 9.0, 'secondary': 7.5, 'tertiary': 6.5, 'residential': 4.5,
    'living_street': 4.0, 'unclassified': 4.5, 'pedestrian': 4.0,
}
ROAD_CLASSES = set(STREET_CLASSES) | {'motorway', 'trunk', 'motorway_link', 'trunk_link', 'primary_link',
                                      'secondary_link', 'tertiary_link', 'service'}
PATH_CLASSES = {'footway', 'path', 'cycleway', 'steps', 'track', 'bridleway'}
STREET_SPACING = 12.0
CELL = 60.0  # ячейка индекса препятствий, м
# Городские мелочи, как на подробных картах: светофоры, ворота, шлагбаумы, лавочки, фонтаны.
POINT_KINDS = {
    'traffic_signals': 'signals',
    'gate': 'gate', 'swing_gate': 'gate', 'sliding_gate': 'gate', 'kissing_gate': 'gate',
    'lift_gate': 'lift_gate',
    'bench': 'bench', 'fountain': 'fountain', 'toilets': 'toilets', 'drinking_water': 'water',
    'parking': 'parking',
}
# Заборы и стены: высота и толщина объёмной полосы, м.
BARRIERS = {'wall': (2.2, 0.5), 'city_wall': (4.0, 1.2), 'retaining_wall': (1.0, 0.5), 'fence': (1.6, 0.25),
            'hedge': (1.2, 0.9)}
NO_CROSSING = {'no', 'unmarked', 'informal', 'impossible'}
POI_KEYS = ('amenity', 'shop', 'tourism', 'office', 'leisure', 'craft', 'healthcare', 'historic')
NAME_KEYS = ('name', 'name:ru', 'name:tg', 'name:en')
BAND = 50.0  # полоса индекса рёбер воды, м

# Проекция: метры на плоскости около средней широты выгрузки (задаётся в main).
KX = KY = 1.0


def set_projection(lat0):
    global KX, KY
    KX = 111320.0 * math.cos(math.radians(lat0))
    KY = 110540.0


def to_xy(lon, lat):
    return lon * KX, lat * KY


def to_lonlat(x, y):
    return x / KX, y / KY


def tile_x(x):
    return int((x / KX + 180.0) / 360.0 * NT)


def tile_y(y):
    lat = math.radians(max(-85.0, min(85.0, y / KY)))
    return int((1.0 - math.asinh(math.tan(lat)) / math.pi) / 2.0 * NT)


class Grid:
    """Простой пространственный индекс по ячейкам."""

    def __init__(self, cell=CELL):
        self.cell = cell
        self.cells = defaultdict(list)

    def add_bbox(self, item, x1, y1, x2, y2):
        c = self.cell
        for i in range(int(x1 // c), int(x2 // c) + 1):
            for j in range(int(y1 // c), int(y2 // c) + 1):
                self.cells[(i, j)].append(item)

    def near(self, x, y):
        return self.cells.get((int(x // self.cell), int(y // self.cell)), ())

    def around(self, x, y):
        i, j = int(x // self.cell), int(y // self.cell)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                yield from self.cells.get((i + di, j + dj), ())


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
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


def num(value, default):
    try:
        return float(str(value).split()[0].replace(',', '.'))
    except (TypeError, ValueError):
        return default


def bbox(rings):
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    return min(xs), min(ys), max(xs), max(ys)


def ring_edges(rings):
    return [(r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]) for r in rings for i in range(len(r) - 1)
            if r[i][1] != r[i + 1][1]]


def crossings(edges, y):
    """Отрезки строки y внутри многоугольника (правило чётности, дыры учитываются)."""
    xs = sorted(ax + (y - ay) * (bx - ax) / (by - ay) for ax, ay, bx, by in edges if (ay <= y) != (by <= y))
    return [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]


def subtract(spans, holes):
    if not holes:
        return spans
    holes.sort()
    out = []
    for s, e in spans:
        cur = s
        for hs, he in holes:
            if he <= cur or hs >= e:
                continue
            if hs > cur:
                out.append((cur, hs))
            cur = max(cur, he)
            if cur >= e:
                break
        if cur < e:
            out.append((cur, e))
    return out


class Water:
    """Водоёмы: рёбра разложены по горизонтальным полосам, чтобы быстро вычитать воду из строки."""

    def __init__(self, polygons):
        self.items = []
        self.index = Grid(1000.0)
        for rings in polygons:
            bands = defaultdict(list)
            for e in ring_edges(rings):
                for b in range(int(min(e[1], e[3]) // BAND), int(max(e[1], e[3]) // BAND) + 1):
                    bands[b].append(e)
            box = bbox(rings)
            self.items.append((box, bands))
            self.index.add_bbox(len(self.items) - 1, *box)

    def near(self, box):
        ids = set()
        x1, y1, x2, y2 = box
        c = self.index.cell
        for i in range(int(x1 // c), int(x2 // c) + 1):
            for j in range(int(y1 // c), int(y2 // c) + 1):
                ids.update(self.index.cells.get((i, j), ()))
        return [self.items[i] for i in ids if self.items[i][0][0] <= x2 and self.items[i][0][2] >= x1
                and self.items[i][0][1] <= y2 and self.items[i][0][3] >= y1]

    @staticmethod
    def spans(items, y):
        out = []
        for (x1, y1, x2, y2), bands in items:
            if y1 <= y <= y2:
                out.extend(crossings(bands.get(int(y // BAND), ()), y))
        return out


class Country:
    """«Внутри страны?» по точному контуру из OSM (lon/lat). Для ячеек сетки, которых
    не касается граница, ответ одинаков для всей ячейки и запоминается."""
    CELL = 0.01   # ~1 км
    BAND = 0.002  # полоса индекса рёбер, градусы

    def __init__(self, rings):
        self.bands = defaultdict(list)
        self.border = set()
        self.cells = {}
        self.empty = not rings
        c = self.CELL
        for outer, inners in rings:
            for ring in [outer, *inners]:
                for (ax, ay), (bx, by) in zip(ring, ring[1:]):
                    for b in range(int(min(ay, by) // self.BAND), int(max(ay, by) // self.BAND) + 1):
                        self.bands[b].append((ax, ay, bx, by))
                    for i in range(int(min(ax, bx) // c), int(max(ax, bx) // c) + 1):
                        for j in range(int(min(ay, by) // c), int(max(ay, by) // c) + 1):
                            self.border.add((i, j))

    def exact(self, lon, lat):
        inside = False
        for ax, ay, bx, by in self.bands.get(int(lat // self.BAND), ()):
            if (ay <= lat) != (by <= lat) and lon < ax + (lat - ay) * (bx - ax) / (by - ay):
                inside = not inside
        return inside

    def contains(self, lon, lat):
        if self.empty:
            return True
        key = (int(lon // self.CELL), int(lat // self.CELL))
        if key in self.border:
            return self.exact(lon, lat)
        state = self.cells.get(key)
        if state is None:
            state = self.cells[key] = self.exact((key[0] + 0.5) * self.CELL, (key[1] + 0.5) * self.CELL)
        return state

    def near_border(self, lon, lat, cells=2):
        i, j = int(lon // self.CELL), int(lat // self.CELL)
        return any((i + di, j + dj) in self.border for di in range(-cells, cells + 1) for dj in range(-cells, cells + 1))


def is_label_key(key):
    return key.startswith('name') or '_name' in key or key.startswith('addr:')


def write_clipped(src, dst, country):
    """Копия выгрузки без подписей соседних стран (см. описание модуля).

    Точки за границей теряют все теги (кроме вершин гор у самой границы, например
    пика Ленина), линии и отношения целиком за границей — названия и адреса."""
    reader = osmium.io.Reader(src, osmium.osm.osm_entity_bits.NOTHING)
    header = reader.header()  # в заголовке — рамка выгрузки, по ней Planetiler выбирает тайлы
    reader.close()
    w = osmium.SimpleWriter(dst, overwrite=True, header=header)
    outside_ways = set()
    cleaned = 0
    for o in osmium.FileProcessor(src).with_locations():
        if o.is_node():
            if len(o.tags) == 0 or country.contains(o.location.lon, o.location.lat) or (
                    o.tags.get('natural') in ('peak', 'volcano')
                    and country.near_border(o.location.lon, o.location.lat)):
                w.add_node(o)
            else:
                w.add_node(o.replace(tags={}))
                cleaned += 1
        elif o.is_way():
            nodes = o.nodes
            try:
                outside = len(nodes) > 0 and not any(
                    country.contains(nodes[i].lon, nodes[i].lat) for i in {0, len(nodes) // 2, len(nodes) - 1})
            except osmium.InvalidLocationError:
                outside = False
            if outside:
                outside_ways.add(o.id)
                if any(is_label_key(t.k) for t in o.tags):
                    w.add_way(o.replace(tags={t.k: t.v for t in o.tags if not is_label_key(t.k)}))
                    cleaned += 1
                    continue
            w.add_way(o)
        elif o.is_relation():
            ways = [m.ref for m in o.members if m.type == 'w']
            if ways and all(r in outside_ways for r in ways) and any(is_label_key(t.k) for t in o.tags):
                w.add_relation(o.replace(tags={t.k: t.v for t in o.tags if not is_label_key(t.k)}))
                cleaned += 1
            else:
                w.add_relation(o)
    w.close()
    return cleaned


# ——— Первый проход: природа ———

class Nature:
    def __init__(self):
        self.places = []      # (класс, x, y)
        self.trees = []       # (x, y, крона, высота)
        self.tree_rows = []   # [(x, y)]
        self.fills = []       # (вид, кольца [(x, y)])
        self.water = []       # кольца
        self.entrances = {}   # id точки -> (lon, lat, теги)
        self.country = []     # кольца границы страны (lon, lat)


def read_nature(path):
    d = Nature()
    fp = (osmium.FileProcessor(path)
          .with_locations()
          .with_areas(osmium.filter.KeyFilter('natural', 'landuse', 'leisure', 'waterway', 'boundary'))
          .with_filter(osmium.filter.KeyFilter('place', 'natural', 'landuse', 'leisure', 'waterway',
                                               'boundary', 'entrance')))
    for o in fp:
        t = o.tags
        if o.is_node():
            lon, lat = o.location.lon, o.location.lat
            if t.get('place') in ('city', 'town', 'village'):
                d.places.append((t['place'], *to_xy(lon, lat)))
            if t.get('natural') == 'tree':
                d.trees.append((*to_xy(lon, lat), num(t.get('diameter_crown'), 7.0), num(t.get('height'), 9.0)))
            if 'entrance' in t:
                d.entrances[o.id] = (lon, lat, {k: t[k] for k in ('entrance', 'ref', 'addr:flats') if k in t})
        elif o.is_way():
            if t.get('natural') == 'tree_row':
                try:
                    d.tree_rows.append([to_xy(n.lon, n.lat) for n in o.nodes])
                except osmium.InvalidLocationError:
                    pass
        elif o.is_area():
            kind = None
            if t.get('landuse') == 'orchard':
                kind = 'orchard'
            elif t.get('landuse') == 'forest' or t.get('natural') == 'wood':
                kind = 'wood'
            elif t.get('leisure') in ('park', 'garden') or t.get('landuse') == 'village_green':
                kind = 'park'
            elif (t.get('natural') == 'water' or t.get('waterway') == 'riverbank'
                  or t.get('landuse') in ('reservoir', 'basin')):
                kind = 'water'
            country = (t.get('boundary') == 'administrative' and t.get('admin_level') == '2'
                       and COUNTRY in (t.get('ISO3166-1'), t.get('ISO3166-1:alpha2')))
            if not kind and not country:
                continue
            for outer in o.outer_rings():
                try:
                    ring = [(n.lon, n.lat) for n in outer]
                    inners = [[(n.lon, n.lat) for n in inner] for inner in o.inner_rings(outer)]
                except osmium.InvalidLocationError:
                    continue
                if country:
                    d.country.append((ring, inners))
                if kind:
                    rings = [[to_xy(*p) for p in r] for r in [ring, *inners]]
                    if kind == 'water':
                        d.water.append(rings[:1])  # острова внутри воды не засаживаем
                    else:
                        d.fills.append((kind, rings))
    return d


# ——— Планирование: сколько деревьев сажать в каждом лесу и саду ———

class Places:
    def __init__(self, places):
        self.grid = defaultdict(list)
        for cls, x, y in places:
            self.grid[(int(x // 5000), int(y // 5000))].append((cls, x, y))

    def within(self, x, y, radius):
        i, j = int(x // 5000), int(y // 5000)
        reach = int(max(radius.values(), default=0) // 5000) + 1
        for di in range(-reach, reach + 1):
            for dj in range(-reach, reach + 1):
                for cls, px, py in self.grid.get((i + di, j + dj), ()):
                    r = radius.get(cls)
                    if r and (px - x) ** 2 + (py - y) ** 2 < r * r:
                        return True
        return False


def rows(rings, spacing, water_items, rnd=None):
    """Строки заливки: (y, отрезки внутри многоугольника без воды)."""
    edges = ring_edges(rings)
    x0, y0, x1, y1 = bbox(rings)
    y = y0 + spacing * (0.5 if rnd is None else rnd.uniform(0.2, 0.8))
    while y < y1:
        spans = subtract(crossings(edges, y), Water.spans(water_items, y))
        if spans:
            yield y, spans
        y += spacing


def grid_points(x0, spans, spacing):
    """Точки сетки с началом в x0 внутри отрезков строки."""
    for a, b in spans:
        k = math.ceil((a - x0) / spacing - 0.5)
        x = x0 + (k + 0.5) * spacing
        while x < b:
            yield x
            x += spacing


def plan(fills, places, water, real_per_tile):
    """Доля мест, которые остаются в каждом лесу/саду, чтобы в тайле было не больше TILE_BUDGET деревьев."""
    plans = []
    per_tile = defaultdict(float)
    for kind, rings in fills:
        spacing, keep = FILLS[kind][:2]
        if kind == 'park' and not DECOR:
            continue
        radius = DECOR_RADIUS if kind == 'park' else SETTLEMENT_RADIUS
        outer = rings[0]
        step = max(1, len(outer) // 40)
        if not any(places.within(x, y, radius) for x, y in outer[::step]):
            continue
        box = bbox(rings)
        items = water.near(box)
        counts = defaultdict(int)
        for y, spans in rows(rings, spacing, items):
            ty = tile_y(y)
            for x in grid_points(box[0], spans, spacing):
                counts[(tile_x(x), ty)] += 1
        if not counts:
            continue
        for t, n in counts.items():
            per_tile[t] += n * keep
        plans.append((kind, rings, box, items, counts))
    share = {t: min(1.0, max(0.0, TILE_BUDGET - real_per_tile.get(t, 0)) / n) for t, n in per_tile.items() if n}
    out = []
    for kind, rings, box, items, counts in plans:
        p = min(share[t] for t in counts)
        if p > 0:
            out.append((kind, rings, box, items, p, set(counts)))
    return out


# ——— Городские детали и поиск ———

def centroid(ring):
    """Центр тяжести кольца (lon, lat); для вырожденных — среднее точек."""
    xy = [to_xy(*p) for p in ring]
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(xy, xy[1:] + xy[:1]):
        f = x1 * y2 - x2 * y1
        a += f
        cx += (x1 + x2) * f
        cy += (y1 + y2) * f
    if abs(a) < 1e-6:
        return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    return to_lonlat(cx / (3 * a), cy / (3 * a))


def poi_category(t):
    """Категория места для поиска — те же id, что в src/categories.js."""
    a, shop, tour, hist = t.get('amenity'), t.get('shop'), t.get('tourism'), t.get('historic')
    if shop in ('mall', 'department_store') or a == 'marketplace':
        return 'mall'
    if a in ('restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'ice_cream', 'food_court'):
        return 'food'
    if a == 'pharmacy':
        return 'pharmacy'
    if tour in ('hotel', 'hostel', 'guest_house', 'motel', 'apartment'):
        return 'hotel'
    if a in ('hospital', 'clinic', 'doctors', 'dentist', 'veterinary') or 'healthcare' in t:
        return 'health'
    if a in ('bank', 'atm', 'bureau_de_change'):
        return 'bank'
    if a == 'fuel':
        return 'fuel'
    if a in ('school', 'kindergarten', 'college', 'university', 'library'):
        return 'edu'
    if (tour in ('museum', 'attraction', 'gallery', 'zoo', 'theme_park') or a in ('theatre', 'cinema', 'arts_centre')
            or hist in ('monument', 'memorial', 'castle') or t.get('leisure') == 'stadium'):
        return 'culture'
    if a in ('townhall', 'police', 'post_office', 'courthouse', 'fire_station', 'embassy') or t.get('office') == 'government':
        return 'gov'
    if a == 'place_of_worship':
        return 'worship'
    if a == 'bus_station' or t.get('railway') in ('station', 'halt') or t.get('public_transport') == 'station':
        return 'transport'
    if t.get('aeroway') == 'aerodrome':
        return 'airport'
    if shop:
        return 'shop'
    return 'other'


POI_TYPE_KEYS = ('amenity', 'shop', 'tourism', 'healthcare', 'leisure', 'office', 'craft', 'historic', 'railway',
                 'aeroway')


def is_poi(t):
    return (any(k in t for k in POI_KEYS) or t.get('railway') in ('station', 'halt')
            or t.get('aeroway') == 'aerodrome')


def poi_details(t):
    """Тип места (значение OSM: cafe, pharmacy…) и сведения для карточки: часы, телефон, сайт, адрес."""
    kind = next((t[k] if t[k] != 'yes' else k for k in POI_TYPE_KEYS if k in t), '')
    info = {}
    for key, tags in (('hours', ('opening_hours',)), ('phone', ('phone', 'contact:phone')),
                      ('site', ('website', 'contact:website', 'url')), ('insta', ('contact:instagram',))):
        v = next((t[k] for k in tags if t.get(k)), None)
        if v:
            info[key] = v[:120]
    street = t.get('addr:street') or t.get('addr:place')
    if street and t.get('addr:housenumber'):
        info['addr'] = f"{street}, {t['addr:housenumber']}"
    return kind, info


def ring_area(ring):
    """Площадь кольца в условных единицах (градусы², с поправкой на широту) — чтобы выбрать главное из зданий."""
    k = math.cos(math.radians(ring[0][1]))
    return abs(sum(ax * k * by - bx * k * ay for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]))) / 2


class Search:
    """Индекс для поиска без сервера: населённые пункты, улицы, адреса и места."""

    def __init__(self):
        self.places = []    # (класс, lon, lat, имена)
        self.pois = []      # (lon, lat, имена, категория, тип, сведения)
        self.streets = defaultdict(list)  # (имя, клетка 3 км) -> [(lon, lat, имена)]
        self.addresses = []  # (lon, lat, улица, дом)

    @staticmethod
    def names(t):
        return tuple(t.get(k) or '' for k in NAME_KEYS)

    def add_street(self, coords, t):
        lon, lat = coords[len(coords) // 2]
        x, y = to_xy(lon, lat)
        key = ((t.get('name:ru') or t['name']).lower(), int(x // 3000), int(y // 3000))
        self.streets[key].append((lon, lat, self.names(t)))

    def write(self, path, country):
        settlements = [p for p in self.places if p[0] in ('city', 'town', 'village') and country.contains(p[1], p[2])]
        grid = defaultdict(list)
        for i, (cls, lon, lat, _names) in enumerate(settlements):
            x, y = to_xy(lon, lat)
            grid[(int(x // 10000), int(y // 10000))].append((i, x, y, {'city': 1.0, 'town': 1.6, 'village': 3.0}[cls]))

        def nearest(lon, lat):
            x, y = to_xy(lon, lat)
            best, best_d = -1, 1e18
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    for i, px, py, w in grid.get((int(x // 10000) + di, int(y // 10000) + dj), ()):
                        d = math.hypot(px - x, py - y) * w  # город «притягивает» сильнее села
                        if d < best_d:
                            best, best_d = i, d
            return best

        items = []

        def add(names, kind, cat, lon, lat, typ='', info=None):
            if not country.contains(lon, lat):
                return
            name, ru, tg, en = names
            title = ru or name
            if not title:
                return
            # Местное имя в OSM обычно таджикское («Хуҷанд»): если name:tg нет, ищем и по нему.
            tg = tg or (name if name != title else '')
            item = [title, tg if tg != title else '', en if en != title else '', kind, cat, typ,
                    round(lon, 5), round(lat, 5), nearest(lon, lat)]
            if info:
                item.append(info)
            items.append(item)

        for cls, lon, lat, names in self.places:
            add(names, 'place', cls, lon, lat)
        for (_key, _i, _j), ways in self.streets.items():
            mx = sum(w[0] for w in ways) / len(ways)
            my = sum(w[1] for w in ways) / len(ways)
            lon, lat, names = min(ways, key=lambda w: (w[0] - mx) ** 2 + (w[1] - my) ** 2)
            add(names, 'street', '', lon, lat)
        for lon, lat, names, cat, typ, info in self.pois:
            add(names, 'poi', cat, lon, lat, typ, info)
        seen = set()
        for lon, lat, street, number in self.addresses:
            key = (street, number, round(lon, 3), round(lat, 3))  # дом и точка на нём — один адрес
            if key not in seen:
                seen.add(key)
                add((f'{street}, {number}', '', '', ''), 'address', '', lon, lat)
        cities = [(names[1] or names[0]) for _cls, _lon, _lat, names in settlements]
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'version': 2, 'fields': ['name', 'name_tg', 'name_en', 'kind', 'category', 'type', 'lon', 'lat',
                                                'place', 'info'],
                       'places': cities, 'items': items}, f, ensure_ascii=False, separators=(',', ':'))
        return len(items)


class Details:
    """Мелочи вблизи: переходы, светофоры, ворота, заборы, парковки, названия зданий."""

    def __init__(self):
        self.points = []            # (lon, lat, вид, имя)
        self.crossing_nodes = {}    # id точки -> (lon, lat, вид)
        self.node_crossings = {}    # id точки -> ([(lon, lat), (lon, lat)], вид) — поперёк дороги
        self.crossings = []         # ([(lon, lat)], вид)
        self.crossing_way_nodes = set()
        self.barriers = []          # ([(lon, lat)], вид)
        self.parkings = []          # ([(lon, lat)], имя)
        self.labels = []            # (lon, lat, имена, площадь) — здания с названием
        self.search = Search()

    def node(self, o):
        t = o.tags
        lon, lat = o.location.lon, o.location.lat
        kind = (POINT_KINDS.get(t.get('highway')) or POINT_KINDS.get(t.get('barrier'))
                or POINT_KINDS.get(t.get('amenity')))
        if kind:
            self.points.append((lon, lat, kind, t.get('name', '')))
        if (t.get('highway') == 'crossing' or ('crossing' in t and t.get('highway') == 'traffic_signals')) \
                and t.get('crossing') not in NO_CROSSING:
            signals = t.get('crossing') == 'traffic_signals' or t.get('highway') == 'traffic_signals'
            self.crossing_nodes[o.id] = (lon, lat, 'signals' if signals else 'zebra')
        if 'name' in t:
            if t.get('place') in ('city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood'):
                self.search.places.append((t['place'], lon, lat, Search.names(t)))
            elif is_poi(t):
                self.search.pois.append((lon, lat, Search.names(t), poi_category(t), *poi_details(t)))
        if 'addr:housenumber' in t and ('addr:street' in t or 'addr:place' in t):
            self.search.addresses.append((lon, lat, t.get('addr:street') or t['addr:place'], t['addr:housenumber']))

    def way(self, o, coords, refs):
        t = o.tags
        hw = t.get('highway')
        if hw in ('footway', 'path', 'cycleway') and 'crossing' in (t.get('footway'), t.get('cycleway'), t.get('path')) \
                and t.get('crossing') not in NO_CROSSING:
            self.crossings.append((coords, 'signals' if t.get('crossing') == 'traffic_signals' else 'zebra'))
            self.crossing_way_nodes.update(refs)
        elif hw in ROAD_CLASSES and t.get('area') != 'yes':
            for i, ref in enumerate(refs):
                if ref in self.crossing_nodes and ref not in self.node_crossings:
                    self.node_crossings[ref] = (self.across(coords, i, STREET_CLASSES.get(hw, 3.5) + 0.5),
                                                self.crossing_nodes[ref][2])
        if hw and 'name' in t and (hw in ROAD_CLASSES or hw in ('living_street', 'pedestrian')) and len(coords) > 1:
            self.search.add_street(coords, t)
        if t.get('barrier') in BARRIERS and len(coords) > 1:
            self.barriers.append((coords, t['barrier']))

    @staticmethod
    def across(coords, i, half):
        """Отрезок поперёк дороги через точку i: «зебра» по ширине проезжей части."""
        xy = [to_xy(*p) for p in coords]
        (ax, ay), (bx, by) = xy[max(i - 1, 0)], xy[min(i + 1, len(xy) - 1)]
        length = math.hypot(bx - ax, by - ay) or 1.0
        nx, ny = -(by - ay) / length, (bx - ax) / length
        x, y = xy[i]
        return [to_lonlat(x + nx * half, y + ny * half), to_lonlat(x - nx * half, y - ny * half)]

    def area(self, o, ring):
        t = o.tags
        lon, lat = centroid(ring)
        if t.get('amenity') == 'parking':
            if t.get('parking') not in ('underground',):
                self.parkings.append((ring, t.get('name', '')))
            self.points.append((lon, lat, 'parking', t.get('name', '')))
        if 'name' in t:
            if is_poi(t):
                self.search.pois.append((lon, lat, Search.names(t), poi_category(t), *poi_details(t)))
            elif 'building' in t:
                self.labels.append((lon, lat, Search.names(t), ring_area(ring)))
        if 'building' in t and 'addr:housenumber' in t and ('addr:street' in t or 'addr:place' in t):
            self.search.addresses.append((lon, lat, t.get('addr:street') or t['addr:place'], t['addr:housenumber']))

    def building_labels(self):
        """Одно название на комплекс: части здания с тем же именем ближе 250 м не подписываются."""
        kept = defaultdict(list)
        out = []
        for lon, lat, names, _area in sorted(self.labels, key=lambda lb: -lb[3]):
            x, y = to_xy(lon, lat)
            key = (names[1] or names[0]).lower()
            if all(math.hypot(x - kx, y - ky) > 250 for kx, ky in kept[key]):
                kept[key].append((x, y))
                out.append((lon, lat, names))
        return out

    def crossing_lines(self):
        nodes = [(line, kind) for ref, (line, kind) in self.node_crossings.items() if ref not in self.crossing_way_nodes]
        return self.crossings + nodes


# ——— Второй проход: дома и дороги там, где сажаются деревья ———

class Obstacles:
    def __init__(self):
        self.buildings = []   # (bbox, кольцо)
        self.blocks = Grid()
        self.segs = []        # (a, b, полуширина)
        self.lines = Grid()
        self.streets = []     # (класс, [(x, y)], [id точек]) — только для --decor
        self.node_use = defaultdict(int)
        self.entrance_out = []  # (lon, lat, угол, теги)

    def add_segment(self, a, b, half):
        # Запас на половину кроны: дерево не должно залезать на дорогу.
        m = half + 5.0
        self.segs.append((a, b, half))
        self.lines.add_bbox(len(self.segs) - 1, min(a[0], b[0]) - m, min(a[1], b[1]) - m,
                            max(a[0], b[0]) + m, max(a[1], b[1]) + m)

    def free(self, x, y, r):
        for i in self.blocks.near(x, y):
            (x1, y1, x2, y2), poly = self.buildings[i]
            if x1 - r <= x <= x2 + r and y1 - r <= y <= y2 + r:
                if point_in_ring(x, y, poly) or any(seg_dist(x, y, *poly[k], *poly[k - 1]) < r * 0.6
                                                    for k in range(len(poly))):
                    return False
        for i in self.lines.near(x, y):
            (ax, ay), (bx, by), half = self.segs[i]
            if seg_dist(x, y, ax, ay, bx, by) < half + r * 0.5:
                return False
        return True


def read_obstacles(path, active, entrances, details):
    """Второй проход: дома и дороги (для посадки деревьев и подъездов) и городские детали."""
    ob = Obstacles()

    def in_active(x, y):
        return (tile_x(x), tile_y(y)) in active

    keys = ('building', 'highway', 'barrier', 'place', 'addr:housenumber', 'railway', 'aeroway', *POI_KEYS)
    fp = (osmium.FileProcessor(path)
          .with_locations()
          .with_areas(osmium.filter.KeyFilter('building', 'aeroway', *POI_KEYS))
          .with_filter(osmium.filter.KeyFilter(*keys)))
    for o in fp:
        t = o.tags
        if o.is_node():
            details.node(o)
        elif o.is_way():
            try:
                coords = [(n.lon, n.lat) for n in o.nodes]
            except osmium.InvalidLocationError:
                continue
            refs = [n.ref for n in o.nodes]
            details.way(o, coords, refs)
            if 'building' in t and len(coords) > 3 and o.is_closed():
                if any(r in entrances for r in refs):
                    entrance_angles(coords, refs, entrances, ob.entrance_out)
            hw = t.get('highway')
            if hw in ROAD_CLASSES or hw in PATH_CLASSES:
                if t.get('area') == 'yes':
                    continue
                xy = [to_xy(*p) for p in coords]
                half = 2.2 if hw in PATH_CLASSES else STREET_CLASSES.get(hw, 5.0) + 1.0
                for a, b in zip(xy, xy[1:]):
                    if in_active(*a) or in_active(*b):
                        ob.add_segment(a, b, half)
                if DECOR and hw in ROAD_CLASSES and in_active(*xy[0]):
                    for r in refs:
                        ob.node_use[r] += 1
                    plain = hw in STREET_CLASSES and t.get('bridge') is None and t.get('tunnel') is None
                    ob.streets.append((hw if plain else '_' + hw, xy, refs))
        elif o.is_area():
            for i, outer in enumerate(o.outer_rings()):
                try:
                    lonlat = [(n.lon, n.lat) for n in outer]
                except osmium.InvalidLocationError:
                    continue
                if i == 0:
                    details.area(o, lonlat)
                if 'building' not in t:
                    continue
                ring = [to_xy(*p) for p in lonlat]
                box = bbox([ring])
                if in_active(box[0], box[1]) or in_active(box[2], box[3]):
                    ob.buildings.append((box, ring))
                    ob.blocks.add_bbox(len(ob.buildings) - 1, box[0] - 6, box[1] - 6, box[2] + 6, box[3] + 6)
    return ob


def entrance_angles(coords, refs, entrances, out):
    ring, refs = coords[:-1], refs[:-1]
    lat0 = ring[0][1]
    k = 111320.0 * math.cos(math.radians(lat0))
    xy = [(lon * k, lat * 110540.0) for lon, lat in ring]
    ccw = signed_area(xy) > 0
    for i, ref in enumerate(refs):
        if ref not in entrances:
            continue
        (ax, ay), (bx, by) = xy[i - 1], xy[(i + 1) % len(xy)]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1.0
        # Наружная нормаль: справа от направления для кольца против часовой стрелки.
        ox, oy = (dy / length, -dx / length) if ccw else (-dy / length, dx / length)
        angle = math.degrees(math.atan2(-ox, -oy)) % 360  # стрелка смотрит внутрь, на дверь
        x, y = xy[i]
        out.append(((x + ox * 2.5) / k, (y + oy * 2.5) / 110540.0, round(angle), entrances.pop(ref)[2]))


# ——— Посадка ———

class Forest:
    """Посаженные деревья с проверкой лимита на тайл и расстояния до соседей."""

    def __init__(self):
        self.trees = []  # (x, y, крона, высота, декоративное)
        self.per_tile = defaultdict(int)
        self.near = Grid(8.0)

    def add(self, x, y, crown, height, decor=False):
        self.trees.append((x, y, crown, height, decor))
        self.per_tile[(tile_x(x), tile_y(y))] += 1
        self.near.add_bbox(len(self.trees) - 1, x, y, x, y)

    def crowded(self, x, y, d):
        return any((self.trees[i][0] - x) ** 2 + (self.trees[i][1] - y) ** 2 < d * d for i in self.near.around(x, y))

    def full(self, x, y):
        return self.per_tile[(tile_x(x), tile_y(y))] >= TILE_BUDGET


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


def plant(nature, plans, ob, places, rnd):
    forest = Forest()
    for x, y, crown, height in nature.trees:
        forest.add(x, y, crown, height)
    for coords in nature.tree_rows:
        for x, y in along(coords, 8.0, 0.0, rnd):
            forest.add(x, y, 6.5, 9.0)

    # Леса, рощи и сады: сетка с шагом, увеличенным под лимит тайла.
    for kind, rings, box, items, share, _tiles in sorted(plans, key=lambda p: p[0] == 'park'):
        spacing, keep, crowns, heights, jitter = FILLS[kind]
        step = spacing / math.sqrt(share)
        j = jitter * step
        decor = kind == 'park'
        for y, spans in rows(rings, step, items, rnd):
            for x in grid_points(box[0], spans, step):
                if rnd.random() >= keep:
                    continue
                px, py = x + rnd.uniform(-j, j), y + rnd.uniform(-j, j)
                crown = rnd.uniform(*crowns)
                if forest.full(px, py) or forest.crowded(px, py, crown * 0.6) or not ob.free(px, py, crown):
                    continue
                forest.add(px, py, crown, rnd.uniform(*heights), decor)

    # Декоративные ряды вдоль городских улиц (только с --decor).
    junction = {nid for nid, k in ob.node_use.items() if k > 1}
    for cls, xy, ids in ob.streets:
        if cls.startswith('_') or not places.within(*xy[0], DECOR_RADIUS):
            continue
        stops = [xy[i] for i, nid in enumerate(ids) if nid in junction] + [xy[0], xy[-1]]
        crown = 6.5
        offset = STREET_CLASSES[cls] + 1.8 + crown / 2
        for side in (-1, 1):
            for x, y in along(xy, STREET_SPACING, side * offset, rnd):
                if any(math.hypot(x - sx, y - sy) < offset + 9 for sx, sy in stops):
                    continue
                if not forest.full(x, y) and not forest.crowded(x, y, 7) and ob.free(x, y, crown):
                    forest.add(x, y, crown, rnd.uniform(8, 12), True)
    return forest.trees


# ——— Запись ———

# Ярусы кроны по профилю шара: (доля радиуса, низ, верх в долях высоты).
# Нижний узкий ярус изображает ствол, дальше — округлая «шапка» кроны.
TIERS = [(0.16, 0.0, 0.34), (0.72, 0.30, 0.46), (0.95, 0.42, 0.60), (1.0, 0.56, 0.74),
         (0.86, 0.70, 0.86), (0.52, 0.83, 0.97)]
SIDES = 12
TRUNK_SIDES = 6
UNIT = {n: [(math.cos(a * 2 * math.pi / n), math.sin(a * 2 * math.pi / n)) for a in range(n)]
        for n in (TRUNK_SIDES, SIDES)}
NODES_PER_TREE = TRUNK_SIDES + (len(TIERS) - 1) * SIDES


def outline(coords, width):
    """Полоса заданной ширины вдоль ломаной (lon, lat) — объёмный забор или стена."""
    xy = [to_xy(*p) for p in coords]
    xy = [p for i, p in enumerate(xy) if i == 0 or p != xy[i - 1]]
    if len(xy) < 2:
        return None
    normals = []
    for (ax, ay), (bx, by) in zip(xy, xy[1:]):
        length = math.hypot(bx - ax, by - ay) or 1.0
        normals.append((-(by - ay) / length, (bx - ax) / length))
    left, right = [], []
    for i, (x, y) in enumerate(xy):
        n1 = normals[max(i - 1, 0)]
        n2 = normals[min(i, len(normals) - 1)]
        nx, ny = n1[0] + n2[0], n1[1] + n2[1]
        length = math.hypot(nx, ny) or 1.0
        nx, ny = nx / length, ny / length
        k = width / 2 / max(0.35, nx * n2[0] + ny * n2[1])  # стык под углом шире, но не бесконечно
        left.append(to_lonlat(x + nx * k, y + ny * k))
        right.append(to_lonlat(x - nx * k, y - ny * k))
    return left + right[::-1] + [left[0]]


def write(dst, trees, entrances, details, rnd):
    """Сначала все точки, потом линии: номера точек каждого дерева идут подряд."""
    w = osmium.SimpleWriter(dst, overwrite=True)
    nid = 0

    def node(lon, lat, tags=None):
        nonlocal nid
        nid += 1
        w.add_node(Node(id=nid, location=(lon, lat), tags=tags or {}, version=1))
        return nid

    for lon, lat, angle, tags in entrances:
        node(lon, lat, {'yoobi': 'entrance', **({'angle': str(angle)} if angle is not None else {}),
                        **{('flats' if k == 'addr:flats' else k): v for k, v in tags.items()}})
    for lon, lat, kind, name in details.points:
        node(lon, lat, {'yoobi': 'point', 'kind': kind, **({'name': name} if name else {})})
    for lon, lat, names in details.building_labels():
        node(lon, lat, {'yoobi': 'label', **{k: v for k, v in zip(NAME_KEYS, names) if v}})
    shapes = []  # (id точек, теги) — линии и многоугольники деталей
    for coords, kind in details.crossing_lines():
        shapes.append(([node(*p) for p in coords], {'yoobi': 'crossing', 'kind': kind}))
    for coords, kind in details.barriers:
        shapes.append(([node(*p) for p in coords], {'yoobi': 'barrier_line', 'kind': kind}))
        height, width = BARRIERS[kind]
        ring = outline(coords, width)
        if ring:
            ids = [node(*p) for p in ring[:-1]]
            shapes.append((ids + [ids[0]], {'yoobi': 'barrier', 'kind': kind, 'height': f'{height:.1f}'}))
    for ring, name in details.parkings:
        if len(ring) > 3 and ring[0] == ring[-1]:
            ids = [node(*p) for p in ring[:-1]]
            shapes.append((ids + [ids[0]], {'yoobi': 'parking', **({'name': name} if name else {})}))
    first = nid = nid + 1
    shades = bytearray(len(trees))
    for i, (x, y, crown, _height, _decor) in enumerate(trees):
        shades[i] = rnd.randrange(3)
        rot = rnd.uniform(0, math.pi / 4)
        c, s = math.cos(rot), math.sin(rot)
        for k, (scale, _lo, _hi) in enumerate(TIERS):
            r = crown / 2 * scale
            for ux, uy in UNIT[TRUNK_SIDES if k == 0 else SIDES]:
                w.add_node(Node(id=nid, location=((x + r * (ux * c - uy * s)) / KX,
                                                  (y + r * (ux * s + uy * c)) / KY), version=1))
                nid += 1
    wid = 1
    for ids, tags in shapes:
        w.add_way(Way(id=wid, nodes=ids, tags=tags, version=1))
        wid += 1
    for i, (_x, _y, _crown, height, decor) in enumerate(trees):
        nid = first + i * NODES_PER_TREE
        for k, (_scale, lo, hi) in enumerate(TIERS):
            n = TRUNK_SIDES if k == 0 else SIDES
            w.add_way(Way(id=wid, nodes=[*range(nid, nid + n), nid], version=1, tags={
                'yoobi': 'tree', 'tier': str(k), 'shade': str(shades[i]),
                'min_height': f'{height * lo:.1f}', 'height': f'{height * hi:.1f}',
                **({'decor': 'yes'} if decor else {})}))
            nid += n
            wid += 1
    w.close()


def write_mask(path, rings):
    """«Всё, кроме страны»: мир с дырами на месте страны и её эксклавов; анклавы
    соседей внутри страны — отдельные многоугольники."""
    if not rings:
        return

    def clean(ring, ccw):
        ring = simplify([list(p) for p in ring], 0.0001)  # ~10 м: кромка совпадает с границей и вблизи
        if (signed_area(ring) > 0) != ccw:
            ring.reverse()
        return [[round(x, 5), round(y, 5)] for x, y in ring]

    world = [[40, 20], [110, 20], [110, 60], [40, 60], [40, 20]]
    holes = [clean(outer, False) for outer, _ in rings]
    islands = [[clean(inner, True)] for _, inners in rings for inner in inners]
    geometry = ({'type': 'MultiPolygon', 'coordinates': [[world, *holes], *islands]} if islands
                else {'type': 'Polygon', 'coordinates': [world, *holes]})
    with open(path, 'w') as f:
        json.dump({'type': 'Feature', 'properties': {}, 'geometry': geometry}, f, separators=(',', ':'))


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


def header_latitude(path):
    reader = osmium.io.Reader(path, osmium.osm.osm_entity_bits.NOTHING)
    box = reader.header().box()
    reader.close()
    return (box.bottom_left.lat + box.top_right.lat) / 2 if box.valid() else 38.5


def main(src, dst, mask_path, clipped_path=None, search_path=None):
    set_projection(header_latitude(src))
    rnd = random.Random(7)
    nature = read_nature(src)
    country = Country(nature.country)
    # Леса и сады засаживаются только у своих населённых пунктов, не у соседских.
    own = [p for p in nature.places if country.contains(*to_lonlat(p[1], p[2]))]
    places = Places(own)
    water = Water(nature.water)
    real = defaultdict(int)
    for x, y, *_ in nature.trees:
        real[(tile_x(x), tile_y(y))] += 1
    plans = plan(nature.fills, places, water, real)
    active = set()
    for *_, tiles in plans:
        for tx, ty in tiles:
            active.update((tx + i, ty + j) for i in (-1, 0, 1) for j in (-1, 0, 1))
    if DECOR:
        for cls, x, y in own:
            if cls in DECOR_RADIUS:
                r = DECOR_RADIUS[cls]
                for tx in range(tile_x(x - r), tile_x(x + r) + 1):
                    for ty in range(tile_y(y + r), tile_y(y - r) + 1):
                        active.add((tx, ty))
    details = Details()
    ob = read_obstacles(src, active, nature.entrances, details)
    trees = plant(nature, plans, ob, places, rnd)
    # Подъезды не на контуре здания — без направления.
    entrances = ob.entrance_out + [(lon, lat, None, tags) for lon, lat, tags in nature.entrances.values()]
    write(dst, trees, entrances, details, rnd)
    write_mask(mask_path, nature.country)
    per_tile = defaultdict(int)
    for x, y, *_ in trees:
        per_tile[(tile_x(x), tile_y(y))] += 1
    print(f'деревьев: {len(trees)} (из OSM {len(nature.trees)}, декоративных {sum(t[4] for t in trees)}), '
          f'засажено лесов и садов: {len(plans)}, тайлов с деревьями: {len(per_tile)}, '
          f'больше всего в тайле: {max(per_tile.values(), default=0)}, подъездов: {len(entrances)}, '
          f'граница страны: {"да" if nature.country else "нет"}')
    kinds = defaultdict(int)
    for *_, kind, _name in details.points:
        kinds[kind] += 1
    print(f'переходов: {len(details.crossing_lines())}, заборов и стен: {len(details.barriers)}, '
          f'парковок: {len(details.parkings)}, названий зданий: {len(details.building_labels())}, '
          f'точек: {dict(sorted(kinds.items()))}')
    if search_path:
        print(f'поиск: {search_path} ({details.search.write(search_path, country)} записей)')
    if clipped_path:
        if not nature.country:
            print(f'Границы {COUNTRY} в выгрузке нет — подписи соседей не убираются', file=sys.stderr)
        cleaned = write_clipped(src, clipped_path, country)
        print(f'выгрузка без подписей соседних стран: {clipped_path} (очищено объектов: {cleaned})')


if __name__ == '__main__':
    sys.setrecursionlimit(100000)
    search = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--search=')), None)
    main(*[a for a in sys.argv[1:] if not a.startswith('--')][:4], search_path=search)
