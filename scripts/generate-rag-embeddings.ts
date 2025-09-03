#!/usr/bin/env tsx

/**
 * Generate embeddings for all documents in the RAG database
 * Uses OpenAI text-embedding-3-small model (1536 dimensions)
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const db = neon(DATABASE_URL);

// Embedding configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per request
const RATE_LIMIT_DELAY = 500; // ms between batches

async function generateOpenAIEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.map((item: any) => item.embedding);
}

async function generateGoogleEmbeddings(texts: string[]): Promise<number[][]> {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY not set');
  }

  const model = 'text-embedding-004';
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:batchEmbedContents?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map(text => ({
        content: { parts: [{ text }] }
      }))
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.embeddings.map((e: any) => e.values);
}

// Simple character n-gram hashing as fallback
function generateHashingEmbedding(text: string, dim = EMBEDDING_DIM): number[] {
  const vec = new Float32Array(dim);
  const s = ` ${text.toLowerCase()} `;
  const ngram = 3;
  
  for (let i = 0; i < s.length - ngram + 1; i++) {
    const gram = s.slice(i, i + ngram);
    let h = 2166136261; // FNV-1a offset basis
    
    for (let j = 0; j < gram.length; j++) {
      h ^= gram.charCodeAt(j);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  
  return Array.from(vec);
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Try OpenAI first
  if (OPENAI_API_KEY) {
    try {
      return await generateOpenAIEmbeddings(texts);
    } catch (error) {
      console.warn('  ⚠️  OpenAI failed, trying Google...', error);
    }
  }
  
  // Try Google as fallback
  if (GOOGLE_API_KEY) {
    try {
      return await generateGoogleEmbeddings(texts);
    } catch (error) {
      console.warn('  ⚠️  Google failed, using local hashing...', error);
    }
  }
  
  // Fallback to local hashing
  console.warn('  ⚠️  Using local hashing embeddings (less accurate)');
  return texts.map(text => generateHashingEmbedding(text));
}

async function checkEmbeddingCache(textHash: string): Promise<number[] | null> {
  const cached = await db`
    SELECT embedding
    FROM rag.embedding_cache
    WHERE text_hash = ${textHash}
    LIMIT 1
  `;
  
  if (cached.length > 0) {
    // Update hit count and last accessed
    await db`
      UPDATE rag.embedding_cache
      SET 
        hit_count = hit_count + 1,
        last_accessed_at = NOW()
      WHERE text_hash = ${textHash}
    `;
    
    return cached[0].embedding;
  }
  
  return null;
}

async function cacheEmbedding(text: string, textHash: string, embedding: number[]): Promise<void> {
  try {
    await db`
      INSERT INTO rag.embedding_cache (
        text,
        text_hash,
        embedding,
        embedding_model,
        created_at
      ) VALUES (
        ${text},
        ${textHash},
        ${JSON.stringify(embedding)}::vector,
        ${EMBEDDING_MODEL},
        NOW()
      )
      ON CONFLICT (text_hash) DO UPDATE
      SET 
        embedding = EXCLUDED.embedding,
        hit_count = embedding_cache.hit_count + 1,
        last_accessed_at = NOW()
    `;
  } catch (error) {
    console.warn('  ⚠️  Failed to cache embedding:', error);
  }
}

async function processDocuments() {
  console.log('📊 Fetching documents without embeddings...');
  
  // Get all documents that need embeddings
  const documents = await db`
    SELECT id, text, text_hash, search_vector
    FROM rag.documents
    WHERE embedding IS NULL
    ORDER BY base_relevance DESC, created_at DESC
  `;
  
  if (documents.length === 0) {
    console.log('  ✅ All documents already have embeddings!');
    return 0;
  }
  
  console.log(`  📝 Found ${documents.length} documents to process`);
  
  let processed = 0;
  let cached = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const textsToEmbed = [];
    const docsToEmbed = [];
    const embeddings: number[][] = [];
    
    // Check cache for each document
    for (const doc of batch) {
      const cachedEmbedding = await checkEmbeddingCache(doc.text_hash);
      
      if (cachedEmbedding) {
        embeddings.push(cachedEmbedding);
        cached++;
      } else {
        // Use search_vector if available, otherwise use text
        const textToEmbed = doc.search_vector || doc.text;
        textsToEmbed.push(textToEmbed);
        docsToEmbed.push(doc);
      }
    }
    
    // Generate embeddings for uncached documents
    if (textsToEmbed.length > 0) {
      try {
        console.log(`  🔄 Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}...`);
        const newEmbeddings = await generateEmbeddings(textsToEmbed);
        
        // Cache the new embeddings
        for (let j = 0; j < newEmbeddings.length; j++) {
          const doc = docsToEmbed[j];
          const embedding = newEmbeddings[j];
          
          await cacheEmbedding(doc.text, doc.text_hash, embedding);
          embeddings.push(embedding);
        }
      } catch (error) {
        console.error(`  ❌ Failed to generate embeddings for batch:`, error);
        errors += textsToEmbed.length;
        continue;
      }
    }
    
    // Update documents with embeddings
    for (let j = 0; j < batch.length; j++) {
      if (j < embeddings.length) {
        try {
          // Format vector properly for pgvector - needs to be [x,y,z] format
          // Handle both array and string formats (from cache)
          const embedding = embeddings[j];
          const vectorString = typeof embedding === 'string' 
            ? embedding 
            : `[${embedding.join(',')}]`;
          
          await db`
            UPDATE rag.documents
            SET 
              embedding = ${vectorString}::vector,
              embedding_model = ${EMBEDDING_MODEL},
              indexed_at = NOW()
            WHERE id = ${batch[j].id}
          `;
          
          processed++;
        } catch (error) {
          console.error(`  ❌ Failed to update document ${batch[j].id}:`, error);
          errors++;
        }
      }
    }
    
    // Progress update
    const progress = Math.min(i + BATCH_SIZE, documents.length);
    console.log(`  ✅ Progress: ${progress}/${documents.length} (${cached} from cache, ${errors} errors)`);
    
    // Rate limiting
    if (i + BATCH_SIZE < documents.length) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }
  
  return { processed, cached, errors };
}

async function verifyEmbeddings() {
  console.log('\n🔍 Verifying embeddings...');
  
  const stats = await db`
    SELECT 
      source,
      COUNT(*) as total,
      COUNT(embedding) as with_embedding,
      COUNT(*) - COUNT(embedding) as missing_embedding
    FROM rag.documents
    GROUP BY source
    ORDER BY source
  `;
  
  console.log('\n📈 Embedding Statistics:');
  console.log('========================');
  
  for (const stat of stats) {
    const percentage = (stat.with_embedding / stat.total * 100).toFixed(1);
    console.log(`  ${stat.source}:`);
    console.log(`    - Total: ${stat.total}`);
    console.log(`    - With embeddings: ${stat.with_embedding} (${percentage}%)`);
    if (stat.missing_embedding > 0) {
      console.log(`    - Missing: ${stat.missing_embedding} ⚠️`);
    }
  }
  
  // Check cache statistics
  const cacheStats = await db`
    SELECT 
      COUNT(*) as total_cached,
      SUM(hit_count) as total_hits,
      AVG(hit_count) as avg_hits
    FROM rag.embedding_cache
  `;
  
  if (cacheStats[0].total_cached > 0) {
    console.log('\n💾 Cache Statistics:');
    console.log('====================');
    console.log(`  Total cached: ${cacheStats[0].total_cached}`);
    console.log(`  Total hits: ${cacheStats[0].total_hits || 0}`);
    console.log(`  Avg hits per entry: ${Math.round(cacheStats[0].avg_hits || 0)}`);
  }
}

async function testSimilaritySearch() {
  console.log('\n🧪 Testing similarity search...');
  
  // Test query
  const testQuery = 'sulfuric acid 98%';
  console.log(`  Query: "${testQuery}"`);
  
  // Generate embedding for query
  const [queryEmbedding] = await generateEmbeddings([testQuery]);
  
  // Search for similar documents
  const results = await db`
    SELECT 
      id,
      source,
      text,
      metadata,
      1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM rag.documents
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT 5
  `;
  
  console.log('\n  Top 5 results:');
  for (const [idx, result] of results.entries()) {
    console.log(`  ${idx + 1}. [${result.source}] ${result.text.substring(0, 100)}...`);
    console.log(`     Similarity: ${(result.similarity * 100).toFixed(2)}%`);
  }
}

async function main() {
  console.log('🚀 Generating RAG Embeddings');
  console.log('=' .repeat(50));
  
  // Check which API is available
  if (OPENAI_API_KEY) {
    console.log('✅ Using OpenAI text-embedding-3-small');
  } else if (GOOGLE_API_KEY) {
    console.log('✅ Using Google text-embedding-004');
  } else {
    console.log('⚠️  No API keys found, will use local hashing (less accurate)');
  }
  
  try {
    // Process documents
    const result = await processDocuments();
    
    // Verify embeddings
    await verifyEmbeddings();
    
    // Test search
    await testSimilaritySearch();
    
    console.log('\n' + '='.repeat(50));
    console.log('✨ Embedding Generation Complete!');
    console.log('='.repeat(50));
    
    if (typeof result === 'object') {
      console.log(`\nSummary:`);
      console.log(`  - Processed: ${result.processed}`);
      console.log(`  - From cache: ${result.cached}`);
      console.log(`  - Errors: ${result.errors}`);
    }
    
    console.log('\nNext steps:');
    console.log('1. Test: npm run rag:test-search');
    console.log('2. Update: Update classification API to use database');
    console.log('3. Monitor: Check query performance and accuracy\n');
    
  } catch (error) {
    console.error('\n❌ Embedding generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}