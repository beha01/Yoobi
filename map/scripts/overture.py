#!/usr/bin/env python3
"""Организации и новые здания Таджикистана из открытой базы Overture Maps.

  python3 scripts/overture.py data/sources/overture-places.jsonl [--release=2026-09-23.1]
  python3 scripts/overture.py --buildings data/sources/overture-buildings.jsonl --mask=data/tajikistan-mask.geojson

Overture Maps Foundation публикует мировую базу мест (кафе, магазины, банки, клиники…)
под открытыми лицензиями (CDLA-Permissive-2.0, Apache-2.0 — у каждой записи указан
источник). Файлы лежат в открытом бакете S3 и отсортированы по территории, поэтому
скрипт читает по HTTP только подвалы файлов и те группы строк, что пересекают
Таджикистан, — десятки мегабайт вместо 11 ГБ. Ключи и аккаунт AWS не нужны.

Результат — по строке JSON на место: id, lon, lat, названия, категория, уверенность,
телефоны, сайты, соцсети, адрес, бренд и источники. scripts/extras.py сверяет эти
места с OSM (дубликаты рядом с тем же названием отбрасываются), кладёт в поиск и в
дополнительные тайлы.

Здания (--buildings): Overture объединяет OSM с контурами, которые Microsoft и Google
распознали по спутниковым снимкам (лицензия ODbL, как у OSM). Берутся только здания
не из OSM — это дома, которых в OSM ещё нет (новые кварталы, сёла). Файлы выбираются по
каталогу STAC, группы строк — по контуру страны (--mask), поэтому из ~7 ГБ соседних
файлов читается только Таджикистан. scripts/extras.py убирает те, что уже нарисованы
в OSM после выхода Overture, и добавляет остальные в основные тайлы.

Нужен pyarrow: pip install pyarrow
"""

import io
import json
import re
import struct
import sys
import time
import urllib.request

import pyarrow.parquet as pq

BUCKET = 'https://overturemaps-us-west-2.s3.amazonaws.com'
BBOX = (67.3, 36.6, 75.2, 41.1)  # Таджикистан с запасом; точную границу проверяет extras.py
COLUMNS = ['id', 'geometry', 'confidence', 'websites', 'socials', 'phones', 'emails', 'brand', 'addresses',
           'names', 'sources', 'operating_status', 'basic_category', 'taxonomy', 'bbox']


def fetch(url, headers=None, tries=6):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=120) as r:
                return r.read()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def list_keys(prefix, delimiter=None):
    """Ключи и подпапки бакета по префиксу (S3 ListObjectsV2, без авторизации)."""
    keys, dirs, token = [], [], None
    while True:
        q = f'list-type=2&prefix={prefix}' + (f'&delimiter={delimiter}' if delimiter else '')
        if token:
            q += '&continuation-token=' + urllib.request.quote(token, safe='')
        xml = fetch(f'{BUCKET}/?{q}').decode()
        keys += re.findall(r'<Key>([^<]+)</Key>', xml)
        dirs += re.findall(r'<Prefix>([^<]+/)</Prefix>', xml)[1:] if delimiter else []
        m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', xml)
        if not m:
            return keys, dirs
        token = m.group(1)


class RangeFile(io.RawIOBase):
    """Файл по HTTP: pyarrow читает кусками (Range), лишнее не скачивается."""

    def __init__(self, url, block=1 << 20):
        self.url, self.pos, self.block, self.cache, self.fetched = url, 0, block, {}, 0
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=60) as r:
            self.size = int(r.headers['Content-Length'])

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def _get(self, start, end):
        data = fetch(self.url, {'Range': f'bytes={start}-{end - 1}'})
        self.fetched += len(data)
        return data

    def read(self, n=-1):
        n = self.size - self.pos if n < 0 else min(n, self.size - self.pos)
        if n <= 0:
            return b''
        if n > self.block:
            data = self._get(self.pos, self.pos + n)
        else:
            data, pos, left = b'', self.pos, n
            while left > 0:
                b = pos // self.block
                if b not in self.cache:
                    if len(self.cache) > 64:
                        self.cache.clear()
                    self.cache[b] = self._get(b * self.block, min(self.size, (b + 1) * self.block))
                chunk = self.cache[b][pos - b * self.block:pos - b * self.block + left]
                data, pos, left = data + chunk, pos + len(chunk), left - len(chunk)
        self.pos += len(data)
        return data

    def readinto(self, buf):
        data = self.read(len(buf))
        buf[:len(data)] = data
        return len(data)


def point(wkb):
    """Координаты точки из WKB (места Overture — всегда точки)."""
    order = '<' if wkb[0] == 1 else '>'
    kind = struct.unpack(order + 'I', wkb[1:5])[0]
    if kind % 1000 != 1:
        return None
    return struct.unpack(order + 'dd', wkb[5:21])


def overlaps(rg, idx, bbox):
    stats = {k: rg.column(idx[k]).statistics for k in ('bbox.xmin', 'bbox.xmax', 'bbox.ymin', 'bbox.ymax')}
    if any(s is None or not s.has_min_max for s in stats.values()):
        return True
    return (stats['bbox.xmin'].min <= bbox[2] and stats['bbox.xmax'].max >= bbox[0]
            and stats['bbox.ymin'].min <= bbox[3] and stats['bbox.ymax'].max >= bbox[1])


def record(row):
    lonlat = point(row['geometry'])
    if not lonlat:
        return None
    names = row['names'] or {}
    common = dict(names.get('common') or [])
    brand = row['brand'] or {}
    brand_names = (brand.get('names') or {})
    address = next(iter(row['addresses'] or []), None) or {}
    taxonomy = row['taxonomy'] or {}
    return {
        'id': row['id'],
        'lon': round(lonlat[0], 6),
        'lat': round(lonlat[1], 6),
        'name': names.get('primary') or '',
        'names': {k: v for k, v in common.items() if k in ('ru', 'tg', 'en') and v},
        'category': row['basic_category'] or '',
        'taxonomy': taxonomy.get('primary') or '',
        'hierarchy': taxonomy.get('hierarchy') or [],
        'confidence': round(row['confidence'] or 0, 3),
        'status': row['operating_status'] or '',
        'phones': row['phones'] or [],
        'websites': row['websites'] or [],
        'socials': row['socials'] or [],
        'address': {k: address.get(k) for k in ('freeform', 'locality', 'postcode', 'region') if address.get(k)},
        'brand': brand_names.get('primary') or '',
        'sources': sorted({s['dataset'] for s in row['sources'] or [] if s.get('dataset')}),
        'licenses': sorted({s['license'] for s in row['sources'] or [] if s.get('license')}),
    }


STAC = 'https://stac.overturemaps.org'


class Raster:
    """Грубая сетка страны (клетки 0.02°) — быстрый ответ «пересекает ли рамка страну»."""

    CELL = 0.02

    def __init__(self, mask_path):
        with open(mask_path, encoding='utf-8') as f:
            g = json.load(f)
        g = g.get('geometry', g)
        polygons = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        # Маска «заморозки» — рамка с дырками: сама страна (и её анклавы) — это дырки.
        if len(polygons) == 1 and len(polygons[0]) > 1 and len(polygons[0][0]) <= 5:
            polygons = [[ring] for ring in polygons[0][1:]]
        self.cells = set()
        xs = [p[0] for poly in polygons for p in poly[0]]
        ys = [p[1] for poly in polygons for p in poly[0]]
        self.bbox = (min(xs), min(ys), max(xs), max(ys))
        for poly in polygons:
            ring = poly[0]
            y0, y1 = min(p[1] for p in ring), max(p[1] for p in ring)
            j = int(y0 // self.CELL)
            while j * self.CELL <= y1:
                y = (j + 0.5) * self.CELL
                xs = sorted(ax + (y - ay) * (bx - ax) / (by - ay)
                            for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]) if (ay > y) != (by > y))
                for a, b in zip(xs[::2], xs[1::2]):
                    # С запасом в клетку: здания у самой границы проверит extras.py точно.
                    for i in range(int(a // self.CELL) - 1, int(b // self.CELL) + 2):
                        for dj in (-1, 0, 1):
                            self.cells.add((i, j + dj))
                j += 1

    def hits(self, x1, y1, x2, y2):
        c = self.CELL
        if (x2 - x1) / c * (y2 - y1) / c > 40000:
            return True  # большая рамка: проверять клетки дольше, чем прочитать
        return any((i, j) in self.cells for i in range(int(x1 // c), int(x2 // c) + 1)
                   for j in range(int(y1 // c), int(y2 // c) + 1))

    def inside(self, x, y):
        return (int(x // self.CELL), int(y // self.CELL)) in self.cells


def wkb_polygons(wkb):
    """Внешние кольца многоугольников из WKB (Polygon / MultiPolygon)."""
    out = []

    def read(pos):
        order = '<' if wkb[pos] == 1 else '>'
        kind = struct.unpack_from(order + 'I', wkb, pos + 1)[0] % 1000
        pos += 5
        if kind == 3:
            rings = struct.unpack_from(order + 'I', wkb, pos)[0]
            pos += 4
            for r in range(rings):
                n = struct.unpack_from(order + 'I', wkb, pos)[0]
                pos += 4
                coords = struct.unpack_from(order + 'd' * (2 * n), wkb, pos)
                pos += 16 * n
                if r == 0:
                    out.append([(round(coords[k], 6), round(coords[k + 1], 6)) for k in range(0, 2 * n, 2)])
            return pos
        if kind == 6:
            count = struct.unpack_from(order + 'I', wkb, pos)[0]
            pos += 4
            for _ in range(count):
                pos = read(pos)
            return pos
        raise ValueError(f'WKB {kind}')

    read(0)
    return out


def buildings(out, mask_path, release=None):
    """Здания Overture не из OSM внутри страны → JSONL: кольцо, высота, этажность, источник."""
    raster = Raster(mask_path)
    if not release:
        _, dirs = list_keys('release/', '/')
        release = sorted(d.split('/')[1] for d in dirs)[-1]
    collection = json.loads(fetch(f'{STAC}/{release}/buildings/building/collection.json'))
    items = [link['href'] for link in collection['links'] if link['rel'] == 'item']
    x1, y1, x2, y2 = raster.bbox
    files = []
    for href in items:
        item = json.loads(fetch(href))
        b = item.get('bbox')
        if b and b[0] <= x2 and b[2] >= x1 and b[1] <= y2 and b[3] >= y1:
            files.append(item['assets']['aws']['href'])
    print(f'Overture {release}: зданий в {len(files)} файлах из {len(items)}')
    columns = ['geometry', 'bbox', 'sources', 'height', 'num_floors']
    total = fetched = 0
    kinds = {}
    with open(out, 'w', encoding='utf-8') as f:
        for url in files:
            src = RangeFile(url)
            pf = pq.ParquetFile(src)
            md = pf.metadata
            idx = {md.schema.column(i).path: i for i in range(md.num_columns)}
            groups = []
            for i in range(md.num_row_groups):
                rg = md.row_group(i)
                st = [rg.column(idx[k]).statistics for k in ('bbox.xmin', 'bbox.ymin', 'bbox.xmax', 'bbox.ymax')]
                if all(s is not None and s.has_min_max for s in st):
                    if raster.hits(st[0].min, st[1].min, st[2].max, st[3].max):
                        groups.append(i)
                else:
                    groups.append(i)
            for i in groups:
                for row in pf.read_row_group(i, columns=columns).to_pylist():
                    b = row['bbox']
                    if not raster.inside((b['xmin'] + b['xmax']) / 2, (b['ymin'] + b['ymax']) / 2):
                        continue
                    datasets = sorted({s['dataset'] for s in row['sources'] or [] if s.get('dataset')})
                    if 'OpenStreetMap' in datasets:
                        continue  # есть в OSM — уже в тайлах
                    for ring in wkb_polygons(row['geometry']):
                        rec = {'r': ring}
                        if row['height']:
                            rec['h'] = round(row['height'], 1)
                        if row['num_floors']:
                            rec['f'] = int(row['num_floors'])
                        rec['s'] = ','.join(datasets)
                        f.write(json.dumps(rec, separators=(',', ':')) + '\n')
                        total += 1
                        kinds[rec['s']] = kinds.get(rec['s'], 0) + 1
            fetched += src.fetched
            print(f'  {url.rsplit("/", 1)[1][:10]}: групп строк {len(groups)}/{md.num_row_groups}, '
                  f'скачано {src.fetched / 1e6:.0f} МБ, зданий не из OSM {total}')
    print(f'Готово: {out} — {total} зданий ({kinds}), скачано {fetched / 1e6:.0f} МБ')


def main(out, release=None, bbox=BBOX):
    if not release:
        _, dirs = list_keys('release/', '/')
        release = sorted(d.split('/')[1] for d in dirs)[-1]
    keys, _ = list_keys(f'release/{release}/theme=places/type=place/')
    keys = [k for k in keys if k.endswith('.parquet')]
    print(f'Overture {release}: {len(keys)} файлов мест')
    total, fetched = 0, 0
    with open(out, 'w', encoding='utf-8') as f:
        for key in keys:
            src = RangeFile(f'{BUCKET}/{key}')
            pf = pq.ParquetFile(src)
            md = pf.metadata
            idx = {md.schema.column(i).path: i for i in range(md.num_columns)}
            groups = [i for i in range(md.num_row_groups) if overlaps(md.row_group(i), idx, bbox)]
            for i in groups:
                table = pf.read_row_group(i, columns=COLUMNS)
                for row in table.to_pylist():
                    b = row['bbox']
                    if not (bbox[0] <= b['xmin'] <= bbox[2] and bbox[1] <= b['ymin'] <= bbox[3]):
                        continue
                    rec = record(row)
                    if rec:
                        f.write(json.dumps(rec, ensure_ascii=False, separators=(',', ':')) + '\n')
                        total += 1
            fetched += src.fetched
            print(f'  {key.rsplit("/", 1)[1][:10]}: групп строк {len(groups)}/{md.num_row_groups}, '
                  f'скачано {src.fetched / 1e6:.1f} МБ, мест всего {total}')
    print(f'Готово: {out} — {total} мест, скачано {fetched / 1e6:.0f} МБ')
    with open(f'{out}.release', 'w', encoding='utf-8') as f:
        f.write(release + '\n')  # extras.py пишет дату релиза в индекс поиска
    return release


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if not args:
        sys.exit(__doc__)
    if '--buildings' in sys.argv:
        buildings(args[0], opts.get('mask', 'data/tajikistan-mask.geojson'), opts.get('release'))
    else:
        main(args[0], opts.get('release'))
