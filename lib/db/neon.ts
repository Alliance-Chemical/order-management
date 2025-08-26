import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as qrSchema from './schema/qr-workspace';

// Create a cached connection for serverless environments
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

// Lazy initialization to avoid errors during build
let sql: ReturnType<typeof neon> | null = null;
let neonDb: ReturnType<typeof drizzle> | null = null;

function initializeNeonDb() {
  if (!sql && connectionString) {
    // Use Neon's serverless driver which handles connection pooling automatically
    sql = neon(connectionString, {
      // Enable connection caching for better performance
      fetchConnectionCache: true,
      // Use WebSocket for better performance
      fullResults: true,
    });
    
    // Create drizzle instance with the Neon driver
    const schema = { ...qrSchema };
    neonDb = drizzle(sql, { schema });
  }
  
  if (!neonDb) {
    throw new Error('Database not initialized. Please set DATABASE_URL or NEON_DATABASE_URL environment variable.');
  }
  
  return neonDb;
}

// Export a function to get the optimized database connection
export function getOptimizedDb() {
  return initializeNeonDb();
}

// Helper function for transactions with automatic retry
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.message.includes('unique constraint') ||
            error.message.includes('foreign key') ||
            error.message.includes('not found')) {
          throw error;
        }
      }
      
      // Wait before retrying with exponential backoff
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}

// Connection health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (!connectionString) {
      return false;
    }
    
    if (!sql) {
      initializeNeonDb();
    }
    
    if (sql) {
      const result = await sql`SELECT 1 as health` as any[];
      return result?.[0]?.health === 1;
    }
    
    return false;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}