CREATE TABLE "freight_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text NOT NULL,
	"nmfc_code" varchar(20),
	"freight_class" varchar(10) NOT NULL,
	"is_hazmat" boolean DEFAULT false,
	"hazmat_class" varchar(10),
	"packing_group" varchar(5),
	"packaging_instructions" text,
	"special_handling" text,
	"min_density" numeric(8, 2),
	"max_density" numeric(8, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freight_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"freight_order_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_description" varchar(500),
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"performed_by" varchar(255),
	"performed_at" timestamp DEFAULT now(),
	"location" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "freight_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"order_id" bigint NOT NULL,
	"order_number" varchar(100) NOT NULL,
	"mycarrier_order_id" varchar(100),
	"tracking_number" varchar(255),
	"carrier_name" varchar(255),
	"service_type" varchar(100),
	"estimated_cost" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"origin_address" jsonb,
	"destination_address" jsonb,
	"package_details" jsonb,
	"booking_status" varchar(50) DEFAULT 'pending',
	"booked_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"ai_suggestions" jsonb DEFAULT '[]'::jsonb,
	"confidence_score" numeric(3, 2),
	"decision_source" varchar(50),
	"session_id" uuid,
	"telemetry_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar(255),
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar(255),
	"special_instructions" text,
	"internal_notes" text,
	CONSTRAINT "freight_orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "freight_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"freight_order_id" uuid,
	"carrier_name" varchar(255) NOT NULL,
	"service_type" varchar(100),
	"quoted_cost" numeric(10, 2) NOT NULL,
	"transit_time" integer,
	"quote_reference" varchar(255),
	"valid_until" timestamp,
	"raw_quote_data" jsonb,
	"is_selected" boolean DEFAULT false,
	"selected_at" timestamp,
	"selected_by" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_freight_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"classification_id" uuid NOT NULL,
	"override_freight_class" varchar(10),
	"override_packaging" text,
	"confidence_score" numeric(3, 2),
	"link_source" varchar(50) DEFAULT 'manual',
	"is_approved" boolean DEFAULT false,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_hazmat_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"un_number" varchar(10),
	"hazard_class" varchar(10),
	"packing_group" varchar(5),
	"proper_shipping_name" varchar(255),
	"is_hazmat" boolean,
	"is_approved" boolean DEFAULT true,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"weight" numeric(10, 2),
	"length" numeric(10, 2),
	"width" numeric(10, 2),
	"height" numeric(10, 2),
	"packaging_type" varchar(50),
	"units_per_package" integer DEFAULT 1,
	"unit_container_type" varchar(50),
	"is_hazardous" boolean DEFAULT false,
	"cas_number" varchar(20),
	"un_number" varchar(10),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "auth"."account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "qr_workspace"."source_containers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "auth"."account" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."session" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."user" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."verification" CASCADE;--> statement-breakpoint
DROP TABLE "qr_workspace"."source_containers" CASCADE;--> statement-breakpoint
ALTER TABLE "qr_workspace"."qr_codes" DROP CONSTRAINT "qr_codes_short_code_unique";--> statement-breakpoint
DROP INDEX "qr_workspace"."idx_unique_source_qr";--> statement-breakpoint
ALTER TABLE "freight_events" ADD CONSTRAINT "freight_events_freight_order_id_freight_orders_id_fk" FOREIGN KEY ("freight_order_id") REFERENCES "public"."freight_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_orders" ADD CONSTRAINT "freight_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "qr_workspace"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_quotes" ADD CONSTRAINT "freight_quotes_freight_order_id_freight_orders_id_fk" FOREIGN KEY ("freight_order_id") REFERENCES "public"."freight_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_freight_links" ADD CONSTRAINT "product_freight_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_freight_links" ADD CONSTRAINT "product_freight_links_classification_id_freight_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."freight_classifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_hazmat_overrides" ADD CONSTRAINT "product_hazmat_overrides_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_classifications_description" ON "freight_classifications" USING btree ("description");--> statement-breakpoint
CREATE INDEX "idx_classifications_nmfc" ON "freight_classifications" USING btree ("nmfc_code");--> statement-breakpoint
CREATE INDEX "idx_classifications_class" ON "freight_classifications" USING btree ("freight_class");--> statement-breakpoint
CREATE INDEX "idx_classifications_hazmat" ON "freight_classifications" USING btree ("is_hazmat");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_freight_class_key" ON "freight_classifications" USING btree ("freight_class","nmfc_code","description");--> statement-breakpoint
CREATE INDEX "idx_event_freight_order_id" ON "freight_events" USING btree ("freight_order_id");--> statement-breakpoint
CREATE INDEX "idx_event_type" ON "freight_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_event_performed_at" ON "freight_events" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_freight_workspace_id" ON "freight_orders" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_freight_order_id" ON "freight_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_freight_booking_status" ON "freight_orders" USING btree ("booking_status");--> statement-breakpoint
CREATE INDEX "idx_freight_carrier" ON "freight_orders" USING btree ("carrier_name");--> statement-breakpoint
CREATE INDEX "idx_quote_freight_order_id" ON "freight_quotes" USING btree ("freight_order_id");--> statement-breakpoint
CREATE INDEX "idx_quote_carrier" ON "freight_quotes" USING btree ("carrier_name");--> statement-breakpoint
CREATE INDEX "idx_quote_selected" ON "freight_quotes" USING btree ("is_selected");--> statement-breakpoint
CREATE INDEX "idx_product_freight_product" ON "product_freight_links" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_freight_classification" ON "product_freight_links" USING btree ("classification_id");--> statement-breakpoint
CREATE INDEX "idx_product_freight_approved" ON "product_freight_links" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX "idx_product_freight_source" ON "product_freight_links" USING btree ("link_source");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_classification" ON "product_freight_links" USING btree ("product_id","classification_id");--> statement-breakpoint
CREATE INDEX "idx_product_hazmat_product" ON "product_hazmat_overrides" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_hazmat_override" ON "product_hazmat_overrides" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_products_sku" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_products_name" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_products_active" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_products_hazardous" ON "products" USING btree ("is_hazardous");--> statement-breakpoint
CREATE INDEX "idx_products_cas" ON "products" USING btree ("cas_number");--> statement-breakpoint
CREATE INDEX "idx_qr_short_code_per_order" ON "qr_workspace"."qr_codes" USING btree ("order_id","short_code");--> statement-breakpoint
ALTER TABLE "qr_workspace"."qr_codes" DROP COLUMN "source_container_id";--> statement-breakpoint
ALTER TABLE "qr_workspace"."workspaces" DROP COLUMN "documents";--> statement-breakpoint
ALTER TABLE "qr_workspace"."workspaces" DROP COLUMN "total_document_size";--> statement-breakpoint
DROP SCHEMA "auth";
