#!/usr/bin/env bash
# Собирает векторные тайлы Таджикистана из свежей выгрузки OpenStreetMap
# в один файл data/tajikistan.pmtiles (схема OpenMapTiles — та же, что у стиля).
#
# Нужен Docker (или Java 21+ и planetiler.jar — см. README).
# Первый запуск скачивает вспомогательные данные (~1 ГБ), дальше — только выгрузку OSM.
# Памяти хватает 2–4 ГБ, сборка занимает несколько минут.
#
#   ./scripts/build-tiles.sh
#
# Готовый файл кладётся на любой статический хостинг или CDN с поддержкой
# HTTP Range (nginx, S3, Cloudflare R2 и т.п.) и подключается так:
#   createStyle({ tiles: 'pmtiles://https://cdn.example.com/map/tajikistan.pmtiles' })

set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p data

docker run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx${PLANETILER_MEMORY:-3g}" \
  -v "$(pwd)/data":/data \
  ghcr.io/onthegomap/planetiler:latest \
  --download \
  --area=tajikistan \
  --languages=ru,tg,en \
  --output=/data/tajikistan.pmtiles \
  --force

ls -lh data/tajikistan.pmtiles
