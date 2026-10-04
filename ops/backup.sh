#!/usr/bin/env bash
# Резервное копирование PulseCheck: дамп PostgreSQL + файловое хранилище.
# Запуск по cron, например:  0 3 * * *  /opt/pulsecheck/ops/backup.sh >> /var/log/pulsecheck-backup.log 2>&1
#
# Переменные окружения (значения по умолчанию — для dev-схемы docker compose):
#   PGCONTAINER   контейнер PostgreSQL       (pulsecheck-postgres)
#   PGUSER        пользователь БД           (slide)
#   PGDATABASE    база                      (slide_hz)
#   STORAGE_DIR   каталог хранилища файлов  (../storage относительно репозитория)
#   BACKUP_DIR    куда складывать копии     (../backups)
set -euo pipefail

PGCONTAINER="${PGCONTAINER:-pulsecheck-postgres}"
PGUSER="${PGUSER:-slide}"
PGDATABASE="${PGDATABASE:-slide_hz}"
STORAGE_DIR="${STORAGE_DIR:-$(cd "$(dirname "$0")/.." && pwd)/storage}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/.." && pwd)/backups}"

STAMP="$(date +%F-%H%M)"
mkdir -p "$BACKUP_DIR"

echo "[backup] дамп БД ${PGDATABASE}..."
docker exec "$PGCONTAINER" pg_dump -U "$PGUSER" "$PGDATABASE" \
  | gzip > "$BACKUP_DIR/db-${PGDATABASE}-${STAMP}.sql.gz"

echo "[backup] архивирование хранилища ${STORAGE_DIR}..."
tar -czf "$BACKUP_DIR/storage-${STAMP}.tar.gz" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"

# ретеншн: храним 30 дней
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "[backup] готово: $BACKUP_DIR/*-${STAMP}.*"
