-- Performance indexes for Vercel deployment
-- These indexes optimize the most common query patterns in our warehouse app

-- Workspace performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_status_created 
  ON qr_workspace.workspaces(status, created_at DESC) 
  WHERE status IN ('active', 'in_progress');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_workflow_phase 
  ON qr_workspace.workspaces(workflow_phase, updated_at DESC) 
  WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_shipstation_sync 
  ON qr_workspace.workspaces(sync_status, last_shipstation_sync) 
  WHERE sync_status != 'synced';

-- QR Code performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_workspace_type 
  ON qr_workspace.qr_codes(workspace_id, qr_type) 
  WHERE workspace_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_scan_tracking 
  ON qr_workspace.qr_codes(last_scanned_at DESC NULLS LAST) 
  WHERE scan_count > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_source_container 
  ON qr_workspace.qr_codes(source_container_id, created_at DESC) 
  WHERE source_container_id IS NOT NULL;

-- Activity log performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_workspace_time 
  ON qr_workspace.activity_logs(workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_action_type 
  ON qr_workspace.activity_logs(action, created_at DESC) 
  WHERE action IN ('qr_scan', 'status_change', 'inspection_complete');

-- Documents performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_workspace_type 
  ON qr_workspace.documents(workspace_id, document_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_processing 
  ON qr_workspace.documents(processing_status, created_at DESC) 
  WHERE processing_status = 'processing';

-- Inspections performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_workspace_phase 
  ON qr_workspace.inspections(workspace_id, phase, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inspections_pending 
  ON qr_workspace.inspections(status, created_at DESC) 
  WHERE status IN ('pending', 'in_progress');

-- Notes performance indexes (for real-time sync)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notes_workspace_updated 
  ON qr_workspace.notes(workspace_id, updated_at DESC);

-- Partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_active_recent 
  ON qr_workspace.workspaces(updated_at DESC) 
  WHERE status = 'active' AND archived_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_to_archive 
  ON qr_workspace.workspaces(archive_scheduled_for) 
  WHERE archive_scheduled_for IS NOT NULL AND archived_at IS NULL;

-- Composite indexes for join queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_order_workspace 
  ON qr_workspace.qr_codes(order_id, workspace_id) 
  WHERE workspace_id IS NOT NULL;

-- JSONB indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_tags_gin 
  ON qr_workspace.workspaces USING GIN (shipstation_tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_modules_gin 
  ON qr_workspace.workspaces USING GIN (active_modules);

-- Function-based index for case-insensitive searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_order_number_lower 
  ON qr_workspace.workspaces(LOWER(order_number));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_code_lower 
  ON qr_workspace.qr_codes(LOWER(qr_code));

-- Statistics update for query planner
ANALYZE qr_workspace.workspaces;
ANALYZE qr_workspace.qr_codes;
ANALYZE qr_workspace.activity_logs;
ANALYZE qr_workspace.documents;
ANALYZE qr_workspace.inspections;
ANALYZE qr_workspace.notes;