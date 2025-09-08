import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const createTableSQL = `
CREATE TABLE IF NOT EXISTS "qr_workspace"."container_types" (
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
`;

const createIndexesSQL = [
  `CREATE INDEX IF NOT EXISTS "container_types_shopify_product_idx" ON "qr_workspace"."container_types" USING btree ("shopify_product_id");`,
  `CREATE INDEX IF NOT EXISTS "container_types_shopify_variant_idx" ON "qr_workspace"."container_types" USING btree ("shopify_variant_id");`,
  `CREATE INDEX IF NOT EXISTS "container_types_material_idx" ON "qr_workspace"."container_types" USING btree ("container_material");`,
  `CREATE INDEX IF NOT EXISTS "container_types_type_idx" ON "qr_workspace"."container_types" USING btree ("container_type");`
];

async function createContainerTypesTable() {
  try {
    console.log('Creating container_types table...');
    
    // Create the table
    await sql`CREATE TABLE IF NOT EXISTS "qr_workspace"."container_types" (
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
)`;
    console.log('✅ Table created successfully');
    
    // Create indexes
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS "container_types_shopify_product_idx" ON "qr_workspace"."container_types" USING btree ("shopify_product_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "container_types_shopify_variant_idx" ON "qr_workspace"."container_types" USING btree ("shopify_variant_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "container_types_material_idx" ON "qr_workspace"."container_types" USING btree ("container_material")`;
    await sql`CREATE INDEX IF NOT EXISTS "container_types_type_idx" ON "qr_workspace"."container_types" USING btree ("container_type")`;
    console.log('✅ Indexes created successfully');
    
    // Test the table
    const testResult = await sql`SELECT COUNT(*) as count FROM qr_workspace.container_types`;
    console.log('✅ Table test successful, current record count:', testResult[0].count);
    
  } catch (error) {
    console.error('❌ Failed to create table:', error);
    throw error;
  }
}

if (require.main === module) {
  createContainerTypesTable()
    .then(() => {
      console.log('🎉 Container types table setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

export { createContainerTypesTable };