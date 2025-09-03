#!/usr/bin/env tsx

/**
 * Setup pgvector and create RAG tables in Neon database
 * Run with: npx tsx scripts/setup-rag-database.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function setupRagDatabase() {
  console.log('🚀 Setting up RAG database with pgvector...\n');

  const db = neon(DATABASE_URL);

  try {
    // Step 1: Enable pgvector extension
    console.log('1️⃣ Enabling pgvector extension...');
    await db`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('   ✅ pgvector extension enabled\n');

    // Step 2: Create RAG schema
    console.log('2️⃣ Creating RAG schema...');
    await db`CREATE SCHEMA IF NOT EXISTS rag`;
    console.log('   ✅ RAG schema created\n');

    // Step 3: Create documents table
    console.log('3️⃣ Creating rag.documents table...');
    await db`
      CREATE TABLE IF NOT EXISTS rag.documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Document identification
        source VARCHAR(50) NOT NULL,
        source_id VARCHAR(100),
        
        -- Content
        text TEXT NOT NULL,
        text_hash VARCHAR(64),
        
        -- Vector embedding (1536 dimensions for text-embedding-3-small)
        embedding vector(1536),
        embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
        
        -- Metadata (JSONB for flexible schema)
        metadata JSONB DEFAULT '{}',
        
        -- Search optimization
        search_vector TEXT,
        keywords JSONB DEFAULT '[]',
        
        -- Scoring and relevance
        base_relevance INTEGER DEFAULT 100,
        click_count INTEGER DEFAULT 0,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        indexed_at TIMESTAMP,
        
        -- Data quality
        is_verified BOOLEAN DEFAULT false,
        verified_by VARCHAR(255),
        verified_at TIMESTAMP
      )
    `;
    console.log('   ✅ Documents table created\n');

    // Step 4: Create indexes for documents table
    console.log('4️⃣ Creating indexes for optimal performance...');
    
    // HNSW index for vector similarity search (cosine distance)
    console.log('   Creating HNSW index for vector search...');
    await db`
      CREATE INDEX IF NOT EXISTS idx_rag_embedding_hnsw 
      ON rag.documents 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;
    
    // Metadata indexes for filtering
    console.log('   Creating metadata indexes...');
    await db`CREATE INDEX IF NOT EXISTS idx_rag_source ON rag.documents(source)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_un_number ON rag.documents((metadata->>'unNumber'))`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_cas_number ON rag.documents((metadata->>'casNumber'))`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_hazard_class ON rag.documents((metadata->>'hazardClass'))`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_cfr_section ON rag.documents((metadata->>'section'))`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_sku ON rag.documents((metadata->>'sku'))`;
    
    // Full-text search index
    console.log('   Creating full-text search index...');
    await db`
      CREATE INDEX IF NOT EXISTS idx_rag_search_vector 
      ON rag.documents 
      USING gin(to_tsvector('english', COALESCE(search_vector, text)))
    `;
    
    // Deduplication index
    await db`CREATE INDEX IF NOT EXISTS idx_rag_text_hash ON rag.documents(text_hash)`;
    console.log('   ✅ All indexes created\n');

    // Step 5: Create query history table
    console.log('5️⃣ Creating rag.query_history table...');
    await db`
      CREATE TABLE IF NOT EXISTS rag.query_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Query details
        query TEXT NOT NULL,
        query_embedding vector(1536),
        query_intent VARCHAR(50),
        
        -- Extracted entities
        entities JSONB DEFAULT '{}',
        
        -- Results and feedback
        returned_document_ids JSONB DEFAULT '[]',
        clicked_document_ids JSONB DEFAULT '[]',
        feedback_score INTEGER,
        
        -- Performance metrics
        search_time_ms INTEGER,
        total_results INTEGER,
        
        -- Context
        user_id VARCHAR(255),
        session_id UUID,
        source VARCHAR(50),
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Indexes for query history
    await db`CREATE INDEX IF NOT EXISTS idx_rag_query_intent ON rag.query_history(query_intent)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_query_user ON rag.query_history(user_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_query_session ON rag.query_history(session_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_query_created ON rag.query_history(created_at DESC)`;
    console.log('   ✅ Query history table created\n');

    // Step 6: Create document relations table
    console.log('6️⃣ Creating rag.document_relations table...');
    await db`
      CREATE TABLE IF NOT EXISTS rag.document_relations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        parent_document_id UUID REFERENCES rag.documents(id) ON DELETE CASCADE,
        child_document_id UUID REFERENCES rag.documents(id) ON DELETE CASCADE,
        
        relation_type VARCHAR(50) NOT NULL,
        relation_strength INTEGER DEFAULT 100,
        
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    await db`CREATE INDEX IF NOT EXISTS idx_rag_rel_parent ON rag.document_relations(parent_document_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_rel_child ON rag.document_relations(child_document_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_rel_type ON rag.document_relations(relation_type)`;
    console.log('   ✅ Document relations table created\n');

    // Step 7: Create embedding cache table
    console.log('7️⃣ Creating rag.embedding_cache table...');
    await db`
      CREATE TABLE IF NOT EXISTS rag.embedding_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        text TEXT NOT NULL UNIQUE,
        text_hash VARCHAR(64) NOT NULL UNIQUE,
        embedding vector(1536) NOT NULL,
        embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
        
        hit_count INTEGER DEFAULT 1,
        last_accessed_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `;
    
    await db`CREATE INDEX IF NOT EXISTS idx_rag_cache_hash ON rag.embedding_cache(text_hash)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_cache_expires ON rag.embedding_cache(expires_at)`;
    await db`CREATE INDEX IF NOT EXISTS idx_rag_cache_hits ON rag.embedding_cache(hit_count DESC)`;
    console.log('   ✅ Embedding cache table created\n');

    // Step 8: Create helper functions
    console.log('8️⃣ Creating helper functions...');
    
    // Function to search similar documents
    await db`
      CREATE OR REPLACE FUNCTION rag.search_similar_documents(
        query_embedding vector(1536),
        match_count int DEFAULT 10,
        filter_source text DEFAULT NULL
      )
      RETURNS TABLE(
        id UUID,
        source VARCHAR,
        text TEXT,
        metadata JSONB,
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          d.id,
          d.source,
          d.text,
          d.metadata,
          1 - (d.embedding <=> query_embedding) as similarity
        FROM rag.documents d
        WHERE 
          (filter_source IS NULL OR d.source = filter_source)
          AND d.embedding IS NOT NULL
        ORDER BY d.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$
    `;
    
    // Function to update click count
    await db`
      CREATE OR REPLACE FUNCTION rag.increment_click_count(doc_id UUID)
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        UPDATE rag.documents 
        SET click_count = click_count + 1,
            updated_at = NOW()
        WHERE id = doc_id;
      END;
      $$
    `;
    
    console.log('   ✅ Helper functions created\n');

    // Step 9: Verify setup
    console.log('9️⃣ Verifying database setup...');
    
    // Check if pgvector is installed
    const vectorCheck = await db`
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    `;
    
    // Check tables exist
    const tableCheck = await db`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'rag' 
      ORDER BY table_name
    `;
    
    console.log('   ✅ Verification complete');
    console.log('   📊 Tables created:', tableCheck.map(t => `rag.${t.table_name}`).join(', '));
    console.log('   🔧 pgvector version:', vectorCheck.length > 0 ? 'Installed' : 'Not found');

    // Success message
    console.log('\n' + '='.repeat(60));
    console.log('✨ RAG database setup complete!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('1. Run: npm run rag:migrate-to-db');
    console.log('2. Test: npm run rag:test-db');
    console.log('3. Update APIs to use database instead of JSON\n');

  } catch (error) {
    console.error('\n❌ Error setting up database:', error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('permission denied')) {
        console.error('\n💡 Tip: Make sure your database user has CREATE EXTENSION privileges');
        console.error('   You may need to run: GRANT CREATE ON DATABASE your_db TO your_user;');
      } else if (error.message.includes('does not exist')) {
        console.error('\n💡 Tip: pgvector extension might not be available in your Neon instance');
        console.error('   Contact Neon support or check your plan for pgvector availability');
      }
    }
    
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupRagDatabase().catch(console.error);
}