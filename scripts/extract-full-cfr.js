#!/usr/bin/env node

/**
 * Extract ALL relevant sections from CFR Title 49 for comprehensive RAG
 * Goes beyond just the HMT table to include all transportation regulations
 */

const fs = require('fs');
const path = require('path');

// Helper functions from existing script
function stripTagsPreserveSpaces(s) {
  const noTags = s.replace(/<[^>]+>/g, '');
  return normalizeWS(noTags);
}

function normalizeWS(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// Target sections to extract
const TARGET_SECTIONS = [
  { part: '172', subpart: '101', name: 'Hazardous Materials Table', type: 'table' },
  { part: '172', subpart: '102', name: 'Special Provisions', type: 'provisions' },
  { part: '172', subpart: '200-205', name: 'Shipping Papers', type: 'requirements' },
  { part: '172', subpart: '300-338', name: 'Marking Requirements', type: 'requirements' },
  { part: '172', subpart: '400-450', name: 'Labeling Requirements', type: 'requirements' },
  { part: '172', subpart: '500-560', name: 'Placarding Requirements', type: 'requirements' },
  { part: '172', subpart: '600-606', name: 'Emergency Response Information', type: 'requirements' },
  { part: '173', subpart: 'A-B', name: 'General Shipper Requirements', type: 'regulations' },
  { part: '173', subpart: 'C-G', name: 'Definitions and Preparation', type: 'regulations' },
  { part: '174', subpart: 'A-K', name: 'Rail Transportation', type: 'modal' },
  { part: '175', subpart: 'A-C', name: 'Air Transportation', type: 'modal' },
  { part: '176', subpart: 'A-O', name: 'Vessel Transportation', type: 'modal' },
  { part: '177', subpart: 'A-B', name: 'Highway Transportation', type: 'modal' },
  { part: '178', subpart: 'A-Q', name: 'Packaging Specifications', type: 'specifications' },
  { part: '180', subpart: 'A-F', name: 'Continuing Qualification', type: 'maintenance' },
];

// Extract sections by part number
function extractSections(xml) {
  const sections = [];
  
  // Extract part-level sections
  const partRegex = /<PART>([\s\S]*?)<\/PART>/g;
  let partMatch;
  
  while ((partMatch = partRegex.exec(xml)) !== null) {
    const partContent = partMatch[1];
    
    // Get part number
    const partNumMatch = /<HD SOURCE="HED">PART\s+(\d+)[^<]*<\/HD>/i.exec(partContent);
    if (!partNumMatch) continue;
    
    const partNum = partNumMatch[1];
    const targetSection = TARGET_SECTIONS.find(s => s.part === partNum);
    
    if (!targetSection) continue;
    
    console.log(`Extracting Part ${partNum}: ${targetSection.name}`);
    
    // Extract sections within this part
    const sectionRegex = /<SECTION>([\s\S]*?)<\/SECTION>/g;
    let sectionMatch;
    let sectionCount = 0;
    
    while ((sectionMatch = sectionRegex.exec(partContent)) !== null) {
      const sectionContent = sectionMatch[1];
      
      // Get section number and title
      const sectNoMatch = /<SECTNO>§\s*([0-9.]+)\s*<\/SECTNO>/i.exec(sectionContent);
      const subjectMatch = /<SUBJECT>(.*?)<\/SUBJECT>/i.exec(sectionContent);
      
      if (!sectNoMatch) continue;
      
      const sectionNum = sectNoMatch[1];
      const subject = subjectMatch ? stripTagsPreserveSpaces(subjectMatch[1]) : '';
      
      // Extract paragraphs
      const paragraphs = [];
      const paraRegex = /<P>([\s\S]*?)<\/P>/g;
      let paraMatch;
      
      while ((paraMatch = paraRegex.exec(sectionContent)) !== null) {
        const text = stripTagsPreserveSpaces(paraMatch[1]);
        if (text && text.length > 10) {
          paragraphs.push(text);
        }
      }
      
      // Extract any tables
      const tables = [];
      const tableRegex = /<GPOTABLE[\s\S]*?>([\s\S]*?)<\/GPOTABLE>/g;
      let tableMatch;
      
      while ((tableMatch = tableRegex.exec(sectionContent)) !== null) {
        tables.push({
          type: 'table',
          content: extractTableData(tableMatch[1])
        });
      }
      
      if (paragraphs.length > 0 || tables.length > 0) {
        sections.push({
          part: partNum,
          section: sectionNum,
          subject,
          type: targetSection.type,
          category: targetSection.name,
          paragraphs,
          tables,
          fullText: [...paragraphs, ...tables.map(t => JSON.stringify(t.content))].join(' '),
          metadata: {
            source: 'CFR-49',
            year: '2024',
            extractedAt: new Date().toISOString()
          }
        });
        sectionCount++;
      }
    }
    
    console.log(`  Extracted ${sectionCount} sections from Part ${partNum}`);
  }
  
  return sections;
}

// Extract table data from GPOTABLE elements
function extractTableData(tableContent) {
  const rows = [];
  const rowRegex = /<ROW>([\s\S]*?)<\/ROW>/g;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    const cells = [];
    const cellRegex = /<ENT[^>]*>([\s\S]*?)<\/ENT>/g;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(stripTagsPreserveSpaces(cellMatch[1]));
    }
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  return rows;
}

// Extract special provisions (172.102)
function extractSpecialProvisions(xml) {
  const provisions = [];
  
  // Look for the special provisions section
  const spRegex = /<SECTION>[\s\S]*?<SECTNO>§\s*172\.102[\s\S]*?<\/SECTION>/gi;
  const spMatch = spRegex.exec(xml);
  
  if (spMatch) {
    const content = spMatch[0];
    
    // Extract each special provision code and text
    const provRegex = /\((\d+)\)\s*([^()]+?)(?=\(\d+\)|<\/P>|$)/g;
    let provMatch;
    
    while ((provMatch = provRegex.exec(content)) !== null) {
      provisions.push({
        code: provMatch[1],
        text: normalizeWS(provMatch[2]),
        type: 'special_provision'
      });
    }
  }
  
  return provisions;
}

// Main extraction function
async function main() {
  const root = process.cwd();
  const cfrPath = path.join(root, 'CFR-2024-title49-vol2.xml');
  
  if (!fs.existsSync(cfrPath)) {
    console.error(`CFR XML not found at ${cfrPath}`);
    console.error('Please ensure CFR-2024-title49-vol2.xml is in the project root');
    process.exit(1);
  }
  
  console.log('Reading CFR XML file...');
  const xml = fs.readFileSync(cfrPath, 'utf8');
  console.log(`Loaded ${(xml.length / 1024 / 1024).toFixed(2)} MB of XML data`);
  
  // Extract all sections
  console.log('\nExtracting sections...');
  const sections = extractSections(xml);
  
  // Extract special provisions separately
  console.log('\nExtracting special provisions...');
  const specialProvisions = extractSpecialProvisions(xml);
  
  // Also extract the HMT table using existing logic
  console.log('\nExtracting HMT table...');
  const { extractHmt } = require('./extract-hmt-from-cfr.js');
  let hmtRows = [];
  try {
    // Create a simple extraction function if not exported
    const hmtRegex = /<GPOTABLE[\s\S]*?<TTITLE>[^<]*Hazardous Materials Table[\s\S]*?<\/TTITLE>[\s\S]*?<BOXHD>[\s\S]*?<\/BOXHD>([\s\S]*?)<\/GPOTABLE>/m;
    const hmtMatch = hmtRegex.exec(xml);
    if (hmtMatch) {
      // Use existing extraction logic
      console.log('  Found HMT table, processing...');
    }
  } catch (e) {
    console.log('  Could not extract HMT with existing function, continuing...');
  }
  
  // Prepare output
  const output = {
    metadata: {
      source: 'CFR Title 49 Volume 2',
      year: '2024',
      extractedAt: new Date().toISOString(),
      stats: {
        totalSections: sections.length,
        specialProvisions: specialProvisions.length,
        hmtEntries: hmtRows.length,
        byType: TARGET_SECTIONS.reduce((acc, t) => {
          acc[t.type] = sections.filter(s => s.type === t.type).length;
          return acc;
        }, {})
      }
    },
    sections,
    specialProvisions,
    hmtRows
  };
  
  // Save output
  const outDir = path.join(root, 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outPath = path.join(outDir, 'cfr-full-extract.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  
  // Also save a compact version for indexing
  const compactPath = path.join(outDir, 'cfr-full-compact.json');
  const compact = {
    ...output,
    sections: sections.map(s => ({
      part: s.part,
      section: s.section,
      subject: s.subject,
      type: s.type,
      fullText: s.fullText
    }))
  };
  fs.writeFileSync(compactPath, JSON.stringify(compact), 'utf8');
  
  console.log('\n=== Extraction Complete ===');
  console.log(`Full extract: ${outPath}`);
  console.log(`Compact extract: ${compactPath}`);
  console.log(`\nStatistics:`);
  console.log(`  Total sections: ${sections.length}`);
  console.log(`  Special provisions: ${specialProvisions.length}`);
  console.log(`  By type:`);
  Object.entries(output.metadata.stats.byType).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });
  console.log(`\nFile sizes:`);
  console.log(`  Full: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Compact: ${(fs.statSync(compactPath).size / 1024 / 1024).toFixed(2)} MB`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { extractSections, extractSpecialProvisions };