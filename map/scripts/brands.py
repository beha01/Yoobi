#!/usr/bin/env python3
"""Филиалы сетей с их собственных сайтов: рестораны, банки — адрес, телефон, часы работы
и точка на карте в том виде, как их публикует сама сеть.

Сеть лучше всех знает, какие её точки работают сегодня: список на официальном сайте
меняется, когда филиал открывается или закрывается. Скрипт читает только публичные
страницы «рестораны» и «отделения» (если их не запрещает robots.txt сайта), по одному
запросу на страницу, и пишет по строке JSON на филиал: сеть, название, адрес, телефон,
часы (в формате opening_hours OSM), координаты, источник и дату. scripts/extras.py
сверяет их с OSM: совпавшие места дополняются телефоном и часами и получают отметку
«есть на сайте сети», недостающие добавляются, а места сети в OSM, которых в списке нет,
помечаются «нет в списке на сайте сети».

  python3 scripts/brands.py data/sources/brands.jsonl

Новая сеть — функция, которая возвращает записи, в BRANDS ниже.
"""

import datetime as dt
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser

UA = 'yoobi-map/1.0 (+https://github.com/beha01/Yoobi; branch locations for the map)'
DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']


def allowed(url):
    parts = urllib.parse.urlsplit(url)
    rp = urllib.robotparser.RobotFileParser()
    try:
        req = urllib.request.Request(f'{parts.scheme}://{parts.netloc}/robots.txt', headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            rp.parse(r.read().decode('utf-8', 'replace').splitlines())
    except Exception:  # noqa: BLE001 — нет robots.txt: ограничений нет
        return True
    return rp.can_fetch(UA, url)


def get(url, tries=3):
    if not allowed(url):
        raise PermissionError(f'robots.txt запрещает {url}')
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ru'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:  # noqa: BLE001 — сеть: повторяем
            if i == tries - 1:
                raise
            print(f'  {url}: {e}, повтор', file=sys.stderr)
            time.sleep(2 ** i)


def clean(s):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    return ' '.join(s.replace('\\/', '/').split()).strip(' ,')


def opening_hours(week):
    """{день 1–7: [(с, до)]} → «Mo-Fr 09:00-18:00; Sa 10:00-16:00» (дни подряд с одними часами — вместе)."""
    spans = []
    for d in range(1, 8):
        v = ','.join(f'{a}-{b}' for a, b in week.get(d, []))
        if spans and spans[-1][2] == v:
            spans[-1][1] = d
        else:
            spans.append([d, d, v])
    out = []
    for a, b, v in spans:
        if not v:
            continue
        days = DAYS[a - 1] if a == b else f'{DAYS[a - 1]}-{DAYS[b - 1]}'
        out.append(f'{days} {v}')
    if len(out) == 1 and out[0].startswith('Mo-Su 00:00-24:00'):
        return '24/7'
    return '; '.join(out)


RU_DAYS = {'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6, 'вс': 7}


def ru_hours(text):
    """«Офис Пн — пт: 08:00 — 21:00 Сб: 08:00 — 20:00 Вс: выходной Касса …» → opening_hours офиса."""
    text = re.split(r'\bКасса\b', text or '', maxsplit=1)[0]
    week = {}
    rule = re.compile(r'(пн|вт|ср|чт|пт|сб|вс)(?:\s*[—–-]\s*(пн|вт|ср|чт|пт|сб|вс))?\s*:\s*'
                      r'(?:(\d{1,2}:\d{2})\s*[—–-]\s*(\d{1,2}:\d{2})|выходной)', re.I)
    for m in rule.finditer(text):
        a = RU_DAYS[m.group(1).lower()]
        b = RU_DAYS[(m.group(2) or m.group(1)).lower()]
        for d in range(a, b + 1):
            week[d] = [(m.group(3).zfill(5), m.group(4).zfill(5))] if m.group(3) else []
    return opening_hours(week) if week else ''


def kfc():
    """kfc.tj: список ресторанов со страницы («locations» — название, адрес, телефон, точка, часы)."""
    page = get('https://www.kfc.tj/')
    i = page.find('"locations":[')
    if i < 0:
        raise ValueError('на kfc.tj нет списка ресторанов')
    locations, _ = json.JSONDecoder().raw_decode(page, i + len('"locations":'))
    out = []
    for loc in locations:
        if not loc.get('lat') or not loc.get('lng') or loc.get('temporarily_closed'):
            continue
        week = {}
        days = loc.get('takeaway_schedule_week_schedule') or {}
        for day, v in (days.items() if isinstance(days, dict) else enumerate(days, 1)):
            spans = (v or {}).get('schedule') or {}
            spans = spans.values() if isinstance(spans, dict) else spans
            week[int(day)] = [(x['from'], x['to']) for x in spans if x.get('from') and x.get('to')]
        out.append({
            'id': f'kfc-{loc["id"]}', 'brand': 'KFC', 'brand:wikidata': 'Q524757',
            'tags': {'amenity': 'fast_food', 'cuisine': 'chicken', 'brand': 'KFC', 'takeaway': 'yes'},
            'name': 'KFC', 'branch': clean(loc.get('title', '')).removeprefix('KFC').strip(),
            'address': clean(loc.get('address', '')).replace(', Tajikistan', '').replace(', Таджикистан', ''),
            'phone': clean(loc.get('phone', '')), 'hours': opening_hours(week) if week else '',
            'lon': round(float(loc['lng']), 7), 'lat': round(float(loc['lat']), 7),
            'website': 'https://www.kfc.tj/', 'source': 'kfc.tj',
        })
    return out


def alif():
    """alif.tj: отделения и центры обслуживания Алиф Банка по всей стране (точки — с сайта)."""
    page = get('https://alif.tj/ru/bank/contacts/offices/dushanbe')
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.S)
    if not m:
        raise ValueError('на alif.tj нет данных отделений')
    data = json.loads(m.group(1))
    out, seen = [], set()

    def walk(x):
        if isinstance(x, dict):
            if x.get('xCoordinates') and x.get('yCoordinates'):
                yield x
            for v in x.values():
                yield from walk(v)
        elif isinstance(x, list):
            for v in x:
                yield from walk(v)

    for p in walk(data.get('props', {}).get('pageProps', {})):
        try:
            lat, lon = float(p['xCoordinates']), float(p['yCoordinates'])
        except ValueError:
            continue
        name = clean(p.get('servicePointName', ''))
        key = (round(lat, 5), round(lon, 5), name)
        if key in seen or not (36 < lat < 42 and 66 < lon < 76):
            continue
        seen.add(key)
        phones = re.findall(r'\+992[\d\s]{8,14}\d', clean(p.get('contacts', '')))
        out.append({
            'id': f'alif-{p.get("id")}', 'brand': 'Алиф', 'brand:wikidata': 'Q108002932',
            'tags': {'amenity': 'bank', 'brand': 'Alif'},
            'name': 'Алиф Банк', 'branch': ' · '.join(v for v in (name, clean(p.get('servicePointNumber', ''))) if v),
            'address': clean(p.get('address', '')), 'phone': phones[0] if phones else '',
            'hours': ru_hours(clean(p.get('workingHours', ''))),
            'lon': round(lon, 7), 'lat': round(lat, 7), 'website': 'https://alif.tj/', 'source': 'alif.tj',
        })
    return out


BRANDS = {'kfc': kfc, 'alif': alif}


def main(out, previous=None):
    """previous — прошлый файл: если сайт сети сейчас недоступен, её филиалы берутся оттуда."""
    today = dt.date.today().isoformat()
    old = {}
    try:
        with open(previous or '', encoding='utf-8') as f:
            for line in f:
                r = json.loads(line)
                old.setdefault(r.get('key'), []).append(r)
    except (FileNotFoundError, ValueError):
        pass
    total = 0
    with open(out, 'w', encoding='utf-8') as f:
        for key, fn in BRANDS.items():
            try:
                rows = fn()
                for r in rows:
                    r.update(key=key, fetched=today)
            except Exception as e:  # noqa: BLE001 — сайт сети недоступен: остальные сети всё равно
                rows = old.get(key, [])
                print(f'{key}: не получилось — {e}; с прошлой сборки: {len(rows)}', file=sys.stderr)
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n')
            print(f'{key}: {len(rows)} точек')
            total += len(rows)
    print(f'всего: {total} → {out}')
    return total


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    main(out, out[:-4] if out.endswith('.tmp') else None)
