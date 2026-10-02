#!/usr/bin/env python3
"""Проверка сборки готовой папки карты (scripts/package-site.py) и проверки сборки (scripts/check-build.py)."""

import importlib.util
import os
import struct
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
failed = 0


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), os.path.join(HERE, f'{name}.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def check(name, cond):
    global failed
    print(('✓ ' if cond else '✗ ') + name)
    failed += not cond


site = load('package-site')
build = load('check-build')
template = os.path.join(HERE, '..', 'site', 'index.html')
archives = {'tajikistan.pmtiles': ('m26100206', 95), 'tajikistan-extra.pmtiles': ('e26100206', 6)}

html = site.page(template, archives, 'OSM 02.10.2026 06:00 UTC', offline=False)
check('страница: новые части тайлов', "prefix: 'tiles/m26100206-', count: 95" in html and "'tiles/e26100206-'" in html)
check('страница: даты данных в подписи', "customAttribution: 'OSM 02.10.2026 06:00 UTC'" in html)
check('страница для хостинга: библиотеки с unpkg', 'https://unpkg.com/maplibre-gl@' in html)
check('рельеф — до своего зума', f'demMaxzoom: {site.DEM_MAXZOOM},' in html)

offline = site.page(template, archives, 'OSM', offline=True, relief=False)
check('для компьютера: библиотеки рядом, без интернета', 'src="lib/maplibre-gl.js"' in offline and 'unpkg.com' not in offline
      and 'fonts.googleapis.com' not in offline)
check('для компьютера: целая страница с кодировкой и заголовком',
      offline.startswith('<!doctype html>') and '<meta charset="utf-8">' in offline
      and offline.index('<title>') < offline.index('</head>'))
check('без тайлов высот — без рельефа', '  dem: null,' in offline)
check('тайлы высот страны: 174 штуки до 9 зума', len(site.dem_tiles()) == 174)

tmp = tempfile.mkdtemp()
os.makedirs(os.path.join(tmp, 'tiles'))
for i in range(130):
    with open(os.path.join(tmp, 'tiles', f'm1-{i:03d}.txt'), 'wb') as f:
        f.write(b'x' * 1_400_000)
with open(os.path.join(tmp, 'search.json'), 'w') as f:
    f.write('{}')
steps = site.plan(tmp)
check('публикация шагами не больше 60 МБ', all(sum(1_400_000 for p in st if p.startswith('tiles/')) <= site.STEP_BYTES for st in steps)
      and sum(len(st) for st in steps) == 131 and len(steps) == 4)


def header(tiles, maxzoom=14, bounds=(67.3, 36.6, 75.2, 41.1)):
    h = bytearray(127)
    h[:7] = b'PMTiles'
    h[7] = 3
    struct.pack_into('<QQQ', h, 72, tiles, tiles, tiles)
    h[100], h[101] = 0, maxzoom
    struct.pack_into('<iiii', h, 102, *(int(v * 1e7) for v in bounds))
    return bytes(h)


path = os.path.join(tmp, 'a.pmtiles')
with open(path, 'wb') as f:
    f.write(header(60000))
h = build.pmtiles(path)
check('заголовок PMTiles: тайлы, зум, рамка', h['tiles'] == 60000 and h['maxzoom'] == 14 and abs(h['bounds'][0] - 67.3) < 1e-6)
old = {'main_tiles': 60000, 'main_bytes': 96e6, 'search_items': 35000, 'search_addresses': 18000, 'main_maxzoom': 14,
       'osm_date': '2026-10-01T06:00:00Z'}
good = dict(old, main_tiles=60100, osm_date='2026-10-02T06:00:00Z')
check('обычная сборка проходит', build.check(good, old) == [])
check('пропала треть тайлов — нельзя', any('main_tiles' in p for p in build.check(dict(good, main_tiles=40000), old)))
check('пропали адреса — нельзя', any('search_addresses' in p for p in build.check(dict(good, search_addresses=12000), old)))
check('данные старее прошлых — нельзя', any('OSM' in p for p in build.check(dict(good, osm_date='2026-09-01'), old)))
check('без прошлой сборки — только пороги', build.check({'main_bytes': 10e6}, {}) != [])

# ——— Состояние сборки: туда и обратно, имена файлов после хранилища не важны ———
import json  # noqa: E402

state = load('state')
data = os.path.join(tmp, 'data')
os.makedirs(os.path.join(data, 'sources'))
pbf = os.path.join(data, 'sources', 'tajikistan.osm.pbf')
with open(pbf, 'wb') as f:
    f.write(os.urandom(state.PART * 2 + 12345))
os.utime(pbf, (1790000000, 1790000000))
with open(os.path.join(data, 'last-good.json'), 'w') as f:
    f.write('{"main_tiles": 1}')
packed = os.path.join(tmp, 'state')
state.pack(packed, data=data)
names = sorted(os.listdir(packed))
renamed = []
for i, n in enumerate(names):
    dst = os.path.join(packed, f'{i:032x}.json')
    os.rename(os.path.join(packed, n), dst)
    renamed.append(dst)
data2 = os.path.join(tmp, 'data2')
state.unpack(renamed, data=data2)
with open(pbf, 'rb') as a_, open(os.path.join(data2, 'sources', 'tajikistan.osm.pbf'), 'rb') as b_:
    same = a_.read() == b_.read()
check('состояние: выгрузка OSM та же и с тем же временем', same
      and os.path.getmtime(os.path.join(data2, 'sources', 'tajikistan.osm.pbf')) == 1790000000)
check('состояние: образец проверки на месте', json.load(open(os.path.join(data2, 'last-good.json'))) == {'main_tiles': 1})
import base64, io, tarfile  # noqa: E401,E402
code_docs = [d for d in (json.load(open(p)) for p in renamed) if d['kind'] == 'code']
check('состояние: рядом код сборки', len(code_docs) == 1 and 'scripts/state.py' in
      tarfile.open(fileobj=io.BytesIO(base64.b64decode(code_docs[0]['data']))).getnames())
os.remove(renamed[-1])  # одной части нет — такое состояние не берётся
try:
    state.unpack([p for p in renamed if os.path.exists(p)], data=os.path.join(tmp, 'data3'))
    broken = False
except SystemExit:
    broken = True
check('состояние без части не восстанавливается', broken)

# ——— Шаги публикации: старая страница работает, пока заливаются новые части ———
steps_mod = load('publish-steps')
site_dir = os.path.join(tmp, 'site')
os.makedirs(os.path.join(site_dir, 'tiles'))
new_tiles = [f'tiles/m9-{i:03d}.txt' for i in range(100)]
for path in new_tiles:
    with open(os.path.join(site_dir, path), 'wb') as f:
        f.write(b'x' * steps_mod.PART_B64)
for path in ('search.json', 'index.html'):
    with open(os.path.join(site_dir, path), 'w') as f:
        f.write('x' * 4_000_000 if path == 'search.json' else '<p>')
with open(os.path.join(site_dir, 'publish-plan.json'), 'w') as f:
    json.dump({'prefix': '9', 'attribution': '', 'archives': {'tajikistan.pmtiles': ['m9', 100]},
               'steps': [new_tiles + ['search.json']]}, f)
live = os.path.join(tmp, 'live.html')
with open(live, 'w') as f:
    f.write("const ARCHIVES = {\n  'tajikistan.pmtiles': { prefix: 'tiles/m8-', count: 98 },\n};")
import contextlib  # noqa: E402
import io  # noqa: E402
buf = io.StringIO()
with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
    steps_mod.main(site_dir, live, live_bytes=160_000_000)
out = json.loads(buf.getvalue())['steps']
added = [p for st in out for p, v in st['files'].items() if v]
check('шаги: все новые файлы, страница — последней', sorted(added) == sorted(new_tiles + ['search.json'])
      and all(st['page'] == 'live' for st in out[:-1]) and out[-1]['page'].endswith('index.html'))
check('шаги: старые части убираются только в последнем', all(v is None for p, v in out[-1]['files'].items() if 'm8-' in p)
      and sum(1 for p in out[-1]['files'] if 'm8-' in p) == 98 and not any('m8-' in p for st in out[:-1] for p in st['files']))
check('шаги: версия не больше 256 МБ', 160_000_000 + sum(st['bytes'] for st in out[:-1]) <= steps_mod.LIMIT
      and all(st['bytes'] <= 64_000_000 for st in out))

print('\nПапка карты в порядке' if not failed else f'\nОшибок: {failed}')
sys.exit(1 if failed else 0)
