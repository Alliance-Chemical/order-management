-- Run this once against your Postgres/Neon database
-- Ensures atomic upserts for product links and prevents duplicate classifications

-- 1) Unique link per product/classification
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_classification
  ON public.product_freight_links (product_id, classification_id);

-- 2) Single classification row for the same (freight_class, nmfc_code, description)
-- If you want to treat NULLs as empty strings equivalently, use an expression index:
CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_class_key
  ON public.freight_classifications (freight_class, nmfc_code, description);

-- Optional: if you prefer to collapse NULL/empty values to one bucket, use this instead:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_class_key
--   ON public.freight_classifications (
--     freight_class,
--     COALESCE(nmfc_code, ''),
--     COALESCE(description, '')
--   );

-- Note: CREATE INDEX CONCURRENTLY is not used here; run during a low-traffic window if needed.
