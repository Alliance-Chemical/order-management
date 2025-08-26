import { config } from 'dotenv';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load .env.local file
config({ path: path.resolve(process.cwd(), '.env.local') });

// Use DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('Please ensure DATABASE_URL is set in your .env.local file');
  process.exit(1);
}

const client = postgres(DATABASE_URL, {
  prepare: false,
});

import * as qrSchema from '../lib/db/schema/qr-workspace';

const schema = { ...qrSchema };
const db = drizzle(client, { schema });
import { 
  workspaces, 
  qrCodes, 
  activityLog,
  batchHistory,
  alertConfigs,
  alertHistory,
  documents,
  chemicals
} from '../lib/db/schema/qr-workspace';
import { sql } from 'drizzle-orm';

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...\n');
  
  try {
    // Clear tables in order of dependencies (reverse of foreign key relationships)
    
    console.log('Clearing activity_log...');
    await db.delete(activityLog);
    
    console.log('Clearing alert_history...');
    await db.delete(alertHistory);
    
    console.log('Clearing documents...');
    await db.delete(documents);
    
    console.log('Clearing batch_history...');
    await db.delete(batchHistory);
    
    console.log('Clearing qr_codes...');
    await db.delete(qrCodes);
    
    console.log('Clearing alert_configs...');
    await db.delete(alertConfigs);
    
    console.log('Clearing workspaces...');
    await db.delete(workspaces);
    
    console.log('Clearing source_containers...');
    // sourceContainers table removed
    
    console.log('Clearing chemicals...');
    await db.delete(chemicals);
    
    // Reset sequences if using PostgreSQL
    console.log('\nResetting sequences...');
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.workspaces', 'id'), 1, false);
    `).catch(() => console.log('  - workspaces sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.qr_codes', 'id'), 1, false);
    `).catch(() => console.log('  - qr_codes sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.source_containers', 'id'), 1, false);
    `).catch(() => console.log('  - source_containers sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.chemicals', 'id'), 1, false);
    `).catch(() => console.log('  - chemicals sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.activity_log', 'id'), 1, false);
    `).catch(() => console.log('  - activity_log sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.batch_history', 'id'), 1, false);
    `).catch(() => console.log('  - batch_history sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.alert_configs', 'id'), 1, false);
    `).catch(() => console.log('  - alert_configs sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.alert_history', 'id'), 1, false);
    `).catch(() => console.log('  - alert_history sequence reset skipped'));
    
    await db.execute(sql`
      SELECT setval(pg_get_serial_sequence('qr_workspace.documents', 'id'), 1, false);
    `).catch(() => console.log('  - documents sequence reset skipped'));
    
    console.log('\n✅ Database cleared successfully!');
    console.log('All tables have been emptied and sequences reset.\n');
    
    // Close the database connection
    await client.end();
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    await client.end();
    process.exit(1);
  }
  
  process.exit(0);
}

// Confirmation prompt
console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
console.log('This action cannot be undone.\n');

if (process.argv.includes('--force')) {
  clearDatabase();
} else {
  console.log('To confirm, run with --force flag:');
  console.log('npm run clear-db -- --force\n');
  process.exit(0);
}