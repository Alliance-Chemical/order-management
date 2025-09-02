const fs = require('fs');
const path = require('path');

function stripTagsPreserveSpaces(s) {
  const noTags = s.replace(/<[^>]+>/g, '');
  return normalizeWS(noTags);
}

function normalizeWS(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function parseNameCell(raw) {
  const qualifierParts = [];
  const italicRe = /<E\s+[^>]*?T=\"03\"[^>]*>([\s\S]*?)<\/E>/g;
  let m;
  while ((m = italicRe.exec(raw)) !== null) {
    qualifierParts.push(stripTagsPreserveSpaces(m[1]));
  }
  const romanOnly = stripTagsPreserveSpaces(raw.replace(italicRe, ' '));
  const base = romanOnly;
  const qualifier = qualifierParts.length ? qualifierParts.join('; ') : null;
  const name_full = qualifier ? normalizeWS(`${base} ${qualifier}`) : base;
  return { base_name: base, qualifier, name_full };
}

function splitCsvCell(cell) {
  if (!cell) return [];
  return cell
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractHmt(xml) {
  const hmtTitleRe = /<GPOTABLE[\s\S]*?<TTITLE>[^<]*Hazardous Materials Table[\s\S]*?<\/TTITLE>[\s\S]*?<BOXHD>[\s\S]*?<\/BOXHD>([\s\S]*?)<\/GPOTABLE>/m;
  const match = hmtTitleRe.exec(xml);
  if (!match) {
    throw new Error('Could not locate §172.101 Hazardous Materials Table in XML');
  }
  const tableInner = match[1];

  const rows = [];
  const rowRe = /<ROW>([\s\S]*?)<\/ROW>/g;
  let r;
  while ((r = rowRe.exec(tableInner)) !== null) {
    const rowXml = r[1];
    const entRe = /<ENT(?:\s+[^>]*)?>([\s\S]*?)<\/ENT>/g;
    const cells = [];
    let e;
    while ((e = entRe.exec(rowXml)) !== null) {
      cells.push(e[1]);
    }
    if (cells.length < 10) continue;
    const symbols = normalizeWS(stripTagsPreserveSpaces(cells[0])) || null;
    const { base_name, qualifier, name_full } = parseNameCell(cells[1]);
    const class_or_division = stripTagsPreserveSpaces(cells[2]) || null;
    const id_number = stripTagsPreserveSpaces(cells[3]) || null;
    const packing_group = stripTagsPreserveSpaces(cells[4]) || null;
    const label_codes = splitCsvCell(stripTagsPreserveSpaces(cells[5]) || '');
    const special_provisions = splitCsvCell(stripTagsPreserveSpaces(cells[6]) || '');
    const exceptions = cells[7] !== undefined ? stripTagsPreserveSpaces(cells[7]) || null : null;
    const non_bulk = cells[8] !== undefined ? stripTagsPreserveSpaces(cells[8]) || null : null;
    const bulk = cells[9] !== undefined ? stripTagsPreserveSpaces(cells[9]) || null : null;
    const passenger_aircraft_rail = cells[10] !== undefined ? stripTagsPreserveSpaces(cells[10]) || null : null;
    const cargo_aircraft_only = cells[11] !== undefined ? stripTagsPreserveSpaces(cells[11]) || null : null;
    const vessel_location = cells[12] !== undefined ? stripTagsPreserveSpaces(cells[12]) || null : null;
    const vessel_other = cells[13] !== undefined ? stripTagsPreserveSpaces(cells[13]) || null : null;
    rows.push({
      symbols,
      name_full,
      base_name,
      qualifier,
      class_or_division,
      id_number,
      packing_group,
      label_codes,
      special_provisions,
      packaging: {
        exceptions,
        non_bulk,
        bulk,
      },
      quantity_limitations: {
        passenger_aircraft_rail,
        cargo_aircraft_only,
      },
      vessel_stowage: {
        location: vessel_location,
        other: vessel_other,
      },
    });
  }
  return rows.filter((row) => row.id_number && /^(UN|NA)\d{3,4}$/.test(row.id_number));
}

function main() {
  const root = process.cwd();
  const cfrPath = path.join(root, 'CFR-2024-title49-vol2.xml');
  if (!fs.existsSync(cfrPath)) {
    console.error(`CFR XML not found at ${cfrPath}`);
    process.exit(1);
  }
  const xml = fs.readFileSync(cfrPath, 'utf8');
  const rows = extractHmt(xml);
  const outDir = path.join(root, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'hmt-172101.json');
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`Extracted ${rows.length} HMT rows -> ${outPath}`);
  const demo = rows.filter((r) => /nitric acid|sulfuric acid/i.test(r.base_name)).slice(0, 8);
  console.log(JSON.stringify(demo, null, 2));
}

if (require.main === module) {
  main();
}

