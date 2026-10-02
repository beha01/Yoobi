#!/usr/bin/env bash
# Ежедневное обновление в облачной сессии Claude Code (routine). Сборка идёт 30–120 минут, а
# ход сессии не должен заканчиваться, пока она идёт: иначе машину заберут вместе со сборкой.
# Поэтому сборка запускается отдельно, а сессия ждёт её короткими приёмами (каждый — меньше
# 10 минут, предела одной команды).
#
#   ./scripts/cloud-daily.sh start [папка]        # запустить daily-update.sh (папка — dist/site)
#   ./scripts/cloud-daily.sh wait [секунд]        # ждать до N секунд (540): код 0 — готово,
#                                                 # 1 — сборка не удалась, 3 — ещё идёт
#   ./scripts/cloud-daily.sh report статус текст  # отчёт о запуске (JSON) — для склада
set -uo pipefail
cd "$(dirname "$0")/.."
RUN=dist/run

case "${1:-}" in
  start)
    mkdir -p "$RUN"
    rm -f "$RUN/exit"
    OUT="${2:-dist/site}"
    nohup setsid bash -c "./scripts/daily-update.sh '$OUT' > '$RUN/log' 2>&1; echo \$? > '$RUN/exit'" \
      >/dev/null 2>&1 < /dev/null &
    echo $! > "$RUN/pid"
    echo "сборка запущена (pid $(cat "$RUN/pid")), журнал — $RUN/log"
    ;;
  wait)
    limit="${2:-540}"
    [[ -f "$RUN/pid" ]] || { echo "сборка не запускалась"; exit 1; }
    if [[ ! -f "$RUN/exit" ]]; then
      timeout "$limit" tail --pid="$(cat "$RUN/pid")" -f /dev/null
    fi
    tail -n 12 "$RUN/log" 2>/dev/null
    if [[ -f "$RUN/exit" ]]; then
      code=$(cat "$RUN/exit")
      echo "сборка закончилась, код $code"
      [[ "$code" == 0 ]] && exit 0 || exit 1
    fi
    if ! kill -0 "$(cat "$RUN/pid")" 2>/dev/null; then
      echo "сборка оборвалась, не записав код выхода"
      exit 1
    fi
    echo "сборка ещё идёт — запустите wait ещё раз"
    exit 3
    ;;
  report)
    python3 - "${2:-?}" "${3:-}" "$RUN/log" <<'PY'
import datetime as dt, json, os, sys
status, message, log = sys.argv[1:4]
lines = open(log, encoding='utf-8', errors='replace').read().splitlines()[-60:] if os.path.exists(log) else []
json.dump({'yoobi_run': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'status': status, 'message': message, 'log': lines}, sys.stdout, ensure_ascii=False, indent=1)
PY
    ;;
  *)
    sed -n '2,13p' "$0"
    exit 2
    ;;
esac
