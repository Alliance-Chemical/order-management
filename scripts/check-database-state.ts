import { sql } from 'drizzle-orm';
import { getOptimizedDb } from '../lib/db/neon';
import { extractRows } from '../lib/db/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkDatabaseState() {
  const db = getOptimizedDb();

  console.log('Checking database state...\n');

  // Check schemas
  const schemasResult = await db.execute(sql`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `);
  const schemas = extractRows(schemasResult);

  console.log('Existing schemas:');
  schemas.forEach((s: any) => console.log(`  - ${s.schema_name}`));
  
  // Check tables in public schema
  const publicTablesResult = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  const publicTables = extractRows(publicTablesResult);

  console.log('\nTables in public schema:');
  publicTables.forEach((t: any) => console.log(`  - ${t.table_name}`));

  // Check tables in qr_workspace schema
  const qrTablesResult = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'qr_workspace'
    ORDER BY table_name
  `);
  const qrTables = extractRows(qrTablesResult);

  console.log('\nTables in qr_workspace schema:');
  qrTables.forEach((t: any) => console.log(`  - ${t.table_name}`));

  // Check tables in rag schema if it exists
  const ragTablesResult = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'rag'
    ORDER BY table_name
  `);
  const ragTables = extractRows(ragTablesResult);

  if (ragTables.length > 0) {
    console.log('\nTables in rag schema:');
    ragTables.forEach((t: any) => console.log(`  - ${t.table_name}`));
  }
  
  // Check if pgvector extension exists
  const extensionsResult = await db.execute(sql`
    SELECT extname
    FROM pg_extension
    WHERE extname = 'vector'
  `);
  const extensions = extractRows(extensionsResult);

  console.log('\nExtensions:');
  if (extensions.length > 0) {
    console.log('  - pgvector extension is installed');
  } else {
    console.log('  - pgvector extension is NOT installed');
  }

  // Check if drizzle migrations table exists
  const migrationTableResult = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'drizzle'
    AND table_name = '__drizzle_migrations'
  `);
  const migrationTable = extractRows(migrationTableResult);

  if (migrationTable.length > 0) {
    console.log('\nDrizzle migrations table exists');

    // Check applied migrations
    const migrationsResult = await db.execute(sql`
      SELECT hash, created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at
    `);
    const migrations = extractRows(migrationsResult);

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