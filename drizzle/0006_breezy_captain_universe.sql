CREATE TABLE "corrective_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"non_conformance_id" uuid,
	"action_type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"assigned_to" varchar(255) NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"completed_by" varchar(255),
	"completed_at" timestamp,
	"verified_by" varchar(255),
	"verified_at" timestamp,
	"verification_notes" text,
	"effectiveness_check" text,
	"effectiveness_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "non_conformances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"issue_type" varchar(100) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"discovered_by" varchar(255) NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'open',
	"resolved_by" varchar(255),
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quality_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"check_type" varchar(100) NOT NULL,
	"result" varchar(20) NOT NULL,
	"checked_by" varchar(255) NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"enabled" boolean DEFAULT false NOT NULL,
	"rollout_percentage" jsonb DEFAULT '0'::jsonb,
	"enabled_for_users" jsonb DEFAULT '[]'::jsonb,
	"enabled_for_tenants" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "feature_flags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_id" varchar(255) NOT NULL,
	"aggregate_type" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_version" varchar(10) DEFAULT '1.0',
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"processing_attempts" jsonb DEFAULT '0'::jsonb,
	"last_attempt_at" timestamp,
	"last_error" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"idempotency_key" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."label_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar(255),
	"product_name" varchar(500),
	"sku" varchar(255),
	"variant_option1" varchar(255),
	"quantity" integer,
	"lot_number" varchar(255),
	"label_type" varchar(20) DEFAULT 'container',
	"custom_request" boolean DEFAULT false,
	"custom_details" varchar(1000),
	"urgent" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'pending',
	"requested_at" timestamp DEFAULT now(),
	"requested_by" varchar(255),
	"printed_at" timestamp,
	"printed_by" varchar(255),
	"updated_at" timestamp DEFAULT now(),
	"legacy_id" integer
);
--> statement-breakpoint
CREATE TABLE "qr_workspace"."lot_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar(255) NOT NULL,
	"product_title" varchar(255) DEFAULT 'Default Title' NOT NULL,
	"sku" varchar(255),
	"lot_number" varchar(255) NOT NULL,
	"month" varchar(20) NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar(255),
	"legacy_id" integer
);
--> statement-breakpoint
ALTER TABLE "qr_workspace"."workspaces" ALTER COLUMN "final_measurements" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_non_conformance_id_non_conformances_id_fk" FOREIGN KEY ("non_conformance_id") REFERENCES "public"."non_conformances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_records" ADD CONSTRAINT "quality_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_corrective_nonconf_id" ON "corrective_actions" USING btree ("non_conformance_id");--> statement-breakpoint
CREATE INDEX "idx_corrective_status" ON "corrective_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_corrective_assigned_to" ON "corrective_actions" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_corrective_due_date" ON "corrective_actions" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_nonconf_workspace_id" ON "non_conformances" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_nonconf_issue_type" ON "non_conformances" USING btree ("issue_type");--> statement-breakpoint
CREATE INDEX "idx_nonconf_severity" ON "non_conformances" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_nonconf_status" ON "non_conformances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_nonconf_discovered_at" ON "non_conformances" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "idx_quality_workspace_id" ON "quality_records" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_quality_check_type" ON "quality_records" USING btree ("check_type");--> statement-breakpoint
CREATE INDEX "idx_quality_result" ON "quality_records" USING btree ("result");--> statement-breakpoint
CREATE INDEX "idx_quality_checked_at" ON "quality_records" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_name" ON "feature_flags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_outbox_processed" ON "outbox_events" USING btree ("processed","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_id","aggregate_type");--> statement-breakpoint
CREATE INDEX "idx_outbox_event_type" ON "outbox_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_outbox_idempotency" ON "outbox_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "label_requests_product_idx" ON "qr_workspace"."label_requests" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "label_requests_status_idx" ON "qr_workspace"."label_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "label_requests_requested_idx" ON "qr_workspace"."label_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "lot_numbers_product_idx" ON "qr_workspace"."lot_numbers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "lot_numbers_lot_idx" ON "qr_workspace"."lot_numbers" USING btree ("lot_number");--> statement-breakpoint
CREATE INDEX "lot_numbers_year_month_idx" ON "qr_workspace"."lot_numbers" USING btree ("year","month");