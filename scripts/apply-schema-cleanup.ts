import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local BEFORE any other imports
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Now import db after env is loaded
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);

async function cleanSchema() {
  console.log('Cleaning up confusing/redundant columns from database schema...\n');
  
  try {
    // Check current columns
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'qr_workspace' 
      AND table_name = 'workspaces'
      AND column_name IN ('master_qr_id', 'container_qr_ids', 'qr_generation_rule', 'shipstation_order_id', 's3_bucket_name')
    `;
    
    console.log('Found columns to remove:', columns.map(c => c.column_name).join(', '));
    
    // Remove each column if it exists
    const columnsToRemove = [
      'master_qr_id',
      'container_qr_ids', 
      'qr_generation_rule',
      'shipstation_order_id',
      's3_bucket_name'
    ];
    
    for (const col of columnsToRemove) {
      try {
        await sql`ALTER TABLE qr_workspace.workspaces DROP COLUMN IF EXISTS ${sql(col)}`;
        console.log(`✓ Removed column: ${col}`);
      } catch (e: any) {
        if (e.message.includes('does not exist')) {
          console.log(`⚠ Column ${col} already removed or doesn't exist`);
        } else {
          console.error(`✗ Error removing ${col}:`, e.message);
        }
      }
    }
    
    console.log('\n✅ Schema cleanup complete!');
    console.log('\nThe following improvements were made:');
    console.log('- Removed redundant QR tracking columns (using qr_codes table instead)');
    console.log('- Removed duplicate ShipStation ID (using order_id)');
    console.log('- Removed redundant S3 bucket column (documents table has this)');
    console.log('\nYour schema is now cleaner and less confusing!');
    
  } catch (error) {
    console.error('Error during schema cleanup:', error);
  } finally {
    await sql.end();
  }
  
  process.exit(0);
}

cleanSchema();