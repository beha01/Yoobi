#!/usr/bin/env python3
"""Состояние сборки между запусками: выгрузка OSM, перемены по снимкам, контур страны и
образец для проверки. Ежедневное обновление в облаке начинает с пустой машины, а Geofabrik
оттуда бывает недоступен; с сохранённой выгрузкой достаточно докачать правки за сутки.

  python3 scripts/state.py pack dist/state      # data/ → файлы JSON для хранилища
  python3 scripts/state.py unpack папка|файлы…  # файлы из хранилища → data/
  python3 scripts/state.py list папка|файлы…    # какой файл к какому состоянию относится
  python3 scripts/state.py stale папка|файлы…   # что можно удалить: всё, кроме самого свежего
                                                # целого состояния и отчётов за неделю

Каждый файл описывает себя сам (JSON: метка сборки, вид, номер части), поэтому имена
файлов после скачивания из хранилища не важны. Рядом кладётся и код сборки (файлы папки map/
из git, tar.gz) — на случай, если запуск в облаке не сможет склонировать репозиторий. Выгрузка OSM режется на части по 12 МБ в
base64; в manifest — время данных и контрольная сумма. Из нескольких сохранённых
состояний берётся самое свежее целое.
"""

import base64
import datetime as dt
import glob
import hashlib
import json
import os
import io
import shutil
import subprocess
import sys
import tarfile

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
AREA = os.environ.get('AREA', 'tajikistan')
PART = 12 * 1024 * 1024
FILES = ['sources/imagery.geojson', f'{AREA}-mask.geojson', 'last-good.json']


def sha(data):
    return hashlib.sha256(data).hexdigest()


SKIP = {'node_modules', 'data', 'fonts', '__pycache__', 'dist', '.git'}  # как в .gitignore


def code():
    """Файлы папки map/ под git (как они лежат сейчас) одним tar.gz. Без git (код сам
    восстановлен из хранилища) — все файлы папки, кроме данных и сборок."""
    try:
        out = subprocess.run(['git', 'ls-files', '-z'], cwd=HERE, capture_output=True, check=True).stdout
        names = list(filter(None, out.decode().split('\0')))
    except (OSError, subprocess.CalledProcessError):
        names = []
    if not names:
        for d, dirs, fs in os.walk(HERE):
            dirs[:] = [x for x in dirs if x not in SKIP]
            names += [os.path.relpath(os.path.join(d, f), HERE) for f in fs]
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        for name in sorted(names):
            path = os.path.join(HERE, name)
            if os.path.isfile(path):
                tar.add(path, arcname=name)
    return buf.getvalue()


def pack(out, data=None):
    data = data or os.path.join(HERE, 'data')
    pbf = os.path.join(data, 'sources', f'{AREA}.osm.pbf')
    if not os.path.exists(pbf):
        raise SystemExit(f'нет {pbf}')
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    mtime = os.path.getmtime(pbf)
    stamp = dt.datetime.fromtimestamp(mtime, dt.timezone.utc).strftime('%Y%m%dT%H%MZ')
    with open(pbf, 'rb') as f:
        raw = f.read()
    parts = [raw[i:i + PART] for i in range(0, len(raw), PART)]
    for i, chunk in enumerate(parts):
        with open(os.path.join(out, f'yoobi-state-{stamp}-osm-{i:02d}.json'), 'w') as g:
            json.dump({'yoobi_state': stamp, 'kind': 'osm', 'index': i, 'data': base64.b64encode(chunk).decode()}, g)
    files = []
    for rel in FILES:
        src = os.path.join(data, rel)
        if os.path.exists(src):
            with open(src, encoding='utf-8') as f:
                text = f.read()
            name = f'yoobi-state-{stamp}-{os.path.splitext(os.path.basename(rel))[0]}.json'
            with open(os.path.join(out, name), 'w', encoding='utf-8') as g:
                json.dump({'yoobi_state': stamp, 'kind': 'file', 'path': rel, 'mtime': os.path.getmtime(src),
                           'data': text}, g, ensure_ascii=False)
            files.append(rel)
    bundle = code()
    if bundle:
        with open(os.path.join(out, f'yoobi-state-{stamp}-code.json'), 'w') as g:
            json.dump({'yoobi_state': stamp, 'kind': 'code', 'data': base64.b64encode(bundle).decode()}, g)
    with open(os.path.join(out, f'yoobi-state-{stamp}-manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'yoobi_state': stamp, 'kind': 'manifest', 'osm_mtime': mtime, 'osm_sha256': sha(raw),
                   'osm_bytes': len(raw), 'osm_parts': len(parts), 'files': files}, f, ensure_ascii=False, indent=1)
    print(f'{out}: состояние {stamp} — выгрузка OSM {len(raw) / 1e6:.1f} МБ в {len(parts)} частях, ещё {len(files)} файла'
          + (f', код {len(bundle) / 1e3:.0f} КБ' if bundle else ''))
    return stamp


def read(paths):
    """Файлы состояний: {метка: [(путь, документ)…]} и отчёты запусков [(путь, документ)…]."""
    states, runs = {}, []
    for path in paths:
        try:
            with open(path, encoding='utf-8') as f:
                doc = json.load(f)
        except (OSError, ValueError, UnicodeDecodeError):
            continue
        if isinstance(doc, dict) and doc.get('yoobi_state'):
            states.setdefault(doc['yoobi_state'], []).append((path, doc))
        elif isinstance(doc, dict) and doc.get('yoobi_run'):
            runs.append((path, doc))
    return states, runs


def complete(states):
    """Целые состояния от свежего к старому: (метка, документы, выгрузка OSM)."""
    for stamp in sorted(states, reverse=True):
        docs = [d for _p, d in states[stamp]]
        manifest = next((d for d in docs if d['kind'] == 'manifest'), None)
        osm = {d['index']: d for d in docs if d['kind'] == 'osm'}
        if not manifest or len(osm) != manifest['osm_parts']:
            print(f'состояние {stamp} неполное — пропускаю', file=sys.stderr)
            continue
        raw = b''.join(base64.b64decode(osm[i]['data']) for i in range(manifest['osm_parts']))
        if sha(raw) != manifest['osm_sha256']:
            print(f'состояние {stamp}: контрольная сумма не совпала — пропускаю', file=sys.stderr)
            continue
        yield stamp, docs, manifest, raw


def listing(paths):
    states, runs = read(paths)
    for stamp, docs in sorted(states.items(), reverse=True):
        for path, doc in sorted(docs, key=lambda d: d[0]):
            print(f'{stamp}\t{doc["kind"]}\t{os.path.basename(path)}')
    for path, doc in sorted(runs, key=lambda r: r[1]['yoobi_run'], reverse=True):
        print(f'{doc["yoobi_run"]}\tотчёт: {doc.get("status")}\t{os.path.basename(path)}')


def stale(paths, keep_days=7, now=None):
    """Имена файлов (без .json — это id ассетов на складе), которые больше не нужны."""
    states, runs = read(paths)
    newest = next(complete(states), None)
    keep = newest[0] if newest else None
    old = [p for stamp, docs in states.items() if keep and stamp != keep for p, _d in docs]
    now = now or dt.datetime.now(dt.timezone.utc)
    limit = (now - dt.timedelta(days=keep_days)).strftime('%Y-%m-%dT%H:%M:%SZ')
    old += [p for p, d in runs if d['yoobi_run'] < limit]
    return sorted(os.path.splitext(os.path.basename(p))[0] for p in old)


def unpack(paths, data=None):
    data = data or os.path.join(HERE, 'data')
    states, _runs = read(paths)
    for stamp, docs, manifest, raw in complete(states):  # самое свежее целое состояние
        pbf = os.path.join(data, 'sources', f'{AREA}.osm.pbf')
        os.makedirs(os.path.dirname(pbf), exist_ok=True)
        with open(pbf + '.tmp', 'wb') as f:
            f.write(raw)
        os.replace(pbf + '.tmp', pbf)
        os.utime(pbf, (manifest['osm_mtime'], manifest['osm_mtime']))  # время данных: build-tiles решит, нужен ли Geofabrik
        restored = []
        for d in docs:
            if d['kind'] == 'file':
                dst = os.path.join(data, d['path'])
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, 'w', encoding='utf-8') as f:
                    f.write(d['data'])
                os.utime(dst, (d['mtime'], d['mtime']))
                restored.append(d['path'])
        print(f'восстановлено состояние {stamp}: выгрузка OSM {len(raw) / 1e6:.1f} МБ, {", ".join(restored)}')
        return stamp
    raise SystemExit('целого состояния сборки среди файлов нет')


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('pack', 'unpack', 'list', 'stale'):
        sys.exit(__doc__)
    if sys.argv[1] == 'pack':
        pack(sys.argv[2])
    else:
        paths = [p for a in sys.argv[2:] for p in (glob.glob(os.path.join(a, '**', '*'), recursive=True)
                                                   if os.path.isdir(a) else [a]) if os.path.isfile(p)]
        if sys.argv[1] == 'stale':
            print('\n'.join(stale(paths)))
        else:
            (unpack if sys.argv[1] == 'unpack' else listing)(paths)
