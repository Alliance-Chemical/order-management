-- Add workflow_type column to workspaces table
ALTER TABLE "qr_workspace"."workspaces" 
ADD COLUMN IF NOT EXISTS "workflow_type" varchar(50) DEFAULT 'pump_and_fill' NOT NULL;