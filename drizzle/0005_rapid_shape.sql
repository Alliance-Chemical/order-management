CREATE TABLE "qr_workspace"."container_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_product_id" varchar(100) NOT NULL,
	"shopify_variant_id" varchar(100) NOT NULL,
	"shopify_title" varchar(255) NOT NULL,
	"shopify_variant_title" varchar(255),
	"shopify_sku" varchar(100),
	"container_material" varchar(20) DEFAULT 'poly' NOT NULL,
	"container_type" varchar(100),
	"capacity" numeric(8, 2),
	"capacity_unit" varchar(10) DEFAULT 'gallons',
	"length" numeric(6, 2),
	"width" numeric(6, 2),
	"height" numeric(6, 2),
	"empty_weight" numeric(8, 2),
	"max_gross_weight" numeric(8, 2),
	"freight_class" varchar(10),
	"nmfc_code" varchar(20),
	"un_rating" varchar(50),
	"hazmat_approved" boolean DEFAULT false,
	"is_stackable" boolean DEFAULT true,
	"max_stack_height" integer DEFAULT 1,
	"is_reusable" boolean DEFAULT true,
	"requires_liner" boolean DEFAULT false,
	"notes" varchar(1000),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar(255),
	"updated_by" varchar(255),
	CONSTRAINT "container_types_shopify_variant_id_unique" UNIQUE("shopify_variant_id")
);
--> statement-breakpoint
CREATE INDEX "container_types_shopify_product_idx" ON "qr_workspace"."container_types" USING btree ("shopify_product_id");--> statement-breakpoint
CREATE INDEX "container_types_shopify_variant_idx" ON "qr_workspace"."container_types" USING btree ("shopify_variant_id");--> statement-breakpoint
CREATE INDEX "container_types_material_idx" ON "qr_workspace"."container_types" USING btree ("container_material");--> statement-breakpoint
CREATE INDEX "container_types_type_idx" ON "qr_workspace"."container_types" USING btree ("container_type");