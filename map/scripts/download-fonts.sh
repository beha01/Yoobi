#!/usr/bin/env bash
# Скачивает шрифты стиля (Noto Sans Regular/Bold/Italic, лицензия OFL) в fonts/,
# чтобы раздавать их со своего сервера вместе со стилем и спрайтами.
#
#   ./scripts/download-fonts.sh
#   createStyle({ glyphs: 'https://cdn.example.com/map/fonts/{fontstack}/{range}.pbf' })

set -euo pipefail

cd "$(dirname "$0")/.."
SOURCE="${FONTS_SOURCE:-https://tiles.openfreemap.org/fonts}"

for font in "Noto Sans Regular" "Noto Sans Bold" "Noto Sans Italic"; do
  mkdir -p "fonts/$font"
  saved=0
  for ((start = 0; start < 65536; start += 256)); do
    range="$start-$((start + 255))"
    # Для блоков символов, которых нет в шрифте, сервер отвечает 404 — их пропускаем.
    if curl -fsS --retry 3 -o "fonts/$font/$range.pbf" "$SOURCE/${font// /%20}/$range.pbf" 2>/dev/null; then
      saved=$((saved + 1))
    else
      rm -f "fonts/$font/$range.pbf"
    fi
  done
  echo "$font: $saved файлов"
done
