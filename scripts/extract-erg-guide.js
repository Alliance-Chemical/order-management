#!/usr/bin/env node

/**
 * Extract Emergency Response Guide data from ERG 2024 PDF
 * Creates structured data for UN numbers, guide pages, and emergency procedures
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// ERG Guide structure patterns
const GUIDE_PATTERNS = {
  unNumber: /UN\s*(\d{4})/g,
  guidePage: /GUIDE\s*(\d{3})/gi,
  hazardClass: /Class\s*([0-9.]+)/gi,
  packingGroup: /PG\s*([I]{1,3})/g,
  
  // Emergency response sections
  potentialHazards: /POTENTIAL HAZARDS([\s\S]*?)(?=PUBLIC SAFETY|EMERGENCY RESPONSE|$)/i,
  publicSafety: /PUBLIC SAFETY([\s\S]*?)(?=EMERGENCY RESPONSE|POTENTIAL HAZARDS|$)/i,
  emergencyResponse: /EMERGENCY RESPONSE([\s\S]*?)(?=POTENTIAL HAZARDS|PUBLIC SAFETY|$)/i,
  
  // Specific subsections
  fire: /FIRE([\s\S]*?)(?=SPILL|FIRST AID|PUBLIC SAFETY|$)/i,
  spillOrLeak: /SPILL OR LEAK([\s\S]*?)(?=FIRE|FIRST AID|PUBLIC SAFETY|$)/i,
  firstAid: /FIRST AID([\s\S]*?)(?=FIRE|SPILL|PUBLIC SAFETY|$)/i,
  
  // Isolation distances
  initialIsolation: /Initial isolation.*?(\d+)\s*(?:meters|feet)/gi,
  protectiveDistance: /Protective action distance.*?(\d+)\s*(?:meters|feet)/gi,
};

// Parse guide pages from PDF
async function extractGuidesFromPDF(pdfPath) {
  console.log('Reading ERG PDF...');
  const dataBuffer = fs.readFileSync(pdfPath);
  
  console.log('Parsing PDF content...');
  const pdfData = await pdf(dataBuffer, {
    // Options for better text extraction
    max: 0, // Parse all pages
    version: 'v2.0.550'
  });
  
  console.log(`Parsed ${pdfData.numpages} pages`);
  
  // Split content by pages or guides
  const guides = [];
  const pages = pdfData.text.split(/\f/); // Form feed character typically separates pages
  
  let currentGuide = null;
  let unNumberMap = {};
  
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    
    // Check if this is a guide page
    const guideMatch = /GUIDE\s*(\d{3})/i.exec(pageText);
    if (guideMatch) {
      const guideNumber = guideMatch[1];
      
      // Extract guide content
      currentGuide = {
        guideNumber,
        pageNumber: i + 1,
        title: extractGuideTitle(pageText),
        substances: [],
        potentialHazards: extractSection(pageText, GUIDE_PATTERNS.potentialHazards),
        publicSafety: extractSection(pageText, GUIDE_PATTERNS.publicSafety),
        emergencyResponse: extractSection(pageText, GUIDE_PATTERNS.emergencyResponse),
        fire: extractSection(pageText, GUIDE_PATTERNS.fire),
        spillOrLeak: extractSection(pageText, GUIDE_PATTERNS.spillOrLeak),
        firstAid: extractSection(pageText, GUIDE_PATTERNS.firstAid),
        isolationDistances: extractIsolationDistances(pageText),
        fullText: pageText
      };
      
      guides.push(currentGuide);
    }
    
    // Extract UN number mappings (usually in index sections)
    const unMatches = [...pageText.matchAll(/UN\s*(\d{4})[\s\S]{0,50}GUIDE\s*(\d{3})/gi)];
    for (const match of unMatches) {
      const unNumber = `UN${match[1]}`;
      const guideNum = match[2];
      
      if (!unNumberMap[unNumber]) {
        unNumberMap[unNumber] = {
          unNumber,
          guideNumber: guideNum,
          names: []
        };
      }
      
      // Try to extract substance name
      const nameMatch = new RegExp(`UN\\s*${match[1]}\\s+([A-Z][A-Z0-9\\s,\\-]+)`, 'i').exec(pageText);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name && !unNumberMap[unNumber].names.includes(name)) {
          unNumberMap[unNumber].names.push(name);
        }
      }
    }
  }
  
  // Link UN numbers to guides
  for (const [unNumber, data] of Object.entries(unNumberMap)) {
    const guide = guides.find(g => g.guideNumber === data.guideNumber);
    if (guide) {
      guide.substances.push({
        unNumber,
        names: data.names
      });
    }
  }
  
  return { guides, unNumberMap };
}

// Extract guide title
function extractGuideTitle(text) {
  const titleMatch = /GUIDE\s*\d{3}\s*[-–]\s*([^\n]+)/i.exec(text);
  return titleMatch ? titleMatch[1].trim() : '';
}

// Extract a section using pattern
function extractSection(text, pattern) {
  const match = pattern.exec(text);
  if (!match || !match[1]) return '';
  
  // Clean up the extracted text
  return match[1]
    .replace(/\s+/g, ' ')
    .replace(/•/g, '\n•')
    .trim();
}

// Extract isolation distances
function extractIsolationDistances(text) {
  const distances = {
    small: { initial: null, protective: null },
    large: { initial: null, protective: null }
  };
  
  // Look for table of initial isolation and protective action distances
  const smallSpillMatch = /SMALL SPILLS[\s\S]{0,200}?(\d+)\s*(?:meters|m)[\s\S]{0,100}?(\d+)\s*(?:meters|m)/i.exec(text);
  const largeSpillMatch = /LARGE SPILLS[\s\S]{0,200}?(\d+)\s*(?:meters|m)[\s\S]{0,100}?(\d+)\s*(?:meters|m)/i.exec(text);
  
  if (smallSpillMatch) {
    distances.small.initial = parseInt(smallSpillMatch[1]);
    distances.small.protective = parseInt(smallSpillMatch[2]);
  }
  
  if (largeSpillMatch) {
    distances.large.initial = parseInt(largeSpillMatch[1]);
    distances.large.protective = parseInt(largeSpillMatch[2]);
  }
  
  return distances;
}

// Create searchable index entries
function createIndexEntries(guides, unNumberMap) {
  const entries = [];
  
  // Create entries for each guide
  for (const guide of guides) {
    // Main guide entry
    entries.push({
      id: `erg-guide-${guide.guideNumber}`,
      type: 'erg_guide',
      guideNumber: guide.guideNumber,
      title: guide.title,
      text: [
        `Emergency Response Guide ${guide.guideNumber}: ${guide.title}`,
        guide.potentialHazards,
        guide.publicSafety,
        guide.fire,
        guide.spillOrLeak,
        guide.firstAid
      ].filter(Boolean).join(' '),
      metadata: {
        source: 'ERG2024',
        guideNumber: guide.guideNumber,
        substances: guide.substances,
        isolationDistances: guide.isolationDistances
      }
    });
    
    // Create entries for each UN number
    for (const substance of guide.substances) {
      entries.push({
        id: `erg-un-${substance.unNumber}`,
        type: 'erg_un_mapping',
        unNumber: substance.unNumber,
        text: `${substance.unNumber} ${substance.names.join(', ')} - Use Emergency Response Guide ${guide.guideNumber}: ${guide.title}`,
        metadata: {
          source: 'ERG2024',
          unNumber: substance.unNumber,
          names: substance.names,
          guideNumber: guide.guideNumber,
          guideTitle: guide.title
        }
      });
    }
  }
  
  return entries;
}

// Main function
async function main() {
  const root = process.cwd();
  const ergPath = path.join(root, 'ERG2024-Eng-Web-a.pdf');
  
  if (!fs.existsSync(ergPath)) {
    console.error(`ERG PDF not found at ${ergPath}`);
    console.error('Please ensure ERG2024-Eng-Web-a.pdf is in the project root');
    process.exit(1);
  }
  
  try {
    // Extract guides from PDF
    const { guides, unNumberMap } = await extractGuidesFromPDF(ergPath);
    
    console.log(`\nExtracted ${guides.length} emergency response guides`);
    console.log(`Mapped ${Object.keys(unNumberMap).length} UN numbers`);
    
    // Create index entries
    const indexEntries = createIndexEntries(guides, unNumberMap);
    console.log(`Created ${indexEntries.length} index entries`);
    
    // Prepare output
    const output = {
      metadata: {
        source: 'Emergency Response Guidebook 2024',
        extractedAt: new Date().toISOString(),
        stats: {
          totalGuides: guides.length,
          totalUNNumbers: Object.keys(unNumberMap).length,
          totalIndexEntries: indexEntries.length
        }
      },
      guides: guides.map(g => ({
        guideNumber: g.guideNumber,
        title: g.title,
        substances: g.substances,
        sections: {
          potentialHazards: g.potentialHazards,
          publicSafety: g.publicSafety,
          fire: g.fire,
          spillOrLeak: g.spillOrLeak,
          firstAid: g.firstAid
        },
        isolationDistances: g.isolationDistances
      })),
      unNumberMap,
      indexEntries
    };
    
    // Save outputs
    const outDir = path.join(root, 'data');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    // Full extract
    const fullPath = path.join(outDir, 'erg-full-extract.json');
    fs.writeFileSync(fullPath, JSON.stringify(output, null, 2), 'utf8');
    
    // Compact version for indexing
    const compactPath = path.join(outDir, 'erg-compact.json');
    fs.writeFileSync(compactPath, JSON.stringify({
      metadata: output.metadata,
      indexEntries
    }), 'utf8');
    
    // UN number lookup table
    const unLookupPath = path.join(outDir, 'erg-un-lookup.json');
    fs.writeFileSync(unLookupPath, JSON.stringify(unNumberMap, null, 2), 'utf8');
    
    console.log('\n=== ERG Extraction Complete ===');
    console.log(`Full extract: ${fullPath}`);
    console.log(`Compact extract: ${compactPath}`);
    console.log(`UN lookup table: ${unLookupPath}`);
    console.log(`\nFile sizes:`);
    console.log(`  Full: ${(fs.statSync(fullPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Compact: ${(fs.statSync(compactPath).size / 1024).toFixed(2)} KB`);
    console.log(`  UN Lookup: ${(fs.statSync(unLookupPath).size / 1024).toFixed(2)} KB`);
    
    // Show sample entries
    console.log('\nSample guide:');
    if (guides[0]) {
      console.log(`  Guide ${guides[0].guideNumber}: ${guides[0].title}`);
      console.log(`  Substances: ${guides[0].substances.slice(0, 3).map(s => s.unNumber).join(', ')}...`);
    }
    
    console.log('\nSample UN mapping:');
    const sampleUN = Object.keys(unNumberMap)[0];
    if (sampleUN) {
      console.log(`  ${sampleUN}: ${unNumberMap[sampleUN].names.join(', ')}`);
      console.log(`  → Guide ${unNumberMap[sampleUN].guideNumber}`);
    }
    
  } catch (error) {
    console.error('Error extracting ERG data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractGuidesFromPDF, createIndexEntries };