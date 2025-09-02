// Link products to freight_classifications by density (fallback to sensible defaults)
// Env controls:
// - DRY_RUN=1             -> preview only
// - ONLY_MISSING=1        -> only products without any product_freight_links
// - PRODUCT_LIMIT=1000    -> limit number of products
// - PRODUCT_OFFSET=0      -> offset for pagination

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

function loadHMT() {
  try {
    const p = path.join(process.cwd(), 'data', 'hmt-172101.json');
    const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
    const map = new Map();
    rows.forEach(r => { if (r.id_number) map.set(String(r.id_number).toUpperCase(), r.class_or_division || null); });
    return map;
  } catch { return new Map(); }
}

function densityToClass(d) {
  // NMFC density guidelines (lbs/ft^3) → class
  if (d >= 50) return '50';
  if (d >= 35) return '55';
  if (d >= 30) return '60';
  if (d >= 22.5) return '65';
  if (d >= 15) return '70';
  if (d >= 13.5) return '77.5';
  if (d >= 12) return '85';
  if (d >= 10.5) return '92.5';
  if (d >= 9) return '100';
  if (d >= 8) return '110';
  if (d >= 7) return '125';
  if (d >= 6) return '150';
  if (d >= 5) return '175';
  if (d >= 4) return '200';
  if (d >= 3) return '250';
  if (d >= 2) return '300';
  if (d >= 1) return '400';
  return '500';
}

async function ensureClassification(sql, freightClass, isHazmat, hazmatClass) {
  // Try to find an existing matching classification row
  const desc = `Density Class ${freightClass}${isHazmat ? ' (Hazmat)' : ''}`;
  const existing = await sql`SELECT id FROM freight_classifications WHERE description = ${desc} AND freight_class = ${freightClass} LIMIT 1`;
  if (existing.length) return existing[0].id;
  const inserted = await sql`
    INSERT INTO freight_classifications (description, freight_class, is_hazmat, hazmat_class, packaging_instructions)
    VALUES (${desc}, ${freightClass}, ${isHazmat}, ${hazmatClass || null}, ${isHazmat ? 'DOT hazmat – verify packaging per CFR 49' : 'Density based class – verify packaging'})
    RETURNING id
  `;
  return inserted[0].id;
}

async function productHasLink(sql, productId) {
  const r = await sql`SELECT 1 FROM product_freight_links WHERE product_id = ${productId} LIMIT 1`;
  return r.length > 0;
}

async function linkProduct(sql, product, hmtMap, dryRun) {
  const w = parseFloat(product.weight || 0);
  const L = parseFloat(product.length || 0);
  const W = parseFloat(product.width || 0);
  const H = parseFloat(product.height || 0);
  let density = null;
  if (w > 0 && L > 0 && W > 0 && H > 0) {
    const cf = (L * W * H) / 1728; // inches^3 to ft^3
    if (cf > 0) density = w / cf;
  }
  let targetClass = null;
  if (density !== null) targetClass = densityToClass(density);
  else targetClass = product.is_hazardous ? '100' : '85'; // fallback

  const isHaz = !!product.is_hazardous;
  const hazClass = product.un_number ? (hmtMap.get(String(product.un_number).toUpperCase()) || null) : null;
  const classId = await ensureClassification(sql, targetClass, isHaz, hazClass);
  const confidence = density !== null ? 0.9 : 0.6;

  // Upsert link: if link to same classification exists, skip; else insert new link
  const existing = await sql`SELECT id, classification_id FROM product_freight_links WHERE product_id = ${product.id} LIMIT 1`;
  if (existing.length) {
    if (existing[0].classification_id === classId) return { updated: false, class: targetClass };
    if (!dryRun) {
      await sql`UPDATE product_freight_links SET classification_id = ${classId}, confidence_score = ${confidence}, link_source = 'ai', is_approved = false, updated_at = NOW() WHERE id = ${existing[0].id}`;
    }
    return { updated: true, class: targetClass };
  } else {
    if (!dryRun) {
      await sql`
        INSERT INTO product_freight_links (product_id, classification_id, confidence_score, link_source, is_approved, created_at)
        VALUES (${product.id}, ${classId}, ${confidence}, 'ai', false, NOW())
      `;
    }
    return { updated: true, class: targetClass };
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const limit = parseInt(process.env.PRODUCT_LIMIT || '0', 10) || null;
  const offset = parseInt(process.env.PRODUCT_OFFSET || '0', 10) || 0;
  const onlyMissing = process.env.ONLY_MISSING === '1' || process.env.ONLY_MISSING === 'true';
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const hmtMap = loadHMT();

  console.log(`🔗 Linking products to freight_classifications${onlyMissing ? ' (only missing links)' : ''}${limit ? `, limit ${limit}` : ''}${offset ? `, offset ${offset}` : ''}${dryRun ? ' [DRY RUN]' : ''}`);

  const whereClauses = [];
  if (onlyMissing) whereClauses.push('id NOT IN (SELECT product_id FROM product_freight_links)');
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const limitSql = limit ? `LIMIT ${limit}` : '';
  const offsetSql = offset ? `OFFSET ${offset}` : '';
  const selectSql = `SELECT id, sku, name, weight, length, width, height, is_hazardous, un_number FROM products ${whereSql} ORDER BY name ${limitSql} ${offsetSql}`;
  const rows = await sql.query(selectSql);

  let processed = 0, updated = 0;
  for (const p of rows) {
    processed++;
    try {
      const res = await linkProduct(sql, p, hmtMap, dryRun);
      if (res.updated) updated++;
      console.log(`✅ ${p.sku || p.id} -> Class ${res.class}${res.updated ? ' (linked)' : ' (no change)'}`);
    } catch (e) {
      console.error(`❌ Failed to link ${p.sku || p.id}:`, e?.message || e);
    }
  }
  console.log(`\nDone. Processed: ${processed}, linked/updated: ${updated}${dryRun ? ' [dry-run]' : ''}`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

