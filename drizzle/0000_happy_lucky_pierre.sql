CREATE SCHEMA "qr_workspace";
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
CREATE TABLE "qr_workspace"."workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" bigint NOT NULL,
	"order_number" varchar(100) NOT NULL,
	"master_qr_id" uuid,
	"container_qr_ids" jsonb DEFAULT '[]'::jsonb,
	"qr_print_count" integer DEFAULT 0,
	"qr_generation_rule" varchar(50),
	"workspace_url" varchar(500) NOT NULL,
	"active_modules" jsonb DEFAULT '{"preMix":true,"warehouse":true,"documents":true}'::jsonb,
	"module_states" jsonb DEFAULT '{}'::jsonb,
	"current_users" jsonb DEFAULT '[]'::jsonb,
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"shipstation_order_id" integer,
	"last_shipstation_sync" timestamp,
	"shipstation_data" jsonb,
	"shipstation_tags" jsonb DEFAULT '[]'::jsonb,
	"sync_status" varchar(50) DEFAULT 'pending',
	"s3_bucket_name" varchar(255),
	"documents" jsonb DEFAULT '{"coa":[],"sds":[],"bol":null,"other":[]}'::jsonb,
	"total_document_size" bigint DEFAULT 0,
	"status" varchar(50) DEFAULT 'active',
	"workflow_phase" varchar(50) DEFAULT 'pre_mix',
	"phase_completed_at" jsonb DEFAULT '{}'::jsonb,
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
ALTER TABLE "qr_workspace"."documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_workspace"."qr_codes" ADD CONSTRAINT "qr_codes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_workspace" ON "qr_workspace"."activity_log" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_activity_performed" ON "qr_workspace"."activity_log" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_alert_workspace_id" ON "qr_workspace"."alert_configs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_alert_type" ON "qr_workspace"."alert_configs" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_alert_history_workspace" ON "qr_workspace"."alert_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_alert_history_triggered" ON "qr_workspace"."alert_history" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_document_workspace" ON "qr_workspace"."documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_document_type" ON "qr_workspace"."documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_qr_workspace_id" ON "qr_workspace"."qr_codes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_qr_order_id" ON "qr_workspace"."qr_codes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_qr_type" ON "qr_workspace"."qr_codes" USING btree ("qr_type");--> statement-breakpoint
CREATE INDEX "idx_qr_code" ON "qr_workspace"."qr_codes" USING btree ("qr_code");--> statement-breakpoint
CREATE INDEX "idx_workspace_order_id" ON "qr_workspace"."workspaces" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_order_number" ON "qr_workspace"."workspaces" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_workspace_status" ON "qr_workspace"."workspaces" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workspace_archive" ON "qr_workspace"."workspaces" USING btree ("archive_scheduled_for");