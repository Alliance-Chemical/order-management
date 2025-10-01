import { pgSchema, uuid, text, jsonb, timestamp, integer, index, varchar, vector, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SQLWrapper } from 'drizzle-orm';

type JsonObject = Record<string, unknown>;

// Create a dedicated schema for RAG data
export const ragSchema = pgSchema('rag');

/**
 * Main documents table storing all RAG content with embeddings
 * Supports OpenAI text-embedding-3-small (1536 dimensions)
 */
export const ragDocuments = ragSchema.table('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Document identification
  source: varchar('source', { length: 50 }).notNull(), // 'hmt', 'cfr', 'erg', 'products'
  sourceId: varchar('source_id', { length: 100 }), // Original ID from source system
  
  // Content
  text: text('text').notNull(),
  textHash: varchar('text_hash', { length: 64 }), // SHA-256 hash for deduplication
  
  // Vector embedding (1536 dimensions for text-embedding-3-small)
  embedding: vector('embedding', { dimensions: 1536 }),
  embeddingModel: varchar('embedding_model', { length: 50 }).default('text-embedding-3-small'),
  
  // Metadata (structured data for filtering and boosting)
  metadata: jsonb('metadata').$type<{
    // Common fields
    type?: string;
    name?: string;
    
    // HMT specific
    unNumber?: string;
    hazardClass?: string;
    packingGroup?: string;
    labels?: string[];
    specialProvisions?: string[];
    
    // CFR specific
    section?: string;
    part?: string;
    subpart?: string;
    subject?: string;
    
    // ERG specific
    guideNumber?: string;
    hazardType?: string;
    isolationDistance?: number;
    
    // Product specific
    sku?: string;
    casNumber?: string;
    nmfcCode?: string;
    freightClass?: string;
    isHazardous?: boolean;
    weight?: number;
    dimensions?: { length: number; width: number; height: number; };
    
    // Additional context
    keywords?: string[];
    category?: string;
    lastUpdated?: string;
  }>().default({}),
  
  // Search optimization
  searchVector: text('search_vector'), // Preprocessed text for full-text search
  keywords: jsonb('keywords').$type<string[]>().default([]),
  
  // Scoring and relevance
  baseRelevance: integer('base_relevance').default(100), // 0-100 base relevance score
  clickCount: integer('click_count').default(0), // Track user interactions
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  indexedAt: timestamp('indexed_at'), // When embedding was generated
  
  // Data quality
  isVerified: boolean('is_verified').default(false),
  verifiedBy: varchar('verified_by', { length: 255 }),
  verifiedAt: timestamp('verified_at'),
}, (table) => ({
  // Vector similarity search index (HNSW for fast approximate nearest neighbor)
  embeddingIdx: index('idx_rag_embedding_hnsw')
    .using('hnsw', table.embedding.op('vector_cosine_ops')),
  
  // Source and metadata indexes for filtering
  sourceIdx: index('idx_rag_source').on(table.source),
  unNumberIdx: index('idx_rag_un_number').on(sql`(metadata->>'unNumber')`),
  casNumberIdx: index('idx_rag_cas_number').on(sql`(metadata->>'casNumber')`),
  hazardClassIdx: index('idx_rag_hazard_class').on(sql`(metadata->>'hazardClass')`),
  sectionIdx: index('idx_rag_cfr_section').on(sql`(metadata->>'section')`),
  skuIdx: index('idx_rag_sku').on(sql`(metadata->>'sku')`),
  
  // Full-text search index
  searchVectorIdx: index('idx_rag_search_vector')
    .using('gin', sql`to_tsvector('english', ${table.searchVector})`),
  
  // Deduplication
  textHashIdx: index('idx_rag_text_hash').on(table.textHash),
}));

/**
 * Query history for learning and optimization
 */
export const ragQueryHistory = ragSchema.table('query_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Query details
  query: text('query').notNull(),
  queryEmbedding: vector('query_embedding', { dimensions: 1536 }),
  queryIntent: varchar('query_intent', { length: 50 }), // classification, emergency, shipping, etc.
  
  // Extracted entities
  entities: jsonb('entities').$type<{
    unNumbers?: string[];
    casNumbers?: string[];
    chemicals?: string[];
    hazardClasses?: string[];
    packingGroups?: string[];
    nmfcCodes?: string[];
    freightClasses?: string[];
  }>().default({}),
  
  // Results and feedback
  returnedDocumentIds: jsonb('returned_document_ids').$type<string[]>().default([]),
  clickedDocumentIds: jsonb('clicked_document_ids').$type<string[]>().default([]),
  feedbackScore: integer('feedback_score'), // 1-5 rating
  
  // Performance metrics
  searchTimeMs: integer('search_time_ms'),
  totalResults: integer('total_results'),
  
  // Context
  userId: varchar('user_id', { length: 255 }),
  sessionId: uuid('session_id'),
  source: varchar('source', { length: 50 }), // 'chat', 'api', 'freight-booking', etc.
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  queryIntentIdx: index('idx_rag_query_intent').on(table.queryIntent),
  userIdx: index('idx_rag_query_user').on(table.userId),
  sessionIdx: index('idx_rag_query_session').on(table.sessionId),
  createdAtIdx: index('idx_rag_query_created').on(table.createdAt),
}));

/**
 * Document relationships for hierarchical content
 */
export const ragDocumentRelations = ragSchema.table('document_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  parentDocumentId: uuid('parent_document_id')
    .references(() => ragDocuments.id, { onDelete: 'cascade' }),
  childDocumentId: uuid('child_document_id')
    .references(() => ragDocuments.id, { onDelete: 'cascade' }),
  
  relationType: varchar('relation_type', { length: 50 }).notNull(), // 'section', 'subsection', 'reference', 'related'
  relationStrength: integer('relation_strength').default(100), // 0-100
  
  metadata: jsonb('metadata').$type<JsonObject>().default({}),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  parentIdx: index('idx_rag_rel_parent').on(table.parentDocumentId),
  childIdx: index('idx_rag_rel_child').on(table.childDocumentId),
  typeIdx: index('idx_rag_rel_type').on(table.relationType),
}));

/**
 * Cache for frequently accessed embeddings
 */
export const ragEmbeddingCache = ragSchema.table('embedding_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  text: text('text').notNull().unique(),
  textHash: varchar('text_hash', { length: 64 }).notNull().unique(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  embeddingModel: varchar('embedding_model', { length: 50 }).default('text-embedding-3-small'),
  
  hitCount: integer('hit_count').default(1),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // Optional TTL
}, (table) => ({
  textHashIdx: index('idx_rag_cache_hash').on(table.textHash),
  expiresIdx: index('idx_rag_cache_expires').on(table.expiresAt),
  hitCountIdx: index('idx_rag_cache_hits').on(table.hitCount),
}));

// Helper type exports
export type RagDocument = typeof ragDocuments.$inferSelect;
export type NewRagDocument = typeof ragDocuments.$inferInsert;
export type RagQueryHistory = typeof ragQueryHistory.$inferSelect;
export type NewRagQueryHistory = typeof ragQueryHistory.$inferInsert;

// Vector similarity search functions (to be used in queries)
export const vectorDistance = {
  cosine: (column: SQLWrapper, vector: number[]) => 
    sql`${column} <=> ${JSON.stringify(vector)}::vector`,
  
  euclidean: (column: SQLWrapper, vector: number[]) => 
    sql`${column} <-> ${JSON.stringify(vector)}::vector`,
  
  innerProduct: (column: SQLWrapper, vector: number[]) => 
    sql`${column} <#> ${JSON.stringify(vector)}::vector`,
};

// Full-text search helper
export const textSearch = (column: SQLWrapper, query: string) => 
  sql`to_tsvector('english', ${column}) @@ plainto_tsquery('english', ${query})`;
