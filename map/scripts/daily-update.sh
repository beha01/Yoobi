#!/usr/bin/env bash
# Ежедневное обновление карты: свежие данные → тайлы → проверка → готовая папка сайта.
#
#   ./scripts/daily-update.sh                     # dist/site — для хостинга и артефакта
#   OFFLINE_OUT=dist/yoobi-map ./scripts/daily-update.sh   # и папка для компьютера
#
# Что обновляется: OSM до текущей минуты, заметки OSM, филиалы сетей с их сайтов, снимки
# Sentinel-2 (новые высотки и этажность), Overture (раз в месяц выходит новый релиз).
# Перед сборкой прошлые тайлы откладываются в data/previous; если проверка
# (scripts/check-build.py) не прошла — они возвращаются на место, публиковать нечего,
# скрипт выходит с кодом 1. Удачная сборка запоминается как образец для следующей.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-dist/site}"
AREA="${AREA:-tajikistan}"
export PLANETILER_MEMORY="${PLANETILER_MEMORY:-6g}"
KEEP=("data/$AREA.pmtiles" "data/$AREA-extra.pmtiles" "data/$AREA-search.json" "data/$AREA-mask.geojson")

rm -rf data/previous
if [[ -f "data/$AREA.pmtiles" ]]; then
  mkdir -p data/previous
  cp -p "${KEEP[@]}" data/previous/ 2>/dev/null || true
fi
restore() {
  if [[ -d data/previous ]]; then
    cp -p data/previous/* data/
    echo "Возвращена прошлая сборка" >&2
  fi
}

if ! ./scripts/build-tiles.sh; then
  echo "Сборка не удалась" >&2
  restore
  exit 1
fi
if ! python3 scripts/check-build.py; then
  restore
  exit 1
fi
python3 scripts/check-build.py --save >/dev/null
python3 scripts/package-site.py "$OUT"
if [[ -n "${OFFLINE_OUT:-}" ]]; then
  python3 scripts/package-site.py "$OFFLINE_OUT" --offline
fi
echo "Готово: $OUT (план публикации — $OUT/publish-plan.json)"
