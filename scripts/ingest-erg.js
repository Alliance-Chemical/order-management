// Extract UN -> ERG Guide mapping from ERG2024 PDF
// Requires: npm i pdf-parse
const fs = require('fs');
const path = require('path');

async function main() {
  const pdfPath = path.join(process.cwd(), 'ERG2024-Eng-Web-a.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('ERG PDF not found:', pdfPath);
    process.exit(1);
  }
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    console.error('Please install pdf-parse: npm i pdf-parse');
    process.exit(1);
  }
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;

  // Heuristic: find lines containing UN numbers and guide numbers.
  // Common patterns in ERG Index: "UN 2031 ... GUIDE 157" or "2031 ... 157" preceded by GUIDE label.
  const lines = text.split(/\r?\n/);
  const mapping = {};
  const re1 = /UN\s*(\d{3,4}).*?GUIDE\s*(\d{3})/i;
  const re2 = /UN\s*(\d{3,4})\b.*?(\d{3})\b/; // fallback
  for (const line of lines) {
    let m = re1.exec(line);
    if (!m) m = re2.exec(line);
    if (m) {
      const un = `UN${m[1]}`;
      const guide = m[2];
      if (/^\d{3}$/.test(guide)) mapping[un] = guide;
    }
  }

  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'erg-index.json');
  fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf8');
  console.log(`ERG mappings: ${Object.keys(mapping).length} UN entries -> ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

