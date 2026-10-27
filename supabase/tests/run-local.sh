#!/usr/bin/env bash
# Runs the migrations + RLS tests against a throwaway local PostgreSQL cluster.
# Requirements: PostgreSQL 15+ server binaries with the contrib extensions
# (unaccent, pg_trgm). No Docker, no Supabase account and no credentials needed.
#
#   npm run test:db
#   PG_BIN=/usr/lib/postgresql/16/bin npm run test:db   # custom binary path
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | tail -1)")}"
if [ ! -x "$PG_BIN/pg_ctl" ]; then
  echo "PostgreSQL server binaries not found. Set PG_BIN=/path/to/postgres/bin" >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-55432}"
cleanup() { "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

PGOPTIONS="-c client_min_messages=warning" "${PSQL[@]}" -f "$ROOT/supabase/tests/supabase-shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  PGOPTIONS="-c client_min_messages=warning" "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls.test.sql" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
exit "${PIPESTATUS[0]}"
