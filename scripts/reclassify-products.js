// Reclassify all products in the DB and update if different
// Env controls:
// - DRY_RUN=1            -> do not write, just log
// - ONLY_MISSING=1       -> process only products with NULL UN
// - PRODUCT_LIMIT=1000   -> limit number of products
// - PRODUCT_OFFSET=0     -> offset for pagination

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function classify(name, sku) {
  const { classifyWithRAG } = require('../lib/hazmat/classify.js');
  return await classifyWithRAG(sku, name);
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const limit = parseInt(process.env.PRODUCT_LIMIT || '0', 10) || null;
  const offset = parseInt(process.env.PRODUCT_OFFSET || '0', 10) || 0;
  const onlyMissing = process.env.ONLY_MISSING === '1' || process.env.ONLY_MISSING === 'true';
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  console.log(`🔁 Reclassifying products${onlyMissing ? ' (only missing UN)' : ''}${limit ? `, limit ${limit}` : ''}${offset ? `, offset ${offset}` : ''}${dryRun ? ' [DRY RUN]' : ''}`);

  const whereClauses = [];
  if (onlyMissing) whereClauses.push('un_number IS NULL');
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const limitSql = limit ? `LIMIT ${limit}` : '';
  const offsetSql = offset ? `OFFSET ${offset}` : '';
  const selectSql = `SELECT id, sku, name, is_hazardous, un_number FROM products ${whereSql} ORDER BY name ${limitSql} ${offsetSql}`;
  const rows = await sql.query(selectSql);

  let processed = 0, updated = 0, cleared = 0;
  for (const p of rows) {
    processed++;
    const sku = p.sku;
    const name = p.name || sku || `product-${p.id}`;

    try {
      const cls = await classify(name, sku);
      const newIsHaz = Boolean(cls && cls.un_number && cls.hazard_class);
      const newUN = cls?.un_number || null;
      const oldIsHaz = !!p.is_hazardous;
      const oldUN = p.un_number || null;

      // Decide update
      if (!newUN && !newIsHaz) {
        // Non-haz outcome: clear existing hazard fields if set
        if (oldUN !== null || oldIsHaz !== false) {
          if (!dryRun) {
            await sql`UPDATE products SET is_hazardous = false, un_number = NULL, updated_at = NOW() WHERE id = ${p.id}`;
          }
          cleared++;
          console.log(`✅ ${sku || p.id} -> NON-HAZ (cleared UN)`);
        }
        continue;
      }

      // Hazardous outcome: update if changed
      if (newUN !== oldUN || newIsHaz !== oldIsHaz) {
        if (!dryRun) {
          await sql`UPDATE products SET is_hazardous = ${newIsHaz}, un_number = ${newUN}, updated_at = NOW() WHERE id = ${p.id}`;
        }
        updated++;
        console.log(`✅ ${sku || p.id} -> ${newUN} (haz=${newIsHaz})`);
      }
    } catch (e) {
      console.error(`❌ Failed to classify ${sku || p.id} (${name}):`, e?.message || e);
    }
  }

  console.log(`\nDone. Processed: ${processed}, updated: ${updated}, cleared: ${cleared}${dryRun ? ' [dry-run]' : ''}`);
  // Ensure the process exits cleanly even if any handles are left open by HTTP/fetch
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
