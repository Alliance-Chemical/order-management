#!/usr/bin/env npx tsx
import { getDb, withRetry } from '@/lib/db';
import { products as productsTable } from '@/lib/db/schema/freight';
import { eq } from 'drizzle-orm';

type ShopifyProduct = {
  id: number;
  title: string;
  body_html?: string;
  variants: Array<{ id: number; sku: string; title: string }>;
};

async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const apiKey = process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY_PUBLIC || process.env.SHOPIFY_API_KEY_ADMIN;
  const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_ACCESS_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN || process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL || 'alliance-chemical-store.myshopify.com';
  if (!apiKey || !apiSecret) {
    throw new Error('Missing Shopify API credentials (SHOPIFY_API_KEY and SHOPIFY_API_SECRET or SHOPIFY_ACCESS_TOKEN).');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.SHOPIFY_ACCESS_TOKEN) {
    headers['X-Shopify-Access-Token'] = process.env.SHOPIFY_ACCESS_TOKEN;
  } else {
    headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  }
  const url = `https://${domain}/admin/api/2024-01/products.json?limit=250`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Shopify fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.products || []) as ShopifyProduct[];
}

async function classify(name: string, sku: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { classifyWithRAG } = require('../lib/hazmat/classify');
  const cls = await classifyWithRAG(sku, name);
  return cls;
}

async function upsertProduct(db: ReturnType<typeof getDb>, sku: string, name: string, cls: any) {
  const isHazardous = Boolean(cls && cls.un_number);
  const unNumber = cls?.un_number || null;
  const record = await withRetry(async () => {
    const existing = await db.select().from(productsTable).where(eq(productsTable.sku, sku));
    if (existing.length > 0) {
      const [updated] = await db
        .update(productsTable)
        .set({
          name,
          isHazardous,
          unNumber,
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(productsTable)
        .values({
          sku,
          name,
          isHazardous,
          unNumber,
          isActive: true,
        })
        .returning();
      return inserted;
    }
  });
  return record;
}

async function main() {
  const db = getDb();
  console.log('🔎 Fetching Shopify products...');
  const products = await fetchShopifyProducts();
  console.log(`Found ${products.length} products`);

  let total = 0;
  let updated = 0;
  for (const p of products) {
    for (const v of p.variants || []) {
      const sku = (v.sku || '').trim();
      if (!sku) continue; // skip variants without SKU
      total++;
      const name = p.title; // prefer product title for classification
      try {
        const cls = await classify(name, sku);
        // Only persist if reasonable confidence OR has clear UN match
        if (cls?.un_number && (cls.confidence ?? 0) >= 0.55) {
          await upsertProduct(db, sku, name, cls);
          updated++;
          console.log(`✅ ${sku} -> ${cls.un_number} (${cls.hazard_class || 'N/A'}; PG ${cls.packing_group || 'N/A'})`);
        } else {
          console.log(`⚠️  Low confidence for ${sku} (${name}). Skipping persist.`);
        }
      } catch (e: any) {
        console.error(`❌ Failed to classify ${sku} (${name}):`, e?.message || e);
      }
    }
  }
  console.log(`\nDone. Consider manual review for low-confidence items.`);
  console.log(`Processed SKUs: ${total}, updated: ${updated}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

