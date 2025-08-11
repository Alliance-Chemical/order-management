-- Clean up confusing/redundant columns from workspaces table
-- These columns are either redundant or not being used properly

-- Remove QR-related columns that are redundant with qr_codes table
ALTER TABLE qr_workspace.workspaces 
DROP COLUMN IF EXISTS master_qr_id,
DROP COLUMN IF EXISTS container_qr_ids,
DROP COLUMN IF EXISTS qr_generation_rule;

-- Remove redundant ShipStation column (we use order_id)
ALTER TABLE qr_workspace.workspaces 
DROP COLUMN IF EXISTS shipstation_order_id;

-- Remove redundant S3 bucket column (documents table has this)
ALTER TABLE qr_workspace.workspaces 
DROP COLUMN IF EXISTS s3_bucket_name;

-- Add a comment to explain the schema
COMMENT ON TABLE qr_workspace.workspaces IS 'Main workspace table for order management. Each workspace represents one order being processed.';
COMMENT ON TABLE qr_workspace.qr_codes IS 'QR codes generated for each workspace. Multiple QR codes per workspace (master, source, containers).';
COMMENT ON COLUMN qr_workspace.workspaces.order_id IS 'ShipStation order ID - primary identifier';
COMMENT ON COLUMN qr_workspace.workspaces.order_number IS 'ShipStation order number for display';
COMMENT ON COLUMN qr_workspace.qr_codes.qr_type IS 'Type of QR code: order_master, container, pallet';
COMMENT ON COLUMN qr_workspace.qr_codes.encoded_data IS 'JSON data encoded in the QR code including containerType for containers';