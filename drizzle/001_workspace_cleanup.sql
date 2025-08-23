-- Drop JSON duplicates from workspaces (if exist)
ALTER TABLE qr_workspace.workspaces
  DROP COLUMN IF EXISTS documents,
  DROP COLUMN IF EXISTS total_document_size;

-- Short code uniqueness per order
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'qr_workspace.qr_codes'::regclass
      AND conname = 'qr_codes_short_code_unique'
  ) THEN
    ALTER TABLE qr_workspace.qr_codes DROP CONSTRAINT qr_codes_short_code_unique;
  END IF;
END$$;

DROP INDEX IF EXISTS qr_workspace.idx_qr_short_code_per_order;
CREATE UNIQUE INDEX idx_qr_short_code_per_order
  ON qr_workspace.qr_codes (order_id, short_code)
  WHERE short_code IS NOT NULL;

-- Helpful compound index
DROP INDEX IF EXISTS qr_workspace.idx_qr_order_type;
CREATE INDEX idx_qr_order_type
  ON qr_workspace.qr_codes (order_id, qr_type);