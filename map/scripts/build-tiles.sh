#!/usr/bin/env bash
# Собирает карту всего Таджикистана из свежей выгрузки OpenStreetMap:
#
#   data/tajikistan.pmtiles        — основные тайлы (схема OpenMapTiles, как у стиля)
#   data/tajikistan-extra.pmtiles  — объёмные деревья и подъезды (scripts/extras.py + tiles/extra.yml)
#   data/tajikistan-mask.geojson   — точный контур страны для «заморозки» соседей
#
# Нужна Java 21+ (planetiler.jar скачается сам) или Docker.
# Первый запуск скачивает вспомогательные данные (~1 ГБ), дальше — только выгрузку OSM.
# Памяти хватает 2–4 ГБ, сборка занимает несколько минут.
#
#   ./scripts/build-tiles.sh
#   PLANETILER_MEMORY=6g ./scripts/build-tiles.sh
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

# 1. Основные тайлы. В подписи попадают только русский, таджикский и английский —
#    так файл заметно меньше.
planetiler \
  --download \
  --area="$AREA" \
  --download_dir="$DATA/sources" \
  ${OCEAN_ARGS[@]+"${OCEAN_ARGS[@]}"} \
  --languages=ru,tg,en \
  --output="$DATA/$AREA.pmtiles" \
  --force

# 2. Объёмные деревья, подъезды со стороной входа и точная маска страны — из той же
#    выгрузки (scripts/extras.py, нужен pyosmium; ставится в data/.venv сам).
PY=python3
if ! python3 -c 'import osmium' 2>/dev/null; then
  [[ -d data/.venv ]] || python3 -m venv data/.venv
  data/.venv/bin/pip install --quiet osmium
  PY=data/.venv/bin/python
fi
rm -f data/extras.osm.pbf
"$PY" scripts/extras.py "data/sources/$AREA.osm.pbf" data/extras.osm.pbf "data/$AREA-mask.geojson"

# 3. Нарезка дополнительных тайлов (до 15 зума — кроны и подъезды точнее).
planetiler generate-custom \
  --schema="$TILES/extra.yml" \
  --osm_path="$DATA/extras.osm.pbf" \
  --maxzoom=15 \
  --output="$DATA/$AREA-extra.pmtiles" \
  --force

ls -lh "data/$AREA.pmtiles" "data/$AREA-extra.pmtiles" "data/$AREA-mask.geojson" 2>/dev/null || true
