import { getEdgeSql } from '@/lib/db/neon-edge';

// Minimal bootstrap to guarantee core freight tables exist in the connected DB.
// Safe to call multiple times; uses IF NOT EXISTS for idempotency.
export async function ensureCoreFreightSchema() {
  const sql = getEdgeSql();

  // Create extension needed for gen_random_uuid()
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  } catch (_) {
    // ignore if not permitted; UUIDs may be set by DB default instead
  }

  // Products
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sku varchar(100) NOT NULL UNIQUE,
      name text NOT NULL,
      description text,
      weight numeric(10,2),
      length numeric(10,2),
      width numeric(10,2),
      height numeric(10,2),
      packaging_type varchar(50),
      units_per_package integer DEFAULT 1,
      unit_container_type varchar(50),
      is_hazardous boolean DEFAULT false,
      cas_number varchar(20),
      un_number varchar(10),
      is_active boolean DEFAULT true,
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    )
  `;

  // Ensure critical product columns exist (in case of older table definition)
  const productCols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'products'
  ` as any[];
  const has = (c: string) => productCols.some((r) => r.column_name === c);
  if (!has('sku')) {
    await sql`ALTER TABLE products ADD COLUMN sku varchar(100)`;
    await sql`UPDATE products SET sku = id::text WHERE sku IS NULL`;
    await sql`ALTER TABLE products ALTER COLUMN sku SET NOT NULL`;
  }
  if (!has('name')) {
    await sql`ALTER TABLE products ADD COLUMN name text`;
    await sql`UPDATE products SET name = 'Product ' || COALESCE(sku, id::text)`;
    await sql`ALTER TABLE products ALTER COLUMN name SET NOT NULL`;
  }
  if (!has('is_hazardous')) {
    await sql`ALTER TABLE products ADD COLUMN is_hazardous boolean DEFAULT false`;
  }
  if (!has('un_number')) {
    await sql`ALTER TABLE products ADD COLUMN un_number varchar(10)`;
  }
  // Unique index for sku
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON products (sku)`;

  // Freight classifications
  await sql`
    CREATE TABLE IF NOT EXISTS freight_classifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      description text NOT NULL,
      nmfc_code varchar(20),
      freight_class varchar(10) NOT NULL,
      is_hazmat boolean DEFAULT false,
      hazmat_class varchar(10),
      packing_group varchar(5),
      packaging_instructions text,
      special_handling text,
      min_density numeric(8,2),
      max_density numeric(8,2),
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_classifications_description ON freight_classifications (description)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_classifications_nmfc ON freight_classifications (nmfc_code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_classifications_class ON freight_classifications (freight_class)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_classifications_hazmat ON freight_classifications (is_hazmat)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_class_key
    ON freight_classifications (freight_class, nmfc_code, description)
  `;

  // Product hazmat overrides (per SKU)
  await sql`
    CREATE TABLE IF NOT EXISTS product_hazmat_overrides (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL,
      is_hazmat boolean,
      un_number varchar(10),
      hazard_class varchar(50),
      packing_group varchar(10),
      proper_shipping_name text,
      is_approved boolean DEFAULT false,
      approved_by varchar(255),
      approved_at timestamp,
      created_at timestamp NOT NULL DEFAULT NOW(),
      created_by varchar(255),
      updated_at timestamp NOT NULL DEFAULT NOW(),
      updated_by varchar(255)
    )
  `;
  // Add unique constraint and FK relations if missing
  try {
    await sql`ALTER TABLE product_hazmat_overrides ADD CONSTRAINT uq_product_hazmat_override UNIQUE (product_id)`;
  } catch (_) {}
  try {
    await sql`
      ALTER TABLE product_hazmat_overrides
      ADD CONSTRAINT product_hazmat_overrides_product_id_products_id_fk
      FOREIGN KEY (product_id) REFERENCES products(id)
    `;
  } catch (_) {}

  // Product → Classification links
  await sql`
    CREATE TABLE IF NOT EXISTS product_freight_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL,
      classification_id uuid NOT NULL,
      override_freight_class varchar(10),
      override_packaging text,
      confidence_score numeric(3,2),
      link_source varchar(50) DEFAULT 'manual',
      is_approved boolean DEFAULT false,
      approved_by varchar(255),
      approved_at timestamp,
      created_at timestamp NOT NULL DEFAULT NOW(),
      created_by varchar(255),
      updated_at timestamp NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_freight_product ON product_freight_links (product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_freight_classification ON product_freight_links (classification_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_freight_approved ON product_freight_links (is_approved)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_freight_source ON product_freight_links (link_source)`;
  try {
    await sql`ALTER TABLE product_freight_links ADD CONSTRAINT uq_product_classification UNIQUE (product_id, classification_id)`;
  } catch (_) {}
  try {
    await sql`
      ALTER TABLE product_freight_links
      ADD CONSTRAINT product_freight_links_product_id_products_id_fk
      FOREIGN KEY (product_id) REFERENCES products(id)
    `;
  } catch (_) {}
  try {
    await sql`
      ALTER TABLE product_freight_links
      ADD CONSTRAINT product_freight_links_classification_id_freight_classifications_id_fk
      FOREIGN KEY (classification_id) REFERENCES freight_classifications(id)
    `;
  } catch (_) {}

  return { ensured: true } as const;
}
