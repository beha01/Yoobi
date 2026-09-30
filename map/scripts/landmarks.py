"""Процедурные модели ориентиров для объёмной карты: купола и минареты мечетей,
трибуны стадионов, беговые дорожки и разметка спортивных площадок.

Всё строится по контурам OpenStreetMap и простым правилам архитектуры (данные 2ГИС
и Яндекса не используются):

  * мечеть — барабан и купол по центру самого большого вписанного в здание круга,
    у больших мечетей — ещё малые купола и минареты по углам здания; минареты,
    отмеченные в OSM (tower:type=minaret), ставятся там, где они есть;
  * Большая мечеть Душанбе — по открытым сведениям: главный купол около 47 м,
    четыре минарета около 72 м;
  * стадион — ступенчатые трибуны вокруг поля и дорожки, у больших — козырёк над
    главной трибуной; сплошной контур building=stadium поверх поля убирается;
  * площадка — цвет покрытия (трава, грунт корта, резина дорожки) и разметка по
    стандартным размерам: футбол, мини-футбол, баскетбол, теннис, волейбол;
  * памятник — гранитный постамент с бронзовой фигурой (статуя, бюст) или
    ступенчатая стела с золотым шаром (стела, обелиск, воинский мемориал);
  * флагшток — сужающаяся мачта с золотым шаром и развевающийся флаг (у флага
    Таджикистана — красная, белая и зелёная полосы 2:3:2 и золотая корона); контур
    здания-мачты (tower:type=flag_pole) не выдавливается столбом;
  * монумент «Истиқлол ва Озодӣ» — по открытым сведениям: высота 121 м, основание
    около 30 м, башня 91 м, наверху — корона, как на гербе.

Геометрия — на плоскости в метрах (функции to_xy / to_lonlat из extras.py).
"""

import heapq
import math

SQ2 = math.sqrt(2)

# ——— Геометрия на плоскости (метры) ———


def ring_area(ring):
    return abs(sum(ax * by - bx * ay for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]))) / 2


def centroid(ring):
    a = cx = cy = 0.0
    for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
        f = ax * by - bx * ay
        a += f
        cx += (ax + bx) * f
        cy += (ay + by) * f
    if abs(a) < 1e-9:
        return sum(x for x, _ in ring) / len(ring), sum(y for _, y in ring) / len(ring)
    return cx / (3 * a), cy / (3 * a)


def inside(x, y, rings):
    """Точка внутри многоугольника с дырами (правило чёт-нечет по всем кольцам)."""
    c = False
    for ring in rings:
        for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                c = not c
    return c


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def edge_dist(x, y, rings):
    return min(seg_dist(x, y, *a, *b) for ring in rings for a, b in zip(ring, ring[1:] + ring[:1]))


def polylabel(rings, precision=0.5):
    """Центр самого большого вписанного круга (алгоритм polylabel): (x, y, радиус)."""
    outer = rings[0]
    xs, ys = [p[0] for p in outer], [p[1] for p in outer]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    size = min(maxx - minx, maxy - miny)
    if size <= 0:
        return minx, miny, 0.0

    def cell(x, y, h):
        d = edge_dist(x, y, rings) * (1 if inside(x, y, rings) else -1)
        return (-(d + h * SQ2), x, y, h, d)

    heap = []
    h = size / 2
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            heapq.heappush(heap, cell(x + h, y + h, h))
            y += size
        x += size
    best = cell(*centroid(outer), 0)
    middle = cell((minx + maxx) / 2, (miny + maxy) / 2, 0)
    if middle[4] > best[4]:
        best = middle
    for _ in range(4000):
        if not heap:
            break
        c = heapq.heappop(heap)
        if c[4] > best[4]:
            best = c
        if -c[0] - best[4] <= precision:
            continue
        h = c[3] / 2
        for dx in (-h, h):
            for dy in (-h, h):
                heapq.heappush(heap, cell(c[1] + dx, c[2] + dy, h))
    return best[1], best[2], max(best[4], 0.0)


def hull(points):
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


class Frame:
    """Прямоугольник наименьшей площади вокруг точек: центр, полудлина hu вдоль длинной
    стороны (ось u), полуширина hv (ось v) и перевод координат (u, v) -> (x, y)."""

    def __init__(self, points):
        h = hull(points)
        best = None
        for i in range(len(h)):
            (ax, ay), (bx, by) = h[i], h[(i + 1) % len(h)]
            if (ax, ay) == (bx, by):
                continue
            ang = math.atan2(by - ay, bx - ax)
            c, s = math.cos(ang), math.sin(ang)
            us = [x * c + y * s for x, y in h]
            vs = [-x * s + y * c for x, y in h]
            area = (max(us) - min(us)) * (max(vs) - min(vs))
            if best is None or area < best[0]:
                best = (area, min(us), max(us), min(vs), max(vs), ang)
        _a, u1, u2, v1, v2, ang = best or (0, 0, 0, 0, 0, 0)
        uc, vc = (u1 + u2) / 2, (v1 + v2) / 2
        c, s = math.cos(ang), math.sin(ang)
        self.cx, self.cy = uc * c - vc * s, uc * s + vc * c
        self.hu, self.hv = (u2 - u1) / 2, (v2 - v1) / 2
        if self.hv > self.hu:
            self.hu, self.hv, ang = self.hv, self.hu, ang + math.pi / 2
        self.angle = ang
        self.c, self.s = math.cos(ang), math.sin(ang)

    def pt(self, u, v):
        return self.cx + u * self.c - v * self.s, self.cy + u * self.s + v * self.c

    def uv(self, x, y):
        dx, dy = x - self.cx, y - self.cy
        return dx * self.c + dy * self.s, -dx * self.s + dy * self.c


def circle(x, y, r, n=24):
    return [(x + r * math.cos(2 * math.pi * k / n), y + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def arc(cu, cv, r, a0, a1, n=12):
    """Точки дуги в координатах (u, v) от угла a0 до a1 (радианы)."""
    return [(cu + r * math.cos(a0 + (a1 - a0) * k / n), cv + r * math.sin(a0 + (a1 - a0) * k / n))
            for k in range(n + 1)]


def rounded(hu, hv, r, seg=6):
    """Скруглённый прямоугольник (u, v) против часовой стрелки: по seg+1 точек на угол."""
    r = max(0.0, min(r, hu, hv))
    pts = []
    for cu, cv, a0 in ((hu - r, hv - r, 0.0), (-(hu - r), hv - r, math.pi / 2),
                       (-(hu - r), -(hv - r), math.pi), (hu - r, -(hv - r), 1.5 * math.pi)):
        pts.extend(arc(cu, cv, r, a0, a0 + math.pi / 2, seg))
    return pts


# ——— Сбор объектов ———

MOSQUE_MIN_AREA = 70.0
GRAND_AREA = 15000.0     # Большая мечеть Душанбе и подобные
BIG_AREA = 1500.0        # у таких — минареты по углам
LEVEL = 3.66             # как render_height в OpenMapTiles
STADIUM_MIN_AREA = 9000.0
STADIUM_WORDS = ('стадион', 'варзишгоҳ', 'варзишгох', 'stadium', 'arena', 'арена')
SOCCER = {'soccer', 'football', 'futsal', 'american_football', 'rugby', 'rugby_union'}


def height_of(tags):
    """Высота здания, как её считает OpenMapTiles (render_height), или None."""
    for key in ('height', 'building:height'):
        v = number(tags.get(key))
        if v:
            return math.ceil(v)
    levels = number(tags.get('building:levels'))
    if levels:
        return math.ceil(levels * LEVEL)
    return None


def monument_kind(t):
    """Вид модели памятника: 'statue', 'bust', 'stele' или None (доски, камни — без модели)."""
    memorial = t.get('memorial', '')
    if t.get('man_made') == 'obelisk' or memorial in ('stele', 'obelisk', 'war_memorial'):
        return 'stele'
    if t.get('historic') not in ('monument', 'memorial'):
        return None
    if memorial == 'bust':
        return 'bust'
    if memorial in ('', 'statue', 'sculpture', 'yes'):
        return 'statue'
    return None


def tajik_flag(t):
    return (t.get('country') == 'TJ' or t.get('flag:wikidata') == 'Q160124' or t.get('subject:wikidata') == 'Q863'
            or 'tajikistan' in (t.get('flag:name') or '').lower())


# Ориентиры со своей моделью: по номеру в OSM, а если контур перерисуют — по названию.
SPECIAL = {('w', 1166323844): 'istiqlol'}


def special_kind(t, key):
    if key in SPECIAL:
        return SPECIAL[key]
    if t.get('historic') == 'monument' and (t.get('name') or '').startswith('Истиқлол ва Озодӣ'):
        return 'istiqlol'
    return None


def square(x, y, half, angle=0.0):
    c, s = math.cos(angle), math.sin(angle)
    return [(x + (u * c - v * s) * half, y + (u * s + v * c) * half) for u, v in ((1, 1), (-1, 1), (-1, -1), (1, -1))]


def number(value):
    if not value:
        return None
    try:
        return float(str(value).replace(',', '.').split()[0].rstrip('m'))
    except ValueError:
        return None


class Landmarks:
    """Собирает мечети, минареты, стадионы и площадки при чтении OSM и строит модели."""

    def __init__(self, to_xy, to_lonlat):
        self.to_xy, self.to_lonlat = to_xy, to_lonlat
        self.mosques = []      # (ключ, кольца xy, теги, это здание)
        self.minarets = []     # (x, y, радиус, высота)
        self.stadiums = []     # (кольца xy, теги)
        self.pitches = []      # (кольца xy, теги)
        self.tracks = []       # кольца xy
        self.monuments = []    # (x, y, вид, масштаб, высота)
        self.sites = []        # индексы мечетей-территорий без здания
        self.buildings = []    # (ключ, кольца xy, теги) — здания на территориях мечетей и стадионов
        self.site_grid = {}    # клетка 200 м -> [(рамка, 'mosque'|'stadium', индекс)]
        self.flagpoles = []    # (x, y, высота, флаг Таджикистана)
        self.special = []      # (вид, ключ, кольца xy, теги) — ориентиры со своей моделью
        # Результат build()
        self.objects = []      # (lon, lat, теги) — купола и шары для объёмного слоя
        self.models = []       # ([(lon, lat)], теги) — барабаны, минареты, трибуны
        self.lines = []        # ([(lon, lat)], теги) — разметка
        self.areas = []        # ([(lon, lat)], теги) — покрытия площадок, полосы газона
        self.overrides = {}    # ('w'|'r', id) -> новые теги для основных тайлов
        self.covered = []      # рамки трибун: сюда не ставятся ML-здания Overture
        self.stats = {}

    # ——— Первый проход (природа): территории ———

    def rings(self, o):
        out = []
        for outer in o.outer_rings():
            try:
                ring = [self.to_xy(n.lon, n.lat) for n in outer][:-1]
                inners = [[self.to_xy(n.lon, n.lat) for n in inner][:-1] for inner in o.inner_rings(outer)]
            except Exception:  # точка без координат
                continue
            if len(ring) >= 3:
                out.append([ring, *[r for r in inners if len(r) >= 3]])
        return out

    @staticmethod
    def key(o):
        return ('w' if o.from_way() else 'r', o.orig_id())

    def area(self, o):
        """Территории из первого прохода: мечети, стадионы, площадки, дорожки, минареты."""
        t = o.tags
        leisure = t.get('leisure')
        mosque = (t.get('amenity') == 'place_of_worship' and t.get('religion') == 'muslim') or t.get('building') == 'mosque'
        minaret = t.get('tower:type') == 'minaret' or t.get('building') == 'minaret' or t.get('man_made') == 'minaret'
        monument = 'building' not in t and monument_kind(t)
        if monument:
            for rings in self.rings(o):
                x, y = centroid(rings[0])
                scale = max(1.0, min(3.0, math.sqrt(ring_area(rings[0])) / 9))
                self.monuments.append((x, y, monument, scale, number(t.get('height'))))
            return
        if not (mosque or minaret or leisure in ('stadium', 'pitch', 'track')):
            return
        tags = {tag.k: tag.v for tag in t}
        for rings in self.rings(o):
            if minaret:
                x, y = centroid(rings[0])
                r = max(1.2, min(4.0, math.sqrt(ring_area(rings[0]) / math.pi)))
                self.minarets.append((x, y, r, number(tags.get('height')) or 28.0))
            elif mosque:
                self.mosques.append((self.key(o), rings, tags, 'building' in tags))
                if 'building' not in tags:
                    self.site(rings[0], 'mosque', len(self.mosques) - 1)
            elif leisure == 'stadium':
                self.stadiums.append((rings, tags))
                self.site(rings[0], 'stadium', len(self.stadiums) - 1)
            elif leisure == 'pitch':
                self.pitches.append((rings, tags))
            else:
                self.tracks.append(rings[0])

    def node(self, o):
        t = o.tags
        if t.get('man_made') == 'flagpole' and (number(t.get('height')) or 0) >= 8:
            x, y = self.to_xy(o.location.lon, o.location.lat)
            self.flagpoles.append((x, y, number(t.get('height')), tajik_flag(t)))
        if t.get('tower:type') == 'minaret' or t.get('man_made') == 'minaret':
            x, y = self.to_xy(o.location.lon, o.location.lat)
            self.minarets.append((x, y, 1.8, number(t.get('height')) or 28.0))
        kind = monument_kind(t)
        if kind:
            x, y = self.to_xy(o.location.lon, o.location.lat)
            self.monuments.append((x, y, kind, 1.0, number(t.get('height'))))

    def site(self, ring, kind, index):
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        box = (min(xs), min(ys), max(xs), max(ys))
        for i in range(int(box[0] // 200), int(box[2] // 200) + 1):
            for j in range(int(box[1] // 200), int(box[3] // 200) + 1):
                self.site_grid.setdefault((i, j), []).append((box, kind, index))

    # ——— Второй проход (дома): здания на территориях ———

    def building(self, o):
        """Здание внутри территории мечети или стадиона запоминается целиком."""
        t = o.tags
        if t.get('tower:type') == 'flag_pole' or t.get('man_made') == 'flagpole':
            self.special.append(('flag_pole', self.key(o), self.rings(o), {tag.k: tag.v for tag in t}))
            return
        if special_kind(t, self.key(o)):
            self.special.append((special_kind(t, self.key(o)), self.key(o), self.rings(o), {tag.k: tag.v for tag in t}))
            return
        if (t.get('amenity') == 'place_of_worship' and t.get('religion') == 'muslim') or t.get('building') == 'mosque':
            return  # уже взято в первом проходе
        for rings in self.rings(o):
            x, y = centroid(rings[0])
            for box, _kind, _i in self.site_grid.get((int(x // 200), int(y // 200)), ()):
                if box[0] <= x <= box[2] and box[1] <= y <= box[3]:
                    self.buildings.append((self.key(o), rings, {tag.k: tag.v for tag in t}))
                    break

    # ——— Построение ———

    def lonlat(self, pts):
        return [self.to_lonlat(x, y) for x, y in pts]

    def model(self, ring_xy, kind, base, top, **extra):
        if top - base < 0.05 or len(ring_xy) < 3:
            return
        self.models.append((self.lonlat(ring_xy), {'yoobi': 'model', 'kind': kind, 'min_height': f'{base:.1f}',
                                                   'height': f'{top:.1f}', **extra}))

    def obj(self, x, y, kind, r, h, z, zmin, tone):
        lon, lat = self.to_lonlat(x, y)
        self.objects.append((lon, lat, {'yoobi': 'object', 'kind': kind, 'r': f'{r:.2f}', 'h': f'{h:.2f}',
                                        'z': f'{z:.2f}', 'zmin': f'{zmin:.2f}', 'tone': tone}))

    def build_stadiums(self):
        """Трибуны, дорожки и покрытия полей. Вызывается до загрузки ML-зданий Overture."""
        count = dict(stands=0, tracks=0, pitches=0, markings=0, slabs=0)
        pitch_of = {}  # индекс площадки -> индекс стадиона
        for pi, (rings, _t) in enumerate(self.pitches):
            x, y = centroid(rings[0])
            for box, kind, si in self.site_grid.get((int(x // 200), int(y // 200)), ()):
                if kind == 'stadium' and box[0] <= x <= box[2] and box[1] <= y <= box[3] \
                        and inside(x, y, self.stadiums[si][0]):
                    pitch_of[pi] = si
                    break
        # Площадки: покрытие и разметка.
        for rings, t in self.pitches:
            if self.pitch(rings, t):
                count['markings'] += 1
            count['pitches'] += 1
        for ring in self.tracks:
            self.areas.append((self.lonlat(ring), {'yoobi': 'pitch', 'kind': 'track'}))
            count['tracks'] += 1
        # Трибуны.
        by_stadium = {}
        for pi, si in pitch_of.items():
            by_stadium.setdefault(si, []).append(pi)
        tracks_in = {}
        for ti, ring in enumerate(self.tracks):
            x, y = centroid(ring)
            for box, kind, si in self.site_grid.get((int(x // 200), int(y // 200)), ()):
                if kind == 'stadium' and box[0] <= x <= box[2] and box[1] <= y <= box[3] \
                        and inside(x, y, self.stadiums[si][0]):
                    tracks_in.setdefault(si, []).append(ti)
                    break
        inside_buildings = {}
        for bi, (_key, rings, t) in enumerate(self.buildings):
            x, y = centroid(rings[0])
            for box, kind, si in self.site_grid.get((int(x // 200), int(y // 200)), ()):
                if kind == 'stadium' and box[0] <= x <= box[2] and box[1] <= y <= box[3] \
                        and inside(x, y, self.stadiums[si][0]):
                    inside_buildings.setdefault(si, []).append(bi)
                    break
        for si, (rings, t) in enumerate(self.stadiums):
            area = ring_area(rings[0])
            if area < STADIUM_MIN_AREA:
                continue
            pitches = sorted(by_stadium.get(si, []), key=lambda p: -ring_area(self.pitches[p][0][0]))
            named = any(w in (t.get('name', '') + ' ' + t.get('name:ru', '')).lower() for w in STADIUM_WORDS)
            if not pitches and not (named or t.get('sport') in SOCCER | {'multi', 'athletics'}):
                continue
            blds = [self.buildings[b] for b in inside_buildings.get(si, [])]
            if any(b[2].get('building') == 'grandstand' for b in blds):
                continue  # настоящие трибуны уже нарисованы в OSM
            slabs = [b for b in blds if b[2].get('building') == 'stadium' and ring_area(b[1][0]) > 0.5 * area]
            small = [b for b in blds if b not in slabs and ring_area(b[1][0]) > 150]
            if small and sum(ring_area(b[1][0]) for b in small) > 0.08 * area:
                continue  # вокруг поля настоящие здания — трибуны не выдумываем
            if self.stands(rings, t, [self.pitches[p] for p in pitches], [self.tracks[i] for i in tracks_in.get(si, [])]):
                count['stands'] += 1
                for key, _r, bt in slabs:  # сплошная «коробка» стадиона поверх поля
                    self.overrides[key] = {k: v for k, v in bt.items() if k not in ('building', 'building:levels', 'height')}
                    count['slabs'] += 1
        self.stats.update(count)

    def stands(self, rings, t, pitches, tracks):
        stadium = Frame(rings[0])
        area = ring_area(rings[0])
        if pitches:
            field = Frame(pitches[0][0][0])
        elif 110 <= 2 * stadium.hu <= 280 and 75 <= 2 * stadium.hv <= 210:
            field = Frame([stadium.pt(u, v) for u, v in ((52.5, 34), (-52.5, 34), (-52.5, -34), (52.5, -34))])
            self.pitch([[field.pt(u, v) for u, v in ((52.5, 34), (-52.5, 34), (-52.5, -34), (52.5, -34))]],
                       {'sport': 'soccer'})
        else:
            return False
        if field.hu < 15 or field.hv < 10:
            return False
        # Внутренний край: дорожка, если есть, иначе поле с запасом.
        hu, hv, corner = field.hu + 5, field.hv + 4, 4.0
        for ring in tracks:
            tf = Frame(ring)
            if tf.hu > hu - 1 and tf.hv > hv - 1:
                hu, hv, corner = tf.hu + 1.5, tf.hv + 1.5, tf.hv * 0.9  # овал вокруг дорожки
        # Трибуны по рамке поля, но не шире самого стадиона.
        room_u, room_v = stadium.hu - hu, stadium.hv - hv
        cap = 10 if area < 15000 else 17 if area < 26000 else 24
        depth = min(cap, min(room_u, room_v) - 1.5)
        if depth < 5:
            return False
        tiers = 1 if depth < 10 else 2 if depth < 17 else 3
        seg = 6
        frame = field
        steps = []
        for i in range(tiers + 1):
            d = depth * i / tiers
            steps.append(rounded(hu + d, hv + d, corner + d, seg))
        n = seg + 1
        for i in range(tiers):
            inner, outer = steps[i], steps[i + 1]
            top = 3.0 + (i + 1) * depth / tiers * 0.48
            kind = 'stand' if i % 2 == 0 else 'stand2'
            pieces = []
            for c in range(4):  # углы
                idx = list(range(c * n, c * n + n))
                pieces.append([inner[k] for k in idx] + [outer[k] for k in reversed(idx)])
            for c in range(4):  # стороны между углами
                a, b = c * n + n - 1, ((c + 1) % 4) * n
                pieces.append([inner[a], inner[b], outer[b], outer[a]])
            for piece in pieces:
                xy = [frame.pt(u, v) for u, v in piece]
                self.model(xy, kind, 0.0, top)
                xs, ys = [p[0] for p in xy], [p[1] for p in xy]
                self.covered.append((min(xs), min(ys), max(xs), max(ys)))
        # Козырёк над главной (западной) трибуной больших стадионов.
        if area >= 24000 and depth >= 14:
            top = 3.0 + depth * 0.48
            side = 1 if math.cos(frame.angle + math.pi / 2) < 0 else -1  # сторона +v смотрит на запад?
            v0, v1 = hv + depth * 0.25, hv + depth + 1.5
            length = hu * 0.8
            roof = [(-length, side * v0), (length, side * v0), (length, side * v1), (-length, side * v1)]
            self.model([frame.pt(u, v) for u, v in roof], 'canopy', top + 3.0, top + 4.2)
        return True

    def pitch(self, rings, t):
        """Покрытие площадки и разметка; True, если разметка нарисована."""
        outer = rings[0]
        f = Frame(outer)
        area = ring_area(outer)
        sport = (t.get('sport') or '').split(';')[0]
        surface = t.get('surface', '')
        L, W = 2 * f.hu, 2 * f.hv
        rect = area / max(L * W, 1.0) > 0.8
        if sport in ('', 'multi', 'yes'):
            sport = ('soccer' if L >= 45 and W >= 25 else 'basketball' if 22 <= L <= 36 and 12 <= W <= 22
                     else 'volleyball' if 15 <= L < 22 and 7 <= W <= 13 else '')
        if sport == 'soccer' and L < 45:
            sport = 'futsal'
        kind = {'tennis': 'clay' if surface in ('clay', 'dirt') else 'hard',
                'basketball': 'court', 'volleyball': 'sand' if surface == 'sand' else 'court',
                'beachvolleyball': 'sand', 'futsal': 'turf' if surface == 'artificial_turf' else 'court',
                'running': 'track', 'athletics': 'track'}.get(sport, 'grass')
        if kind == 'grass' and surface in ('asphalt', 'concrete', 'paved'):
            kind = 'court'
        if kind == 'grass' and surface == 'artificial_turf':
            kind = 'turf'
        self.areas.append((self.lonlat(outer), {'yoobi': 'pitch', 'kind': kind}))
        if not rect or f.hu < 6 or f.hv < 3:
            return False
        draw = {'soccer': self.soccer, 'futsal': self.futsal, 'football': self.soccer, 'basketball': self.basketball,
                'tennis': self.tennis, 'volleyball': self.volleyball, 'beachvolleyball': self.volleyball}.get(sport)
        if not draw:
            return False
        draw(f)
        return True

    def line(self, f, pts, kind='line', closed=False):
        xy = [f.pt(u, v) for u, v in pts]
        if closed:
            xy.append(xy[0])
        self.lines.append((self.lonlat(xy), {'yoobi': 'marking', 'kind': kind}))

    def box(self, f, u1, v1, u2, v2, kind='line'):
        self.line(f, [(u1, v1), (u2, v1), (u2, v2), (u1, v2)], kind, closed=True)

    def soccer(self, f):
        a, b = f.hu - 0.8, f.hv - 0.8
        s = min(1.0, a / 52.5, b / 34.0)
        # Полосы газона, как после стрижки.
        n = 12 if a > 30 else 8
        for k in range(0, n, 2):
            u1, u2 = -a + 2 * a * k / n, -a + 2 * a * (k + 1) / n
            self.areas.append((self.lonlat([f.pt(u, v) for u, v in ((u1, -b), (u2, -b), (u2, b), (u1, b))]),
                               {'yoobi': 'pitch', 'kind': 'stripe'}))
        self.box(f, -a, -b, a, b)
        self.line(f, [(0, -b), (0, b)])
        self.line(f, arc(0, 0, 9.15 * s, 0, 2 * math.pi, 32))
        for side in (-1, 1):
            e = side * a
            pd, pw = 16.5 * s, min(20.16 * s, b * 0.62)
            gd, gw = 5.5 * s, min(9.16 * s, b * 0.3)
            self.line(f, [(e, -pw), (e - side * pd, -pw), (e - side * pd, pw), (e, pw)])
            self.line(f, [(e, -gw), (e - side * gd, -gw), (e - side * gd, gw), (e, gw)])
            spot = e - side * 11 * s
            half = math.acos(min(1.0, (pd - 11 * s) / (9.15 * s)))
            mid = math.pi if side > 0 else 0.0
            self.line(f, arc(spot, 0, 9.15 * s, mid - half, mid + half, 10))
            self.line(f, [(e, -3.66 * s), (e + side * 1.6 * s, -3.66 * s), (e + side * 1.6 * s, 3.66 * s),
                          (e, 3.66 * s)], 'goal')
            for sv in (-1, 1):  # угловые дуги
                a0 = math.atan2(-sv, -side)
                self.line(f, arc(e, sv * b, 1.0, a0 - math.pi / 4, a0 + math.pi / 4, 4))

    def futsal(self, f):
        a, b = f.hu - 0.5, f.hv - 0.5
        s = min(1.0, a / 20.0, b / 10.0)
        self.box(f, -a, -b, a, b)
        self.line(f, [(0, -b), (0, b)])
        self.line(f, arc(0, 0, 3.0 * s, 0, 2 * math.pi, 24))
        for side in (-1, 1):
            e = side * a
            r = 6.0 * s
            self.line(f, arc(e, 1.58 * s, r, math.pi / 2, math.pi if side > 0 else 0, 8)
                      + arc(e, -1.58 * s, r, math.pi if side > 0 else 0, 1.5 * math.pi if side > 0 else -math.pi / 2, 8))
            self.line(f, [(e, -1.5 * s), (e + side * 1.0, -1.5 * s), (e + side * 1.0, 1.5 * s), (e, 1.5 * s)], 'goal')

    def basketball(self, f):
        s = min(1.0, (f.hu - 0.6) / 14.0, (f.hv - 0.6) / 7.5)
        a, b = 14.0 * s, 7.5 * s
        self.box(f, -a, -b, a, b)
        self.line(f, [(0, -b), (0, b)])
        self.line(f, arc(0, 0, 1.8 * s, 0, 2 * math.pi, 20))
        for side in (-1, 1):
            e = side * a
            key = e - side * 5.8 * s
            self.line(f, [(e, -2.45 * s), (key, -2.45 * s), (key, 2.45 * s), (e, 2.45 * s)])
            mid = math.pi if side > 0 else 0.0
            self.line(f, arc(key, 0, 1.8 * s, mid - math.pi / 2, mid + math.pi / 2, 10))
            basket = e - side * 1.575 * s
            r, lim = 6.75 * s, b - 0.9 * s
            half = math.asin(min(1.0, lim / r))
            pts = arc(basket, 0, r, mid - half, mid + half, 16)
            # До лицевой линии — прямые отрезки.
            self.line(f, [(e, pts[0][1])] + pts + [(e, pts[-1][1])])

    def tennis(self, f):
        s = min(1.0, (f.hu - 0.6) / 11.885, (f.hv - 0.4) / 5.485)
        a, b = 11.885 * s, 5.485 * s
        single = b - 1.37 * s
        self.areas.append((self.lonlat([f.pt(u, v) for u, v in ((-a, -b), (a, -b), (a, b), (-a, b))]),
                           {'yoobi': 'pitch', 'kind': 'inner'}))
        self.box(f, -a, -b, a, b)
        for sv in (-1, 1):
            self.line(f, [(-a, sv * single), (a, sv * single)])
        for su in (-1, 1):
            self.line(f, [(su * 6.4 * s, -single), (su * 6.4 * s, single)])
        self.line(f, [(-6.4 * s, 0), (6.4 * s, 0)])
        self.line(f, [(0, -b - 0.9 * s), (0, b + 0.9 * s)], 'net')

    def volleyball(self, f):
        s = min(1.0, (f.hu - 0.6) / 9.0, (f.hv - 0.6) / 4.5)
        a, b = 9.0 * s, 4.5 * s
        self.box(f, -a, -b, a, b)
        for su in (-1, 1):
            self.line(f, [(su * 3.0 * s, -b), (su * 3.0 * s, b)])
        self.line(f, [(0, -b - 1.0 * s), (0, b + 1.0 * s)], 'net')

    def build_mosques(self, new_buildings=()):
        """Купола, барабаны и минареты. new_buildings — ML-здания Overture [(кольцо lon/lat, ...)]:
        на территории мечети без здания в OSM купол ставится на такое здание."""
        count = dict(mosques=0, domes=0, minarets=0, heights=0)
        seen = set()
        halls = []  # (ключ, кольца, теги здания, из OSM)
        site_halls = {}
        for key, rings, tags in self.buildings:
            x, y = centroid(rings[0])
            for box, kind, mi in self.site_grid.get((int(x // 200), int(y // 200)), ()):
                if kind == 'mosque' and box[0] <= x <= box[2] and box[1] <= y <= box[3] \
                        and inside(x, y, self.mosques[mi][1]):
                    best = site_halls.get(mi)
                    if best is None or ring_area(rings[0]) > ring_area(best[1][0]):
                        site_halls[mi] = (key, rings, tags, True)
                    break
        for ring, height, floors in new_buildings:
            xy = [self.to_xy(*p) for p in ring]
            if len(xy) < 3:
                continue
            x, y = centroid(xy)
            for box, kind, mi in self.site_grid.get((int(x // 200), int(y // 200)), ()):
                if kind == 'mosque' and mi not in site_halls and box[0] <= x <= box[2] and box[1] <= y <= box[3] \
                        and inside(x, y, self.mosques[mi][1]) and ring_area(xy) > 120:
                    site_halls[mi] = (None, [xy], {'height': f'{height:g}'} if height
                                      else {'building:levels': str(floors)} if floors else {}, False)
                    break
        for mi, (key, rings, tags, is_building) in enumerate(self.mosques):
            if is_building:
                halls.append((key, rings, tags, True))
            elif mi in site_halls:
                halls.append(site_halls[mi])
        # Минареты из OSM — рядом с мечетью, по ним не нужны выдуманные.
        real = [(x, y) for x, y, *_ in self.minarets]
        for x, y, r, h in self.minarets:
            self.minaret(x, y, r, h)
            count['minarets'] += 1
        for key, rings, tags, osm in halls:
            outer = rings[0]
            area = ring_area(outer)
            cx, cy = centroid(outer)
            mark = (round(cx), round(cy), round(area))
            if mark in seen or area < MOSQUE_MIN_AREA:
                continue
            seen.add(mark)
            count['mosques'] += 1
            grand = area >= GRAND_AREA
            base = height_of(tags)
            if base is None and not osm:
                base = 5.0  # ML-здание Overture без высоты: так его рисуют основные тайлы
            if base is None:  # высоты в OSM нет: зал по размеру здания
                base = 18.0 if grand else round(max(5.0, min(12.0, 4.5 + math.sqrt(area) * 0.06)), 1)
                if key:
                    self.overrides.setdefault(key, {**tags, 'height': f'{base:g}'})
                    count['heights'] += 1
            px, py, d = polylabel(rings, precision=0.5)
            if d < 3.0:
                continue
            f = Frame(outer)
            r = min(17.0, 0.9 * d) if grand else max(2.2, min(16.0, 0.62 * d, 0.3 * math.sqrt(area)))
            tone = 'turquoise'
            colour = (tags.get('roof:colour') or '').lower()
            if colour in ('gold', 'golden', 'yellow', '#ffd700', '#d4af37'):
                tone = 'gold'
            elif colour in ('white', 'silver', 'grey', 'gray', '#ffffff'):
                tone = 'white'
            elif colour in ('green', 'darkgreen', '#008000'):
                tone = 'green'
            elif colour in ('blue', 'lightblue', '#0000ff'):
                tone = 'blue'
            self.dome(px, py, r, base, tone, grand)
            count['domes'] += 1
            # Малые купола вокруг главного у больших мечетей.
            if area >= 2500:
                for du, dv in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    sr = r * 0.38
                    u0, v0 = f.uv(px, py)
                    x, y = f.pt(u0 + du * r * 1.75, v0 + dv * r * 1.75)
                    if inside(x, y, rings) and edge_dist(x, y, rings) > sr * 1.1:
                        self.dome(x, y, sr, base, tone, False, drum=False)
                        count['domes'] += 1
            # Минареты по углам больших мечетей, если настоящих рядом нет.
            if area >= BIG_AREA and not any(math.hypot(x - cx, y - cy) < 120 for x, y in real):
                top = base + (r * 0.3 if not grand else 6.0) + r * (1.2 if grand else 1.0)
                height = 72.0 if grand else max(20.0, min(48.0, top * 1.7))
                mr = 3.2 if grand else max(1.4, min(2.6, height * 0.05))
                corners = ((1, 1), (-1, 1), (-1, -1), (1, -1)) if area >= 6000 or grand else ((1, 1), (-1, -1))
                for su, sv in corners:
                    # Угол здания, ближайший к углу описанного прямоугольника, чуть внутрь.
                    tx, ty = f.pt(su * f.hu, sv * f.hv)
                    vx, vy = min(outer, key=lambda p: (p[0] - tx) ** 2 + (p[1] - ty) ** 2)
                    dx, dy = cx - vx, cy - vy
                    dl = math.hypot(dx, dy) or 1.0
                    x, y = vx + dx / dl * mr * 2.2, vy + dy / dl * mr * 2.2
                    if not inside(x, y, rings):
                        continue
                    self.minaret(x, y, mr, height)
                    count['minarets'] += 1
        self.stats.update(count)

    def build_monuments(self):
        """Постаменты с бронзовыми фигурами и стелы — у памятников OSM."""
        near = {}  # клетка 10 м -> поставленные памятники
        count = dict(statues=0, busts=0, steles=0)
        for x, y, kind, scale, height in self.monuments:
            cx, cy = int(x // 10), int(y // 10)
            if any(math.hypot(x - px, y - py) < 6 for i in (-1, 0, 1) for j in (-1, 0, 1)
                   for px, py in near.get((cx + i, cy + j), ())):
                continue  # памятник нанесён и точкой, и контуром
            near.setdefault((cx, cy), []).append((x, y))
            turn = (x * 7.31 + y * 3.17) % (math.pi / 2)  # постаменты не все по сторонам света
            s = scale
            if kind == 'stele':
                h = height or 12.0 * s
                w = max(0.6, h * 0.06)
                self.model(square(x, y, w * 2.0, turn), 'pedestal', 0.0, 0.9)
                self.model(square(x, y, w, turn), 'stele', 0.9, h * 0.72)
                self.model(square(x, y, w * 0.78, turn), 'stele', h * 0.72, h * 0.92)
                self.model(square(x, y, w * 0.5, turn), 'stele', h * 0.92, h)
                fr = max(0.3, w * 0.6)
                self.obj(x, y, 'finial', fr, fr, h + fr * 0.7, h - fr, 'gold')
                count['steles'] += 1
                continue
            bust = kind == 'bust'
            top = (1.7 if bust else 2.8) * s
            self.model(square(x, y, (1.1 if bust else 1.6) * s, turn), 'plinth', 0.0, 0.4 * s)
            self.model(square(x, y, (0.7 if bust else 1.05) * s, turn), 'pedestal', 0.4 * s, top)
            fr, fh = (0.38 * s, 0.55 * s) if bust else (0.55 * s, 1.35 * s)
            self.obj(x, y, 'figure', fr, fh, top + fh * 0.96, top, 'bronze')
            count['busts' if bust else 'statues'] += 1
        self.stats.update(count)

    def build_special(self):
        """Флагштоки и ориентиры со своей моделью (см. описание модуля)."""
        count = dict(flagpoles=0, monuments_special=0)
        poles = list(self.flagpoles)
        for kind, key, rings_list, tags in self.special:
            if not rings_list:
                continue
            ring = rings_list[0][0]
            x, y = centroid(ring)
            if kind == 'flag_pole':
                # Контур-мачта из OSM: вместо столба толщиной с контур — модель мачты.
                self.overrides[key] = {k: v for k, v in tags.items() if k not in ('building', 'height', 'building:levels')}
                if not any(math.hypot(px - x, py - y) < 15 for px, py, *_ in poles):
                    poles.append((x, y, number(tags.get('height')) or 20.0, tajik_flag(tags)))
            elif kind == 'istiqlol':
                self.istiqlol(key, ring, tags)
                count['monuments_special'] += 1
        for x, y, height, national in poles:
            self.flagpole(x, y, height, national)
            count['flagpoles'] += 1
        self.stats.update(count)

    def flagpole(self, x, y, height, national):
        r0 = max(0.12, height * 0.009)
        self.model(circle(x, y, r0 * 3.2, 16), 'pedestal', 0.0, min(1.4, 0.3 + height * 0.006))
        for (z0, z1, k) in ((0.0, 0.45, 1.0), (0.45, 0.8, 0.78), (0.8, 1.0, 0.58)):
            self.model(circle(x, y, r0 * k, 12), 'mast', height * z0, height * z1)
        fr = r0 * 0.9
        self.obj(x, y, 'finial', fr, fr, height + fr * 0.7, height - fr * 0.2, 'gold')
        # Полотнище 2:1, волна растёт к свободному краю; ветер — на восток с небольшим разбросом.
        fw = height * 0.36
        fh = fw / 2
        top = height - fr * 1.6
        angle = math.radians(-8 + (x * 3.7 + y * 1.3) % 16)
        c, s = math.cos(angle), math.sin(angle)
        thick = max(0.06, fw * 0.008)

        def strip(u0, u1, extra=0.0, n=28):
            upper, lower = [], []
            for i in range(n + 1):
                u = u0 + (u1 - u0) * i / n
                v = fw * 0.055 * math.sin(2 * math.pi * u / (fw * 0.72)) * (u / fw) ** 0.8
                h = (thick + extra) / 2
                upper.append((u, v + h))
                lower.append((u, v - h))
            return [(x + (u + r0) * c - v * s, y + (u + r0) * s + v * c) for u, v in upper + lower[::-1]]

        cloth = strip(0.0, fw)
        if national:  # Таджикистан: красная, белая и зелёная полосы 2:3:2 и золотая корона в центре
            self.model(cloth, 'flag-green', top - fh, top - fh * 5 / 7)
            self.model(cloth, 'flag-white', top - fh * 5 / 7, top - fh * 2 / 7)
            self.model(cloth, 'flag-red', top - fh * 2 / 7, top)
            crown = strip(fw * 0.5 - fh * 0.11, fw * 0.5 + fh * 0.11, extra=thick * 0.6, n=6)
            self.model(crown, 'gold', top - fh * 0.56, top - fh * 0.44)
        else:
            self.model(cloth, 'flag-white', top - fh, top)

    def istiqlol(self, key, ring, tags):
        """«Истиқлол ва Озодӣ»: стилобат по контуру OSM, круглое основание до 30 м, сужающаяся
        башня до 112 м и золотая корона до 121 м."""
        self.overrides[key] = {**{k: v for k, v in tags.items() if k not in ('building:levels',)}, 'height': '8',
                               'building': 'yes'}
        x, y, d = polylabel([ring])
        base_r = max(8.0, min(d * 0.62, 26.0))
        self.model(circle(x, y, base_r, 40), 'monument', 8.0, 30.0)
        self.model(circle(x, y, base_r * 0.72, 40), 'monument', 30.0, 33.0)
        for z0, z1, r in ((33.0, 60.0, 7.6), (60.0, 85.0, 6.6), (85.0, 104.0, 5.6), (104.0, 112.0, 4.8)):
            self.model(circle(x, y, r, 24), 'monument', z0, z1)
        self.model(circle(x, y, 5.6, 24), 'gold', 112.0, 115.6)
        self.obj(x, y, 'dome', 4.9, 5.4, 115.6, 115.6, 'gold')
        self.obj(x, y, 'finial', 0.9, 0.9, 121.6, 120.2, 'gold')

    def dome(self, x, y, r, base, tone, grand, drum=True):
        z = base
        if drum:
            h = 6.0 if grand else max(1.0, r * 0.3)
            self.model(circle(x, y, r * 1.02, 28), 'drum', base, base + h)
            z = base + h
        rv = r * (1.2 if grand else 1.0)
        self.obj(x, y, 'dome', r, rv, z, z, tone)
        # Навершие — маленький золотой шар.
        fr = max(0.25, r * 0.07)
        self.obj(x, y, 'finial', fr, fr, z + rv + fr * 0.6, z + rv - fr, 'gold')

    def minaret(self, x, y, r, height):
        """Минарет: цоколь, ствол (сужается кверху), балкон, фонарь и луковичный купол."""
        self.model(circle(x, y, r * 1.35, 8), 'minaret', 0.0, height * 0.05)
        self.model(circle(x, y, r, 16), 'minaret', 0.0, height * 0.55)
        self.model(circle(x, y, r * 0.86, 16), 'minaret', height * 0.55, height * 0.72)
        self.model(circle(x, y, r * 1.35, 16), 'balcony', height * 0.72, height * 0.75)
        self.model(circle(x, y, r * 0.74, 16), 'minaret', height * 0.75, height * 0.86)
        cap = r * 0.82
        self.obj(x, y, 'bulb', cap, cap * 1.35, height * 0.86, height * 0.86, 'turquoise')
        fr = max(0.2, r * 0.12)
        self.obj(x, y, 'finial', fr, fr, height * 0.86 + cap * 1.35 + fr * 0.6, height * 0.86 + cap * 1.35 - fr, 'gold')
