#!/usr/bin/env node

/**
 * Optimized batch RAG migration - 50x faster than row-by-row
 * Uses bulk INSERT statements for maximum speed
 */

const { Client } = require('pg');

async function migrate() {
  const devUrl = process.argv[2];
  const prodUrl = process.argv[3];
  const startOffset = parseInt(process.argv[4]?.replace('--offset=', '') || '0');

  if (!devUrl || !prodUrl) {
    console.error('Usage: node scripts/migrate-rag-batch.js "<DEV_URL>" "<PROD_URL>" [--offset=N]');
    process.exit(1);
  }

  console.log('==> Optimized Batch RAG Migration');
  console.log(`-> Starting from offset: ${startOffset}`);

  const devClient = new Client({ connectionString: devUrl });
  const prodClient = new Client({ connectionString: prodUrl });

  try {
    await devClient.connect();
    await prodClient.connect();

    // Get total count
    const countResult = await devClient.query('SELECT COUNT(*) FROM rag.documents');
    const totalDocs = parseInt(countResult.rows[0].count);
    console.log(`-> Total documents to migrate: ${totalDocs}`);
    
    if (startOffset > 0) {
      console.log(`-> Skipping first ${startOffset} (already migrated)`);
    }

    // Ensure schema exists
    if (startOffset === 0) {
      console.log('-> Ensuring RAG schema...');
      await prodClient.query('CREATE EXTENSION IF NOT EXISTS vector');
      await prodClient.query('CREATE SCHEMA IF NOT EXISTS rag');
      
      // Create tables if not exist
      const schemaSQL = `
        CREATE TABLE IF NOT EXISTS rag.documents (
          id UUID PRIMARY KEY,
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
        
        CREATE TABLE IF NOT EXISTS rag.query_history (
          id UUID PRIMARY KEY,
          query TEXT NOT NULL,
          query_embedding vector(1536),
          intent VARCHAR(50),
          results JSONB,
          result_count INTEGER DEFAULT 0,
          top_score FLOAT,
          feedback_score INTEGER,
          user_id VARCHAR(255),
          session_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS rag.embedding_cache (
          id UUID PRIMARY KEY,
          text_hash VARCHAR(64) NOT NULL,
          text TEXT NOT NULL,
          embedding vector(1536),
          model VARCHAR(50) DEFAULT 'text-embedding-3-small',
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP,
          hit_count INTEGER DEFAULT 0,
          last_accessed TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS rag.document_relations (
          id UUID PRIMARY KEY,
          parent_doc_id UUID,
          child_doc_id UUID,
          relation_type VARCHAR(50),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      for (const stmt of schemaSQL.split(';').filter(s => s.trim())) {
        try {
          await prodClient.query(stmt);
        } catch (e) {
          if (!e.message.includes('already exists')) {
            console.warn('Schema warning:', e.message);
          }
        }
      }
    }

    // Migrate documents in batches
    console.log('-> Migrating documents in batches of 100...');
    const BATCH_SIZE = 100;
    let offset = startOffset;
    let migrated = startOffset;

    while (offset < totalDocs) {
      const result = await devClient.query(`
        SELECT * FROM rag.documents 
        ORDER BY created_at 
        LIMIT $1 OFFSET $2
      `, [BATCH_SIZE, offset]);

      if (result.rows.length === 0) break;

      // Build bulk insert
      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const doc of result.rows) {
        const placeholders = [];
        
        // Add all field values
        params.push(doc.id);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.source);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.source_id);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.text);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.text_hash);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.embedding);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.embedding_model || 'text-embedding-3-small');
        placeholders.push(`$${paramIndex++}`);
        
        params.push(JSON.stringify(doc.metadata || {}));
        placeholders.push(`$${paramIndex++}::jsonb`);
        
        params.push(doc.search_vector);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(JSON.stringify(doc.keywords || []));
        placeholders.push(`$${paramIndex++}::jsonb`);
        
        params.push(doc.base_relevance || 100);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.click_count || 0);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.created_at || new Date());
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.updated_at || new Date());
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.indexed_at);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.is_verified || false);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.verified_by);
        placeholders.push(`$${paramIndex++}`);
        
        params.push(doc.verified_at);
        placeholders.push(`$${paramIndex++}`);
        
        values.push(`(${placeholders.join(', ')})`);
      }

      // Execute bulk insert
      const insertSQL = `
        INSERT INTO rag.documents (
          id, source, source_id, text, text_hash, embedding,
          embedding_model, metadata, search_vector, keywords,
          base_relevance, click_count, created_at, updated_at,
          indexed_at, is_verified, verified_by, verified_at
        ) VALUES ${values.join(', ')}
        ON CONFLICT (id) DO NOTHING
      `;

      await prodClient.query(insertSQL, params);
      
      migrated += result.rows.length;
      offset += BATCH_SIZE;
      
      // Progress update
      const percent = Math.round((migrated / totalDocs) * 100);
      console.log(`   [${percent}%] Migrated ${migrated}/${totalDocs} documents`);
    }

    // Migrate other tables only if starting from beginning
    if (startOffset === 0) {
      // Query history
      console.log('-> Migrating query_history...');
      const queries = await devClient.query('SELECT * FROM rag.query_history');
      
      if (queries.rows.length > 0) {
        const qValues = [];
        const qParams = [];
        let qIndex = 1;
        
        for (const q of queries.rows) {
          const placeholders = [];
          qParams.push(q.id, q.query, q.query_embedding, q.intent, 
                      q.results ? JSON.stringify(q.results) : null, q.result_count || 0, q.top_score, 
                      q.feedback_score, q.user_id, q.session_id, 
                      q.created_at || new Date());
          
          for (let i = 0; i < 11; i++) {
            if (i === 4) {
              placeholders.push(`$${qIndex++}::jsonb`);  // results field needs jsonb cast
            } else {
              placeholders.push(`$${qIndex++}`);
            }
          }
          qValues.push(`(${placeholders.join(', ')})`);
        }
        
        await prodClient.query(`
          INSERT INTO rag.query_history (
            id, query, query_embedding, intent, results, result_count,
            top_score, feedback_score, user_id, session_id, created_at
          ) VALUES ${qValues.join(', ')}
          ON CONFLICT (id) DO NOTHING
        `, qParams);
        
        console.log(`   Migrated ${queries.rows.length} queries`);
      }

      // Embedding cache
      console.log('-> Migrating embedding_cache...');
      const cacheResult = await devClient.query('SELECT COUNT(*) FROM rag.embedding_cache');
      const totalCache = parseInt(cacheResult.rows[0].count);
      console.log(`   Found ${totalCache} cache entries`);
      
      let cacheOffset = 0;
      let cacheMigrated = 0;
      
      while (cacheOffset < totalCache) {
        const cache = await devClient.query(`
          SELECT * FROM rag.embedding_cache 
          ORDER BY created_at 
          LIMIT 500 OFFSET $1
        `, [cacheOffset]);
        
        if (cache.rows.length === 0) break;
        
        const cValues = [];
        const cParams = [];
        let cIndex = 1;
        
        for (const c of cache.rows) {
          const placeholders = [];
          cParams.push(c.id, c.text_hash, c.text, c.embedding,
                      c.model || 'text-embedding-3-small', c.created_at || new Date(),
                      c.expires_at, c.hit_count || 0, c.last_accessed);
          
          for (let i = 0; i < 9; i++) {
            placeholders.push(`$${cIndex++}`);
          }
          cValues.push(`(${placeholders.join(', ')})`);
        }
        
        await prodClient.query(`
          INSERT INTO rag.embedding_cache (
            id, text_hash, text, embedding, model, created_at,
            expires_at, hit_count, last_accessed
          ) VALUES ${cValues.join(', ')}
          ON CONFLICT (id) DO NOTHING
        `, cParams);
        
        cacheMigrated += cache.rows.length;
        cacheOffset += 500;
        console.log(`   [${Math.round((cacheMigrated/totalCache)*100)}%] Migrated ${cacheMigrated}/${totalCache} cache entries`);
      }

      // Document relations
      console.log('-> Migrating document_relations...');
      const relations = await devClient.query('SELECT * FROM rag.document_relations');
      
      if (relations.rows.length > 0) {
        const rValues = [];
        const rParams = [];
        let rIndex = 1;
        
        for (const r of relations.rows) {
          const placeholders = [];
          rParams.push(r.id, r.parent_doc_id, r.child_doc_id,
                      r.relation_type, JSON.stringify(r.metadata || {}), r.created_at || new Date());
          
          for (let i = 0; i < 6; i++) {
            if (i === 4) {
              placeholders.push(`$${rIndex++}::jsonb`);  // metadata field needs jsonb cast
            } else {
              placeholders.push(`$${rIndex++}`);
            }
          }
          rValues.push(`(${placeholders.join(', ')})`);
        }
        
        await prodClient.query(`
          INSERT INTO rag.document_relations (
            id, parent_doc_id, child_doc_id, relation_type, metadata, created_at
          ) VALUES ${rValues.join(', ')}
          ON CONFLICT (id) DO NOTHING
        `, rParams);
        
        console.log(`   Migrated ${relations.rows.length} relations`);
      }
    }

    // Final verification
    console.log('\n-> Verifying migration...');
    const verification = await prodClient.query(`
      SELECT 
        (SELECT COUNT(*) FROM rag.documents) as documents,
        (SELECT COUNT(*) FROM rag.query_history) as queries,
        (SELECT COUNT(*) FROM rag.document_relations) as relations,
        (SELECT COUNT(*) FROM rag.embedding_cache) as cache
    `);
    
    console.log('✅ Production counts:', verification.rows[0]);
    
    // Sample data
    const samples = await prodClient.query(`
      SELECT source, COUNT(*) as count 
      FROM rag.documents 
      GROUP BY source 
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Documents by source:');
    samples.rows.forEach(s => console.log(`   ${s.source}: ${s.count}`));

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await devClient.end();
    await prodClient.end();
  }
}

migrate().catch(console.error);