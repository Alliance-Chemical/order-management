DB Recovery Guide (Neon Postgres)

Overview
- Goal: Safely recover product/freight linkage data from an old Postgres DB and optionally restore into a target DB.
- Script: `scripts/db_recovery.sh` handles dump, basic inspection, and restore.

Prerequisites
- PostgreSQL client tools installed: `pg_dump`, `psql`, `pg_restore`.
- Environment variables set locally (do not commit secrets):
  - `export OLD_DATABASE_URL='postgres://user:pass@host/db?sslmode=require'`
  - `export NEW_DATABASE_URL='postgres://user:pass@host/db?sslmode=require'` (optional, for restore)

Quick Start
1) Dump the old DB (custom-format + schema-only):
   bash scripts/db_recovery.sh dump

2) Inspect likely linkage columns/tables:
   bash scripts/db_recovery.sh inspect
   # Outputs under a timestamped folder in `dumps/`:
   # - tables.txt
   # - columns_keyword_hits.csv

3) Restore (optional):
   - Full restore:
     bash scripts/db_recovery.sh restore-full --dump dumps/<STAMP>/old_db.dump --to "$NEW_DATABASE_URL"

   - Selective restore of specific tables:
     bash scripts/db_recovery.sh restore-select \
       --dump dumps/<STAMP>/old_db.dump \
       --to "$NEW_DATABASE_URL" \
       --tables public.products,public.product_variants,public.freight_classes,public.product_freight

Flags and Notes
- `--out DIR`: Choose output directory for `dump`/`inspect`.
- `--drop`: Add to restore commands to drop conflicting objects before restore (use with care).
- The script never prints secrets. Avoid committing any files in `dumps/`.

Finding the Right Tables
- Open `columns_keyword_hits.csv` to see columns with names like: `shopify`, `variant`, `product`, `sku`, `freight`, `hazmat`, `class`.
- Cross-check those tables in `tables.txt`. Common candidates include:
  - `public.products`, `public.product_variants`, `public.freight_classes`, `public.product_freight`
- Join keys usually are `sku`, `variant_id`, or `product_id` from Shopify.

Validation Tips
- After restoring selected tables, spot-check counts and sample joins:
  psql "$NEW_DATABASE_URL" -c "\dt"
  psql "$NEW_DATABASE_URL" -c "SELECT COUNT(*) FROM public.product_freight;"

Cleanup
- Delete dumps after verification:
  rm -rf dumps/<STAMP>

