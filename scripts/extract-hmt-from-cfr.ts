import fs from 'fs';
import path from 'path';

type HmtRow = {
  symbols: string | null;
  name_full: string;
  base_name: string;
  qualifier: string | null;
  class_or_division: string | null;
  id_number: string | null;
  packing_group: string | null;
  label_codes: string[];
  special_provisions: string[];
  packaging: {
    exceptions: string | null;
    non_bulk: string | null;
    bulk: string | null;
  };
  quantity_limitations: {
    passenger_aircraft_rail: string | null;
    cargo_aircraft_only: string | null;
  };
  vessel_stowage: {
    location: string | null;
    other: string | null;
  };
};

function readFileUtf8(p: string) {
  return fs.readFileSync(p, 'utf8');
}

function stripTagsPreserveSpaces(s: string) {
  // Replace tags with nothing, collapse whitespace
  const noTags = s.replace(/<[^>]+>/g, '');
  return normalizeWS(noTags);
}

function normalizeWS(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function parseNameCell(raw: string) {
  // raw is inner XML of the name cell, may include italic qualifiers using <E T="03"> ... </E>
  // Extract base (roman) text outside of italic tags, and qualifier from italic tags combined.
  const qualifierParts: string[] = [];
  const italicRe = /<E\s+[^>]*?T=\"03\"[^>]*>([\s\S]*?)<\/E>/g;
  let m: RegExpExecArray | null;
  while ((m = italicRe.exec(raw)) !== null) {
    qualifierParts.push(stripTagsPreserveSpaces(m[1]));
  }
  // Remove italic tags to get roman-visible text, then strip tags
  const romanOnly = stripTagsPreserveSpaces(raw.replace(italicRe, ' '));
  const base = romanOnly; // This will include the core PSN (e.g., "Nitric acid")
  const qualifier = qualifierParts.length ? qualifierParts.join('; ') : null;
  const name_full = qualifier ? normalizeWS(`${base} ${qualifier}`) : base;
  return { base_name: base, qualifier, name_full };
}

function splitCsvCell(cell: string | null): string[] {
  if (!cell) return [];
  return cell
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractHmt(xml: string): HmtRow[] {
  // Find the GPOTABLE that has the TTITLE containing "Hazardous Materials Table"
  const ttitleIdx = xml.indexOf('<TTITLE>§');
  // There may be multiple TTITLEs; use a more robust search
  const hmtTitleRe = /<GPOTABLE[\s\S]*?<TTITLE>[^<]*Hazardous Materials Table[\s\S]*?<\/TTITLE>[\s\S]*?<BOXHD>[\s\S]*?<\/BOXHD>([\s\S]*?)<\/GPOTABLE>/m;
  const match = hmtTitleRe.exec(xml);
  if (!match) {
    throw new Error('Could not locate §172.101 Hazardous Materials Table in XML');
  }
  const tableInner = match[1];

  const rows: HmtRow[] = [];
  const rowRe = /<ROW>([\s\S]*?)<\/ROW>/g;
  let r: RegExpExecArray | null;
  while ((r = rowRe.exec(tableInner)) !== null) {
    const rowXml = r[1];
    const entRe = /<ENT(?:\s+[^>]*)?>([\s\S]*?)<\/ENT>/g;
    const cells: string[] = [];
    let e: RegExpExecArray | null;
    while ((e = entRe.exec(rowXml)) !== null) {
      // Keep raw cell XML for name parsing; others we will strip tags
      cells.push(e[1]);
    }
    if (cells.length === 0) continue;
    // Expect 14 columns: Symbols, Name, Class/Division, ID, PG, Labels, Special, Exceptions, Non-bulk, Bulk, Pax, Cargo, Vessel Loc, Vessel Other
    // Some rows might be headers or irregular; skip if not at least 10 cols
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

  // Filter rows that don't have an ID number resembling UN/NA
  const filtered = rows.filter((row) => row.id_number && /^(UN|NA)\d{3,4}$/.test(row.id_number));
  return filtered;
}

function main() {
  const root = process.cwd();
  const cfrPath = path.join(root, 'CFR-2024-title49-vol2.xml');
  if (!fs.existsSync(cfrPath)) {
    console.error(`CFR XML not found at ${cfrPath}`);
    process.exit(1);
  }
  const xml = readFileUtf8(cfrPath);
  const rows = extractHmt(xml);
  const outDir = path.join(root, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'hmt-172101.json');
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`Extracted ${rows.length} HMT rows -> ${outPath}`);

  // Quick demo: show Nitric acid and Sulfuric acid matches
  const demo = rows.filter((r) => /nitric acid|sulfuric acid/i.test(r.base_name)).slice(0, 8);
  console.log(JSON.stringify(demo, null, 2));
}

if (require.main === module) {
  main();
}

