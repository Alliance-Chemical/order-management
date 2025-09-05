#!/usr/bin/env bash
set -euo pipefail

# Copy only RAG data (rag.* tables) from a source Postgres DB to a destination Postgres DB.
# - Ensures the RAG schema and pgvector extension exist on destination (idempotent)
# - Copies data only (no schema changes) for:
#   rag.documents, rag.embedding_cache, rag.document_relations, rag.query_history
#
# Usage:
#   scripts/copy-rag-dev-to-prod.sh "<DEV_DB_URL>" "<PROD_DB_URL>"
#   # or with env vars
#   export DEV_DB="postgres://.../qr-workspace-test?sslmode=require"
#   export PROD_DB="postgres://.../verceldb?sslmode=require"
#   scripts/copy-rag-dev-to-prod.sh

echo "==> Copying RAG data (rag.*) from source -> destination"

DEV_DB_ARG="${1:-}"; PROD_DB_ARG="${2:-}"
DEV_DB="${DEV_DB_ARG:-${DEV_DB:-}}"
PROD_DB="${PROD_DB_ARG:-${PROD_DB:-}}"

if [[ -z "${DEV_DB:-}" || -z "${PROD_DB:-}" ]]; then
  echo "Error: DEV_DB and PROD_DB must be provided as arguments or env vars." >&2
  echo "Example:" >&2
  echo "  scripts/copy-rag-dev-to-prod.sh \"postgres://.../qr-workspace-test?sslmode=require\" \"postgres://.../verceldb?sslmode=require\"" >&2
  exit 1
fi

if [[ "${DEV_DB}" != *"sslmode=require"* || "${PROD_DB}" != *"sslmode=require"* ]]; then
  echo "Warning: It is recommended to include '?sslmode=require' on both URLs for Neon/Vercel." >&2
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$ROOT_DIR/lib/db/migrations/0001_add_pgvector_rag.sql"
if [[ ! -f "$SQL_FILE" ]]; then
  echo "Error: RAG SQL file not found at $SQL_FILE" >&2
  exit 1
fi

# Prefer Docker with official Postgres 16 client to avoid local version mismatch
if command -v docker >/dev/null 2>&1; then
  echo "-> Using Docker (postgres:16-alpine) for pg client tools"
  docker run --rm \
    -v "$ROOT_DIR:/work" -w /work \
    -e DEV_DB="$DEV_DB" -e PROD_DB="$PROD_DB" \
    postgres:16-alpine sh -c '
      set -euo pipefail;
      echo "   Ensuring RAG schema + pgvector on destination...";
      # Use ON_ERROR_STOP=0 to ignore harmless "already exists" when rerun
      psql "$PROD_DB" -v ON_ERROR_STOP=0 -f lib/db/migrations/0001_add_pgvector_rag.sql || true;
      echo "   Copying rag.* data from source -> destination...";
      pg_dump "$DEV_DB" --data-only --no-owner --no-privileges -n rag | psql "$PROD_DB";
      echo "   Verifying counts...";
      psql "$PROD_DB" -c "select count(*) as documents from rag.documents;";
    '
  echo "✅ RAG data copy completed via Docker"
  exit 0
fi

echo "-> Docker not found; attempting local pg client tools"
if ! command -v psql >/dev/null 2>&1 || ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: psql/pg_dump not found. Install Postgres client 16 or use Docker." >&2
  echo "Ubuntu install: sudo apt-get update && sudo apt-get install -y postgresql-client-16" >&2
  exit 1
fi

# Check pg_dump major version (recommend 16 for server 16)
if ! pg_dump --version | grep -q " 16\."; then
  echo "Warning: pg_dump version is not 16.x. If you hit version mismatch, install postgresql-client-16 or use Docker." >&2
fi

echo "-> Ensuring RAG schema + pgvector on destination (local psql)"
# Ignore harmless "already exists" errors if rerun
psql "$PROD_DB" -v ON_ERROR_STOP=0 -f "$SQL_FILE" || true

echo "-> Copying rag.* data (local pg_dump -> psql)"
pg_dump "$DEV_DB" --data-only --no-owner --no-privileges -n rag | psql "$PROD_DB"

echo "-> Verifying counts"
psql "$PROD_DB" -c "select count(*) as documents from rag.documents;"

echo "✅ RAG data copy completed"
