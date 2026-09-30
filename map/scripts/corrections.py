"""Правки владельца карты поверх выгрузки OpenStreetMap (tiles/corrections.json).

Открытые данные отстают от жизни: заведение сменилось, построили мост, открыли новое
здание, а в OSM этого ещё нет. Правка — сведения того, кто видел это сам (владелец
карты, жители, курьеры); источник и дата пишутся в note. Сборка применяет правки до
всех проходов extras.py, поэтому они попадают и в основные тайлы, и в дополнительные,
и в поиск. Лучше потом внести то же самое в openstreetmap.org — тогда правку можно убрать.

  {
    "change": [{"osm": "node/5480014421", "tags": {"name": "…"}, "drop": ["name:ru"], "note": "…"}],
    "add": [
      {"lon": 68.75, "lat": 38.57, "tags": {"amenity": "restaurant", "name": "…"}, "note": "…"},
      {"line": [[68.77, 38.58], [68.78, 38.58]], "tags": {"highway": "secondary", "bridge": "yes", "layer": "1"}},
      {"area": [[68.75, 38.57], [68.751, 38.57], [68.751, 38.571]], "tags": {"building": "yes", "name": "…"}}
    ],
    "remove": ["node/123"]
  }

«change» заменяет и добавляет теги объекта OSM (drop — удалить теги), «remove» убирает
объект целиком (у линий и отношений — только теги, геометрия нужна соседям), «add»
добавляет точку, линию или контур с новыми номерами — выше любых в OSM.
"""

import json

import osmium
from osmium.osm.mutable import Node, Way

ADD_NODE_BASE = 70_000_000_000
ADD_WAY_BASE = 7_000_000_000
KINDS = {'node': 'n', 'way': 'w', 'relation': 'r', 'n': 'n', 'w': 'w', 'r': 'r'}


def load(path):
    """Правки из файла или None, если файла нет."""
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        return None
    changes, removed = {}, set()
    for item in data.get('change', []):
        kind, oid = item['osm'].split('/')
        changes[(KINDS[kind], int(oid))] = (item.get('tags', {}), set(item.get('drop', [])))
    for ref in data.get('remove', []):
        kind, oid = ref.split('/')
        removed.add((KINDS[kind], int(oid)))
    return {'change': changes, 'remove': removed, 'add': data.get('add', [])}


def apply(src, dst, corr):
    """Копия выгрузки с правками. Возвращает число применённых правок."""
    reader = osmium.io.Reader(src, osmium.osm.osm_entity_bits.NOTHING)
    header = reader.header()
    reader.close()
    w = osmium.SimpleWriter(dst, overwrite=True, header=header)
    applied = 0
    nodes = [a for a in corr['add'] if 'lon' in a]
    shapes = [a for a in corr['add'] if 'line' in a or 'area' in a]
    stage = 'nodes'

    def add_nodes():
        nid = ADD_NODE_BASE
        for a in nodes:
            w.add_node(Node(id=nid, location=(a['lon'], a['lat']), tags=a.get('tags', {}), version=1))
            nid += 1
        for a in shapes:
            coords = a.get('line') or a.get('area')
            for lon, lat in coords:
                w.add_node(Node(id=nid, location=(lon, lat), version=1))
                nid += 1

    def add_ways():
        nid = ADD_NODE_BASE + len(nodes)
        wid = ADD_WAY_BASE
        for a in shapes:
            coords = a.get('line') or a.get('area')
            ids = list(range(nid, nid + len(coords)))
            nid += len(coords)
            if 'area' in a and ids[0] != ids[-1]:
                ids.append(ids[0])
            w.add_way(Way(id=wid, nodes=ids, tags=a.get('tags', {}), version=1))
            wid += 1

    def fixed(o, key):
        nonlocal applied
        if key in corr['remove']:
            applied += 1
            return None if key[0] == 'n' else o.replace(tags={})
        change = corr['change'].get(key)
        if not change:
            return o
        tags, drop = change
        applied += 1
        new = {t.k: t.v for t in o.tags if t.k not in drop}
        new.update(tags)
        return o.replace(tags=new)

    for o in osmium.FileProcessor(src):
        if stage == 'nodes' and not o.is_node():
            add_nodes()
            stage = 'ways'
        if stage == 'ways' and o.is_relation():
            add_ways()
            stage = 'relations'
        if o.is_node():
            o2 = fixed(o, ('n', o.id))
            if o2 is None:
                o2 = o.replace(tags={})  # точка нужна линиям — остаётся без тегов
            w.add_node(o2)
        elif o.is_way():
            w.add_way(fixed(o, ('w', o.id)))
        else:
            w.add_relation(fixed(o, ('r', o.id)))
    if stage == 'nodes':
        add_nodes()
    if stage != 'relations':
        add_ways()
    w.close()
    return applied + len(corr['add'])
