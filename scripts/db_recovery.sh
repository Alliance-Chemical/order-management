#!/usr/bin/env bash
set -euo pipefail

# DB Recovery helper for Postgres (Neon-compatible)
# - Performs safe dump from OLD_DATABASE_URL
# - Inspects schema for likely Shopify/freight linkage
# - Optionally restores to NEW_DATABASE_URL (full or selected tables)

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/db_recovery.sh dump [--out DIR]
  bash scripts/db_recovery.sh inspect [--out DIR]
  bash scripts/db_recovery.sh restore-full --dump FILE --to NEW_DATABASE_URL [--drop]
  bash scripts/db_recovery.sh restore-select --dump FILE --to NEW_DATABASE_URL --tables T1,T2,... [--drop]

Notes:
  - Requires pg_dump/pg_restore/psql installed.
  - Reads OLD_DATABASE_URL from env for dump/inspect.
  - Use custom-format dump for flexible restore.
  - Does not print secrets. Do not commit dumps.
USAGE
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Error: $name is not installed. Install PostgreSQL client tools (pg_dump, psql, pg_restore)." >&2
    exit 1
  fi
}

timestamp() { date +"%Y%m%d_%H%M%S"; }

ensure_outdir() {
  local outdir="$1"
  mkdir -p "$outdir"
}

dump_db() {
  local outdir="dumps/$(timestamp)"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --out)
        outdir="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
    esac
  done

  require_cmd pg_dump
  require_cmd psql

  if [[ -z "${OLD_DATABASE_URL:-}" ]]; then
    echo "Error: OLD_DATABASE_URL is not set in your environment." >&2
    echo "Example: export OLD_DATABASE_URL='postgres://...:...@host/db?sslmode=require'" >&2
    exit 1
  fi

  ensure_outdir "$outdir"

  echo "Creating dumps in $outdir (not printing secrets)..."
  pg_dump --format=c --no-owner --no-privileges -f "$outdir/old_db.dump" "$OLD_DATABASE_URL"
  pg_dump --schema-only -f "$outdir/old_schema.sql" "$OLD_DATABASE_URL"

  echo "Dump complete:"
  echo " - $outdir/old_db.dump (custom format)"
  echo " - $outdir/old_schema.sql (schema only)"
}

inspect_db() {
  local outdir="dumps/$(timestamp)"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --out)
        outdir="$2"; shift 2 ;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
    esac
  done

  require_cmd psql

  if [[ -z "${OLD_DATABASE_URL:-}" ]]; then
    echo "Error: OLD_DATABASE_URL is not set in your environment." >&2
    echo "Example: export OLD_DATABASE_URL='postgres://...:...@host/db?sslmode=require'" >&2
    exit 1
  fi

  ensure_outdir "$outdir"

  echo "Inspecting schema to identify relevant tables..."
  psql -v ON_ERROR_STOP=1 "$OLD_DATABASE_URL" -Atc \
    "SELECT table_schema||'.'||table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1;" \
    > "$outdir/tables.txt"

  psql -v ON_ERROR_STOP=1 "$OLD_DATABASE_URL" -Atc \
    "SELECT table_schema||'.'||table_name||','||column_name FROM information_schema.columns WHERE column_name ILIKE ANY (ARRAY['%shopify%','%variant%','%product%','%sku%','%freight%','%hazmat%','%class%']) ORDER BY 1;" \
    > "$outdir/columns_keyword_hits.csv"

  echo "Wrote:"
  echo " - $outdir/tables.txt"
  echo " - $outdir/columns_keyword_hits.csv (schema.table,column)"
}

restore_full() {
  local dumpfile=""
  local target_url=""
  local do_drop="false"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dump) dumpfile="$2"; shift 2 ;;
      --to) target_url="$2"; shift 2 ;;
      --drop) do_drop="true"; shift ;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
    esac
  done

  require_cmd pg_restore

  if [[ -z "$dumpfile" || -z "$target_url" ]]; then
    echo "Error: --dump and --to NEW_DATABASE_URL are required." >&2
    exit 1
  fi
  if [[ ! -f "$dumpfile" ]]; then
    echo "Error: dump file not found: $dumpfile" >&2
    exit 1
  fi

  local clean_flags=("--no-owner" "--no-privileges")
  if [[ "$do_drop" == "true" ]]; then
    clean_flags+=("--clean" "--if-exists")
  fi

  echo "Restoring full dump to target (not printing secrets)..."
  pg_restore "${clean_flags[@]}" --dbname="$target_url" "$dumpfile"
  echo "Restore complete."
}

restore_select() {
  local dumpfile=""
  local target_url=""
  local tables_csv=""
  local do_drop="false"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dump) dumpfile="$2"; shift 2 ;;
      --to) target_url="$2"; shift 2 ;;
      --tables) tables_csv="$2"; shift 2 ;;
      --drop) do_drop="true"; shift ;;
      *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
    esac
  done

  require_cmd pg_restore

  if [[ -z "$dumpfile" || -z "$target_url" || -z "$tables_csv" ]]; then
    echo "Error: --dump, --to NEW_DATABASE_URL, and --tables are required." >&2
    exit 1
  fi
  if [[ ! -f "$dumpfile" ]]; then
    echo "Error: dump file not found: $dumpfile" >&2
    exit 1
  fi

  IFS=',' read -r -a table_list <<< "$tables_csv"
  local restore_args=("--no-owner" "--no-privileges")
  if [[ "$do_drop" == "true" ]]; then
    restore_args+=("--clean" "--if-exists")
  fi
  for t in "${table_list[@]}"; do
    restore_args+=("-t" "$t")
  done

  echo "Restoring selected tables to target (not printing secrets)..."
  pg_restore "${restore_args[@]}" --dbname="$target_url" "$dumpfile"
  echo "Selective restore complete."
}

main() {
  local cmd="${1:-}" || true
  if [[ -z "$cmd" ]]; then
    usage; exit 2
  fi
  shift || true

  case "$cmd" in
    dump) dump_db "$@" ;;
    inspect) inspect_db "$@" ;;
    restore-full) restore_full "$@" ;;
    restore-select) restore_select "$@" ;;
    -h|--help|help) usage ;;
    *) echo "Unknown command: $cmd" >&2; usage; exit 2 ;;
  esac
}

main "$@"

