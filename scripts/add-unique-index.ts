import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function addUniqueIndex() {
  try {
    console.log('Adding unique index for source QR codes...');
    
    // Add the unique partial index (table is in qr_workspace schema)
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_source_qr 
      ON qr_workspace.qr_codes (workspace_id, (encoded_data->>'sourceContainerId')) 
      WHERE qr_type = 'source'
    `);
    
    console.log('✅ Unique index added successfully!');
    console.log('This prevents duplicate source QR codes for the same container.');
    
    await client.end();
    process.exit(0);
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ Index already exists, skipping creation.');
      await client.end();
      process.exit(0);
    }
    console.error('Error adding index:', error);
    await client.end();
    process.exit(1);
  }
}

addUniqueIndex();