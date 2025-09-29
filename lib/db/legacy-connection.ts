import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Connection to the original tool.alliancechemical.com database
const LEGACY_DB_URL = process.env.LEGACY_DATABASE_URL ||
  "postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/verceldb?sslmode=require";

// Create a read-only connection pool with limited connections
const legacyQueryClient = postgres(LEGACY_DB_URL, {
  max: 2, // Limited connections for read-only access
  idle_timeout: 20,
  connect_timeout: 10,
});

export const legacyDb = drizzle(legacyQueryClient);

// Helper function to safely query legacy database
export async function queryLegacyDb<T>(
  query: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    console.error('Legacy database query error:', error);
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

// Test connection function
export async function testLegacyConnection(): Promise<boolean> {
  try {
    await legacyQueryClient`SELECT 1`;
    console.log('✅ Legacy database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Legacy database connection failed:', error);
    return false;
  }
}