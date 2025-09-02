// Ingest historical shipping Excel to normalized JSON
// Requires: npm i xlsx
const fs = require('fs');
const path = require('path');

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

async function main() {
  const inPath = path.join(process.cwd(), 'Shipping 08_27_2025 (1).xlsx');
  if (!fs.existsSync(inPath)) {
    console.error('Historical Excel not found:', inPath);
    process.exit(1);
  }

  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.error('Please install xlsx: npm i xlsx');
    process.exit(1);
  }

  const wb = XLSX.readFile(inPath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  // Heuristics for column names
  function get(obj, candidates) {
    for (const c of candidates) {
      const k = Object.keys(obj).find((x) => x.toLowerCase() === c.toLowerCase());
      if (k) return obj[k];
    }
    return null;
  }

  const out = [];
  for (const r of rows) {
    const sku = get(r, ['sku', 'SKU', 'Item SKU', 'item_sku']);
    const name = get(r, ['Product Name', 'Description', 'Item Name', 'product_name']);
    const un = get(r, ['UN', 'UN Number', 'UN_Number', 'UN No', 'UN#', 'UNNumber']);
    const notes = get(r, ['Notes', 'Comments', 'Remarks']);
    if (!sku && !name && !un) continue;
    out.push({ sku: sku || null, product_name: name || null, chosen_un: un || null, notes: notes || null, source_row: r });
  }

  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'historical-shipping.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.length} historical rows -> ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

