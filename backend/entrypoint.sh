#!/usr/bin/env sh
set -eu

cd /app

if [ "${AUTO_MIGRATE:-1}" = "1" ]; then
  echo "[entrypoint] Running database migrations..."
  if [ "${MIGRATE_FAKE:-0}" = "1" ]; then
    python manage_db.py upgrade --fake
  else
    python manage_db.py upgrade
  fi
  echo "[entrypoint] Database migrations finished."
else
  echo "[entrypoint] AUTO_MIGRATE=0, skipping migrations."
fi

UVICORN_PORT="${PORT:-8000}"

echo "[entrypoint] Starting uvicorn on port ${UVICORN_PORT}."
exec uvicorn app.main:app --host 0.0.0.0 --port "${UVICORN_PORT}"
