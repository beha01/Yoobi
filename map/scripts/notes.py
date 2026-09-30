#!/usr/bin/env python3
"""Сообщения пользователей OpenStreetMap: что закрылось, снесено или открылось.

Organic Maps, CoMaps, MAPS.ME и другие приложения на данных OSM оставляют «заметки»
(notes), когда человек на месте видит, что заведения уже нет, дом снесён или появилось
новое место, а сам править карту не стал. Такие заметки висят открытыми месяцами, и
карта всё это время показывает прошлое. Скрипт скачивает открытые заметки области
(лицензия ODbL, как у данных OSM) и превращает их в правки поверх выгрузки:

  * «места нет» — точка убирается; у здания снимаются только теги заведения, а если в
    заметке сказано, что дом снесён, пропадает и само здание (на его месте — стройка,
    если о ней написано);
  * новое место с названием и типом (так их присылают Organic Maps и MAPS.ME), которого
    рядом ещё нет, — добавляется с пометкой «по сообщению пользователя, не проверено».

Заметка не применяется, если объект правили в OSM уже после неё: значит, его проверили.

  python3 scripts/notes.py data/sources/osm-notes.json      # скачать открытые заметки
"""

import datetime as dt
import json
import math
import re
import sys
import time
import urllib.request

API = 'https://api.openstreetmap.org/api/0.6/notes.json'
BBOX = (67.3, 36.6, 75.2, 41.1)  # Таджикистан с запасом, как у Overture
STEP = 4.0  # API отдаёт не больше 25 кв. градусов и 10 000 заметок за запрос
NEW_MAX_AGE = 3 * 365  # новые места — только из заметок не старше трёх лет, дней

POI_KEYS = ('amenity', 'shop', 'tourism', 'leisure', 'office', 'craft', 'healthcare', 'historic')
# Теги заведения, которые снимаются со здания, когда самого заведения уже нет.
POI_TAGS = POI_KEYS + ('name', 'name:ru', 'name:tg', 'name:en', 'brand', 'operator', 'opening_hours', 'phone',
                       'contact:phone', 'website', 'contact:website', 'contact:instagram', 'cuisine', 'email',
                       'contact:email', 'description', 'fuel:diesel', 'fuel:octane_92', 'fuel:octane_95')
GONE = ('has gone or never existed', 'place does not exist', 'not found on the ground',
        'cannot be found on the ground')
DEMOLISHED = re.compile(r'снес|снос|демонт|разруш|demolish|torn down|doesn.t exist anymore|no longer exist|'
                        r'не существ|здания нет|дома нет', re.I)
BUILDING_SITE = re.compile(r'стро(ит|йк|ят)|новострой|construction|building site', re.I)
SECONDARY = ('cuisine', 'internet_access', 'diet', 'sport', 'religion', 'denomination', 'vending', 'fuel')


def fetch(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'yoobi-map/1.0 (notes.py)'})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 — сеть: повторяем
            if i == tries - 1:
                raise
            print(f'  {e}, повтор через {2 ** i} с', file=sys.stderr)
            time.sleep(2 ** i)


def download(out, bbox=BBOX):
    x1, y1, x2, y2 = bbox
    notes = {}
    x = x1
    while x < x2:
        y = y1
        while y < y2:
            box = (round(x, 3), round(y, 3), round(min(x + STEP, x2), 3), round(min(y + STEP, y2), 3))
            data = fetch(f'{API}?bbox={",".join(map(str, box))}&limit=10000&closed=0')
            feats = data.get('features', [])
            if len(feats) >= 10000:
                print(f'  {box}: 10 000 заметок — часть могла не войти, уменьшите STEP', file=sys.stderr)
            for f in feats:
                p = f['properties']
                comments = p.get('comments') or []
                lon, lat = f['geometry']['coordinates']
                notes[p['id']] = {
                    'id': p['id'], 'lon': round(lon, 7), 'lat': round(lat, 7),
                    'date': p['date_created'][:19].replace(' ', 'T'),
                    'text': (comments[0].get('text') or '') if comments else '',
                    'replies': [c.get('text') or '' for c in comments[1:]],
                }
            y += STEP
        x += STEP
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'downloaded': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                   'bbox': bbox, 'notes': sorted(notes.values(), key=lambda n: n['id'])},
                  f, ensure_ascii=False, separators=(',', ':'))
    print(f'открытых заметок: {len(notes)} → {out}')
    return len(notes)


def parse(note):
    """Что сообщили: {'gone': bool, 'name', 'types': {ключ: значение}, 'comment'} или None."""
    text = ' '.join((note.get('text') or '').split())
    m = re.search(r'POI types:\s*(.+?)(?:\s+OSM (?:data version|snapshot date)|\s+#|$)', text)
    if not m:
        return None
    types = {}
    for token in m.group(1).split():
        k, _, v = token.partition('-')
        if k == 'building':
            types.setdefault('building', v or 'yes')
        elif k in POI_KEYS or k in SECONDARY:
            types.setdefault(k, v or 'yes')
    name = re.search(r'POI name:\s*(.+?)\s+POI types:', text)
    comment = re.search(r'"([^"]*)"', text)
    return {
        'gone': any(g in text.lower() for g in GONE),
        'name': name.group(1).strip() if name else '',
        'types': types,
        'comment': comment.group(1).strip() if comment else '',
    }


def names_of(t):
    return [t.get(k) for k in ('name', 'name:ru', 'name:tg', 'name:en', 'old_name', 'brand')]


def norm(s):
    s = (s or '').lower().replace('ё', 'е')
    return re.sub(r'[\s"«»\'`.,:;!?()\-–—№#]+', '', s)


def same_name(a, names):
    a = norm(a)
    return bool(a) and any(a == norm(b) or (len(a) >= 5 and (a in norm(b) or norm(b) in a) and norm(b))
                           for b in names if b)


class Frame:
    """Метры на плоскости около широты lat0."""

    def __init__(self, lat0):
        self.kx = 111320.0 * math.cos(math.radians(lat0))

    def dist(self, a, b):
        return math.hypot((a[0] - b[0]) * self.kx, (a[1] - b[1]) * 110540.0)


def inside(pt, ring):
    x, y = pt
    hit = False
    for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            hit = not hit
    return hit


def corrections(src, notes_path, now=None):
    """Правки по заметкам в формате corrections.load: {'change', 'remove', 'add'} и счётчики."""
    import osmium  # только для сборки; скачивание заметок обходится без pyosmium

    with open(notes_path, encoding='utf-8') as f:
        data = json.load(f)
    now = now or dt.datetime.now(dt.timezone.utc)
    reports = []
    for n in data['notes']:
        r = parse(n)
        if not r:
            continue
        if any(re.search(r'\b(fixed|resolved|исправ|добав|нанес|уже есть|already)', t, re.I) for t in n['replies']):
            continue  # кто-то ответил, что уже поправил, — заметку просто не закрыли
        r.update(id=n['id'], lon=n['lon'], lat=n['lat'],
                 date=dt.datetime.fromisoformat(n['date']).replace(tzinfo=dt.timezone.utc))
        if r['gone'] or (r['name'] and any(k in r['types'] for k in POI_KEYS)):
            reports.append(r)
    if not reports:
        return {'change': {}, 'remove': set(), 'add': []}, {}
    fr = Frame(sum(r['lat'] for r in reports) / len(reports))
    cell = 0.002  # ~200 м: кандидаты ищутся только в соседних клетках
    grid = {}
    for i, r in enumerate(reports):
        grid.setdefault((int(r['lon'] // cell), int(r['lat'] // cell)), []).append(i)
    cands = [[] for _ in reports]  # (расстояние, внутри контура, вид, id, теги, время)

    def near(lon, lat):
        ci, cj = int(lon // cell), int(lat // cell)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                yield from grid.get((ci + di, cj + dj), ())

    fp = (osmium.FileProcessor(src).with_locations().with_areas()
          .with_filter(osmium.filter.KeyFilter('building', *POI_KEYS)))
    for o in fp:
        if o.is_node():
            pt, ring, kind, oid = (o.location.lon, o.location.lat), None, 'n', o.id
        elif o.is_area():
            try:
                outer = next(iter(o.outer_rings()))
            except StopIteration:
                continue
            ring = [(p.lon, p.lat) for p in outer][:-1]
            if len(ring) < 3:
                continue
            pt = (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
            kind, oid = ('w' if o.from_way() else 'r'), o.orig_id()
        else:
            continue
        tags = None
        for i in near(*pt):
            r = reports[i]
            d = fr.dist(pt, (r['lon'], r['lat']))
            if d > 120:
                continue
            within = ring is not None and inside((r['lon'], r['lat']), ring)
            tags = tags or dict(o.tags)
            cands[i].append((d, within, kind, oid, tags, o.timestamp))

    change, removed, added, stats = {}, set(), [], {'закрыто мест': 0, 'снесено зданий': 0, 'стройка': 0,
                                                     'новых мест': 0, 'уже поправлено в OSM': 0, 'не найдено': 0}
    for r, cs in zip(reports, cands):
        if not r['gone']:
            # Новое место: если рядом такого ещё нет, добавляется с пометкой заметки.
            if (now - r['date']).days > NEW_MAX_AGE:
                continue
            if any(d < 150 and same_name(r['name'], names_of(t)) for d, _w, _k, _i, t, _ts in cs):
                continue
            if any(fr.dist((a['lon'], a['lat']), (r['lon'], r['lat'])) < 150
                   and same_name(r['name'], [a['tags']['name']]) for a in added):
                continue  # то же место в двух заметках
            tags = {k: v for k, v in r['types'].items() if k != 'building'}
            tags.update(name=r['name'], **{'yoobi:note': f'{r["id"]}|{r["date"]:%Y-%m-%d}'})
            added.append({'lon': r['lon'], 'lat': r['lat'], 'tags': tags})
            stats['новых мест'] += 1
            continue
        main_type = next(((k, v) for k, v in r['types'].items() if k in POI_KEYS), None)
        best = None
        for d, within, kind, oid, t, ts in sorted(cs, key=lambda c: (not c[1], c[0])):
            if r['name']:
                ok = same_name(r['name'], names_of(t)) and (d <= 40 or within)
            elif main_type:
                ok = t.get(main_type[0]) == main_type[1] and not t.get('name') and (d <= 12 or within)
            else:  # «POI has no name POI types: building» — безымянный дом, в который попала заметка
                ok = within and not any(k in t for k in POI_KEYS) and not t.get('name')
            if ok:
                best = (kind, oid, t, ts)
                break
        if not best:
            stats['не найдено'] += 1
            continue
        kind, oid, t, ts = best
        if ts > r['date']:
            stats['уже поправлено в OSM'] += 1
            continue
        demolished = bool(DEMOLISHED.search(r['comment'] or ''))
        mark = f'{r["id"]}|{r["date"]:%Y-%m-%d}'
        if kind == 'n':
            removed.add((kind, oid))
            stats['закрыто мест'] += 1
        elif 'building' in t and not demolished:
            # Здание стоит, заведения в нём нет: снимаются только его теги.
            change[(kind, oid)] = ({'yoobi:gone': mark}, {k for k in t if k in POI_TAGS})
            stats['закрыто мест'] += 1
        elif BUILDING_SITE.search(r['comment'] or ''):
            change[(kind, oid)] = ({'landuse': 'construction', 'yoobi:gone': mark}, set(t))
            stats['стройка'] += 1
        else:
            change[(kind, oid)] = ({'yoobi:gone': mark}, set(t))
            stats['снесено зданий' if 'building' in t else 'закрыто мест'] += 1
    return {'change': change, 'remove': removed, 'add': added}, stats


def merge(base, extra):
    """Правки владельца важнее заметок: объект из base заметками не трогается."""
    if not base:
        return extra
    out = {'change': dict(extra['change']), 'remove': set(extra['remove']), 'add': list(extra['add'])}
    for key in set(base['change']) | set(base['remove']):
        out['change'].pop(key, None)
        out['remove'].discard(key)
    out['change'].update(base['change'])
    out['remove'] |= base['remove']
    out['add'] += base['add']
    return out


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    download(sys.argv[1])
