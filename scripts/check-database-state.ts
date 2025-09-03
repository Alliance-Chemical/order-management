import { sql } from 'drizzle-orm';
import { getOptimizedDb } from '../lib/db/neon';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkDatabaseState() {
  const db = getOptimizedDb();
  
  console.log('Checking database state...\n');
  
  // Check schemas
  const schemas = await db.execute(sql`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `);
  
  console.log('Existing schemas:');
  schemas.forEach((s: any) => console.log(`  - ${s.schema_name}`));
  
  // Check tables in public schema
  const publicTables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('\nTables in public schema:');
  publicTables.forEach((t: any) => console.log(`  - ${t.table_name}`));
  
  // Check tables in qr_workspace schema
  const qrTables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'qr_workspace' 
    ORDER BY table_name
  `);
  
  console.log('\nTables in qr_workspace schema:');
  qrTables.forEach((t: any) => console.log(`  - ${t.table_name}`));
  
  // Check tables in rag schema if it exists
  const ragTables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'rag' 
    ORDER BY table_name
  `);
  
  if (ragTables.length > 0) {
    console.log('\nTables in rag schema:');
    ragTables.forEach((t: any) => console.log(`  - ${t.table_name}`));
  }
  
  // Check if pgvector extension exists
  const extensions = await db.execute(sql`
    SELECT extname 
    FROM pg_extension 
    WHERE extname = 'vector'
  `);
  
  console.log('\nExtensions:');
  if (extensions.length > 0) {
    console.log('  - pgvector extension is installed');
  } else {
    console.log('  - pgvector extension is NOT installed');
  }
  
  // Check if drizzle migrations table exists
  const migrationTable = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'drizzle' 
    AND table_name = '__drizzle_migrations'
  `);
  
  if (migrationTable.length > 0) {
    console.log('\nDrizzle migrations table exists');
    
    // Check applied migrations
    const migrations = await db.execute(sql`
      SELECT hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `);
    
    console.log('Applied migrations:');
    migrations.forEach((m: any) => {
      console.log(`  - ${m.hash} (applied at ${m.created_at})`);
    });
  } else {
    console.log('\nDrizzle migrations table does NOT exist');
  }
  
  process.exit(0);
}

checkDatabaseState().catch(console.error);