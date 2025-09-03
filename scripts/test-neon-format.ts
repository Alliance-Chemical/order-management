#!/usr/bin/env tsx

import { getRawSql } from '../lib/db/neon';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
  const sql = getRawSql();
  const result = await sql`SELECT 1 as test, 2 as value LIMIT 1`;
  console.log('Type:', typeof result);
  console.log('IsArray:', Array.isArray(result));
  console.log('Result:', result);
  
  // Test actual RAG query
  const ragResult = await sql`
    SELECT id, source, text
    FROM rag.documents
    LIMIT 2
  `;
  console.log('\nRAG Result Type:', typeof ragResult);
  console.log('RAG IsArray:', Array.isArray(ragResult));
  console.log('RAG Result:', ragResult);
}

test().catch(console.error);