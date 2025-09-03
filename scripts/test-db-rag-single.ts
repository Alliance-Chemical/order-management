#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { classifyWithDatabaseRAG } from '../lib/services/rag/database-rag';

dotenv.config({ path: '.env.local' });

async function test() {
  console.log('Testing Database RAG for Sulfuric Acid 98%...\n');
  
  try {
    const result = await classifyWithDatabaseRAG('SA-98', 'Sulfuric Acid 98%');
    
    console.log('Result:', {
      un_number: result.un_number,
      hazard_class: result.hazard_class,
      packing_group: result.packing_group,
      confidence: result.confidence,
      source: result.source,
      explanation: result.explanation
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

test().catch(console.error);