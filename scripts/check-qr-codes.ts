import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local BEFORE any other imports
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Now import db after env is loaded
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function checkOrder() {
  const orderId = 36311;

  // Find workspace
  const ws = await db.select().from(schema.workspaces).where(eq(schema.workspaces.orderId, orderId));
  console.log('Workspace:', ws);

  if (ws.length > 0) {
    const qrs = await db.select().from(schema.qrCodes).where(eq(schema.qrCodes.workspaceId, ws[0].id));
    console.log('\nTotal QR Codes found:', qrs.length);
    console.log('\nQR Code Details:');
    qrs.forEach((qr, i) => {
      console.log(`\nQR ${i+1}:`);
      console.log(`  - Type: ${qr.qrType}`);
      console.log(`  - Container Number: ${qr.containerNumber}`);
      console.log(`  - Short Code: ${qr.shortCode}`);
      console.log(`  - Encoded Data:`, JSON.stringify(qr.encodedData, null, 2));
    });
  } else {
    console.log('No workspace found for order', orderId);
  }
  
  process.exit(0);
}

checkOrder();