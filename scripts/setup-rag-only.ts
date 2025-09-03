#!/usr/bin/env tsx

/**
 * Setup ONLY the RAG schema with pgvector
 * Doesn't touch freight tables - avoids conflicts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

async function setupRAG() {
  const db = neon(DATABASE_URL);
  
  try {
    console.log('🚀 Setting up RAG with pgvector...\n');
    
    // 1. Enable extensions
    console.log('Enabling extensions...');
    await db`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await db`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ Extensions enabled\n');
    
    // 2. Create RAG schema
    console.log('Creating RAG schema...');
    await db`CREATE SCHEMA IF NOT EXISTS rag`;
    console.log('✅ Schema created\n');
    
    // 3. Run the migration SQL directly
    console.log('Creating RAG tables...');
    
    // This is the exact SQL from drizzle/0004_cynical_lester.sql but ONLY the RAG parts
    await db`
      CREATE TABLE IF NOT EXISTS "rag"."documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "source" varchar(50) NOT NULL,
        "source_id" varchar(100),
        "text" text NOT NULL,
        "text_hash" varchar(64),
        "embedding" vector(1536),
        "embedding_model" varchar(50) DEFAULT 'text-embedding-3-small',
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "search_vector" text,
        "keywords" jsonb DEFAULT '[]'::jsonb,
        "base_relevance" integer DEFAULT 100,
        "click_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "indexed_at" timestamp,
        "is_verified" boolean DEFAULT false,
        "verified_by" varchar(255),
        "verified_at" timestamp
      )
    `;
    
    await db`
      CREATE TABLE IF NOT EXISTS "rag"."query_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "query" text NOT NULL,
        "query_embedding" vector(1536),
        "query_intent" varchar(50),
        "entities" jsonb DEFAULT '{}'::jsonb,
        "returned_document_ids" jsonb DEFAULT '[]'::jsonb,
        "clicked_document_ids" jsonb DEFAULT '[]'::jsonb,
        "feedback_score" integer,
        "search_time_ms" integer,
        "total_results" integer,
        "user_id" varchar(255),
        "session_id" uuid,
        "source" varchar(50),
        "created_at" timestamp DEFAULT now()
      )
    `;
    
    await db`
      CREATE TABLE IF NOT EXISTS "rag"."document_relations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "parent_document_id" uuid,
        "child_document_id" uuid,
        "relation_type" varchar(50) NOT NULL,
        "relation_strength" integer DEFAULT 100,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT now()
      )
    `;
    
    await db`
      CREATE TABLE IF NOT EXISTS "rag"."embedding_cache" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "text" text NOT NULL,
        "text_hash" varchar(64) NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "embedding_model" varchar(50) DEFAULT 'text-embedding-3-small',
        "hit_count" integer DEFAULT 1,
        "last_accessed_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "expires_at" timestamp,
        CONSTRAINT "embedding_cache_text_unique" UNIQUE("text"),
        CONSTRAINT "embedding_cache_text_hash_unique" UNIQUE("text_hash")
      )
    `;
    
    console.log('✅ Tables created\n');
    
    // 4. Create indexes
    console.log('Creating indexes...');
    
    // HNSW index for vector search
    await db`
      CREATE INDEX IF NOT EXISTS "idx_rag_embedding_hnsw" 
      ON "rag"."documents" 
      USING hnsw ("embedding" vector_cosine_ops)
    `;
    
    // Other indexes
    await db`CREATE INDEX IF NOT EXISTS "idx_rag_source" ON "rag"."documents"("source")`;
    await db`CREATE INDEX IF NOT EXISTS "idx_rag_text_hash" ON "rag"."documents"("text_hash")`;
    await db`CREATE INDEX IF NOT EXISTS "idx_rag_query_intent" ON "rag"."query_history"("query_intent")`;
    await db`CREATE INDEX IF NOT EXISTS "idx_rag_query_user" ON "rag"."query_history"("user_id")`;
    await db`CREATE INDEX IF NOT EXISTS "idx_rag_cache_hash" ON "rag"."embedding_cache"("text_hash")`;
    
    console.log('✅ Indexes created\n');
    
    // 5. Add foreign keys
    console.log('Adding relationships...');
    await db`
      ALTER TABLE "rag"."document_relations" 
      ADD CONSTRAINT "document_relations_parent_fk" 
      FOREIGN KEY ("parent_document_id") 
      REFERENCES "rag"."documents"("id") 
      ON DELETE CASCADE
    `;
    
    await db`
      ALTER TABLE "rag"."document_relations" 
      ADD CONSTRAINT "document_relations_child_fk" 
      FOREIGN KEY ("child_document_id") 
      REFERENCES "rag"."documents"("id") 
      ON DELETE CASCADE
    `;
    
    console.log('✅ Relationships added\n');
    
    // 6. Verify
    const tables = await db`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'rag'
      ORDER BY table_name
    `;
    
    console.log('✨ RAG setup complete!');
    console.log('📊 Tables:', tables.map(t => `rag.${t.table_name}`).join(', '));
    console.log('\nNext: Run npm run rag:db:migrate to import data');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupRAG();
}