#!/usr/bin/env python3
"""Готовая карта одной папкой: страница (site/index.html), код, спрайты, шрифты, тайлы и поиск.

Папку можно выложить на любой статический хостинг, опубликовать артефактом claude.ai или
открыть у себя на компьютере без интернета:

  python3 scripts/package-site.py dist/site                 # для хостинга и артефакта
  python3 scripts/package-site.py dist/yoobi-map --offline  # для компьютера: библиотеки рядом,
                                                            # запуск двойным щелчком (Windows,
                                                            # macOS, Linux), см. README.txt внутри

Тайлы режутся на части по 1 МБ в base64 (tiles/<префикс>-NNN.txt): так их раздаёт любой
сервер, даже без запросов диапазонов, а артефакт принимает только веб-типы файлов. Префикс —
время сборки (m26100206 …): у новой версии другие имена частей, и открытая у кого-то
страница не смешает старые и новые тайлы. --prefix=… — свой префикс.

publish-plan.json рядом — какие файлы публиковать каким шагом (не больше 60 МБ и 250 файлов
за раз), для артефакта claude.ai.
"""

import base64
import concurrent.futures as cf
import datetime as dt
import json
import math
import os
import re
import shutil
import sys
import urllib.request

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PART = 1 << 20
FONTS = {'regular': 'Noto Sans Regular', 'bold': 'Noto Sans Bold', 'italic': 'Noto Sans Italic'}
# Диапазоны знаков, которые встречаются в подписях: латиница, кириллица (и таджикские буквы),
# общая пунктуация и знаки. Остальные карта не запрашивает.
RANGES = ['0-255', '256-511', '512-767', '768-1023', '1024-1279', '1280-1535', '8192-8447', '8448-8703']
FONT_SOURCE = os.environ.get('FONTS_SOURCE', 'https://tiles.openfreemap.org/fonts')
LIBS = {
    'maplibre-gl.js': 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
    'pmtiles.js': 'https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js',
}
# Рельеф (горы в тени): тайлы высот AWS Terrain Tiles (открытые данные, формат terrarium) по стране.
DEM_SOURCE = os.environ.get('DEM_SOURCE', 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium')
DEM_MAXZOOM = 9
DEM_BBOX = (67.3, 36.6, 75.2, 41.1)
STEP_BYTES = 60 * 1000 * 1000
STEP_FILES = 250


def fetch(url, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'yoobi-map/1.0 (package-site.py)'})
    with urllib.request.urlopen(req, timeout=120) as r, open(dst + '.tmp', 'wb') as f:
        shutil.copyfileobj(r, f)
    os.replace(dst + '.tmp', dst)


def dem_tiles(maxzoom=DEM_MAXZOOM, bbox=DEM_BBOX):
    out = []
    for z in range(maxzoom + 1):
        n = 2 ** z
        tx = lambda lon: int((lon + 180) / 360 * n)  # noqa: E731
        ty = lambda lat: int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)  # noqa: E731
        for x in range(tx(bbox[0]), tx(bbox[2]) + 1):
            for y in range(ty(bbox[3]), ty(bbox[1]) + 1):
                out.append((z, x, y))
    return out


def dem(out, data):
    """Тайлы высот страны в out/dem (кеш — data/dem). False — не скачались (тогда без рельефа)."""
    need = []
    for z, x, y in dem_tiles():
        cached = os.path.join(data, 'dem', str(z), str(x), f'{y}.png')
        if not os.path.exists(cached):
            need.append((f'{DEM_SOURCE}/{z}/{x}/{y}.png', cached))
    try:
        with cf.ThreadPoolExecutor(8) as pool:
            list(pool.map(lambda job: fetch(*job), need))
    except Exception as e:  # noqa: BLE001 — без сети рельеф просто не рисуется
        print(f'рельеф не скачан: {e}', file=sys.stderr)
        return False
    shutil.copytree(os.path.join(data, 'dem'), os.path.join(out, 'dem'))
    return True


def b64(data):
    return base64.b64encode(data).decode()


def split(src, out, prefix):
    """PMTiles → части по 1 МБ в base64. Возвращает число частей."""
    n = 0
    with open(src, 'rb') as f:
        while True:
            chunk = f.read(PART)
            if not chunk:
                break
            with open(os.path.join(out, f'{prefix}-{n:03d}.txt'), 'w') as g:
                g.write(b64(chunk))
            n += 1
    return n


def day(iso):
    return '.'.join(reversed(iso[:10].split('-')))


def attribution(data):
    """«OSM 30.09.2026 21:31 UTC · Overture 23.09.2026 · снимки 27.09.2026» — даты данных."""
    parts = []
    try:
        with open(os.path.join(data, 'tajikistan-search.json'), encoding='utf-8') as f:
            dates = json.load(f).get('dates', {})
    except (OSError, ValueError):
        dates = {}
    osm = dates.get('osm_time')
    if not osm:
        pbf = os.path.join(data, 'sources', 'tajikistan.osm.pbf')
        if os.path.exists(pbf):  # scripts/update-osm.py ставит файлу время данных
            osm = dt.datetime.fromtimestamp(os.path.getmtime(pbf), dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    if osm:
        parts.append(f'OSM {day(osm)}' + (f' {osm[11:16]} UTC' if len(osm) >= 16 else ''))
    if dates.get('overture'):
        parts.append(f'Overture {day(dates["overture"])}')
    try:
        with open(os.path.join(data, 'sources', 'imagery.geojson'), encoding='utf-8') as f:
            shots = json.load(f).get('dates') or []
        if shots:
            parts.append(f'снимки {day(max(shots))}')
    except (OSError, ValueError):
        pass
    return ' · '.join(parts)


def page(template, archives, credit, offline, relief=True):
    with open(template, encoding='utf-8') as f:
        s = f.read()
    s, n = re.subn(r'demMaxzoom: \d+,', f'demMaxzoom: {DEM_MAXZOOM},', s)
    if not relief:  # тайлов высот нет — без рельефа, чтобы не было запросов в пустоту
        s, n = re.subn(r'  dem: `\$\{base\}dem/\{z\}/\{x\}/\{y\}\.png`,\n', '  dem: null,\n', s)
    block = 'const ARCHIVES = {\n' + ''.join(
        f"  '{name}': {{ prefix: 'tiles/{prefix}-', count: {count} }},\n" for name, (prefix, count) in archives.items()
    ) + '};'
    s, n = re.subn(r'const ARCHIVES = \{\n(?:  [^\n]*\n)+\};', lambda _m: block, s)
    if n != 1:
        raise SystemExit('в site/index.html не найден блок ARCHIVES')
    s, n = re.subn(r"customAttribution: '[^']*'", lambda _m: f"customAttribution: '{credit}'", s)
    if n != 1:
        raise SystemExit('в site/index.html не найдена подпись с датами данных (customAttribution)')
    if offline:
        for name, url in LIBS.items():
            if url not in s:
                raise SystemExit(f'в site/index.html нет {url}')
            s = s.replace(url, f'lib/{name}')
        # Без интернета шрифт страницы — системный; подписи карты — свои шрифты из fonts/.
        s = re.sub(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts\.(?:googleapis|gstatic)\.com[^>]*>\n?', '', s)
        title = re.search(r'<title>.*?</title>\n?', s)
        head = title.group(0) if title else '<title>Карта Yoobi</title>\n'
        if title:
            s = s.replace(title.group(0), '', 1)
        s = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
             '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
             + head + '</head>\n<body>\n' + s + '\n</body>\n</html>\n')
    return s


def plan(out):
    """Шаги публикации: части тайлов, затем код и поиск; страница — последней."""
    files = []
    for root, _dirs, names in os.walk(out):
        for name in names:
            path = os.path.relpath(os.path.join(root, name), out)
            if path in ('index.html', 'publish-plan.json') or path.startswith(('lib/', 'README', 'Открыть', 'start', 'server')):
                continue
            files.append((path, os.path.getsize(os.path.join(root, name))))
    files.sort(key=lambda x: (not x[0].startswith('tiles/'), x[0]))
    steps, cur, size = [], [], 0
    for path, n in files:
        if cur and (size + n > STEP_BYTES or len(cur) >= STEP_FILES):
            steps.append(cur)
            cur, size = [], 0
        cur.append(path)
        size += n
    if cur:
        steps.append(cur)
    return steps


def main(out, offline=False, prefix=None):
    data = os.path.join(HERE, 'data')
    now = dt.datetime.now(dt.timezone.utc)
    prefix = prefix or now.strftime('%y%m%d%H')
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'tiles'))
    archives = {}
    for name, letter in (('tajikistan.pmtiles', 'm'), ('tajikistan-extra.pmtiles', 'e')):
        src = os.path.join(data, name)
        if not os.path.exists(src):
            raise SystemExit(f'нет {src} — сначала scripts/build-tiles.sh')
        archives[name] = (f'{letter}{prefix}', split(src, os.path.join(out, 'tiles'), f'{letter}{prefix}'))
    credit = attribution(data)
    relief = dem(out, data)
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(page(os.path.join(HERE, 'site', 'index.html'), archives, credit, offline, relief))
    shutil.copytree(os.path.join(HERE, 'src'), os.path.join(out, 'src'))
    shutil.copytree(os.path.join(HERE, 'sprites'), os.path.join(out, 'sprites'),
                    ignore=shutil.ignore_patterns('*.svg', 'src'))
    shutil.copy(os.path.join(data, 'tajikistan-search.json'), os.path.join(out, 'search.json'))
    shutil.copy(os.path.join(data, 'tajikistan-mask.geojson'), os.path.join(out, 'mask.geojson'))
    for style, font in FONTS.items():
        os.makedirs(os.path.join(out, 'fonts', style))
        for rng in RANGES:
            pbf = os.path.join(HERE, 'fonts', font, f'{rng}.pbf')
            if not os.path.exists(pbf):
                fetch(f'{FONT_SOURCE}/{font.replace(" ", "%20")}/{rng}.pbf', pbf)
            with open(pbf, 'rb') as f, open(os.path.join(out, 'fonts', style, f'{rng}.txt'), 'w') as g:
                g.write(b64(f.read()))
    if offline:
        for name, url in LIBS.items():
            cached = os.path.join(data, 'lib', name)
            if not os.path.exists(cached):
                fetch(url, cached)
            os.makedirs(os.path.join(out, 'lib'), exist_ok=True)
            shutil.copy(cached, os.path.join(out, 'lib', name))
        launcher = os.path.join(HERE, 'site', 'offline')
        for name in os.listdir(launcher):
            shutil.copy(os.path.join(launcher, name), os.path.join(out, name))
        for name in os.listdir(out):
            if name.endswith(('.sh', '.command')):
                os.chmod(os.path.join(out, name), 0o755)
    if offline:
        print(f'{out}: карта для компьютера, {credit}')
        return
    steps = plan(out)
    with open(os.path.join(out, 'publish-plan.json'), 'w', encoding='utf-8') as f:
        json.dump({'prefix': prefix, 'archives': {k: list(v) for k, v in archives.items()}, 'attribution': credit,
                   'built': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'page': 'index.html', 'steps': steps}, f,
                  ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(r, n)) for r, _d, ns in os.walk(out) for n in ns)
    print(f'{out}: {total / 1e6:.1f} МБ, части тайлов {archives["tajikistan.pmtiles"][1]} + '
          f'{archives["tajikistan-extra.pmtiles"][1]} (префикс {prefix}), шагов публикации {len(steps)}, {credit}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict((a[2:].split('=', 1) + [''])[:2] for a in sys.argv[1:] if a.startswith('--'))
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], offline='offline' in opts, prefix=opts.get('prefix') or None)
