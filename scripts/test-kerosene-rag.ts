import { getRawSql } from '../lib/db/neon';

async function testKeroseneRAG() {
  const sql = getRawSql();
  
  console.log('Testing kerosene RAG classification...\n');
  
  // Search for kerosene in the database
  const results = await sql`
    SELECT 
      id,
      source,
      text,
      metadata
    FROM rag.documents
    WHERE 
      text ILIKE '%kerosene%'
      OR metadata::text ILIKE '%kerosene%'
      OR text ILIKE '%UN1223%'
    LIMIT 10
  `;
  
  console.log(`Found ${results.length} kerosene-related documents:\n`);
  
  results.forEach((r: any, i: number) => {
    console.log(`Document ${i + 1}:`);
    console.log('  Source:', r.source);
    console.log('  Text:', r.text?.substring(0, 150));
    console.log('  UN:', r.metadata?.unNumber);
    console.log('  Class:', r.metadata?.hazardClass);
    console.log('  PG:', r.metadata?.packingGroup);
    console.log('  Name:', r.metadata?.baseName || r.metadata?.name);
    console.log('---');
  });
  
  // Now search for what's actually matching
  console.log('\nSearching for "petroleum ether" to see what matched:\n');
  
  const petroleum = await sql`
    SELECT 
      id,
      source,
      text,
      metadata
    FROM rag.documents
    WHERE 
      text ILIKE '%petroleum ether%'
    LIMIT 5
  `;
  
  petroleum.forEach((r: any, i: number) => {
    console.log(`Petroleum Document ${i + 1}:`);
    console.log('  Source:', r.source);
    console.log('  Text:', r.text?.substring(0, 150));
    console.log('  UN:', r.metadata?.unNumber);
    console.log('  Class:', r.metadata?.hazardClass);
    console.log('  PG:', r.metadata?.packingGroup);
    console.log('  Name:', r.metadata?.baseName || r.metadata?.name);
    console.log('---');
  });
  
  process.exit(0);
}

testKeroseneRAG().catch(console.error);