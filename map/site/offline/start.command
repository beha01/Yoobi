#!/bin/sh
# Карта Yoobi на своём компьютере (macOS, Linux): сервер только для этого компьютера.
cd "$(dirname "$0")"
PORT=8765
URL="http://127.0.0.1:$PORT/index.html"
echo "Карта Yoobi: $URL — не закрывайте это окно, пока пользуетесь картой."
( sleep 1; command -v open >/dev/null && open "$URL" || xdg-open "$URL" ) >/dev/null 2>&1 &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
