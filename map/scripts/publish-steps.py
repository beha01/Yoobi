#!/usr/bin/env python3
"""Шаги публикации новой сборки в артефакт claude.ai без перерыва для тех, у кого карта открыта.

Пока новые части тайлов заливаются, живая страница работает со старыми (у частей разные
префиксы). Последним шагом публикуется новая страница, и в том же шаге убираются старые
части. В версии артефакта не больше 256 МБ, за раз — не больше 64 МБ и 255 файлов, поэтому
до последнего шага заливается столько, сколько помещается рядом со старыми частями.

  python3 scripts/publish-steps.py dist/site живая-страница.html [--live-bytes=N] [--full] > steps.json

живая-страница.html — опубликованная сейчас страница (Artifact read сохраняет её файлом):
по ней видно, какие части тайлов сейчас в ходу. --full — залить и неизменные файлы (рельеф,
шрифты), например в новый артефакт. --live-bytes — сколько весит живая версия (сумма размеров
из списка её файлов); без него — оценка по числу частей. Вывод — JSON: шаги с картой файлов {путь: файл|null}
и какую страницу публиковать на каждом шаге (живую или новую).
"""

import json
import os
import re
import sys

LIMIT = 250 * 1000 * 1000      # запас до 256 МБ версии
STEP = 58 * 1000 * 1000        # запас до 64 МБ за раз
FINAL = 62 * 1000 * 1000
FILES = 240
PART_B64 = 1398104
OTHER = 32 * 1000 * 1000       # рельеф, шрифты, поиск, код в живой версии
STATIC = ('dem/', 'fonts/')


def archives(html):
    return re.findall(r"prefix: 'tiles/([^']+)-', count: (\d+)", html)


def main(site, live, full=False, live_bytes=None):
    with open(os.path.join(site, 'publish-plan.json'), encoding='utf-8') as f:
        plan = json.load(f)
    with open(live, encoding='utf-8') as f:
        old = [(p, int(n)) for p, n in archives(f.read())]
    new_prefixes = {v[0] for v in plan['archives'].values()}
    old = [(p, n) for p, n in old if p not in new_prefixes]
    files = [path for step in plan['steps'] for path in step
             if full or not path.startswith(STATIC)]
    size = {p: os.path.getsize(os.path.join(site, p)) for p in files}
    tiles = [p for p in files if p.startswith('tiles/')]
    rest = [p for p in files if not p.startswith('tiles/')]
    live_bytes = live_bytes or sum(n for _p, n in old) * PART_B64 + OTHER
    budget = max(0, LIMIT - live_bytes)
    steps, cur, cur_bytes, used = [], [], 0, 0
    queue = list(tiles)
    total = sum(size.values())
    # Заливаем части, пока остаток помещается в последний шаг или пока есть место в версии.
    while queue and total - used > FINAL - 2_000_000:
        p = queue[0]
        if used + size[p] > budget:
            break
        if cur and (cur_bytes + size[p] > STEP or len(cur) >= FILES):
            steps.append(cur)
            cur, cur_bytes = [], 0
        cur.append(queue.pop(0))
        cur_bytes += size[p]
        used += size[p]
    if cur:
        steps.append(cur)
    final = queue + rest
    final_bytes = sum(size[p] for p in final)
    if final_bytes > FINAL or len(final) > FILES:
        raise SystemExit(f'последний шаг вышел {final_bytes / 1e6:.0f} МБ, {len(final)} файлов — не помещается '
                         f'(в живой версии ~{live_bytes / 1e6:.0f} МБ); уменьшите тайлы или опубликуйте в два приёма')
    root = os.path.abspath(site)
    out = [{'page': 'live', 'files': {p: os.path.join(root, p) for p in st},
            'bytes': sum(size[p] for p in st)} for st in steps]
    removals = {f'tiles/{p}-{i:03d}.txt': None for p, n in old for i in range(n)}
    out.append({'page': os.path.join(root, 'index.html'), 'files': {**{p: os.path.join(root, p) for p in final}, **removals},
                'bytes': final_bytes, 'removes': len(removals)})
    json.dump({'prefix': plan['prefix'], 'attribution': plan['attribution'], 'old_prefixes': [p for p, _n in old],
               'steps': out}, sys.stdout, ensure_ascii=False, indent=1)
    print(f'шагов: {len(out)}, ' + ', '.join(f'{s["bytes"] / 1e6:.0f} МБ' for s in out), file=sys.stderr)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2:
        sys.exit(__doc__)
    opts = dict((a[2:].split('=', 1) + [''])[:2] for a in sys.argv[1:] if a.startswith('--'))
    main(args[0], args[1], full='full' in opts, live_bytes=int(opts['live-bytes']) if opts.get('live-bytes') else None)
