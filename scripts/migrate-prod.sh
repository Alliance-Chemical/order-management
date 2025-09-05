#!/usr/bin/env bash
set -euo pipefail

echo "==> Migrating database schema to Vercel PROD"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Error: vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx not found (install Node/npm)." >&2
  exit 1
fi

if [[ ! -f "drizzle.config.ts" ]]; then
  echo "Error: drizzle.config.ts not found in repo root." >&2
  exit 1
fi

TMP_ENV=".env.prod"
echo "-> Pulling PROD env from Vercel into $TMP_ENV"
vercel env pull "$TMP_ENV" >/dev/null

if [[ ! -s "$TMP_ENV" ]]; then
  echo "Error: Failed to pull PROD env. Are you logged into Vercel and in the right project?" >&2
  exit 1
fi

set -a
source "$TMP_ENV"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL missing from PROD env." >&2
  exit 1
fi

# Mask the URL for display (show host only)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|^[a-z]+://[^@]+@([^/]+).*$|\1|')
echo "-> Using PROD database host: $DB_HOST"

echo "-> Running drizzle-kit push against PROD"
DATABASE_URL="$DATABASE_URL" npx drizzle-kit push

echo "✅ Prod migration complete"

