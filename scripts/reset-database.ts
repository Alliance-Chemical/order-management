import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local BEFORE any other imports
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Now import db after env is loaded
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/db/schema/qr-workspace';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function resetDatabase() {
  console.log('Clearing all data from database...');
  
  // Delete in order to respect foreign key constraints
  try {
    await db.delete(schema.activityLog);
    console.log('✓ Cleared activity log');
  } catch (e) {
    console.log('⚠ Activity log table not found or already empty');
  }
  
  try {
    await db.delete(schema.alertHistory);
    console.log('✓ Cleared alert history');
  } catch (e) {
    console.log('⚠ Alert history table not found or already empty');
  }
  
  try {
    await db.delete(schema.documents);
    console.log('✓ Cleared documents');
  } catch (e) {
    console.log('⚠ Documents table not found or already empty');
  }
  
  try {
    await db.delete(schema.qrCodes);
    console.log('✓ Cleared QR codes');
  } catch (e) {
    console.log('⚠ QR codes table not found or already empty');
  }
  
  try {
    await db.delete(schema.sourceContainers);
    console.log('✓ Cleared source containers');
  } catch (e) {
    console.log('⚠ Source containers table not found or already empty');
  }
  
  try {
    await db.delete(schema.alertConfigs);
    console.log('✓ Cleared alert configs');
  } catch (e) {
    console.log('⚠ Alert configs table not found or already empty');
  }
  
  try {
    await db.delete(schema.workspaces);
    console.log('✓ Cleared workspaces');
  } catch (e) {
    console.log('⚠ Workspaces table not found or already empty');
  }
  
  console.log('\n✅ Database reset complete! All tables are now empty.');
  
  process.exit(0);
}

resetDatabase().catch(err => {
  console.error('Error resetting database:', err);
  process.exit(1);
});