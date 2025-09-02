require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fetchShopifyProducts() {
  const apiKey = process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY_PUBLIC || process.env.SHOPIFY_API_KEY_ADMIN;
  const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_ACCESS_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN || process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL || 'alliance-chemical-store.myshopify.com';
  if (!apiKey && !apiSecret) {
    throw new Error('Missing Shopify API credentials (SHOPIFY_API_KEY/SECRET or SHOPIFY_ACCESS_TOKEN).');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.SHOPIFY_ACCESS_TOKEN) {
    headers['X-Shopify-Access-Token'] = process.env.SHOPIFY_ACCESS_TOKEN;
  } else {
    headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  }
  let url = `https://${domain}/admin/api/2024-01/products.json?limit=250`;
  const all = [];
  const maxPages = parseInt(process.env.SHOPIFY_MAX_PAGES || '0', 10) || Infinity;
  let page = 0;
  while (true) {
    page++;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Shopify fetch failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const items = data.products || [];
    all.push(...items);
    const link = res.headers.get('link') || res.headers.get('Link');
    if (!link || page >= maxPages) break;
    const m = link.match(/<([^>]+)>; rel="next"/);
    if (m && m[1]) {
      url = m[1];
    } else {
      break;
    }
  }
  return all;
}

async function classify(name, sku) {
  const { classifyWithRAG } = require('../lib/hazmat/classify.js');
  return await classifyWithRAG(sku, name);
}

async function upsertProduct(sql, sku, name, cls) {
  const isHazardous = Boolean(cls && cls.un_number);
  const unNumber = cls?.un_number || null;
  const existing = await sql`SELECT id FROM products WHERE sku = ${sku} LIMIT 1`;
  if (existing.length) {
    const updated = await sql`
      UPDATE products
      SET name = ${name}, is_hazardous = ${isHazardous}, un_number = ${unNumber}, updated_at = NOW()
      WHERE id = ${existing[0].id}
      RETURNING *
    `;
    return updated[0];
  } else {
    const inserted = await sql`
      INSERT INTO products (sku, name, is_hazardous, un_number, is_active)
      VALUES (${sku}, ${name}, ${isHazardous}, ${unNumber}, true)
      RETURNING *
    `;
    return inserted[0];
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  console.log('🔎 Fetching Shopify products...');
  const products = await fetchShopifyProducts();
  console.log(`Found ${products.length} products`);
  let total = 0, updated = 0;
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const outCsv = process.env.OUT_CSV;
  const rows = [['sku','name','is_hazardous','un_number','confidence']];
  let limit = process.env.CLASSIFY_LIMIT === undefined ? Infinity : parseInt(process.env.CLASSIFY_LIMIT || '0', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = Infinity;
  let processed = 0;
  for (const p of products) {
    for (const v of p.variants || []) {
      const sku = (v.sku || '').trim();
      if (!sku) continue;
      if (processed >= limit) break;
      total++;
      const variantTitle = (v.title || '').trim();
      const name = (variantTitle && !/default\s*title/i.test(variantTitle))
        ? `${p.title} ${variantTitle}`
        : p.title;
      // Skip packaging-only items: packaging terms present AND no chemical keywords present
      const packagingRe = /\b(jug|bottle|cap|sprayer|pump|spigot|lid|hdpe|hpde|poly|pail|drum|case|box|carton|empty|label|funnel|trigger|can)\b/i;
      const chemRe = /\b(acid|alcohol|glycol(?!\s+ether)|glycol\s+ether|peroxide|hypochlorite|hydrochloric|sulfuric|nitric|acetic|amine|solvent|ketone|xylene|toluene|acetone|isopropyl|ethanol|ethyl|sodium|potassium|hydroxide|ammonia|chloride|nitrate|sulfate|chlorine|phenol|benzene|naphtha|petroleum|distillate|ether|ipa|methanol|hexane|heptane|pentane|acetate)\b/i;
      if (packagingRe.test(name) && !chemRe.test(name)) {
        console.log(`↪️  Skip packaging SKU ${sku} (${name})`);
        continue;
      }
      try {
        const cls = await classify(name, sku);
        if (!cls?.un_number && (!cls?.hazard_class)) {
          // Non-hazardous outcome – clear hazard fields
          if (!dryRun) {
            await sql`
              UPDATE products SET is_hazardous = false, un_number = NULL, updated_at = NOW()
              WHERE sku = ${sku}
            `;
            console.log(`✅ ${sku} -> NON-HAZ (cleared UN)`);
          } else {
            console.log(`📝 (dry-run) ${sku} -> NON-HAZ`);
          }
          rows.push([sku, name.replaceAll('\n',' '), 'false', '', String(cls.confidence ?? '')]);
        } else if (cls?.un_number && (cls.confidence ?? 0) >= 0.55) {
          rows.push([sku, name.replaceAll('\n',' '), 'true', cls.un_number, String(cls.confidence ?? '')]);
          if (!dryRun) {
            await upsertProduct(sql, sku, name, cls);
            updated++;
            console.log(`✅ ${sku} -> ${cls.un_number} (${cls.hazard_class || 'N/A'}; PG ${cls.packing_group || 'N/A'})`);
          } else {
            console.log(`📝 (dry-run) ${sku} -> ${cls.un_number} (${cls.hazard_class || 'N/A'}; PG ${cls.packing_group || 'N/A'})`);
          }
        } else {
          console.log(`⚠️  Low confidence for ${sku} (${name}). Skipping persist.`);
        }
      } catch (e) {
        console.error(`❌ Failed to classify ${sku} (${name}):`, e?.message || e);
      }
      processed++;
    }
    if (processed >= limit) break;
  }
  if (outCsv) {
    const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replaceAll('"','""') + '"').join(',')).join('\n');
    require('fs').writeFileSync(outCsv, csv, 'utf8');
    console.log(`🗂  Wrote CSV: ${outCsv}`);
  }
  console.log(`\nDone. Processed SKUs: ${processed}/${total} (limit ${limit}), updated: ${dryRun ? 0 : updated}${dryRun ? ' (dry-run)' : ''}`);
  if (processed >= limit) {
    console.log('Tip: set CLASSIFY_LIMIT env to process more, e.g. CLASSIFY_LIMIT=500 npm run classify:shopify');
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
