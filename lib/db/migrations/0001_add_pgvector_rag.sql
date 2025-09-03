-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create RAG schema
CREATE SCHEMA IF NOT EXISTS rag;

-- Create documents table
CREATE TABLE IF NOT EXISTS rag.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(100),
  text TEXT NOT NULL,
  text_hash VARCHAR(64),
  embedding vector(1536),
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
  metadata JSONB DEFAULT '{}',
  search_vector TEXT,
  keywords JSONB DEFAULT '[]',
  base_relevance INTEGER DEFAULT 100,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  indexed_at TIMESTAMP,
  is_verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(255),
  verified_at TIMESTAMP
);

-- Create HNSW index for vector similarity
CREATE INDEX idx_rag_embedding_hnsw ON rag.documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create metadata indexes
CREATE INDEX idx_rag_source ON rag.documents(source);
CREATE INDEX idx_rag_un_number ON rag.documents((metadata->>'unNumber'));
CREATE INDEX idx_rag_cas_number ON rag.documents((metadata->>'casNumber'));
CREATE INDEX idx_rag_hazard_class ON rag.documents((metadata->>'hazardClass'));
CREATE INDEX idx_rag_cfr_section ON rag.documents((metadata->>'section'));
CREATE INDEX idx_rag_sku ON rag.documents((metadata->>'sku'));
CREATE INDEX idx_rag_text_hash ON rag.documents(text_hash);

-- Full-text search index
CREATE INDEX idx_rag_search_vector ON rag.documents 
USING gin(to_tsvector('english', COALESCE(search_vector, text)));

-- Query history table
CREATE TABLE IF NOT EXISTS rag.query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  query_embedding vector(1536),
  query_intent VARCHAR(50),
  entities JSONB DEFAULT '{}',
  returned_document_ids JSONB DEFAULT '[]',
  clicked_document_ids JSONB DEFAULT '[]',
  feedback_score INTEGER,
  search_time_ms INTEGER,
  total_results INTEGER,
  user_id VARCHAR(255),
  session_id UUID,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Query history indexes
CREATE INDEX idx_rag_query_intent ON rag.query_history(query_intent);
CREATE INDEX idx_rag_query_user ON rag.query_history(user_id);
CREATE INDEX idx_rag_query_session ON rag.query_history(session_id);
CREATE INDEX idx_rag_query_created ON rag.query_history(created_at DESC);

-- Document relations table
CREATE TABLE IF NOT EXISTS rag.document_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_document_id UUID REFERENCES rag.documents(id) ON DELETE CASCADE,
  child_document_id UUID REFERENCES rag.documents(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL,
  relation_strength INTEGER DEFAULT 100,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rag_rel_parent ON rag.document_relations(parent_document_id);
CREATE INDEX idx_rag_rel_child ON rag.document_relations(child_document_id);
CREATE INDEX idx_rag_rel_type ON rag.document_relations(relation_type);

-- Embedding cache table
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
);

CREATE INDEX idx_rag_cache_hash ON rag.embedding_cache(text_hash);
CREATE INDEX idx_rag_cache_expires ON rag.embedding_cache(expires_at);
CREATE INDEX idx_rag_cache_hits ON rag.embedding_cache(hit_count DESC);