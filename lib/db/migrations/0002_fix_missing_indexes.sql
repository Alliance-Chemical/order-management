-- Fix missing performance indexes for actual table names
-- These indexes optimize queries for tables that exist in production

-- Activity log performance indexes (corrected table name)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_workspace_time 
  ON qr_workspace.activity_log(workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_action_type 
  ON qr_workspace.activity_log(action, created_at DESC) 
  WHERE action IN ('qr_scan', 'status_change', 'inspection_complete');

-- Documents performance indexes (processing_status might not exist yet)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_workspace_type 
  ON qr_workspace.documents(workspace_id, document_type, created_at DESC);

-- Source containers performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_containers_workspace 
  ON qr_workspace.source_containers(workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_containers_status 
  ON qr_workspace.source_containers(status, created_at DESC) 
  WHERE status IN ('active', 'in_use');

-- Alert configs and history indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_configs_workspace 
  ON qr_workspace.alert_configs(workspace_id, alert_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_history_triggered 
  ON qr_workspace.alert_history(triggered_at DESC);

-- Batch history performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_history_workspace 
  ON qr_workspace.batch_history(workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_history_status 
  ON qr_workspace.batch_history(print_status, created_at DESC);

-- Chemicals lookup index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chemicals_name_lower 
  ON qr_workspace.chemicals(LOWER(name));

-- Update statistics for existing tables
ANALYZE qr_workspace.workspaces;
ANALYZE qr_workspace.qr_codes;
ANALYZE qr_workspace.activity_log;
ANALYZE qr_workspace.documents;
ANALYZE qr_workspace.source_containers;
ANALYZE qr_workspace.alert_configs;
ANALYZE qr_workspace.alert_history;
ANALYZE qr_workspace.batch_history;
ANALYZE qr_workspace.chemicals;