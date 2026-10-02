#!/usr/bin/env python3
"""Новые высотки и расчищенные кварталы по открытым спутниковым снимкам Sentinel-2.

Здания в OSM по Таджикистану в основном нарисованы в 2017–2019 годах. С тех пор в городах
снесены целые махалли частных домов и выросли новые многоэтажки, а на карте всё ещё
старый частный сектор (так в Казаконе в Душанбе). Снимки Sentinel-2 (программа Copernicus,
открытая лицензия: можно использовать и изменять с указанием источника) обновляются раз
в несколько дней. Скрипт сравнивает последние ясные снимки с такими же осенними снимками
2017 года и находит:

  * новые высокие дома — появилась резкая тень, а рядом с ней, со стороны солнца, светлая
    крыша. Высота — по длине тени и высоте солнца над горизонтом;
  * расчищенные участки — где была пёстрая картинка частного сектора или сады, а теперь
    ровная голая земля: дома снесены, идёт стройка.

Уже нарисованное в OSM не дублируется: тень у дома, который есть в OSM, пропускается.
Снимок — 10 м на пиксель, поэтому контур нового дома примерный (±10 м), этажность — ±2–3
этажа; карточка дома это пишет. Старые частные дома, на месте которых теперь высотка или
голая земля, убираются с карты (при сборке, в scripts/extras.py).

  python3 scripts/imagery.py data/sources/imagery.geojson [--osm=data/sources/tajikistan.osm.pbf]
      [--only=Dushanbe,Khujand] [--review=каталог для картинок проверки] [--cache=data/sources/imagery-cache]

Нужны numpy, scipy и rasterio (pip install numpy scipy rasterio). Снимки берутся из
открытого архива Sentinel-2 L2A на AWS через каталог Element 84 Earth Search — только
нужные окна, по несколько мегабайт на город. На карте: «Contains modified Copernicus
Sentinel data <год>».
"""

import datetime as dt
import json
import math
import os
import sys
import time
import urllib.request
import warnings

try:  # для анализа снимков; правкам для сборки (corrections) хватает json
    import numpy as np
    from scipy import ndimage as ndi
except ImportError:  # pragma: no cover
    np = ndi = None

STAC = 'https://earth-search.aws.element84.com/v1/search'
COLLECTION = 'sentinel-2-l2a'
BANDS = {'blue': 'b', 'green': 'g', 'red': 'r', 'nir': 'n'}
PIXEL = 10.0
BASELINE_YEARS = (2017, 2018)  # когда рисовалась большая часть домов в OSM
RADIUS = {'capital': 11000, 'city': 6000, 'town': 2500}  # м вокруг центра населённого пункта
INVALID_SCL = (0, 1, 3, 8, 9, 10, 11)  # нет данных, пересвет, тени и облака, снег
# Старая обработка (2017–2018) принимает светлые крыши за облака; в почти ясный день облачные
# пиксели не выбрасываются — случайное облако уберёт медиана по нескольким дням.
CLEAR_SCENE = 3.0   # облачность снимка, %, ниже которой маскируются только пропуски
CACHE_VERSION = 2
UA = 'yoobi-map/1.0 (+https://github.com/beha01/Yoobi; imagery.py)'

# Пороги (коэффициенты отражения 0…1). Подобраны на Душанбе: тень высотки темнее 0,075 и
# заметно темнее окрестностей, свежая крыша — светлее 0,16 и светлее окрестностей.
SHADOW_MAX = 0.075
SHADOW_REL = 0.62
SHADOW_NIR = 0.16
ROOF_MIN = 0.16
ROOF_REL = 1.08
MIN_SHADOW_PX = 4
MIN_ROOF_PX = 4
MIN_LEVELS = 5
BARE_SD = 0.013
BARE_NDVI = 0.15
MIN_CLEARED_PX = 30  # 0,3 га
MIN_CLEARED_HOUSES = 8  # на расчищенном участке в OSM стоят хотя бы 8 домов…
CLEARED_DENSITY = 15    # …и не реже 15 на гектар — как в частном секторе
SMALL_HOUSE_M2 = 400
HOUSE_TYPES = {'yes', 'house', 'residential', 'detached', 'semidetached_house', 'hut', 'shed', 'garage',
               'garages', 'terrace', 'farm_auxiliary', 'bungalow'}
POI_KEYS = ('amenity', 'shop', 'office', 'tourism', 'leisure', 'craft', 'healthcare', 'historic', 'name')


# ---------------------------------------------------------------------------- каталог снимков

def post(url, body, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST',
                                         headers={'Content-Type': 'application/json', 'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 — сеть: повторяем
            if i == tries - 1:
                raise
            print(f'  каталог: {e}, повтор', file=sys.stderr)
            time.sleep(2 ** i)


def search(bbox, start, end, max_cloud):
    """Снимки, задевающие рамку, с облачностью ниже max_cloud %, от новых к старым."""
    body = {'collections': [COLLECTION], 'bbox': list(bbox), 'limit': 100,
            'datetime': f'{start}T00:00:00Z/{end}T23:59:59Z', 'query': {'eo:cloud_cover': {'lt': max_cloud}},
            'sortby': [{'field': 'properties.datetime', 'direction': 'desc'}]}
    try:
        page = post(STAC, body)
    except Exception:  # noqa: BLE001 — каталог без сортировки: отсортируем сами
        body.pop('sortby')
        page = post(STAC, body)
    items = []
    while True:
        items += page.get('features', [])
        nxt = next((ln for ln in page.get('links', []) if ln.get('rel') == 'next'), None)
        if not nxt or len(items) > 400:
            break
        page = post(nxt['href'], nxt.get('body') or body)
    return sorted(items, key=lambda it: it['properties']['datetime'], reverse=True)


def scale_of(item):
    """Отражение = DN × 1e-4 + сдвиг. С версии обработки 04.00 (2022) в DN добавлено 1000; в архиве
    Earth Search его уже вычли, если стоит earthsearch:boa_offset_applied."""
    p = item['properties']
    base = float(p.get('s2:processing_baseline') or 0)
    offset = -0.1 if base >= 4 and not p.get('earthsearch:boa_offset_applied') else 0.0
    return 1e-4, offset


# ---------------------------------------------------------------------------- сетка и чтение

class Grid:
    """Сетка 10 м в зоне UTM области: совпадает с сеткой снимков, поэтому окна читаются без пересчёта."""

    def __init__(self, bbox):
        from rasterio.transform import from_origin
        from rasterio.warp import transform
        lon = (bbox[0] + bbox[2]) / 2
        self.epsg = 32600 + int((lon + 180) // 6) + 1
        self.crs = f'EPSG:{self.epsg}'
        xs, ys = transform('EPSG:4326', self.crs, [bbox[0], bbox[2], bbox[0], bbox[2]], [bbox[1], bbox[1], bbox[3], bbox[3]])
        self.x0 = math.floor(min(xs) / 20) * 20
        self.y1 = math.ceil(max(ys) / 20) * 20
        self.w = int(math.ceil((max(xs) - self.x0) / 20) * 2)
        self.h = int(math.ceil((self.y1 - min(ys)) / 20) * 2)
        self.transform = from_origin(self.x0, self.y1, PIXEL, PIXEL)
        self.bounds = (self.x0, self.y1 - self.h * PIXEL, self.x0 + self.w * PIXEL, self.y1)

    def key(self):
        return f'{self.epsg}-{self.x0}-{self.y1}-{self.w}-{self.h}'

    def to_px(self, lons, lats):
        from rasterio.warp import transform
        xs, ys = transform('EPSG:4326', self.crs, list(lons), list(lats))
        return (np.array(xs) - self.x0) / PIXEL, (self.y1 - np.array(ys)) / PIXEL

    def to_lonlat(self, cols, rows):
        from rasterio.warp import transform
        xs = [self.x0 + c * PIXEL for c in cols]
        ys = [self.y1 - r * PIXEL for r in rows]
        return transform(self.crs, 'EPSG:4326', xs, ys)


def read_scene(items, grid):
    """Снимки одного дня (несколько квадратов сетки) в сетке области: словарь каналов с NaN там,
    где данных нет или облака."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.windows import from_bounds
    out = {k: np.full((grid.h, grid.w), np.nan, 'f4') for k in BANDS.values()}
    env = rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',
                       GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='2', VSI_CACHE='TRUE')
    with env:
        for item in items:
            zone = item['properties'].get('mgrs:utm_zone')
            if zone and 32600 + int(zone) != grid.epsg:
                continue  # квадрат соседней зоны UTM — другая сетка
            scale, offset = scale_of(item)
            with rasterio.open(item['assets']['scl']['href']) as ds:
                scl = ds.read(1, window=from_bounds(*grid.bounds, ds.transform), out_shape=(grid.h, grid.w),
                              boundless=True, fill_value=0, resampling=Resampling.nearest)
            clear = float(item['properties'].get('eo:cloud_cover', 100)) < CLEAR_SCENE
            ok = ~np.isin(scl, (0, 1) if clear else INVALID_SCL)
            ok &= np.isnan(out['r'])  # соседний квадрат того же дня уже заполнил эти пиксели
            if not ok.any():
                continue
            for asset, k in BANDS.items():
                with rasterio.open(item['assets'][asset]['href']) as ds:
                    a = ds.read(1, window=from_bounds(*grid.bounds, ds.transform), out_shape=(grid.h, grid.w),
                                boundless=True, fill_value=0, resampling=Resampling.nearest)
                good = ok & (a > 0)
                out[k][good] = a[good].astype('f4') * scale + offset
    return out


def by_day(items):
    days = {}
    for it in items:
        days.setdefault(it['properties']['datetime'][:10], []).append(it)
    return days


def composite(days, grid, cache, want, min_valid=0.85):
    """Медиана по want самым новым ясным дням. Возвращает (каналы, дни, солнце (азимут, высота))."""
    stack, used, sun = [], [], []
    for day, items in sorted(days.items(), reverse=True):
        path = os.path.join(cache, f'{grid.key()}-{day}-v{CACHE_VERSION}.npz') if cache else None
        if path and os.path.exists(path):
            with np.load(path) as z:
                scene = {k: z[k].astype('f4') for k in BANDS.values()}
        else:
            try:
                scene = read_scene(items, grid)
            except Exception as e:  # noqa: BLE001 — снимок недоступен: берём другой день
                print(f'  {day}: {e}', file=sys.stderr)
                continue
            if path:
                np.savez_compressed(path, **{k: v.astype('f2') for k, v in scene.items()})
        valid = float(np.isfinite(scene['r']).mean())
        if valid < min_valid:
            continue
        stack.append(scene)
        used.append(day)
        p = items[0]['properties']
        sun.append((p.get('view:sun_azimuth', 160.0), p.get('view:sun_elevation', 45.0)))
        if len(stack) >= want:
            break
    if not stack:
        return None, [], None
    with np.errstate(all='ignore'), warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)  # пиксель без данных во все дни — NaN
        bands = {k: np.nanmedian(np.stack([s[k] for s in stack]), axis=0) if len(stack) > 1 else stack[0][k]
                 for k in BANDS.values()}
    az = sum(s[0] for s in sun) / len(sun)
    el = sum(s[1] for s in sun) / len(sun)
    return bands, used, (az, el)


# ---------------------------------------------------------------------------- признаки

def features(c):
    """Яркость, NDVI, яркость окрестности (медиана 90 м) и пестрота (разброс в окне 30 м)."""
    r, g, b, n = c['r'], c['g'], c['b'], c['n']
    bri = (r + g + b) / 3
    ndvi = (n - r) / (n + r + 1e-6)
    fill = np.where(np.isfinite(bri), bri, np.nanmedian(bri) if np.isfinite(bri).any() else 0)
    med = ndi.median_filter(fill, 9)
    mean = ndi.uniform_filter(fill, 3)
    sd = np.sqrt(np.maximum(ndi.uniform_filter(fill * fill, 3) - mean * mean, 0))
    return {'bri': bri, 'ndvi': ndvi, 'nir': n, 'med': med, 'sd': sd, 'valid': np.isfinite(bri) & np.isfinite(n)}


def match(old, now):
    """Старый снимок в яркостях нового (сопоставление квантилей по каждому каналу): другая камера,
    другая обработка и дымка иначе выглядят как «перемены» по всему городу."""
    out = {}
    q = np.linspace(0, 100, 201)
    for k in BANDS.values():
        a, b = old[k], now[k]
        ok_a, ok_b = np.isfinite(a), np.isfinite(b)
        if ok_a.sum() < 1000 or ok_b.sum() < 1000:
            out[k] = a
            continue
        qa, qb = np.percentile(a[ok_a], q), np.percentile(b[ok_b], q)
        qa = np.maximum.accumulate(qa + np.arange(len(qa)) * 1e-9)  # строго возрастающие для интерполяции
        out[k] = np.where(ok_a, np.interp(a, qa, qb), np.nan).astype('f4')
    return out


def heights(now, sun, ids, keys, min_levels=4):
    """Этажность зданий OSM без этажности по длине их тени: {ключ: этажей}. ids — растр номеров
    зданий (1…), keys — их ключи. Тень ищется сразу за зданием в сторону от солнца; контур из OSM
    может быть сдвинут относительно снимка на пиксель, поэтому тень может начинаться и внутри.
    Оценка — только если тень есть вдоль большей части стороны здания, а само здание освещено."""
    az, el = sun
    ax, ay = -math.sin(math.radians(az)), math.cos(math.radians(az))  # от солнца: столбец, строка
    sh = shadow(now)
    h, w = ids.shape
    out = {}
    slices = ndi.find_objects(ids)
    for i, sl in enumerate(slices):
        if sl is None:
            continue
        ys, xs = np.nonzero(ids[sl] == i + 1)
        if len(ys) < 2:
            continue
        ys, xs = ys + sl[0].start, xs + sl[1].start
        if sh[ys, xs].mean() > 0.5:
            continue  # здание само в чужой тени
        own = set(zip(ys.tolist(), xs.tolist()))
        runs = []
        bri = now['bri']
        for y, x in own:
            ny, nx = int(round(y + ay)), int(round(x + ax))
            if (ny, nx) in own:
                continue  # не крайний пиксель со стороны тени
            run, last, end = 0, None, None
            for k in range(-1, 18):
                yy, xx = int(round(y + ay * k)), int(round(x + ax * k))
                if not (0 <= yy < h and 0 <= xx < w):
                    break
                other = ids[yy, xx] not in (0, i + 1)
                if sh[yy, xx] and not other:
                    run += 1
                    last = (yy, xx)
                elif last:
                    end = (k, yy, xx)
                    break
                elif k >= 3 or other:
                    break
            length = float(run)
            if end:  # край тени посреди пикселя: доля по яркости между тенью и светом за ней
                k, yy, xx = end
                y2, x2 = int(round(y + ay * (k + 2))), int(round(x + ax * (k + 2)))
                if 0 <= y2 < h and 0 <= x2 < w and not sh[y2, x2]:
                    lit, dark, mid = bri[y2, x2], bri[last], bri[yy, xx]
                    if lit - dark > 0.02:
                        length += float(np.clip((lit - mid) / (lit - dark), 0, 1))
            runs.append(length)
        if not runs:
            continue
        runs.sort()
        if sum(r >= 2 for r in runs) < 0.5 * len(runs):
            continue
        length = runs[int(0.75 * (len(runs) - 1))]
        levels = int(round(length * PIXEL * math.tan(math.radians(el)) / 3.2))
        if levels >= min_levels:
            out[keys[i][0] + str(keys[i][1])] = min(levels, 40)
    return out


def shadow(f):
    """Тень высокого дома: тёмное пятно, заметно темнее окрестностей, не вода и не зелень."""
    with np.errstate(invalid='ignore'):
        return f['valid'] & (f['bri'] < SHADOW_MAX) & (f['bri'] < SHADOW_REL * f['med']) & \
            (f['nir'] < SHADOW_NIR) & (f['nir'] > 0.035) & (f['ndvi'] < 0.35)


def min_rect(points):
    """Прямоугольник наименьшей площади вокруг точек (вращающиеся калиперы по выпуклой оболочке)."""
    pts = sorted(set((float(x), float(y)) for x, y in points))
    if len(pts) < 3:
        return None

    def half(seq):
        h = []
        for p in seq:
            while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0]) <= 0:
                h.pop()
            h.append(p)
        return h

    hull = np.array(half(pts)[:-1] + half(pts[::-1])[:-1])
    best = None
    for i in range(len(hull)):
        e = hull[(i + 1) % len(hull)] - hull[i]
        length = math.hypot(*e)
        if length == 0:
            continue
        u = e / length
        v = np.array([-u[1], u[0]])
        a, b = hull @ u, hull @ v
        area = (a.max() - a.min()) * (b.max() - b.min())
        if best is None or area < best[0]:
            best = (area, u, v, a.min(), a.max(), b.min(), b.max())
    if best is None:
        return None
    _, u, v, a0, a1, b0, b1 = best
    return [tuple(u * a + v * b) for a, b in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]


def towers(now, old, sun, mapped=None, built=None):
    """Новые высокие дома: [{'rect': [(col, row)×4], 'height': м, 'levels': n, 'shadow': px, 'roof': px}].
    now/old — признаки features() свежего и старого снимка, sun — (азимут, высота) солнца, mapped —
    маска зданий, уже нарисованных в OSM (высоких или больших): такие не повторяются; built — маска
    застройки: вне неё (горы, поля) не ищем."""
    az, el = sun
    sx, sy = math.sin(math.radians(az)), -math.cos(math.radians(az))  # к солнцу: столбец, строка
    sh_now, sh_old = shadow(now), shadow(old)
    new = sh_now & ~ndi.binary_dilation(sh_old, iterations=1) & old['valid']  # в старом снимке там не облако
    if built is not None:
        new &= built
    with np.errstate(invalid='ignore'):
        changed = ((now['bri'] - old['bri']) > 0.02) | ((old['ndvi'] - now['ndvi']) > 0.06)
        roof = now['valid'] & (now['bri'] > np.maximum(ROOF_MIN, ROOF_REL * now['med'])) & (now['ndvi'] < 0.22) & \
            changed & ~sh_now
    lab, count = ndi.label(new, structure=np.ones((3, 3)))
    if not count:
        return []
    sizes = ndi.sum(new, lab, range(1, count + 1))
    slices = ndi.find_objects(lab)
    h, w = new.shape
    claimed = np.zeros(new.shape, bool)
    out = []
    for i in np.argsort(-sizes):
        if sizes[i] < MIN_SHADOW_PX:
            break
        sl = slices[i]
        ys, xs = np.nonzero(lab[sl] == i + 1)
        ys, xs = ys + sl[0].start, xs + sl[1].start
        blob = set(zip(ys.tolist(), xs.tolist()))
        # Тень дома — компактное пятно; длинная тонкая полоса — тень склона, оврага или ряда деревьев.
        srect = min_rect([(x + dx, y + dy) for y, x in blob for dx in (0, 1) for dy in (0, 1)])
        if srect:
            a, b = math.dist(srect[0], srect[1]), math.dist(srect[1], srect[2])
            if max(a, b) > 14 or len(blob) / (a * b) < 0.4:
                continue
        along = xs * sx + ys * sy          # вдоль направления на солнце
        across = xs * -sy + ys * sx        # поперёк
        a_hi, c_lo, c_hi = along.max(), across.min() - 1.5, across.max() + 1.5
        # Крыша — светлые пиксели сразу за тенью со стороны солнца; растим её не дальше 70 м от тени.
        seeds = []
        for y, x in blob:
            for k in (1, 2):
                yy, xx = int(round(y + sy * k)), int(round(x + sx * k))
                if 0 <= yy < h and 0 <= xx < w and (yy, xx) not in blob and roof[yy, xx] and not claimed[yy, xx]:
                    seeds.append((yy, xx))
        found, queue = set(seeds), list(seeds)
        while queue and len(found) < 80:
            y, x = queue.pop()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if not (0 <= yy < h and 0 <= xx < w) or (yy, xx) in found or not roof[yy, xx] or claimed[yy, xx]:
                    continue
                a, c = xx * sx + yy * sy, xx * -sy + yy * sx
                if 0 < a - a_hi <= 7 and c_lo <= c <= c_hi:
                    found.add((yy, xx))
                    queue.append((yy, xx))
        if len(found) < MIN_ROOF_PX:
            continue
        rows_f, cols_f = zip(*found)
        if float(np.mean(now['bri'][list(rows_f), list(cols_f)])) < 0.18:
            continue  # новая крыша заметно светлая; тусклое пятно — поле или склон
        height = (along.max() - along.min() + 1) * PIXEL * math.tan(math.radians(el))
        levels = int(round(height / 3.2))
        if levels < MIN_LEVELS or height > 200:
            continue
        rect = min_rect([(x + dx, y + dy) for y, x in found for dx in (0, 1) for dy in (0, 1)])
        if not rect:
            continue
        side = [math.dist(rect[0], rect[1]), math.dist(rect[1], rect[2])]
        area_px = side[0] * side[1]
        if area_px < 2 or len(found) / area_px < 0.45 or max(side) > 20 or max(side) / max(min(side), 0.5) > 8:
            continue
        rows, cols = zip(*found)
        if mapped is not None and mapped[list(rows), list(cols)].mean() > 0.2:
            continue  # этот дом уже есть в OSM
        for y, x in found:
            claimed[y, x] = True
        out.append({'rect': rect, 'height': round(height, 1), 'levels': min(levels, 40),
                    'shadow': int(sizes[i]), 'roof': len(found)})
    return out


def cleared(now, old, exclude=None):
    """Расчищенные участки: маска пикселей, где была пёстрая застройка или зелень, а теперь ровная
    голая земля (участками от MIN_CLEARED_PX). exclude — то, что голым бывает и так: дороги,
    площади, стадионы, уже отмеченные в OSM стройки и большие здания."""
    with np.errstate(invalid='ignore'):
        bare = now['valid'] & (now['ndvi'] < BARE_NDVI) & (now['sd'] < BARE_SD) & (now['bri'] > 0.12) & \
            (now['bri'] < 0.3) & ~shadow(now)
        was = old['valid'] & ((old['sd'] > 0.017) | (old['ndvi'] > 0.22))
        diff = (np.abs(now['bri'] - old['bri']) > 0.015) | (np.abs(now['ndvi'] - old['ndvi']) > 0.06)
    m = bare & was & diff
    if exclude is not None:
        m &= ~exclude
    m = ndi.binary_opening(m, structure=np.ones((2, 2)))
    m = ndi.binary_closing(m, structure=np.ones((3, 3)))
    m = ndi.binary_fill_holes(m)
    lab, count = ndi.label(m)
    if not count:
        return m
    sizes = ndi.sum(m, lab, range(1, count + 1))
    keep = np.zeros(count + 1, bool)
    for i, (s, sl) in enumerate(zip(sizes, ndi.find_objects(lab)), 1):
        if s >= MIN_CLEARED_PX:
            ys, xs = np.nonzero(lab[sl] == i)
            ys, xs = ys + sl[0].start, xs + sl[1].start
            rect = min_rect([(x + dx, y + dy) for y, x in zip(ys, xs) for dx in (0, 1) for dy in (0, 1)])
            if rect:
                a, b = math.dist(rect[0], rect[1]), math.dist(rect[1], rect[2])
                keep[i] = min(a, b) >= 3 and s / (a * b) >= 0.3  # не узкая полоса (дорога, канал)
    return keep[lab]


# ---------------------------------------------------------------------------- OSM в сетке области

def country_rings(mask_path):
    """Кольца страны из маски «всё, кроме страны» (дыры первого многоугольника)."""
    try:
        with open(mask_path, encoding='utf-8') as f:
            g = json.load(f)['geometry']
    except (FileNotFoundError, KeyError, ValueError):
        return None
    polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    return polys[0][1:]


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][:2]
        xj, yj = ring[j][:2]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            inside = not inside
        j = i
    return inside


def areas(osm_path, mask_path=None, only=None):
    """Рамки городов и посёлков (соседние объединяются): [(название, (запад, юг, восток, север))]."""
    import osmium
    rings = country_rings(mask_path) if mask_path else None
    boxes = []
    for o in osmium.FileProcessor(osm_path, osmium.osm.NODE).with_filter(osmium.filter.KeyFilter('place')):
        kind = o.tags.get('place')
        if kind not in ('city', 'town'):
            continue
        lon, lat = o.location.lon, o.location.lat
        if rings and not any(in_ring(lon, lat, r) for r in rings):
            continue  # соседняя страна
        name = o.tags.get('name:en') or o.tags.get('int_name') or o.tags.get('name') or f'{kind} {o.id}'
        r = RADIUS['capital'] if o.tags.get('capital') in ('yes', '2') else RADIUS[kind]
        dy, dx = r / 111320, r / (111320 * math.cos(math.radians(lat)))
        boxes.append([name, [lon - dx, lat - dy, lon + dx, lat + dy], r])
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i][1], boxes[j][1]
                if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                    big = boxes[i] if boxes[i][2] >= boxes[j][2] else boxes[j]
                    boxes[i] = [big[0], [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])], big[2]]
                    del boxes[j]
                    merged = True
                    break
            if merged:
                break
    out = [(n, tuple(round(v, 5) for v in b)) for n, b, _ in sorted(boxes, key=lambda x: -x[2])]
    if only:
        want = {s.strip().lower() for s in only.split(',')}
        out = [a for a in out if a[0].lower() in want]
    return out


class OsmLayer:
    """Здания и площадные объекты OSM в рамках областей — чтобы не дублировать нарисованное."""

    OPEN = {('leisure', 'park'), ('leisure', 'pitch'), ('leisure', 'stadium'), ('leisure', 'playground'),
            ('leisure', 'sports_centre'), ('amenity', 'parking'), ('place', 'square'), ('highway', 'pedestrian'),
            ('landuse', 'railway'), ('landuse', 'cemetery'), ('landuse', 'farmland'), ('landuse', 'industrial'),
            ('aeroway', 'aerodrome'), ('amenity', 'marketplace'), ('landuse', 'quarry')}
    SITE = {('landuse', 'construction'), ('landuse', 'brownfield'), ('landuse', 'greenfield'),
            ('building', 'construction')}

    def __init__(self, osm_path, boxes):
        import osmium
        self.boxes = boxes
        self.cells = {}  # клетка 0,1° -> номера областей: быстро понять, в какую область попал объект
        for i, (_n, b) in enumerate(boxes):
            for cx in range(int(math.floor(b[0] * 10)), int(math.floor(b[2] * 10)) + 1):
                for cy in range(int(math.floor(b[1] * 10)), int(math.floor(b[3] * 10)) + 1):
                    self.cells.setdefault((cx, cy), []).append(i)
        # по областям: здания (id, кольцо lon/lat, теги), площади (вид, кольцо), дороги (широкая ли, линия)
        self.per = [{'buildings': [], 'areas': [], 'roads': []} for _ in boxes]
        fp = (osmium.FileProcessor(osm_path).with_locations()
              .with_areas(osmium.filter.KeyFilter('building', 'landuse', 'leisure', 'amenity', 'natural', 'water',
                                                  'waterway', 'place', 'highway', 'aeroway'))
              .with_filter(osmium.filter.KeyFilter('building', 'landuse', 'leisure', 'amenity', 'natural', 'water',
                                                   'waterway', 'place', 'highway', 'aeroway')))
        for o in fp:
            t = o.tags
            if o.is_way() and 'highway' in t and not o.is_closed():
                try:
                    line = [(n.lon, n.lat) for n in o.nodes]
                except osmium.InvalidLocationError:
                    continue
                wide = t['highway'] in ('motorway', 'trunk', 'primary', 'secondary')
                for i in self.near(line[0]):
                    self.per[i]['roads'].append((wide, line))
                continue
            if not o.is_area():
                continue
            try:
                ring = [(p.lon, p.lat) for p in next(iter(o.outer_rings()))]
            except (StopIteration, osmium.InvalidLocationError):
                continue
            where = self.near(ring[0]) if len(ring) >= 4 else []
            if not where:
                continue
            if 'building' in t:
                item = ('w' if o.from_way() else 'r', o.orig_id())
                for i in where:
                    self.per[i]['buildings'].append((item, ring, dict(t)))
            kind = None
            if t.get('natural') == 'water' or 'water' in t or t.get('waterway') == 'riverbank':
                kind = 'water'
            elif any((k, t.get(k)) in self.SITE for k in ('landuse', 'building')):
                kind = 'site'
            elif any((k, t.get(k)) in self.OPEN for k in ('leisure', 'amenity', 'place', 'highway', 'landuse', 'aeroway')):
                kind = 'open'
            elif t.get('landuse') in ('residential', 'commercial', 'retail'):
                kind = 'urban'
            if kind:
                for i in where:
                    self.per[i]['areas'].append((kind, ring))

    def near(self, p):
        """Номера областей, в рамку которых (с запасом ~1 км) попадает точка."""
        out = []
        for i in self.cells.get((int(math.floor(p[0] * 10)), int(math.floor(p[1] * 10))), ()):
            b = self.boxes[i][1]
            if b[0] - 0.01 <= p[0] <= b[2] + 0.01 and b[1] - 0.01 <= p[1] <= b[3] + 0.01:
                out.append(i)
        return out

    def masks(self, grid, index):
        """Маски в сетке области: mapped (здания OSM высокие или большие), exclude (голое и так:
        дороги, площади, вода, стройки OSM, большие здания), и мелкие дома с центрами в пикселях."""
        from rasterio.features import rasterize
        per = self.per[index]
        shapes_mapped, shapes_excl, shapes_wide, houses, unleveled, shapes_any, shapes_urban = [], [], [], [], [], [], []
        pts = []  # все координаты разом — пересчёт в UTM одним вызовом

        def geom(ring):
            i = len(pts)
            pts.extend(ring)
            return (i, len(ring))

        polys = []
        for key, ring, t in per['buildings']:
            polys.append(('b', geom(ring), (key, t)))
        for kind, ring in per['areas']:
            polys.append((kind, geom(ring), None))
        lines = [(wide, geom(line)) for wide, line in per['roads']]
        shape = (grid.h, grid.w)
        if not pts:
            return {'mapped': np.zeros(shape, bool), 'exclude': np.zeros(shape, bool), 'houses': [],
                    'ids': np.zeros(shape, 'int32'), 'keys': [], 'built': np.zeros(shape, bool)}
        cols, rows = grid.to_px([p[0] for p in pts], [p[1] for p in pts])
        xs, ys = grid.x0 + cols * PIXEL, grid.y1 - rows * PIXEL

        def coords(g):
            i, n = g
            return list(zip(xs[i:i + n].tolist(), ys[i:i + n].tolist()))

        for kind, g, extra in polys:
            ring = coords(g)
            poly = {'type': 'Polygon', 'coordinates': [ring]}
            if kind == 'urban':
                shapes_urban.append(poly)
                continue
            if kind == 'b':
                key, t = extra
                ox, oy = ring[0]
                area = abs(sum((ax - ox) * (by - oy) - (bx - ox) * (ay - oy) for (ax, ay), (bx, by) in
                               zip(ring, ring[1:] + ring[:1]))) / 2 if len(ring) > 2 else 0
                try:
                    levels = float(t.get('building:levels', '0').split(';')[0])
                except ValueError:
                    levels = 0
                if not levels and 'height' not in t and 200 <= area <= 20000 and \
                        t.get('building') not in ('roof', 'canopy', 'carport', 'greenhouse', 'ruins', 'construction'):
                    unleveled.append((key, poly))  # этажность оценим по тени
                shapes_any.append(poly)
                if levels >= 4 or area >= 300 or t.get('building') not in HOUSE_TYPES:
                    shapes_mapped.append(poly)
                    if area >= 500:
                        shapes_excl.append(poly)
                elif area < SMALL_HOUSE_M2 and levels <= 3 and not any(k in t for k in POI_KEYS):
                    cx = sum(p[0] for p in ring[:-1]) / max(len(ring) - 1, 1)
                    cy = sum(p[1] for p in ring[:-1]) / max(len(ring) - 1, 1)
                    houses.append((key, (cx - grid.x0) / PIXEL, (grid.y1 - cy) / PIXEL, round(area)))
            else:
                shapes_excl.append(poly)
        for wide, g in lines:
            line = coords(g)
            if len(line) >= 2:
                (shapes_wide if wide else shapes_excl).append({'type': 'LineString', 'coordinates': line})
        mapped = rasterize(shapes_mapped, out_shape=shape, transform=grid.transform, fill=0,
                           default_value=1, dtype='uint8').astype(bool) if shapes_mapped else np.zeros(shape, bool)
        excl = rasterize(shapes_excl, out_shape=shape, transform=grid.transform, fill=0, default_value=1,
                         dtype='uint8', all_touched=True).astype(bool) if shapes_excl else np.zeros(shape, bool)
        if shapes_wide:  # проспекты шире пикселя
            excl |= ndi.binary_dilation(rasterize(shapes_wide, out_shape=shape, transform=grid.transform, fill=0,
                                                  default_value=1, dtype='uint8', all_touched=True).astype(bool))
        ids = rasterize([(g, i + 1) for i, (_k, g) in enumerate(unleveled)], out_shape=shape,
                        transform=grid.transform, fill=0, dtype='int32') if unleveled else np.zeros(shape, 'int32')
        # Застройка: где домов OSM хотя бы 6% площади в окне 150 м или жилой квартал. Высотки ищутся только
        # там — в горах и полях тени от склонов и стогов не выдаются за дома.
        built = np.zeros(shape, bool)
        if shapes_any:
            anyb = rasterize(shapes_any, out_shape=shape, transform=grid.transform, fill=0, default_value=1,
                             dtype='uint8', all_touched=True).astype('f4')
            built = ndi.uniform_filter(anyb, 15) >= 0.06
        if shapes_urban:
            built |= rasterize(shapes_urban, out_shape=shape, transform=grid.transform, fill=0, default_value=1,
                               dtype='uint8').astype(bool)
        return {'mapped': mapped, 'exclude': excl, 'houses': houses, 'ids': ids, 'keys': [k for k, _g in unleveled],
                'built': built}


# ---------------------------------------------------------------------------- область целиком

def polygons(mask, grid, tolerance=0.6):
    """Участки маски — кольца lon/lat (упрощённые до ~6 м)."""
    from rasterio.features import shapes
    from rasterio.transform import from_origin
    out = []
    for geom, value in shapes(mask.astype('uint8'), mask=mask, transform=from_origin(0, 0, 1, -1)):
        ring = [(x, y) for x, y in geom['coordinates'][0]]  # в пикселях: столбец, строка
        ring = simplify(ring, tolerance)
        if len(ring) < 4:
            continue
        lon, lat = grid.to_lonlat([p[0] for p in ring], [p[1] for p in ring])
        out.append([[round(a, 6), round(b, 6)] for a, b in zip(lon, lat)])
    return out


def simplify(points, tol):
    if len(points) < 3:
        return points
    (ax, ay), (bx, by) = points[0], points[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy) or 1e-9
    far, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(dy * (px - ax) - dx * (py - ay)) / norm if (dx or dy) else math.hypot(px - ax, py - ay)
        if d > far:
            far, idx = d, i
    if far <= tol:
        return [points[0], points[-1]]
    return simplify(points[:idx + 1], tol)[:-1] + simplify(points[idx:], tol)


def inside(x, y, rect, pad=0.4):
    """Точка внутри прямоугольника (с запасом pad пикселя)."""
    (x0, y0), (x1, y1), _, (x3, y3) = rect
    ux, uy, vx, vy = x1 - x0, y1 - y0, x3 - x0, y3 - y0
    lu, lv = math.hypot(ux, uy), math.hypot(vx, vy)
    a = ((x - x0) * ux + (y - y0) * uy) / lu
    b = ((x - x0) * vx + (y - y0) * vy) / lv
    return -pad <= a <= lu + pad and -pad <= b <= lv + pad


def analyse(index, osm, cache, review=None, today=None):
    """Изменения одной области: (признаки GeoJSON, {дом OSM: причина}, {дом OSM: [этажей, дата]}, сводка)."""
    today = today or dt.date.today()
    name, bbox = osm.boxes[index]
    grid = Grid(bbox)
    recent_items = [it for it in search(bbox, (today - dt.timedelta(days=150)).isoformat(), today.isoformat(), 20)
                    if it['properties'].get('view:sun_elevation', 0) >= 30]
    now, days_now, sun = composite(by_day(recent_items), grid, cache, want=3)
    if now is None:
        return [], {}, {}, {'нет свежих ясных снимков': 1}
    newest = dt.date.fromisoformat(days_now[0])
    doy = newest.timetuple().tm_yday
    old, days_old = None, []
    for year in BASELINE_YEARS:
        a = dt.date(year, 1, 1) + dt.timedelta(days=doy - 31)
        b = dt.date(year, 1, 1) + dt.timedelta(days=doy + 25)
        items = [it for it in search(bbox, a.isoformat(), b.isoformat(), 10)
                 if abs(it['properties'].get('view:sun_elevation', 0) - sun[1]) <= 8]
        old, days_old, _ = composite(by_day(items), grid, cache, want=3)
        if old is not None:
            break
    if old is None:
        return [], {}, {}, {'нет старых снимков для сравнения': 1}
    old = match(old, now)
    fn, fo = features(now), features(old)
    m = osm.masks(grid, index)
    mapped, exclude, houses = m['mapped'], m['exclude'], m['houses']
    found = towers(fn, fo, sun, mapped, m['built'])
    clear = cleared(fn, fo, exclude | mapped)
    tall = heights(fn, sun, m['ids'], m['keys'])
    for t in found:  # у новой высотки земля вокруг голая — это не отдельный пустырь
        rr = [p[1] for p in t['rect']]
        cc = [p[0] for p in t['rect']]
        clear[max(int(min(rr)) - 1, 0):int(max(rr)) + 2, max(int(min(cc)) - 1, 0):int(max(cc)) + 2] = False
    clear = ndi.binary_opening(clear, structure=np.ones((2, 2)))
    lab, count = ndi.label(clear)
    if count:
        # Расчищено там, где в OSM стоят частные дома, а на снимке теперь голая земля. Голые холмы,
        # русла рек и поля голые и так — там домов в OSM нет, они не в счёт.
        sizes = ndi.sum(clear, lab, range(1, count + 1))
        per = np.zeros(count + 1)
        h, w = clear.shape
        for _key, cx, cy, _a in houses:
            r, c = int(cy), int(cx)
            if 0 <= r < h and 0 <= c < w and lab[r, c]:
                per[lab[r, c]] += 1
        ha = sizes * PIXEL * PIXEL / 1e4
        keep = (sizes >= MIN_CLEARED_PX) & (per[1:] >= MIN_CLEARED_HOUSES) & (per[1:] >= CLEARED_DENSITY * ha)
        clear = np.isin(lab, 1 + np.flatnonzero(keep))
    share = clear.mean()
    stats = {'снимки': f'{", ".join(days_now)} против {", ".join(days_old)}', 'новых высоток': len(found),
             'расчищено, га': round(float(clear.sum()) * PIXEL * PIXEL / 1e4, 1)}
    if len(found) > max(60, grid.w * grid.h / 2500) or share > 0.12:
        # Столько перемен сразу — скорее дымка, снег или сбой снимка, чем правда.
        stats['пропущено: слишком много перемен'] = 1
        return [], {}, {}, stats
    date = days_now[0]
    feats, hide = [], {}
    for t in found:
        lon, lat = grid.to_lonlat([p[0] for p in t['rect']], [p[1] for p in t['rect']])
        ring = [[round(a, 6), round(b, 6)] for a, b in zip(lon, lat)]
        feats.append({'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [ring + ring[:1]]},
                      'properties': {'kind': 'tower', 'levels': t['levels'], 'height': t['height'], 'date': date,
                                     'area': name, 'shadow_px': t['shadow'], 'roof_px': t['roof']}})
        for key, cx, cy, _a in houses:
            if inside(cx, cy, t['rect']):
                hide[f'{key[0]}{key[1]}'] = f'tower|{date}'
    for ring in polygons(clear, grid):
        feats.append({'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [ring]},
                      'properties': {'kind': 'cleared', 'date': date, 'area': name}})
    h, w = clear.shape
    for key, cx, cy, _a in houses:
        r, c = int(cy), int(cx)
        if 0 <= r < h and 0 <= c < w and clear[r, c]:
            hide.setdefault(f'{key[0]}{key[1]}', f'cleared|{date}')
    stats['старых домов убрать'] = len(hide)
    stats['этажность по тени'] = len(tall)
    if review:
        try:
            draw_review(os.path.join(review, f'{name.replace("/", "-")}.png'), now, old, found, clear, grid)
        except Exception as e:  # noqa: BLE001 — картинка для проверки не важнее результата
            print(f'  {name}: картинка не записана — {e}', file=sys.stderr)
    return feats, hide, {k: [v, date] for k, v in tall.items()}, stats


def draw_review(path, now, old, found, clear, grid, zoom=3):
    """Картинка для проверки глазами: слева 2017 год, справа сейчас с найденным."""
    from PIL import Image, ImageDraw

    def rgb(c):
        a = np.dstack([c['r'], c['g'], c['b']])
        return np.nan_to_num(np.clip(a / 0.3 * 255, 0, 255)).astype('u1')

    a, b = rgb(old), rgb(now)
    edge = clear & ~ndi.binary_erosion(clear)
    b[edge] = (255, 210, 0)
    size = (grid.w * zoom, grid.h * zoom)
    left = Image.fromarray(a).resize(size, Image.BICUBIC)
    right = Image.fromarray(b).resize(size, Image.NEAREST)
    d = ImageDraw.Draw(right)
    for t in found:
        d.polygon([(x * zoom, y * zoom) for x, y in t['rect']], outline=(255, 0, 255))
        cx = sum(p[0] for p in t['rect']) / 4 * zoom
        cy = sum(p[1] for p in t['rect']) / 4 * zoom
        d.text((cx - 5, cy - 5), str(t['levels']), fill=(255, 255, 0))
    img = Image.new('RGB', (size[0] * 2 + 6, size[1]), 'white')
    img.paste(left, (0, 0))
    img.paste(right, (size[0] + 6, 0))
    img.save(path)


# ---------------------------------------------------------------------------- правки для сборки

def corrections(path, keep_removed=()):
    """Правки в формате corrections.load: новые высотки (контур примерный), стройки на расчищенных
    участках, старые частные дома на их месте — убрать, этажность по тени. keep_removed — дома, которые
    уже убраны другим способом (scripts/cleanup.py): этажность им не ставится. Второе — счётчики."""
    empty = {'change': {}, 'remove': set(), 'add': []}
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except (FileNotFoundError, ValueError):
        return empty, {}
    out = {'change': {}, 'remove': set(), 'add': []}
    stats = {'новых домов': 0, 'расчищенных участков': 0, 'старых домов убрано': 0}
    for ft in data.get('features', []):
        p, ring = ft.get('properties', {}), ft['geometry']['coordinates'][0][:-1]
        if p.get('kind') == 'tower':
            out['add'].append({'area': ring, 'tags': {
                'building': 'yes', 'building:levels': str(p['levels']), 'yoobi:imagery': f'tower|{p["date"]}',
                'source': 'Copernicus Sentinel-2'}})
            stats['новых домов'] += 1
        elif p.get('kind') == 'cleared':
            out['add'].append({'area': ring, 'tags': {'landuse': 'construction', 'yoobi:imagery': f'cleared|{p["date"]}',
                                                      'source': 'Copernicus Sentinel-2'}})
            stats['расчищенных участков'] += 1
    for key in data.get('hide', {}):
        out['remove'].add((key[0], int(key[1:])))
        stats['старых домов убрано'] += 1
    stats['этажность по тени'] = 0
    for key, (levels, date) in data.get('levels', {}).items():
        if (key[0], int(key[1:])) in keep_removed:
            continue
        out['change'][(key[0], int(key[1:]))] = ({'building:levels': str(levels), 'yoobi:imagery': f'levels|{date}'},
                                                 set())
        stats['этажность по тени'] += 1
    return out, stats


_OSM, _ARGS = None, (None, None)
WORKERS = 3


def _work(index):
    """Одна область в отдельном процессе; ошибка — строкой, чтобы не ронять остальные."""
    try:
        return analyse(index, _OSM, *_ARGS)
    except Exception as e:  # noqa: BLE001
        return f'{type(e).__name__}: {e}'


def main(out, osm_path, mask_path=None, only=None, review=None, cache=None):
    boxes = areas(osm_path, mask_path, only)
    print(f'областей: {len(boxes)}')
    if review:
        os.makedirs(review, exist_ok=True)
    if cache:
        os.makedirs(cache, exist_ok=True)
    global _OSM, _ARGS
    _OSM, _ARGS = OsmLayer(osm_path, boxes), (cache, review)
    feats, hide, levels, dates = [], {}, {}, set()
    # Области считаются параллельно: чтение снимков упирается в сеть, а не в процессор. Процессы
    # получают данные OSM при fork, без пересылки.
    import concurrent.futures as cf
    import multiprocessing as mp
    workers = max(1, min(WORKERS, len(boxes)))
    with cf.ProcessPoolExecutor(workers, mp_context=mp.get_context('fork')) as pool:
        for name, result in zip((b[0] for b in boxes), pool.map(_work, range(len(boxes)))):
            if isinstance(result, str):
                print(f'{name}: ошибка — {result}', file=sys.stderr)
                continue
            f, h, lv, stats = result
            feats += f
            hide.update(h)
            levels.update(lv)
            dates.update(x['properties']['date'] for x in f)
            dates.update(v[1] for v in lv.values())
            print(f'{name}: ' + ', '.join(f'{k}: {v}' for k, v in stats.items()), flush=True)
    data = {'type': 'FeatureCollection', 'features': feats, 'hide': hide, 'levels': levels,
            'attribution': f'Contains modified Copernicus Sentinel data {max(dates)[:4] if dates else dt.date.today().year}',
            'dates': sorted(dates)}
    tmp = out + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, out)
    towers_n = sum(1 for x in feats if x['properties']['kind'] == 'tower')
    print(f'всего: новых высоток {towers_n}, расчищенных участков {len(feats) - towers_n}, '
          f'старых домов убрать {len(hide)}, этажность по тени у {len(levels)} → {out}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if len(args) != 1:
        sys.exit(__doc__)
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    main(args[0], opts.get('osm', os.path.join(here, 'data', 'sources', 'tajikistan.osm.pbf')),
         opts.get('mask', os.path.join(here, 'data', 'tajikistan-mask.geojson')), opts.get('only'),
         opts.get('review'), opts.get('cache', os.path.join(here, 'data', 'sources', 'imagery-cache')))
