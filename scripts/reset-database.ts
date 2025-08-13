import { config } from 'dotenv';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as qrSchema from '../lib/db/schema/qr-workspace';
import * as authSchema from '../lib/db/schema/auth';

// Load .env.local file
config({ path: path.resolve(process.cwd(), '.env.local') });

async function resetDatabase() {
  console.log('🗑️  Starting database reset...\n');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }
  
  console.log('📡 Connecting to database...');
  
  const client = postgres(connectionString, {
    prepare: false,
    max: 1
  });
  
  const schema = { ...qrSchema, ...authSchema };
  const db = drizzle(client, { schema });
  
  try {
    // Clear tables in order of dependencies
    console.log('\n🧹 Clearing tables...\n');
    
    // Clear auth tables first
    console.log('  - Clearing sessions...');
    await db.delete(authSchema.session).catch(e => console.log('    ⚠️  No sessions table or already empty'));
    
    console.log('  - Clearing accounts...');
    await db.delete(authSchema.account).catch(e => console.log('    ⚠️  No accounts table or already empty'));
    
    console.log('  - Clearing verifications...');
    await db.delete(authSchema.verification).catch(e => console.log('    ⚠️  No verifications table or already empty'));
    
    console.log('  - Clearing users...');
    await db.delete(authSchema.user).catch(e => console.log('    ⚠️  No users table or already empty'));
    
    // Clear QR workspace tables
    console.log('  - Clearing activity_log...');
    await db.delete(qrSchema.activityLog);
    
    console.log('  - Clearing alert_history...');
    await db.delete(qrSchema.alertHistory);
    
    console.log('  - Clearing documents...');
    await db.delete(qrSchema.documents);
    
    console.log('  - Clearing batch_history...');
    await db.delete(qrSchema.batchHistory);
    
    console.log('  - Clearing qr_codes...');
    await db.delete(qrSchema.qrCodes);
    
    console.log('  - Clearing alert_configs...');
    await db.delete(qrSchema.alertConfigs);
    
    console.log('  - Clearing workspaces...');
    await db.delete(qrSchema.workspaces);
    
    console.log('  - Clearing source_containers...');
    await db.delete(qrSchema.sourceContainers);
    
    console.log('  - Clearing chemicals...');
    await db.delete(qrSchema.chemicals);
    
    console.log('\n✅ Database reset successfully!');
    console.log('All tables have been cleared.\n');
    
    // Close connection
    await client.end();
    
  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    await client.end();
    process.exit(1);
  }
  
  process.exit(0);
}

// Confirmation prompt
console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
console.log('This action cannot be undone.\n');

if (process.argv.includes('--force')) {
  resetDatabase();
} else {
  console.log('To confirm, run with --force flag:');
  console.log('npm run reset-db -- --force\n');
  process.exit(0);
}
