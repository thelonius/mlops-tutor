#!/bin/sh
# Вставить сайт-блок MLOps Tutor в ХОСТОВОЙ Caddyfile (стек gpx-tracker) и
# перезагрузить конфиг. Запускается НА СЕРВЕРЕ: CI зовёт его по ssh после того,
# как доставил deploy/host-caddy-mlops.conf.
#
# Зачем отдельный шаг. Хостер не пропускает снаружи порт 4443, на котором сайт
# жил через ssd_radar_caddy, поэтому публичный адрес обслуживает Caddy, который
# владеет хостовым :443. Его файл лежит вне репозитория, и без этого скрипта
# блок жил бы там единственной копией.
#
# Тот же приём уже работает у ssd-radar и quickbarn: каждый проект владеет
# только своим куском между маркерами, всё остальное переносится байт в байт.
#
# Идемпотентно: конфиг совпал — ничего не трогаем и не перезагружаем. Разошёлся —
# бэкап, запись, `caddy validate`, и только потом `reload`. Битый конфиг
# откатывается на бэкап, а работающий Caddy его не увидит: он перечитывает файл
# только по reload.
#
# Usage: sync_host_caddy.sh [фрагмент] [хостовый Caddyfile] [контейнер]
set -eu

FRAGMENT="${1:-/root/mlops-tutor/deploy/host-caddy-mlops.conf}"
HOST_CF="${2:-/root/cesium-route-renderer/gpx-tracker/Caddyfile}"
CONTAINER="${3:-gpx-tracker-caddy}"

BEGIN_MARK="# >>> mlops-tutor: блок из deploy/host-caddy-mlops.conf, правки здесь затрутся >>>"
END_MARK="# <<< mlops-tutor <<<"

die() { echo "host-caddy: $*" >&2; exit 1; }

[ -f "$FRAGMENT" ] || die "нет фрагмента $FRAGMENT (его доставляет деплой)"
[ -f "$HOST_CF" ] || die "нет хостового Caddyfile $HOST_CF"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "контейнер $CONTAINER не найден"

# Блок без маркеров (вписан руками) дописывать вслепую нельзя: сайт окажется
# объявлен дважды, и Caddy откажется стартовать.
if ! grep -qF "$BEGIN_MARK" "$HOST_CF"; then
  if grep -q "mlops-31-130-130-11\.sslip\.io" "$HOST_CF"; then
    die "в $HOST_CF есть блок mlops без маркеров. Оберните его один раз руками:
     строка до блока — $BEGIN_MARK
     строка после    — $END_MARK"
  fi
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Всё вне наших маркеров — чужое (VPN, ssd-radar, quickbarn), переносим как есть.
awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
  $0 == b { skip = 1; next }
  $0 == e { skip = 0; next }
  !skip   { print }
' "$HOST_CF" | awk '
  # схлопываем хвостовые пустые строки, чтобы блок не уезжал вниз с каждым прогоном
  { lines[NR] = $0 }
  END {
    last = NR
    while (last > 0 && lines[last] ~ /^[[:space:]]*$/) last--
    for (i = 1; i <= last; i++) print lines[i]
  }
' > "$TMP"

{
  echo ""
  echo "$BEGIN_MARK"
  cat "$FRAGMENT"
  echo "$END_MARK"
} >> "$TMP"

if cmp -s "$TMP" "$HOST_CF"; then
  echo "host-caddy: конфиг уже совпадает с репозиторием, перезагрузка не нужна"
  exit 0
fi

BACKUP="$HOST_CF.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$HOST_CF" "$BACKUP"
cat "$TMP" > "$HOST_CF"   # перезаписываем содержимое: файл примонтирован в контейнер по inode
echo "host-caddy: конфиг обновлён, бэкап $BACKUP"

restore() {
  cat "$BACKUP" > "$HOST_CF"
  docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
  die "$1 — откатились на $BACKUP"
}

docker exec "$CONTAINER" caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 \
  || restore "caddy validate не принял новый конфиг"

docker exec -w /etc/caddy "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 \
  || restore "caddy reload упал"

echo "host-caddy: конфиг перезагружен ($CONTAINER)"
