const fs = require('fs');
const path = require('path');
const { chunkText } = require('../lib/rag/chunk');
const { embed } = require('../lib/rag/embeddings');
const { saveIndex } = require('../lib/rag/vectorStore');

function hmtRowToText(row) {
  const parts = [];
  parts.push(`${row.base_name}`);
  if (row.qualifier) parts.push(`${row.qualifier}`);
  parts.push(`ID ${row.id_number}`);
  if (row.class_or_division) parts.push(`Class ${row.class_or_division}`);
  if (row.packing_group) parts.push(`PG ${row.packing_group}`);
  if (row.label_codes?.length) parts.push(`Labels ${row.label_codes.join(', ')}`);
  if (row.special_provisions?.length) parts.push(`SP ${row.special_provisions.join(', ')}`);
  const pkg = row.packaging || {};
  if (pkg.exceptions || pkg.non_bulk || pkg.bulk) {
    const p = [];
    if (pkg.exceptions) p.push(`Exceptions ${pkg.exceptions}`);
    if (pkg.non_bulk) p.push(`Non-bulk ${pkg.non_bulk}`);
    if (pkg.bulk) p.push(`Bulk ${pkg.bulk}`);
    parts.push(p.join('; '));
  }
  const ql = row.quantity_limitations || {};
  if (ql.passenger_aircraft_rail || ql.cargo_aircraft_only) {
    const p = [];
    if (ql.passenger_aircraft_rail) p.push(`Passenger/Rail ${ql.passenger_aircraft_rail}`);
    if (ql.cargo_aircraft_only) p.push(`Cargo-only ${ql.cargo_aircraft_only}`);
    parts.push(p.join('; '));
  }
  const vs = row.vessel_stowage || {};
  if (vs.location || vs.other) {
    const p = [];
    if (vs.location) p.push(`Vessel ${vs.location}`);
    if (vs.other) p.push(`Vessel other ${vs.other}`);
    parts.push(p.join('; '));
  }
  return parts.join(' — ');
}

async function main() {
  const root = process.cwd();
  const inPath = path.join(root, 'data', 'hmt-172101.json');
  if (!fs.existsSync(inPath)) {
    console.error('Missing data/hmt-172101.json. Run scripts/extract-hmt-from-cfr.js first.');
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const docs = [];
  for (const row of rows) {
    const baseMeta = {
      source: 'CFR-49-172.101',
      id_number: row.id_number,
      base_name: row.base_name,
      qualifier: row.qualifier,
      class: row.class_or_division,
      packing_group: row.packing_group,
      label_codes: row.label_codes || [],
      special_provisions: row.special_provisions || [],
      packaging: row.packaging || {},
      quantity_limitations: row.quantity_limitations || {},
      vessel_stowage: row.vessel_stowage || {},
    };
    const text = hmtRowToText(row);
    const chunks = chunkText(text, { targetTokens: 300, overlapTokens: 30 });
    chunks.forEach((chunk, i) => {
      docs.push({
        id: `${row.id_number}:${row.base_name}:${i}`,
        text: chunk,
        metadata: { ...baseMeta, chunk: i },
      });
    });
  }
  // Use hottest model available (auto), fall back to local-hash without failing
  const embeddings = await embed(docs.map((d) => d.text), { provider: 'auto', dim: 512 });
  const out = {
    schema: 'ac-rag-index@v1',
    dim: 512,
    created_at: new Date().toISOString(),
    docs: docs.map((d, i) => ({ ...d, embedding: embeddings[i] })),
  };
  const outPath = path.join(root, 'data', 'index-hmt-local.json');
  saveIndex(outPath, out);
  console.log(`Built index with ${out.docs.length} chunks -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
