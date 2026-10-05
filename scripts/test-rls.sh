#!/usr/bin/env bash
# Spin up a throwaway Postgres, apply auth stub + migrations + content import, run RLS tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | head -1)")}"
DATA="$(mktemp -d)"; PORT="${PGPORT_TEST:-55432}"
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DATA"; RUN="runuser -u postgres --"; else RUN=""; fi
cleanup() { $RUN "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
$RUN "$PGBIN/initdb" -D "$DATA" -U postgres >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
sleep 2
PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "create database cm" 
$PSQL -d cm -f "$ROOT/supabase/tests/auth-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do $PSQL -d cm -f "$f"; done
$PSQL -d cm -c "grant select, insert, update, delete on all tables in schema public to authenticated; grant usage, select on all sequences in schema public to authenticated;"
(cd "$ROOT" && npx tsx scripts/import-content.ts >/dev/null)
$PSQL -d cm -f "$ROOT/supabase/seed-content.sql"
echo "content rows: $($PSQL -d cm -tAc 'select count(*) from public.items')"
$PSQL -d cm -f "$ROOT/supabase/tests/rls.sql"
