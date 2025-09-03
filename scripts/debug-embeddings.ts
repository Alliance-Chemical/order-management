#!/usr/bin/env tsx

import { getRawSql } from '../lib/db/neon';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugEmbeddings() {
  const sql = getRawSql();
  
  console.log('🔍 Debugging Embeddings Quality\n');
  console.log('=' .repeat(60));
  
  // Check if embeddings exist and have proper dimensions
  const statsResult = await sql`
    SELECT 
      source,
      COUNT(*) as count,
      COUNT(embedding) as with_embedding,
      AVG(array_length(embedding::real[], 1)) as avg_dimension,
      MIN(array_length(embedding::real[], 1)) as min_dimension,
      MAX(array_length(embedding::real[], 1)) as max_dimension
    FROM rag.documents
    GROUP BY source
    ORDER BY source
  `;
  
  const stats = (statsResult as any).rows || statsResult;
  console.log('\n📊 Embedding Statistics by Source:');
  console.log('-' .repeat(60));
  stats.forEach((s: any) => {
    console.log(`\n${s.source}:`);
    console.log(`  Total docs: ${s.count}`);
    console.log(`  With embeddings: ${s.with_embedding}`);
    console.log(`  Avg dimension: ${s.avg_dimension}`);
    console.log(`  Dimension range: ${s.min_dimension} - ${s.max_dimension}`);
  });
  
  // Check specific products we're testing
  console.log('\n\n📦 Test Product Entries:');
  console.log('-' .repeat(60));
  
  const testProducts = [
    'sulfuric acid 98%',
    'hydrochloric acid 32%',
    'nitric acid 70%',
    'sodium hydroxide 50%'
  ];
  
  for (const product of testProducts) {
    console.log(`\n🧪 Searching for: "${product}"`);
    
    const result = await sql`
      SELECT 
        id, 
        source,
        text,
        metadata,
        embedding IS NOT NULL as has_embedding,
        array_length(embedding::real[], 1) as embedding_dim
      FROM rag.documents
      WHERE 
        text ILIKE ${'%' + product + '%'} OR
        search_vector ILIKE ${'%' + product + '%'}
      LIMIT 5
    `;
    
    const rows = (result as any).rows || result;
    if (rows.length === 0) {
      console.log('  ❌ No entries found!');
    } else {
      rows.forEach((r: any) => {
        console.log(`  ✓ [${r.source}] ${r.text.substring(0, 100)}...`);
        console.log(`    Has embedding: ${r.has_embedding}, Dimension: ${r.embedding_dim}`);
        if (r.metadata?.unNumber) {
          console.log(`    UN: ${r.metadata.unNumber}, Class: ${r.metadata.hazardClass}`);
        }
      });
    }
  }
  
  // Test similarity search directly
  console.log('\n\n🎯 Testing Direct Similarity Search:');
  console.log('-' .repeat(60));
  
  // Generate embedding for test query
  const testQuery = 'sulfuric acid 98%';
  console.log(`\nGenerating embedding for: "${testQuery}"`);
  
  // Check if we can find similar documents
  const similarResult = await sql`
    SELECT 
      text,
      metadata,
      1 - (embedding <=> (
        SELECT embedding 
        FROM rag.documents 
        WHERE text ILIKE '%sulfuric acid%' 
        LIMIT 1
      )) as similarity
    FROM rag.documents
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> (
      SELECT embedding 
      FROM rag.documents 
      WHERE text ILIKE '%sulfuric acid%' 
      LIMIT 1
    )
    LIMIT 5
  `;
  
  const similar = (similarResult as any).rows || similarResult;
  console.log('\nTop 5 similar documents:');
  similar.forEach((s: any, i: number) => {
    console.log(`${i + 1}. [Similarity: ${(s.similarity * 100).toFixed(2)}%] ${s.text.substring(0, 80)}...`);
  });
  
  // Check threshold issue
  console.log('\n\n📈 Similarity Distribution Analysis:');
  console.log('-' .repeat(60));
  
  const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];
  for (const threshold of thresholds) {
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM rag.documents d1, rag.documents d2
      WHERE d1.id != d2.id
      AND d1.embedding IS NOT NULL 
      AND d2.embedding IS NOT NULL
      AND d1.text ILIKE '%sulfuric acid%'
      AND 1 - (d1.embedding <=> d2.embedding) >= ${threshold}
      LIMIT 100
    `;
    
    const count = ((countResult as any).rows || countResult)[0].count;
    console.log(`  Threshold ${threshold}: ${count} matches`);
  }
}

debugEmbeddings().catch(console.error);