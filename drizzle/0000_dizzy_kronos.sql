CREATE SCHEMA IF NOT EXISTS "qr_workspace";
--> statement-breakpoint
CREATE TABLE "qr_workspace"."activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"activity_type" varchar(100) NOT NULL,
	"activity_description" varchar(1000),
	"performed_by" varchar(255) NOT NULL,
	"performed_at" timestamp DEFAULT now(),
	"module" varchar(50),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"changes" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."alert_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true,
	"sns_topic_arn" varchar(500),
	"recipients" jsonb DEFAULT '[]'::jsonb,
	"trigger_conditions" jsonb DEFAULT '{}'::jsonb,
	"cooldown_minutes" integer DEFAULT 30,
	"last_triggered_at" timestamp,
	"trigger_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."alert_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"alert_config_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"triggered_by" varchar(255) NOT NULL,
	"triggered_at" timestamp DEFAULT now(),
	"message_content" varchar(1000) NOT NULL,
	"recipients_notified" jsonb NOT NULL,
	"sns_message_id" varchar(255),
	"delivery_status" jsonb DEFAULT '{}'::jsonb,
	"acknowledged_by" varchar(255),
	"acknowledged_at" timestamp,
	"action_taken" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."batch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"batch_number" varchar(255) NOT NULL,
	"chemical_name" varchar(255) NOT NULL,
	"initial_concentration" numeric(5, 2) NOT NULL,
	"desired_concentration" numeric(5, 2) NOT NULL,
	"method_used" varchar(10) NOT NULL,
	"initial_specific_gravity" numeric(5, 3) NOT NULL,
	"total_volume_gallons" numeric(10, 4) NOT NULL,
	"chemical_volume_gallons" numeric(10, 4) NOT NULL,
	"water_volume_gallons" numeric(10, 4) NOT NULL,
	"chemical_weight_lbs" numeric(10, 4) NOT NULL,
	"water_weight_lbs" numeric(10, 4) NOT NULL,
	"notes" varchar(1000),
	"completed_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"qr_code_id" uuid,
	"destination_qr_ids" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "batch_history_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."chemicals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"alternate_names" jsonb DEFAULT '[]'::jsonb,
	"specific_gravity" numeric(5, 3) NOT NULL,
	"initial_concentration" numeric(5, 2) NOT NULL,
	"method" varchar(10) NOT NULL,
	"grade" varchar(50),
	"grade_category" varchar(50),
	"hazard_class" varchar(255),
	"ppe_suggestion" varchar(500),
	"shopify_product_id" varchar(100),
	"shopify_title" varchar(255),
	"shopify_sku" varchar(100),
	"is_active" boolean DEFAULT true,
	"notes" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chemicals_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"document_type" varchar(50) NOT NULL,
	"document_name" varchar(255) NOT NULL,
	"s3_bucket" varchar(255) NOT NULL,
	"s3_key" varchar(500) NOT NULL,
	"s3_url" varchar(1000),
	"file_size" bigint NOT NULL,
	"mime_type" varchar(100),
	"checksum" varchar(255),
	"uploaded_by" varchar(255) NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"deleted_at" timestamp,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"qr_type" varchar(50) NOT NULL,
	"qr_code" varchar(500) NOT NULL,
	"short_code" varchar(50),
	"source_container_id" varchar(255),
	"order_id" bigint NOT NULL,
	"order_number" varchar(100),
	"container_number" integer,
	"chemical_name" varchar(255),
	"encoded_data" jsonb NOT NULL,
	"qr_url" varchar(500) NOT NULL,
	"scan_count" integer DEFAULT 0,
	"last_scanned_at" timestamp,
	"last_scanned_by" varchar(255),
	"printed_at" timestamp,
	"printed_by" varchar(255),
	"print_count" integer DEFAULT 0,
	"label_size" varchar(50),
	"is_active" boolean DEFAULT true,
	"deactivated_at" timestamp,
	"deactivation_reason" varchar(255),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "qr_codes_qr_code_unique" UNIQUE("qr_code"),
	CONSTRAINT "qr_codes_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."source_containers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_product_id" varchar(255) NOT NULL,
	"shopify_variant_id" varchar(255) NOT NULL,
	"product_title" varchar(500) NOT NULL,
	"variant_title" varchar(500),
	"sku" varchar(255),
	"barcode" varchar(255),
	"qr_code_id" uuid,
	"short_code" varchar(50),
	"container_type" varchar(100),
	"capacity" varchar(100),
	"current_quantity" numeric(10, 2),
	"unit_of_measure" varchar(50),
	"warehouse_location" varchar(255),
	"status" varchar(50) DEFAULT 'active',
	"hazmat_class" varchar(100),
	"un_number" varchar(50),
	"packing_group" varchar(10),
	"flash_point" varchar(100),
	"last_refilled" timestamp,
	"last_inventory_check" timestamp,
	"expiration_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar(255),
	CONSTRAINT "source_containers_shopify_variant_id_unique" UNIQUE("shopify_variant_id"),
	CONSTRAINT "source_containers_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" bigint NOT NULL,
	"order_number" varchar(100) NOT NULL,
	"qr_print_count" integer DEFAULT 0,
	"workspace_url" varchar(500) NOT NULL,
	"active_modules" jsonb DEFAULT '{"preMix":true,"warehouse":true,"documents":true}'::jsonb,
	"module_states" jsonb DEFAULT '{}'::jsonb,
	"current_users" jsonb DEFAULT '[]'::jsonb,
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"last_shipstation_sync" timestamp,
	"shipstation_data" jsonb,
	"shipstation_tags" jsonb DEFAULT '[]'::jsonb,
	"sync_status" varchar(50) DEFAULT 'pending',
	"documents" jsonb DEFAULT '{"coa":[],"sds":[],"bol":null,"other":[]}'::jsonb,
	"total_document_size" bigint DEFAULT 0,
	"status" varchar(50) DEFAULT 'active',
	"workflow_type" varchar(50) DEFAULT 'pump_and_fill' NOT NULL,
	"workflow_phase" varchar(50) DEFAULT 'pre_mix',
	"phase_completed_at" jsonb DEFAULT '{}'::jsonb,
	"final_measurements" jsonb,
	"shipped_at" timestamp,
	"archive_scheduled_for" timestamp,
	"archived_at" timestamp,
	"archive_s3_path" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar(255),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar(255),
	CONSTRAINT "workspaces_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "qr_workspace"."activity_log" ADD CONSTRAINT "activity_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."alert_configs" ADD CONSTRAINT "alert_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."alert_history" ADD CONSTRAINT "alert_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."alert_history" ADD CONSTRAINT "alert_history_alert_config_id_alert_configs_id_fk" FOREIGN KEY ("alert_config_id") REFERENCES "qr_workspace"."alert_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."batch_history" ADD CONSTRAINT "batch_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."batch_history" ADD CONSTRAINT "batch_history_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "qr_workspace"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."qr_codes" ADD CONSTRAINT "qr_codes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."source_containers" ADD CONSTRAINT "source_containers_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "qr_workspace"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_workspace" ON "qr_workspace"."activity_log" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_activity_performed" ON "qr_workspace"."activity_log" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_alert_workspace_id" ON "qr_workspace"."alert_configs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_alert_type" ON "qr_workspace"."alert_configs" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_alert_history_workspace" ON "qr_workspace"."alert_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_alert_history_triggered" ON "qr_workspace"."alert_history" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "chemicals_name_idx" ON "qr_workspace"."chemicals" USING btree ("name");--> statement-breakpoint
CREATE INDEX "chemicals_grade_idx" ON "qr_workspace"."chemicals" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "idx_document_workspace" ON "qr_workspace"."documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_document_type" ON "qr_workspace"."documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_qr_workspace_id" ON "qr_workspace"."qr_codes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_qr_order_id" ON "qr_workspace"."qr_codes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_qr_type" ON "qr_workspace"."qr_codes" USING btree ("qr_type");--> statement-breakpoint
CREATE INDEX "idx_qr_code" ON "qr_workspace"."qr_codes" USING btree ("qr_code");--> statement-breakpoint
-- NOTE: Changed from regular INDEX to UNIQUE INDEX with WHERE clause for partial index
CREATE UNIQUE INDEX "idx_unique_source_qr" ON "qr_workspace"."qr_codes" ("workspace_id","source_container_id")
WHERE "qr_type" = 'source' AND "source_container_id" IS NOT NULL;--> statement-breakpoint

-- ==== MANUAL ENHANCEMENTS - START ====

-- 1. Backfill the new source_container_id column from the old JSONB data (if any exists).
UPDATE "qr_workspace"."qr_codes"
SET source_container_id = encoded_data->>'sourceContainerId'
WHERE qr_type = 'source' AND encoded_data ? 'sourceContainerId' AND source_container_id IS NULL;

-- ==== MANUAL ENHANCEMENTS - END ====
--> statement-breakpoint
CREATE INDEX "idx_workspace_order_id" ON "qr_workspace"."workspaces" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_order_number" ON "qr_workspace"."workspaces" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_workspace_status" ON "qr_workspace"."workspaces" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workspace_archive" ON "qr_workspace"."workspaces" USING btree ("archive_scheduled_for");