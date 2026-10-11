#!/bin/sh
set -e
# Миграции применяются при каждом старте (идемпотентно). Отключить: SKIP_MIGRATIONS=1.
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  node scripts/migrate.mjs
fi
exec "$@"
