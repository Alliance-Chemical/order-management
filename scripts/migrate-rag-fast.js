#!/usr/bin/env node

/**
 * Fast batch RAG data migration using pg client directly
 * Optimized for speed with larger batches and parallel processing
 */

const { Client } = require('pg');

async function migrate() {
  const devUrl = process.argv[2] || process.env.DEV_DB;
  const prodUrl = process.argv[3] || process.env.PROD_DB;

  if (!devUrl || !prodUrl) {
    console.error('Usage: node scripts/migrate-rag-fast.js "<DEV_DB_URL>" "<PROD_DB_URL>"');
    process.exit(1);
  }

  console.log('==> Starting FAST RAG data migration');

  const devClient = new Client({ connectionString: devUrl });
  const prodClient = new Client({ connectionString: prodUrl });

  try {
    await devClient.connect();
    await prodClient.connect();

    // Ensure schema exists
    console.log('-> Ensuring RAG schema in production...');
    await prodClient.query('CREATE EXTENSION IF NOT EXISTS vector');
    await prodClient.query('CREATE SCHEMA IF NOT EXISTS rag');

    // Get row count
    const countResult = await devClient.query('SELECT COUNT(*) FROM rag.documents');
    const totalDocs = parseInt(countResult.rows[0].count);
    console.log(`-> Found ${totalDocs} documents to migrate`);

    // Clear production data
    console.log('-> Clearing production RAG data...');
    await prodClient.query('TRUNCATE rag.documents, rag.query_history, rag.document_relations, rag.embedding_cache CASCADE');

    // Copy using COPY command (fastest method)
    console.log('-> Copying data using COPY command...');
    
    // Stream from dev to prod
    const copyOutStream = devClient.query(`COPY (
      SELECT * FROM rag.documents ORDER BY created_at
    ) TO STDOUT`);
    
    const copyInStream = prodClient.query(`COPY rag.documents FROM STDIN`);
    
    copyOutStream.pipe(copyInStream);
    
    await new Promise((resolve, reject) => {
      copyInStream.on('finish', resolve);
      copyInStream.on('error', reject);
    });

    // Copy other tables
    console.log('-> Copying query_history...');
    const queries = await devClient.query('SELECT * FROM rag.query_history');
    if (queries.rows.length > 0) {
      const queryValues = queries.rows.map(q => 
        `('${q.id}', '${q.query.replace(/'/g, "''")}', ${q.query_embedding ? `'${q.query_embedding}'` : 'NULL'}, 
          ${q.intent ? `'${q.intent}'` : 'NULL'}, ${q.results ? `'${JSON.stringify(q.results).replace(/'/g, "''")}'::jsonb` : 'NULL'},
          ${q.result_count || 0}, ${q.top_score || 'NULL'}, ${q.feedback_score || 'NULL'}, 
          ${q.user_id ? `'${q.user_id}'` : 'NULL'}, ${q.session_id ? `'${q.session_id}'` : 'NULL'}, 
          '${q.created_at || new Date().toISOString()}')`
      ).join(',');
      
      await prodClient.query(`
        INSERT INTO rag.query_history (id, query, query_embedding, intent, results, result_count,
          top_score, feedback_score, user_id, session_id, created_at)
        VALUES ${queryValues}
      `);
    }

    console.log('-> Copying embedding_cache...');
    const cache = await devClient.query('SELECT * FROM rag.embedding_cache');
    if (cache.rows.length > 0) {
      for (let i = 0; i < cache.rows.length; i += 500) {
        const batch = cache.rows.slice(i, i + 500);
        const cacheValues = batch.map(c => 
          `('${c.id}', '${c.text_hash}', '${c.text.replace(/'/g, "''")}', 
            ${c.embedding ? `'${c.embedding}'` : 'NULL'}, '${c.model || 'text-embedding-3-small'}',
            '${c.created_at || new Date().toISOString()}', ${c.expires_at ? `'${c.expires_at}'` : 'NULL'},
            ${c.hit_count || 0}, ${c.last_accessed ? `'${c.last_accessed}'` : 'NULL'})`
        ).join(',');
        
        await prodClient.query(`
          INSERT INTO rag.embedding_cache (id, text_hash, text, embedding, model, created_at,
            expires_at, hit_count, last_accessed)
          VALUES ${cacheValues}
        `);
        console.log(`   Copied ${Math.min((i + 500), cache.rows.length)}/${cache.rows.length} cache entries`);
      }
    }

    // Verify
    const prodCount = await prodClient.query('SELECT COUNT(*) FROM rag.documents');
    console.log(`✅ Migration complete! ${prodCount.rows[0].count} documents in production`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await devClient.end();
    await prodClient.end();
  }
}

migrate().catch(console.error);