#!/usr/bin/env python3
"""Догоняет выгрузку OpenStreetMap до текущей минуты.

Geofabrik выпускает выгрузку страны раз в сутки, а OpenStreetMap правят каждую минуту.
Скрипт берёт с planet.openstreetmap.org файлы изменений всего мира с момента выгрузки
(сначала часовые, потом минутные), накладывает их и оставляет только объекты области —
по тем же правилам, что у самой выгрузки: точки в её рамке, линии хотя бы с одной такой
точкой (целиком) и отношения с такими участниками. В заголовок пишутся минутный сервер
и время последней правки, поэтому следующий запуск продолжает с того же места, а более
свежая выгрузка Geofabrik (curl -z сравнивает время файла) просто заменяет файл.

  python3 scripts/update-osm.py data/sources/tajikistan.osm.pbf

Без сети файл остаётся как был: сборка идёт по суточной выгрузке.
"""

import datetime as dt
import os
import sys
import time

import osmium
from osmium.replication.server import ReplicationServer

HOUR = 'https://planet.openstreetmap.org/replication/hour'
MINUTE = 'https://planet.openstreetmap.org/replication/minute'
MAX_KB = 1024 * 1024  # изменения держатся в памяти: не больше ~1 ГБ за один заход


def header_of(path):
    r = osmium.io.Reader(path, osmium.osm.osm_entity_bits.NOTHING)
    h = r.header()
    r.close()
    return h


def parse_ts(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00')) if value else None


def merge(src, dst, svr, start):
    """Накладывает на src изменения с номера start (сколько влезет в MAX_KB).
    Возвращает (последний номер, время) или None, если скачать нечего."""
    diffs = svr.collect_diffs(start, max_size=MAX_KB)
    if diffs is None:
        return None
    info = svr.get_state_info(diffs.id)
    pool = osmium.io.ThreadPool()
    reader = osmium.io.Reader(src, thread_pool=pool)
    writer = osmium.io.Writer(osmium.io.File(dst), osmium.io.Header(), thread_pool=pool)
    diffs.reader.apply_to_reader(reader, writer, False)
    reader.close()
    writer.close()
    return diffs.id, info.timestamp if info else None


def clip(src, dst, box, header):
    """Оставляет объекты области: как у Geofabrik, линии через границу — целиком."""
    inside, ways, need = osmium.index.IdSet(), osmium.index.IdSet(), osmium.index.IdSet()
    for n in osmium.FileProcessor(src, osmium.osm.NODE):
        if box.contains(n.location):
            inside.set(n.id)
    for w in osmium.FileProcessor(src, osmium.osm.WAY):
        if any(inside.get(r.ref) for r in w.nodes):
            ways.set(w.id)
            for r in w.nodes:
                need.set(r.ref)
    members = {r.id: [(m.type, m.ref) for m in r.members] for r in osmium.FileProcessor(src, osmium.osm.RELATION)}
    rels, grew = set(), True
    while grew:  # вложенные отношения: пока находятся новые
        grew = False
        for rid, mm in members.items():
            if rid in rels:
                continue
            if any((t == 'n' and (inside.get(ref) or need.get(ref))) or (t == 'w' and ways.get(ref))
                   or (t == 'r' and ref in rels) for t, ref in mm):
                rels.add(rid)
                grew = True
    w = osmium.SimpleWriter(dst, overwrite=True, header=header)
    kept = 0
    for o in osmium.FileProcessor(src):
        if o.is_node():
            if inside.get(o.id) or need.get(o.id):
                w.add_node(o)
                kept += 1
        elif o.is_way():
            if ways.get(o.id):
                w.add_way(o)
                kept += 1
        elif o.id in rels:
            w.add_relation(o)
            kept += 1
    w.close()
    return kept


def update(path):
    h = header_of(path)
    box = h.box()
    if not box.valid():
        raise SystemExit(f'в {path} нет рамки области в заголовке — нужна выгрузка Geofabrik')
    since = parse_ts(h.get('osmosis_replication_timestamp'))
    if since is None:
        raise SystemExit(f'в {path} нет времени выгрузки (osmosis_replication_timestamp)')
    base_url = h.get('osmosis_replication_base_url', '').rstrip('/')
    seq = int(h.get('osmosis_replication_sequence_number') or 0)
    now = dt.datetime.now(dt.timezone.utc)
    print(f'выгрузка на {since:%d.%m.%Y %H:%M} UTC, отставание {(now - since).total_seconds() / 3600:.1f} ч')

    work = path + '.merge'
    current, n = path, 0
    newest = since
    last_url, last_seq = base_url, seq
    # Часовые файлы — если отстаём больше чем на пару часов, минутные — до текущей минуты.
    for url in ((HOUR, MINUTE) if now - since > dt.timedelta(hours=2) else (MINUTE,)):
        svr = ReplicationServer(url)
        state = svr.get_state_info()
        if state is None:
            print(f'нет связи с {url}', file=sys.stderr)
            break
        if state.timestamp <= newest:
            continue
        # Продолжение прошлого запуска — со следующего номера, иначе — по времени (файл,
        # в котором это время; лишние старые правки не мешают: берётся новейшая версия).
        resume = url == base_url and seq and newest == since
        start = seq + 1 if resume else svr.timestamp_to_sequence(newest)
        if start is None:
            print(f'{url}: не нашёл изменений с {newest:%d.%m %H:%M}', file=sys.stderr)
            break
        while start <= state.sequence:
            t = time.time()
            dst = f'{work}{n % 2}.osm.pbf'
            if os.path.exists(dst):
                os.remove(dst)
            done = merge(current, dst, svr, start)
            if done is None:
                break
            if current != path:
                os.remove(current)
            current, n = dst, n + 1
            last_url, last_seq = url, done[0]
            newest = max(newest, done[1] or newest)
            print(f'  {url.rsplit("/", 1)[1]}: изменения {start}–{done[0]} по {newest:%d.%m %H:%M} UTC '
                  f'за {time.time() - t:.0f} с')
            start = done[0] + 1
    if current == path:
        print('новых правок нет')
        return False

    out = osmium.io.Header()
    out.add_box(box)
    out.set('generator', 'yoobi update-osm.py')
    out.set('osmosis_replication_base_url', last_url)
    out.set('osmosis_replication_sequence_number', str(last_seq))
    out.set('osmosis_replication_timestamp', newest.strftime('%Y-%m-%dT%H:%M:%SZ'))
    tmp = path + '.tmp.osm.pbf'
    kept = clip(current, tmp, box, out)
    os.remove(current)
    os.replace(tmp, path)
    stamp = newest.timestamp()
    os.utime(path, (stamp, stamp))  # curl -z скачает выгрузку Geofabrik, только если она новее
    print(f'выгрузка обновлена до {newest:%d.%m.%Y %H:%M} UTC: {kept} объектов в {path}')
    return True


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    update(sys.argv[1])
