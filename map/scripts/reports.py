#!/usr/bin/env python3
"""Сообщения курьеров и жителей с карты (src/reports.js) — в правки поверх выгрузки.

Кнопка «Сообщить об изменении» и долгое нажатие на карту сохраняют сообщения в хранилище
проекта (у демо — в базе артефакта). Выгрузка сообщений — JSON-файл:

  {"reports": [{"id": "r…", "kind": "place", "lon": 68.75, "lat": 38.57, "name": "…",
                "cat": "amenity=restaurant", "at": "2026-09-30T12:00:00Z", "status": "…"}, …]}

scripts/extras.py применяет его вместе с заметками OSM и правками владельца
(tiles/corrections.json важнее всего). Что делается с сообщением:

  place, building — новая точка с названием и видом (если рядом такого ещё нет);
  house           — номер дома; entrance — подъезд с квартирами;
  road            — мост или дорога линией;
  closed, demolished, rename, moved — у найденного рядом места (по названию из карточки):
                    убрать, убрать вместе со зданием, переименовать, перенести;
  construction, other — только на карте сообщений: их разбирает человек.

Сообщение со "status": "rejected" (владелец отклонил) не применяется. Пометка
yoobi:report в тегах — карточка покажет «по сообщению пользователя карты, не проверено».
"""

import json

from notes import POI_KEYS, POI_TAGS, Frame, inside, names_of, same_name

ROADS = {'bridge': ('unclassified', True), 'footbridge': ('footway', True), 'road': ('unclassified', False),
         'footway': ('footway', False)}


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        return []
    items = data.get('reports', data) if isinstance(data, dict) else data
    return [r for r in items if isinstance(r, dict) and r.get('kind') and r.get('status') != 'rejected'
            and isinstance(r.get('lon'), (int, float)) and isinstance(r.get('lat'), (int, float))]


def cat_tags(cat):
    k, _, v = (cat or '').partition('=')
    return {k: v} if k in POI_KEYS + ('office',) and v else {}


def mark(r):
    return f'{r.get("id", "")}|{str(r.get("at", ""))[:10]}'


def corrections(src, reports):
    """Правки в формате corrections.load и счётчики."""
    import osmium

    change, removed, added = {}, set(), []
    stats = {'новых мест': 0, 'номеров домов': 0, 'подъездов': 0, 'мостов и дорог': 0, 'закрыто': 0,
             'переименовано': 0, 'перенесено': 0, 'уже есть': 0, 'не найдено': 0, 'разобрать вручную': 0}
    targets = [r for r in reports if r['kind'] in ('closed', 'demolished', 'rename', 'moved') and r.get('target')]
    need_scan = targets or any(r['kind'] in ('place', 'building', 'house') for r in reports)
    cands = {id(r): [] for r in reports}
    if need_scan:
        fr = Frame(sum(r['lat'] for r in reports) / len(reports))
        cell = 0.002
        grid = {}
        for r in reports:
            lon, lat = (r['target']['lon'], r['target']['lat']) if r.get('target') else (r['lon'], r['lat'])
            grid.setdefault((int(lon // cell), int(lat // cell)), []).append((r, lon, lat))
        fp = (osmium.FileProcessor(src).with_locations().with_areas()
              .with_filter(osmium.filter.KeyFilter('building', 'addr:housenumber', *POI_KEYS)))
        for o in fp:
            if o.is_node():
                pt, ring, kind, oid = (o.location.lon, o.location.lat), None, 'n', o.id
            elif o.is_area():
                try:
                    ring = [(p.lon, p.lat) for p in next(iter(o.outer_rings()))][:-1]
                except StopIteration:
                    continue
                if len(ring) < 3:
                    continue
                pt = (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
                kind, oid = ('w' if o.from_way() else 'r'), o.orig_id()
            else:
                continue
            ci, cj = int(pt[0] // cell), int(pt[1] // cell)
            tags = None
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    for r, lon, lat in grid.get((ci + di, cj + dj), ()):
                        d = fr.dist(pt, (lon, lat))
                        if d <= 150:
                            tags = tags or dict(o.tags)
                            cands[id(r)].append((d, ring is not None and inside((lon, lat), ring), kind, oid, tags))
    for r in reports:
        k, cs = r['kind'], sorted(cands[id(r)], key=lambda c: (not c[1], c[0]))
        if k in ('place', 'building'):
            tags = cat_tags(r.get('cat'))
            if not r.get('name') and not r.get('house'):
                stats['разобрать вручную'] += 1
                continue
            if r.get('name') and any(d < 150 and same_name(r['name'], names_of(t)) for d, _w, _k, _i, t in cs):
                stats['уже есть'] += 1
                continue
            if r.get('name'):
                tags['name'] = r['name']
                if not any(key in tags for key in POI_KEYS + ('office',)):
                    tags['office'] = 'yes'  # организация неизвестного вида — всё равно ищется по названию
            if r.get('house'):
                tags['addr:housenumber'] = r['house']
                if r.get('street'):
                    tags['addr:street'] = r['street']
            if r.get('levels'):
                tags['building:levels'] = str(r['levels'])
            tags['yoobi:report'] = mark(r)
            added.append({'lon': r['lon'], 'lat': r['lat'], 'tags': tags})
            stats['новых мест'] += 1
        elif k == 'house':
            if not r.get('house'):
                continue
            if any(d < 30 and t.get('addr:housenumber', '').lower() == r['house'].lower() for d, _w, _k, _i, t in cs):
                stats['уже есть'] += 1
                continue
            tags = {'addr:housenumber': r['house'], 'yoobi:report': mark(r)}
            if r.get('street'):
                tags['addr:street'] = r['street']
            if r.get('levels'):
                tags['building:levels'] = str(r['levels'])
            added.append({'lon': r['lon'], 'lat': r['lat'], 'tags': tags})
            stats['номеров домов'] += 1
        elif k == 'entrance':
            tags = {'entrance': 'staircase', 'yoobi:report': mark(r)}
            if r.get('ref'):
                tags['ref'] = r['ref']
            if r.get('flats'):
                tags['addr:flats'] = r['flats']
            added.append({'lon': r['lon'], 'lat': r['lat'], 'tags': tags})
            stats['подъездов'] += 1
        elif k == 'road':
            line = [p for p in r.get('line') or [] if isinstance(p, list) and len(p) == 2]
            if len(line) < 2:
                continue
            highway, bridge = ROADS.get(r.get('road'), ROADS['road'])
            tags = {'highway': highway, 'yoobi:report': mark(r)}
            if bridge:
                tags.update(bridge='yes', layer='1')
            if r.get('name'):
                tags['name'] = r['name']
            added.append({'line': line, 'tags': tags})
            stats['мостов и дорог'] += 1
        elif k in ('closed', 'demolished', 'rename', 'moved'):
            title = r['target'].get('title') or ''
            best = next(((kind, oid, t) for d, within, kind, oid, t in cs
                         if (d <= 60 or within) and same_name(title, names_of(t))), None)
            if not best and k == 'demolished':  # безымянный дом, из карточки которого сообщили
                best = next(((kind, oid, t) for d, within, kind, oid, t in cs if within and 'building' in t), None)
            if not best:
                stats['не найдено'] += 1
                continue
            kind, oid, t = best
            if k == 'closed':
                if kind == 'n':
                    removed.add((kind, oid))
                else:
                    change[(kind, oid)] = ({'yoobi:gone': mark(r)}, {key for key in t if key in POI_TAGS})
                stats['закрыто'] += 1
            elif k == 'demolished':
                if kind == 'n':
                    removed.add((kind, oid))
                else:
                    change[(kind, oid)] = ({'yoobi:gone': mark(r)}, set(t))
                stats['закрыто'] += 1
            elif k == 'rename' and r.get('name'):
                change[(kind, oid)] = ({'name': r['name'], 'yoobi:report': mark(r)}, {'name:ru', 'name:tg', 'name:en'})
                stats['переименовано'] += 1
            elif k == 'moved':
                if kind == 'n':
                    change[(kind, oid)] = ({'yoobi:report': mark(r)}, set(), [r['lon'], r['lat']])
                else:  # заведение в здании переехало: теги — на новую точку, здание остаётся
                    poi = {key: v for key, v in t.items() if key in POI_TAGS}
                    change[(kind, oid)] = ({'yoobi:gone': mark(r)}, set(poi))
                    added.append({'lon': r['lon'], 'lat': r['lat'], 'tags': {**poi, 'yoobi:report': mark(r)}})
                stats['перенесено'] += 1
        else:
            stats['разобрать вручную'] += 1
    return {'change': change, 'remove': removed, 'add': added}, stats

