#!/usr/bin/env node

/**
 * Test the RAG search functionality
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');

// Simple cosine similarity calculation
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate hash-based embedding
function hashingVector(text, dim = 512, ngram = 3) {
  const vec = new Float32Array(dim);
  const s = ` ${text.toLowerCase()} `;
  for (let i = 0; i < s.length - ngram + 1; i++) {
    const gram = s.slice(i, i + ngram);
    let h = 2166136261; // FNV-1a
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

// Generate OpenAI embedding
async function getOpenAIEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

async function testSearch() {
  console.log('=== Testing RAG Search System ===\n');
  
  // Load the index
  const indexPath = path.join(process.cwd(), 'data', 'rag-index-comprehensive.json');
  
  if (!fs.existsSync(indexPath)) {
    console.error('❌ Index not found. Please run: npm run rag:pipeline');
    process.exit(1);
  }
  
  console.log('Loading index...');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  console.log(`✓ Loaded ${index.documents.length} documents`);
  
  // Check what type of embeddings we have
  const dimensions = index.dimensions || 512;
  const useOpenAI = dimensions === 1536 && process.env.OPENAI_API_KEY;
  
  if (useOpenAI) {
    console.log('✓ Using OpenAI embeddings (text-embedding-3-small)\n');
  } else if (dimensions === 1536 && !process.env.OPENAI_API_KEY) {
    console.log('⚠️  Index uses OpenAI embeddings but OPENAI_API_KEY not set');
    console.log('   Falling back to keyword matching\n');
  } else {
    console.log(`✓ Using hash-based embeddings (${dimensions} dimensions)\n`);
  }
  
  // Test queries
  const testQueries = [
    'sulfuric acid shipping requirements',
    'UN1830 emergency response',
    'corrosive liquid packing group II',
    'highway transportation hazmat',
    'sodium hydroxide classification'
  ];
  
  console.log('Running test queries:\n');
  
  for (const query of testQueries) {
    console.log(`Query: "${query}"`);
    console.log('-'.repeat(50));
    
    let results;
    
    if (useOpenAI) {
      // Generate OpenAI embedding
      try {
        const queryEmbedding = await getOpenAIEmbedding(query);
        
        // Search using embeddings
        results = index.documents
          .map(doc => ({
            ...doc,
            score: cosineSimilarity(queryEmbedding, doc.embedding)
          }))
          .filter(doc => doc.score > 0.3)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
      } catch (err) {
        console.error('Error getting OpenAI embedding:', err.message);
        continue;
      }
    } else if (dimensions === 512) {
      // Use hash-based embeddings
      const queryEmbedding = hashingVector(query, dimensions);
      
      results = index.documents
        .map(doc => ({
          ...doc,
          score: cosineSimilarity(queryEmbedding, doc.embedding)
        }))
        .filter(doc => doc.score > 0.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    } else {
      // Fallback to keyword matching when no API key
      const queryWords = query.toLowerCase().split(/\s+/);
      results = index.documents
        .map(doc => {
          const text = doc.text.toLowerCase();
          const matchCount = queryWords.filter(word => text.includes(word)).length;
          return {
            ...doc,
            score: matchCount / queryWords.length
          };
        })
        .filter(doc => doc.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }
    
    // Display results
    if (results.length === 0) {
      console.log('No results found\n');
    } else {
      results.forEach((result, i) => {
        console.log(`\n${i + 1}. [${result.source}] Score: ${result.score.toFixed(3)}`);
        console.log(`   ${result.text.substring(0, 150)}...`);
        if (result.metadata?.unNumber) {
          console.log(`   UN Number: ${result.metadata.unNumber}`);
        }
        if (result.metadata?.section) {
          console.log(`   CFR Section: ${result.metadata.section}`);
        }
      });
    }
    console.log('\n');
  }
  
  // Statistics
  console.log('=== Index Statistics ===');
  const bySource = {};
  index.documents.forEach(doc => {
    bySource[doc.source] = (bySource[doc.source] || 0) + 1;
  });
  
  console.log('Documents by source:');
  Object.entries(bySource).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
  
  console.log('\n✅ RAG search test complete!');
  console.log('\nTo use with OpenAI embeddings (better quality):');
  console.log('1. Add OPENAI_API_KEY to your .env file');
  console.log('2. Rebuild index: npm run rag:build-comprehensive');
  console.log('3. Use the API: POST /api/rag/search');
}

if (require.main === module) {
  testSearch().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}