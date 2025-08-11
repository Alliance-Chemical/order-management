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

async function clearAndRegenerate() {
  const orderId = 36311;

  // Find workspace
  const ws = await db.select().from(schema.workspaces).where(eq(schema.workspaces.orderId, orderId));
  
  if (ws.length > 0) {
    console.log('Found workspace:', ws[0].id);
    
    // Delete existing QR codes
    const deleted = await db.delete(schema.qrCodes).where(eq(schema.qrCodes.workspaceId, ws[0].id));
    console.log('Deleted existing QR codes');
    
    // Check they're gone
    const remaining = await db.select().from(schema.qrCodes).where(eq(schema.qrCodes.workspaceId, ws[0].id));
    console.log('Remaining QR codes:', remaining.length);
  } else {
    console.log('No workspace found for order', orderId);
  }
  
  process.exit(0);
}

clearAndRegenerate();