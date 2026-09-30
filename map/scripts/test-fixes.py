#!/usr/bin/env python3
"""Проверка правок поверх выгрузки: заметки OSM, сообщения с карты, правки владельца."""

import datetime as dt
import json
import os
import sys
import tempfile

sys.path.insert(0, __file__.rsplit('/', 1)[0])
import osmium  # noqa: E402
from osmium.osm.mutable import Node, Way  # noqa: E402

import corrections  # noqa: E402
import notes  # noqa: E402
import reports  # noqa: E402

failed = 0


def check(name, cond):
    global failed
    print(('✓ ' if cond else '✗ ') + name)
    failed += not cond


OLD = dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc)
tmp = tempfile.mkdtemp()
src = os.path.join(tmp, 'src.osm.pbf')
w = osmium.SimpleWriter(src)
# Кафе точкой, магазин точкой, здание-заправка контуром, безымянный дом контуром.
w.add_node(Node(id=1, location=(68.7500, 38.5700), tags={'amenity': 'cafe', 'name': 'Давра'}, version=1, timestamp=OLD))
w.add_node(Node(id=2, location=(68.7510, 38.5700), tags={'shop': 'gift', 'name': 'Сувениры'}, version=1, timestamp=OLD))
square = [(68.7520, 38.5700), (68.7524, 38.5700), (68.7524, 38.5703), (68.7520, 38.5703)]
for i, (x, y) in enumerate(square):
    w.add_node(Node(id=10 + i, location=(x, y), version=1, timestamp=OLD))
w.add_way(Way(id=100, nodes=[10, 11, 12, 13, 10], tags={'building': 'yes', 'amenity': 'fuel', 'name': 'Шарк'},
              version=1, timestamp=OLD))
house = [(68.7530, 38.5700), (68.7533, 38.5700), (68.7533, 38.5702), (68.7530, 38.5702)]
for i, (x, y) in enumerate(house):
    w.add_node(Node(id=20 + i, location=(x, y), version=1, timestamp=OLD))
w.add_way(Way(id=101, nodes=[20, 21, 22, 23, 20], tags={'building': 'yes'}, version=1, timestamp=OLD))
w.close()


def read(path):
    out = {}
    for o in osmium.FileProcessor(path):
        out[(o.type_str(), o.id)] = (dict(o.tags), (o.location.lon, o.location.lat) if o.is_node() else None)
    return out


# ——— Разбор заметок ———
gone = notes.parse({'text': '"снесено" This place does not exist: A CoMaps user reported that the POI was visible on '
                            'the map (see snapshot date below), but was not found on the ground. OSM snapshot date: '
                            '2026-02-21T15:17:51Z POI name: Шарк POI types: building amenity-fuel  #CoMaps android'})
check('заметка CoMaps: места нет, название и типы', gone['gone'] and gone['name'] == 'Шарк'
      and gone['types'] == {'building': 'yes', 'amenity': 'fuel'} and gone['comment'] == 'снесено')
new = notes.parse({'text': '"Сор пицца" POI name: Сор пицца POI types: amenity-fast_food cuisine-pizza OSM data '
                           'version: 2026-04-24T11:02:23Z  #mapsme'})
check('заметка MAPS.ME: новое место', not new['gone'] and new['name'] == 'Сор пицца'
      and new['types'] == {'amenity': 'fast_food', 'cuisine': 'pizza'})
check('просто текст — не сообщение о месте', notes.parse({'text': 'Hello, can you fix the airport?'}) is None)

# ——— Заметки → правки ———
path = os.path.join(tmp, 'notes.json')
day = '2026-03-24T10:00:00'
with open(path, 'w', encoding='utf-8') as f:
    json.dump({'notes': [
        {'id': 1, 'lon': 68.75222, 'lat': 38.57015, 'date': day, 'replies': [], 'text':
         '"снесено" This place does not exist: A CoMaps user reported ... OSM snapshot date: 2026-02-21 '
         'POI name: Шарк POI types: building amenity-fuel  #CoMaps'},
        {'id': 2, 'lon': 68.75101, 'lat': 38.57001, 'date': day, 'replies': [], 'text':
         '"Closed" The place has gone or never existed. OSM snapshot date: 2026 POI name: Сувениры POI types: shop-gift'},
        {'id': 3, 'lon': 68.7540, 'lat': 38.5710, 'date': day, 'replies': [], 'text':
         '"Сор пицца" POI name: Сор пицца POI types: amenity-fast_food cuisine-pizza OSM data version: 2026 #mapsme'},
        {'id': 4, 'lon': 68.75001, 'lat': 38.57001, 'date': day, 'replies': ['Already fixed, thanks'], 'text':
         '"Closed" The place has gone or never existed. POI name: Давра POI types: amenity-cafe'},
    ]}, f, ensure_ascii=False)
corr, stats = notes.corrections(src, path, now=dt.datetime(2026, 9, 30, tzinfo=dt.timezone.utc))
check('снесённая заправка — здание убрано целиком', corr['change'].get(('w', 100), ({}, set()))[1] >= {'building', 'amenity'})
check('закрытый магазин-точка убран', ('n', 2) in corr['remove'])
check('новое место из заметки добавлено с пометкой', any(a['tags'].get('name') == 'Сор пицца'
                                                         and a['tags'].get('yoobi:note') for a in corr['add']))
check('заметка с ответом «уже поправлено» не применяется', ('n', 1) not in corr['remove'])

# ——— Сообщения с карты → правки ———
sent = [
    {'id': 'r1', 'kind': 'closed', 'lon': 68.75, 'lat': 38.57, 'at': '2026-09-30T10:00:00Z',
     'target': {'title': 'Давра', 'lon': 68.7500, 'lat': 38.5700}},
    {'id': 'r2', 'kind': 'rename', 'lon': 68.751, 'lat': 38.57, 'name': 'Подарки', 'at': '2026-09-30T10:00:00Z',
     'target': {'title': 'Сувениры', 'lon': 68.7510, 'lat': 38.5700}},
    {'id': 'r3', 'kind': 'place', 'lon': 68.7505, 'lat': 38.5705, 'name': 'Тадж Плов', 'cat': 'amenity=restaurant',
     'at': '2026-09-30T10:00:00Z'},
    {'id': 'r4', 'kind': 'house', 'lon': 68.75315, 'lat': 38.5701, 'house': '12/1', 'street': 'улица Шамси',
     'at': '2026-09-30T10:00:00Z'},
    {'id': 'r5', 'kind': 'road', 'lon': 68.76, 'lat': 38.58, 'road': 'bridge', 'line': [[68.759, 38.58], [68.761, 38.58]],
     'at': '2026-09-30T10:00:00Z'},
    {'id': 'r6', 'kind': 'moved', 'lon': 68.7600, 'lat': 38.5750, 'at': '2026-09-30T10:00:00Z',
     'target': {'title': 'Шарк', 'lon': 68.7522, 'lat': 38.57015}},
    {'id': 'r7', 'kind': 'place', 'lon': 68.7505, 'lat': 38.5705, 'name': 'Отклонённое', 'status': 'rejected',
     'at': '2026-09-30T10:00:00Z'},
]
rpath = os.path.join(tmp, 'reports.json')
with open(rpath, 'w', encoding='utf-8') as f:
    json.dump({'reports': sent}, f, ensure_ascii=False)
loaded = reports.load(rpath)
check('отклонённое владельцем сообщение не загружается', len(loaded) == 6)
rc, rstats = reports.corrections(src, loaded)
check('закрылось: точка убрана', ('n', 1) in rc['remove'])
check('другое название: имя заменено', rc['change'].get(('n', 2), ({},))[0].get('name') == 'Подарки')
check('новое место — ресторан', any(a['tags'].get('amenity') == 'restaurant' for a in rc['add']))
check('номер дома', any(a['tags'].get('addr:housenumber') == '12/1' for a in rc['add']))
check('мост линией', any(a.get('line') and a['tags'].get('bridge') == 'yes' for a in rc['add']))
check('переехало из здания: теги на новой точке, здание остаётся',
      any(a['tags'].get('name') == 'Шарк' and a['lon'] == 68.76 for a in rc['add'])
      and 'building' not in rc['change'][('w', 100)][1])

# ——— Правки владельца важнее; применение к выгрузке ———
owner = {'change': {('n', 2): ({'name': 'Сувениры Хуҷанд', 'check_date': '2026-09-30'}, set(), [68.7515, 38.5701])},
         'remove': set(), 'add': [{'lon': 68.7506, 'lat': 38.5706, 'tags': {'amenity': 'bank', 'name': 'Банк'}}]}
fixes = notes.merge(owner, notes.merge(rc, corr))
check('правка владельца важнее сообщения', fixes['change'][('n', 2)][0]['name'] == 'Сувениры Хуҷанд')
dst = os.path.join(tmp, 'dst.osm.pbf')
corrections.apply(src, dst, fixes)
out = read(dst)
check('убранная точка без тегов', out[('n', 1)][0] == {})
check('перенос точки владельцем', abs(out[('n', 2)][1][0] - 68.7515) < 1e-6)
check('добавлены новые точки и линия', sum(1 for (k, i) in out if k == 'n' and i >= corrections.ADD_NODE_BASE) >= 5
      and any(k == 'w' and i >= corrections.ADD_WAY_BASE for (k, i) in out))
stamps = [o.timestamp for o in osmium.FileProcessor(dst, osmium.osm.NODE) if o.id == 2]
check('дата проверки владельцем — время правки', stamps and stamps[0].date() == dt.date(2026, 9, 30))

print('\nПравки в порядке' if not failed else f'\nОшибок: {failed}')
sys.exit(1 if failed else 0)
