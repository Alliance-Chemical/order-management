#!/usr/bin/env node

/**
 * Node.js-based RAG data migration script
 * Copies rag.* tables from dev to prod without pg_dump
 * Uses Neon serverless driver to avoid version mismatches
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs').promises;
const path = require('path');

async function migrate() {
  // Get database URLs from command line or environment
  const devUrl = process.argv[2] || process.env.DEV_DB;
  const prodUrl = process.argv[3] || process.env.PROD_DB;

  if (!devUrl || !prodUrl) {
    console.error('Usage: node scripts/migrate-rag-node.js "<DEV_DB_URL>" "<PROD_DB_URL>"');
    process.exit(1);
  }

  console.log('==> Starting RAG data migration (Node.js version)');

  // Create connections using sql function
  const devSql = neon(devUrl);
  const prodSql = neon(prodUrl);

  try {
    // Step 1: Ensure RAG schema exists in production
    console.log('-> Ensuring RAG schema and pgvector in production...');
    const schemaSQL = await fs.readFile(
      path.join(__dirname, '..', 'lib', 'db', 'migrations', '0001_add_pgvector_rag.sql'),
      'utf-8'
    );
    
    // Execute schema creation (idempotent with IF NOT EXISTS)
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const stmt of statements) {
      try {
        // Execute raw SQL
        await prodSql(stmt + ';', []);
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists') && !err.message.includes('tagged-template')) {
          console.warn(`Warning during schema setup: ${err.message}`);
        }
      }
    }

    // Step 2: Get counts from dev
    console.log('-> Checking source data...');
    const devCounts = await devSql`
      SELECT 
        (SELECT COUNT(*) FROM rag.documents) as documents,
        (SELECT COUNT(*) FROM rag.query_history) as queries,
        (SELECT COUNT(*) FROM rag.document_relations) as relations,
        (SELECT COUNT(*) FROM rag.embedding_cache) as cache
    `;
    console.log('   Source counts:', devCounts[0]);

    // Step 3: Clear existing production data (optional - comment out if appending)
    console.log('-> Clearing existing production RAG data...');
    await prodSql`DELETE FROM rag.document_relations`;
    await prodSql`DELETE FROM rag.query_history`;
    await prodSql`DELETE FROM rag.embedding_cache`;
    await prodSql`DELETE FROM rag.documents`;

    // Step 4: Copy documents table in batches
    console.log('-> Copying rag.documents...');
    const batchSize = 100;
    let offset = 0;
    let totalDocs = 0;

    while (true) {
      const docs = await devSql`
        SELECT * FROM rag.documents
        ORDER BY created_at
        LIMIT ${batchSize}
        OFFSET ${offset}
      `;

      if (docs.length === 0) break;

      // Insert batch into production
      for (const doc of docs) {
        // Handle null values and JSON serialization
        const metadata = doc.metadata ? JSON.stringify(doc.metadata) : '{}';
        const keywords = doc.keywords ? JSON.stringify(doc.keywords) : '[]';
        
        await prodSql`
          INSERT INTO rag.documents (
            id, source, source_id, text, text_hash, embedding, 
            embedding_model, metadata, search_vector, keywords,
            base_relevance, click_count, created_at, updated_at,
            indexed_at, is_verified, verified_by, verified_at
          ) VALUES (
            ${doc.id}, 
            ${doc.source}, 
            ${doc.source_id}, 
            ${doc.text},
            ${doc.text_hash}, 
            ${doc.embedding}, 
            ${doc.embedding_model || 'text-embedding-3-small'},
            ${metadata}::jsonb, 
            ${doc.search_vector}, 
            ${keywords}::jsonb,
            ${doc.base_relevance || 100}, 
            ${doc.click_count || 0}, 
            ${doc.created_at || new Date()},
            ${doc.updated_at || new Date()}, 
            ${doc.indexed_at}, 
            ${doc.is_verified || false},
            ${doc.verified_by}, 
            ${doc.verified_at}
          )
        `;
      }

      totalDocs += docs.length;
      console.log(`   Copied ${totalDocs} documents...`);
      offset += batchSize;
    }

    // Step 5: Copy query_history table
    console.log('-> Copying rag.query_history...');
    const queries = await devSql`SELECT * FROM rag.query_history`;
    for (const query of queries) {
      const results = query.results ? JSON.stringify(query.results) : null;
      
      await prodSql`
        INSERT INTO rag.query_history (
          id, query, query_embedding, intent, results, result_count,
          top_score, feedback_score, user_id, session_id, created_at
        ) VALUES (
          ${query.id}, 
          ${query.query}, 
          ${query.query_embedding}, 
          ${query.intent},
          ${results}::jsonb, 
          ${query.result_count || 0}, 
          ${query.top_score},
          ${query.feedback_score}, 
          ${query.user_id}, 
          ${query.session_id},
          ${query.created_at || new Date()}
        )
      `;
    }
    console.log(`   Copied ${queries.length} queries`);

    // Step 6: Copy document_relations table
    console.log('-> Copying rag.document_relations...');
    const relations = await devSql`SELECT * FROM rag.document_relations`;
    for (const rel of relations) {
      const metadata = rel.metadata ? JSON.stringify(rel.metadata) : '{}';
      
      await prodSql`
        INSERT INTO rag.document_relations (
          id, parent_doc_id, child_doc_id, relation_type, metadata, created_at
        ) VALUES (
          ${rel.id}, 
          ${rel.parent_doc_id}, 
          ${rel.child_doc_id},
          ${rel.relation_type}, 
          ${metadata}::jsonb, 
          ${rel.created_at || new Date()}
        )
      `;
    }
    console.log(`   Copied ${relations.length} relations`);

    // Step 7: Copy embedding_cache table
    console.log('-> Copying rag.embedding_cache...');
    const cache = await devSql`SELECT * FROM rag.embedding_cache`;
    for (const item of cache) {
      await prodSql`
        INSERT INTO rag.embedding_cache (
          id, text_hash, text, embedding, model, created_at,
          expires_at, hit_count, last_accessed
        ) VALUES (
          ${item.id}, 
          ${item.text_hash}, 
          ${item.text}, 
          ${item.embedding},
          ${item.model || 'text-embedding-3-small'}, 
          ${item.created_at || new Date()}, 
          ${item.expires_at},
          ${item.hit_count || 0}, 
          ${item.last_accessed}
        )
      `;
    }
    console.log(`   Copied ${cache.length} cache entries`);

    // Step 8: Verify production counts
    console.log('-> Verifying production data...');
    const prodCounts = await prodSql`
      SELECT 
        (SELECT COUNT(*) FROM rag.documents) as documents,
        (SELECT COUNT(*) FROM rag.query_history) as queries,
        (SELECT COUNT(*) FROM rag.document_relations) as relations,
        (SELECT COUNT(*) FROM rag.embedding_cache) as cache
    `;
    console.log('   Production counts:', prodCounts[0]);

    console.log('✅ RAG data migration completed successfully!');
    
    // Sample verification
    const samples = await prodSql`
      SELECT id, source, metadata->>'unNumber' as un_number 
      FROM rag.documents 
      LIMIT 3
    `;
    console.log('Sample migrated documents:');
    samples.forEach(s => console.log(`  - ${s.source}: UN${s.un_number || 'N/A'}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run migration
migrate().catch(console.error);