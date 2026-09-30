#!/usr/bin/env bash
# Собирает карту всего Таджикистана из свежей выгрузки OpenStreetMap:
#
#   data/tajikistan.pmtiles        — основные тайлы (схема OpenMapTiles, как у стиля)
#   data/tajikistan-extra.pmtiles  — объёмные деревья, подъезды, «зебры», заборы, парковки, светофоры
#                                    и названия зданий (scripts/extras.py + tiles/extra.yml)
#   data/tajikistan-mask.geojson   — точный контур страны для «заморозки» соседей
#   data/tajikistan-search.json    — индекс поиска: города, улицы, дома и организации (src/search.js)
#
# Организации берутся из OSM и из открытой базы Overture Maps (scripts/overture.py,
# лицензии CDLA-Permissive-2.0 / Apache-2.0 / CC0), а дома, которых ещё нет в OSM, —
# из контуров Microsoft/Google в Overture (ODbL): без них — OVERTURE=0.
#
# Нужна Java 21+ (planetiler.jar скачается сам) или Docker.
# Первый запуск скачивает вспомогательные данные (~1 ГБ), дальше — только выгрузку OSM.
# Памяти хватает 2–4 ГБ, сборка занимает несколько минут.
#
#   ./scripts/build-tiles.sh
#   PLANETILER_MEMORY=6g ./scripts/build-tiles.sh
#   OSM_URL=https://example.com/tajikistan.osm.pbf ./scripts/build-tiles.sh   # свой источник выгрузки
#
# Готовые файлы кладутся на статический хостинг или CDN с поддержкой HTTP Range
# (nginx, S3, Cloudflare R2) и подключаются так:
#   createStyle({
#     tiles: 'pmtiles://https://cdn.example.com/map/tajikistan.pmtiles',
#     extraTiles: 'pmtiles://https://cdn.example.com/map/tajikistan-extra.pmtiles',
#   })

set -euo pipefail

cd "$(dirname "$0")/.."
PLANETILER_VERSION=0.10.2
MEMORY="${PLANETILER_MEMORY:-3g}"
AREA="${AREA:-tajikistan}"
mkdir -p data

if command -v java >/dev/null && java -version 2>&1 | grep -Eq 'version "(2[1-9]|[3-9][0-9])'; then
  JAR="data/planetiler-$PLANETILER_VERSION.jar"
  if [[ ! -f "$JAR" ]]; then
    curl -fL --retry 3 -o "$JAR.tmp" \
      "https://github.com/onthegomap/planetiler/releases/download/v$PLANETILER_VERSION/planetiler.jar"
    mv "$JAR.tmp" "$JAR"
  fi
  DATA=data
  TILES=tiles
  planetiler() { java "-Xmx$MEMORY" -jar "$JAR" "$@"; }
elif command -v docker >/dev/null; then
  DATA=/data
  TILES=/tiles
  planetiler() {
    docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx$MEMORY" \
      -v "$(pwd)/data":/data -v "$(pwd)/tiles":/tiles -w / \
      "ghcr.io/onthegomap/planetiler:$PLANETILER_VERSION" "$@"
  }
else
  echo "Нужна Java 21+ или Docker" >&2
  exit 1
fi

# У Таджикистана нет выхода к морю, поэтому вместо мировых полигонов океана
# (~850 МБ) подставляется пустышка tiles/no-ocean.zip. Для приморских регионов
# запускайте с OCEAN=1.
OCEAN_ARGS=()
if [[ "${OCEAN:-0}" != 1 ]]; then
  OCEAN_ARGS=(--water_polygons_path="$TILES/no-ocean.zip")
fi

# 1. Свежая выгрузка OSM. Скрипт качает её сам, а не через planetiler --download:
#    так при каждой пересборке данные обновляются (curl -z скачивает файл, только
#    если на сервере есть версия новее). Если HTTPS до Geofabrik закрыт прокси или
#    фильтром, та же выгрузка берётся по HTTP с проверкой контрольной суммы MD5.
#    Для областей не из Азии задайте GEOFABRIK_PATH (например, europe/monaco) или OSM_URL.
PBF="data/sources/$AREA.osm.pbf"
GEOFABRIK_PATH="${GEOFABRIK_PATH:-asia/$AREA}"
mkdir -p data/sources

md5_of() { { md5sum "$1" 2>/dev/null || md5 -r "$1"; } | cut -d' ' -f1; }

fetch_osm() {
  local url=$1 tmp="$PBF.tmp" since=()
  [[ -s "$PBF" ]] && since=(-z "$PBF")
  rm -f "$tmp"
  curl -fL --retry 3 --retry-all-errors --connect-timeout 20 -R ${since[@]+"${since[@]}"} -o "$tmp" "$url" || { rm -f "$tmp"; return 1; }
  if [[ ! -s "$tmp" ]]; then
    rm -f "$tmp"
    echo "Выгрузка OSM не изменилась с прошлой сборки: $PBF"
    return 0
  fi
  if [[ $url == http://* ]]; then
    local want
    want=$(curl -fsSL --retry 3 --retry-all-errors "$url.md5" | cut -d' ' -f1) || want=
    if [[ -z $want || $(md5_of "$tmp") != "$want" ]]; then
      rm -f "$tmp"
      echo "Контрольная сумма выгрузки не совпала: $url" >&2
      return 1
    fi
  fi
  mv "$tmp" "$PBF"
}

if [[ -n "${OSM_URL:-}" ]]; then
  fetch_osm "$OSM_URL"
elif ! fetch_osm "https://download.geofabrik.de/$GEOFABRIK_PATH-latest.osm.pbf"; then
  echo "HTTPS до Geofabrik недоступен, пробую HTTP с проверкой MD5" >&2
  fetch_osm "http://download.geofabrik.de/$GEOFABRIK_PATH-latest.osm.pbf"
fi

# 2. Объёмные деревья, подъезды со стороной входа, городские детали, индекс поиска,
#    точная маска страны и копия выгрузки без подписей соседних стран
#    (scripts/extras.py, нужен pyosmium 4+; ставится в data/.venv сам).
PY=python3
if ! python3 -c 'import osmium; osmium.FileProcessor' 2>/dev/null; then
  [[ -d data/.venv ]] || python3 -m venv data/.venv
  data/.venv/bin/pip install --quiet 'osmium>=4'
  PY=data/.venv/bin/python
fi
# Суточная выгрузка отстаёт от OpenStreetMap на часы: правки после неё докачиваются
# с planet.openstreetmap.org до текущей минуты (scripts/update-osm.py, ~2–5 минут).
# Без сети или с UPDATE_OSM=0 сборка идёт по суточной выгрузке.
if [[ "${UPDATE_OSM:-1}" == 1 ]]; then
  "$PY" scripts/update-osm.py "$PBF" || echo "Правки OSM после выгрузки не скачаны — сборка по суточной выгрузке" >&2
fi
# Открытые заметки пользователей OSM (Organic Maps, CoMaps, MAPS.ME…): закрытые и снесённые
# места убираются, новые — добавляются с пометкой (scripts/notes.py). NOTES=0 — без них.
if [[ "${NOTES:-1}" == 1 ]]; then
  if "$PY" scripts/notes.py data/sources/osm-notes.json.tmp; then
    mv data/sources/osm-notes.json.tmp data/sources/osm-notes.json
  else
    echo "Заметки OSM не скачаны — сборка без них" >&2
  fi
fi
# Филиалы сетей с их собственных сайтов (scripts/brands.py): рестораны, банки — адреса, часы и
# точки, как их публикует сама сеть. BRANDS=0 — без них.
if [[ "${BRANDS:-1}" == 1 ]]; then
  if "$PY" scripts/brands.py data/sources/brands.jsonl.tmp; then
    mv data/sources/brands.jsonl.tmp data/sources/brands.jsonl
  else
    echo "Сайты сетей недоступны — филиалы с прошлой сборки" >&2
  fi
fi
# Спутниковые снимки Sentinel-2 (scripts/imagery.py): новые высотки, которых ещё нет в OSM,
# этажность по тени и старые дома, на месте которых стоит новое. Сравниваются последние ясные
# дни с той же осенью 2017 года; снимки кешируются в data/sources/imagery-cache. Нужен контур
# страны с прошлого прогона extras.py. IMAGERY=0 — без снимков (берётся прошлый результат).
if [[ "${IMAGERY:-1}" == 1 && -f "data/$AREA-mask.geojson" ]]; then
  if ! data/.venv/bin/python -c 'import numpy, scipy, rasterio' 2>/dev/null; then
    [[ -d data/.venv ]] || python3 -m venv data/.venv
    data/.venv/bin/pip install --quiet 'osmium>=4' numpy scipy rasterio pillow
  fi
  data/.venv/bin/python scripts/imagery.py data/sources/imagery.geojson --osm="$PBF" --mask="data/$AREA-mask.geojson" ||
    echo "Снимки Sentinel-2 недоступны — перемены по снимкам с прошлой сборки" >&2
fi
# Организации Overture Maps: из мировой базы читаются только куски, покрывающие страну
# (~50 МБ). Если сеть до S3 недоступна, сборка продолжается без них.
OVERTURE_ARGS=()
if [[ "${OVERTURE:-1}" == 1 ]]; then
  if ! "$PY" -c 'import pyarrow' 2>/dev/null; then
    [[ -d data/.venv ]] || python3 -m venv data/.venv
    data/.venv/bin/pip install --quiet 'osmium>=4' pyarrow
    PY=data/.venv/bin/python
  fi
  if "$PY" scripts/overture.py data/sources/overture-places.jsonl.tmp; then
    mv data/sources/overture-places.jsonl.tmp data/sources/overture-places.jsonl
  else
    echo "Overture Maps недоступен — организации только из OSM" >&2
  fi
  [[ -f data/sources/overture-places.jsonl ]] && OVERTURE_ARGS+=(--overture=data/sources/overture-places.jsonl)
fi
# Новые здания Overture выбираются по контуру страны, который пишет extras.py: на первом
# запуске его ещё нет — тогда здания скачиваются после первого прогона, и он повторяется.
fetch_buildings() {
  [[ "${OVERTURE:-1}" == 1 && -f "data/$AREA-mask.geojson" ]] || return 1
  if "$PY" scripts/overture.py --buildings data/sources/overture-buildings.jsonl.tmp --mask="data/$AREA-mask.geojson"; then
    mv data/sources/overture-buildings.jsonl.tmp data/sources/overture-buildings.jsonl
  else
    echo "Новые здания Overture не скачаны — только дома OSM" >&2
    return 1
  fi
}
run_extras() {
  local args=(${OVERTURE_ARGS[@]+"${OVERTURE_ARGS[@]}"})
  [[ "${NOTES:-1}" == 1 ]] || args+=(--notes=)
  [[ "${BRANDS:-1}" == 1 && -f data/sources/brands.jsonl ]] && args+=(--brands=data/sources/brands.jsonl)
  # Сообщения курьеров с карты (src/reports.js), выгруженные из хранилища проекта.
  [[ -n "${REPORTS:-}" ]] && args+=(--reports="$REPORTS")
  [[ "${OVERTURE:-1}" == 1 && -f data/sources/overture-buildings.jsonl ]] && args+=(--buildings=data/sources/overture-buildings.jsonl)
  rm -f data/extras.osm.pbf
  "$PY" scripts/extras.py "$PBF" data/extras.osm.pbf "data/$AREA-mask.geojson" "data/$AREA-clipped.osm.pbf" \
    --search="data/$AREA-search.json" ${args[@]+"${args[@]}"}
}
had_mask=0
[[ -f "data/$AREA-mask.geojson" ]] && had_mask=1
[[ $had_mask == 1 ]] && fetch_buildings || true
run_extras
if [[ $had_mask == 0 ]] && fetch_buildings; then
  run_extras
fi

# 3. Основные тайлы — из копии без подписей соседей, поэтому стиль рисует подписи
#    Таджикистана поверх «заморозки». В подписи попадают только русский, таджикский
#    и английский — так файл заметно меньше. Planetiler докачивает только
#    вспомогательные данные (Natural Earth, осевые линии озёр).
planetiler \
  --download \
  --area="$AREA" \
  --osm_path="$DATA/$AREA-clipped.osm.pbf" \
  --download_dir="$DATA/sources" \
  ${OCEAN_ARGS[@]+"${OCEAN_ARGS[@]}"} \
  --languages=ru,tg,en \
  --output="$DATA/$AREA.pmtiles" \
  --force

# 4. Нарезка дополнительных тайлов (до 15 зума — кроны и подъезды точнее).
planetiler generate-custom \
  --schema="$TILES/extra.yml" \
  --osm_path="$DATA/extras.osm.pbf" \
  --maxzoom=15 \
  --output="$DATA/$AREA-extra.pmtiles" \
  --force

ls -lh "data/$AREA.pmtiles" "data/$AREA-extra.pmtiles" "data/$AREA-mask.geojson" "data/$AREA-search.json" 2>/dev/null || true
