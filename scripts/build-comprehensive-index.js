#!/usr/bin/env node

/**
 * Build comprehensive RAG index from all data sources
 * Uses OpenAI embeddings for semantic search
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { embedBatch, estimateEmbeddingCost } = require('../lib/rag/embeddings-config');
const { chunkText } = require('../lib/rag/chunk');

// Configuration
const INDEX_CONFIG = {
  chunkSize: 500,  // tokens per chunk
  chunkOverlap: 50, // overlap between chunks
  batchSize: 100,   // embeddings per batch
  sources: {
    cfr: true,
    erg: true,
    hmt: true,
    products: true
  }
};

// Load data sources
async function loadDataSources() {
  const dataDir = path.join(process.cwd(), 'data');
  const sources = {};
  
  // Load existing HMT data
  if (INDEX_CONFIG.sources.hmt) {
    const hmtPath = path.join(dataDir, 'hmt-172101.json');
    if (fs.existsSync(hmtPath)) {
      console.log('Loading HMT data...');
      sources.hmt = JSON.parse(fs.readFileSync(hmtPath, 'utf8'));
      console.log(`  Loaded ${sources.hmt.length} HMT entries`);
    }
  }
  
  // Load CFR full extract
  if (INDEX_CONFIG.sources.cfr) {
    const cfrPath = path.join(dataDir, 'cfr-full-compact.json');
    if (fs.existsSync(cfrPath)) {
      console.log('Loading CFR sections...');
      sources.cfr = JSON.parse(fs.readFileSync(cfrPath, 'utf8'));
      console.log(`  Loaded ${sources.cfr.sections?.length || 0} CFR sections`);
    }
  }
  
  // Load ERG data
  if (INDEX_CONFIG.sources.erg) {
    const ergPath = path.join(dataDir, 'erg-compact.json');
    if (fs.existsSync(ergPath)) {
      console.log('Loading ERG guides...');
      sources.erg = JSON.parse(fs.readFileSync(ergPath, 'utf8'));
      console.log(`  Loaded ${sources.erg.indexEntries?.length || 0} ERG entries`);
    }
  }
  
  // Load product/database export
  if (INDEX_CONFIG.sources.products) {
    const dbPath = path.join(dataDir, 'database-rag-entries.json');
    if (fs.existsSync(dbPath)) {
      console.log('Loading product data...');
      sources.products = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      console.log(`  Loaded ${sources.products.entries?.length || 0} product entries`);
    }
  }
  
  return sources;
}

// Create document entries from all sources
function createDocuments(sources) {
  const documents = [];
  let docId = 0;
  
  // Process HMT entries
  if (sources.hmt) {
    console.log('\nProcessing HMT entries...');
    for (const entry of sources.hmt) {
      const text = [
        `Hazardous Material: ${entry.base_name}`,
        entry.qualifier ? `Technical name: ${entry.qualifier}` : '',
        `UN Number: ${entry.id_number}`,
        `Hazard Class: ${entry.class_or_division}`,
        entry.packing_group ? `Packing Group: ${entry.packing_group}` : '',
        entry.label_codes?.length ? `Labels: ${entry.label_codes.join(', ')}` : '',
        entry.special_provisions?.length ? `Special Provisions: ${entry.special_provisions.join(', ')}` : ''
      ].filter(Boolean).join(' | ');
      
      documents.push({
        id: `hmt-${docId++}`,
        source: 'hmt',
        text,
        metadata: {
          type: 'hazmat_table',
          unNumber: entry.id_number,
          name: entry.base_name,
          hazardClass: entry.class_or_division,
          packingGroup: entry.packing_group,
          labels: entry.label_codes,
          specialProvisions: entry.special_provisions
        }
      });
    }
  }
  
  // Process CFR sections
  if (sources.cfr?.sections) {
    console.log('\nProcessing CFR sections...');
    for (const section of sources.cfr.sections) {
      // Chunk long sections
      const chunks = chunkText(section.fullText || '', {
        targetTokens: INDEX_CONFIG.chunkSize,
        overlapTokens: INDEX_CONFIG.chunkOverlap
      });
      
      for (let i = 0; i < chunks.length; i++) {
        documents.push({
          id: `cfr-${section.part}-${section.section}-${i}`,
          source: 'cfr',
          text: `CFR §${section.section} ${section.subject}: ${chunks[i]}`,
          metadata: {
            type: 'regulation',
            part: section.part,
            section: section.section,
            subject: section.subject,
            category: section.type,
            chunkIndex: i,
            totalChunks: chunks.length
          }
        });
      }
    }
  }
  
  // Process ERG entries
  if (sources.erg?.indexEntries) {
    console.log('\nProcessing ERG entries...');
    for (const entry of sources.erg.indexEntries) {
      documents.push({
        id: entry.id,
        source: 'erg',
        text: entry.text,
        metadata: entry.metadata
      });
    }
  }
  
  // Process product entries
  if (sources.products?.entries) {
    console.log('\nProcessing product entries...');
    for (const entry of sources.products.entries) {
      documents.push({
        id: entry.id,
        source: 'products',
        text: entry.text,
        metadata: entry.metadata
      });
    }
  }
  
  console.log(`\nTotal documents created: ${documents.length}`);
  return documents;
}

// Generate embeddings for all documents
async function generateEmbeddings(documents) {
  console.log('\n=== Generating OpenAI Embeddings ===');
  
  // Estimate cost
  const costEstimate = estimateEmbeddingCost(documents.map(d => d.text));
  console.log('Cost estimate:', costEstimate);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('\n⚠️  WARNING: OPENAI_API_KEY not set!');
    console.warn('Please set your OpenAI API key to use embeddings.');
    console.warn('Falling back to local hash-based embeddings (lower quality).\n');
  }
  
  // Generate embeddings in batches
  const texts = documents.map(d => d.text);
  const embeddings = await embedBatch(texts, (progress) => {
    process.stdout.write(`\rProcessing: ${progress.processed}/${progress.total} (${progress.percent}%)`);
  });
  
  console.log('\n✓ Embeddings generated successfully');
  
  // Add embeddings to documents
  for (let i = 0; i < documents.length; i++) {
    documents[i].embedding = embeddings[i];
  }
  
  return documents;
}

// Build and save the index
async function buildIndex() {
  try {
    console.log('=== Building Comprehensive RAG Index ===\n');
    
    // Load all data sources
    const sources = await loadDataSources();
    
    if (Object.keys(sources).length === 0) {
      console.error('\n❌ No data sources found!');
      console.error('Please run the extraction scripts first:');
      console.error('  npm run cfr:extract-all');
      console.error('  npm run erg:extract');
      console.error('  npm run db:export-products');
      process.exit(1);
    }
    
    // Create documents
    const documents = createDocuments(sources);
    
    // Generate embeddings
    const embeddedDocuments = await generateEmbeddings(documents);
    
    // Create index structure
    const index = {
      version: '2.0',
      model: process.env.OPENAI_API_KEY ? 'text-embedding-3-small' : 'local-hash',
      dimensions: process.env.OPENAI_API_KEY ? 1536 : 512,
      createdAt: new Date().toISOString(),
      stats: {
        totalDocuments: embeddedDocuments.length,
        sources: {
          hmt: embeddedDocuments.filter(d => d.source === 'hmt').length,
          cfr: embeddedDocuments.filter(d => d.source === 'cfr').length,
          erg: embeddedDocuments.filter(d => d.source === 'erg').length,
          products: embeddedDocuments.filter(d => d.source === 'products').length
        }
      },
      documents: embeddedDocuments
    };
    
    // Save index
    const outDir = path.join(process.cwd(), 'data');
    const indexPath = path.join(outDir, 'rag-index-comprehensive.json');
    
    console.log('\nSaving index...');
    fs.writeFileSync(indexPath, JSON.stringify(index), 'utf8');
    
    // Also save a metadata file for quick loading
    const metadataPath = path.join(outDir, 'rag-index-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify({
      ...index,
      documents: undefined // Exclude documents from metadata
    }, null, 2), 'utf8');
    
    console.log('\n=== Index Build Complete ===');
    console.log(`Index saved to: ${indexPath}`);
    console.log(`Metadata saved to: ${metadataPath}`);
    console.log(`\nIndex Statistics:`);
    console.log(`  Total documents: ${index.stats.totalDocuments}`);
    console.log(`  Embedding model: ${index.model}`);
    console.log(`  Dimensions: ${index.dimensions}`);
    console.log(`  Sources breakdown:`);
    Object.entries(index.stats.sources).forEach(([source, count]) => {
      console.log(`    ${source}: ${count} documents`);
    });
    console.log(`\nFile size: ${(fs.statSync(indexPath).size / 1024 / 1024).toFixed(2)} MB`);
    
    // Provide next steps
    console.log('\n✅ Your RAG index is ready!');
    console.log('\nNext steps:');
    console.log('1. Set OPENAI_API_KEY in .env if not already set');
    console.log('2. Run: npm run rag:search-test');
    console.log('3. Use the new /api/rag/search endpoint');
    
  } catch (error) {
    console.error('\n❌ Error building index:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  buildIndex();
}

module.exports = { buildIndex, createDocuments, generateEmbeddings };