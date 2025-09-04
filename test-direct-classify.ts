#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { classifyWithDatabaseRAG } from './lib/services/rag/database-rag';

async function test() {
  console.log('Testing pattern-based classification for UN1219...\n');
  
  // Test 1: Search by chemical name
  const result1 = await classifyWithDatabaseRAG(null, 'Isopropyl Alcohol 99%');
  console.log('Search for "Isopropyl Alcohol 99%":');
  console.log('  UN Number:', result1.un_number);
  console.log('  Name:', result1.proper_shipping_name);
  console.log('  Class:', result1.hazard_class);
  console.log('  PG:', result1.packing_group);
  console.log('  Source:', result1.source);
  console.log('');
  
  // Test 2: Search by UN number (should use pattern)
  const result2 = await classifyWithDatabaseRAG(null, 'UN1219');
  console.log('Search for "UN1219":');
  console.log('  UN Number:', result2.un_number);
  console.log('  Name:', result2.proper_shipping_name);
  console.log('  Class:', result2.hazard_class);
  console.log('  PG:', result2.packing_group);
  console.log('  Source:', result2.source);
}

test().catch(console.error);