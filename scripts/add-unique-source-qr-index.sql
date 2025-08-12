-- Add unique partial index to prevent duplicate source QR codes
-- This ensures that for any given workspace, a specific source container 
-- can only have one QR code of type 'source'

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_source_qr 
ON qr_codes (workspace_id, (encoded_data->>'sourceContainerId')) 
WHERE qr_type = 'source';

-- Note: This index uses the JSONB field encoded_data to extract sourceContainerId
-- It only applies to rows where qr_type = 'source' (partial index)
-- This prevents race conditions when multiple users try to create the same source QR