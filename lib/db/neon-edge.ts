import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as qrSchema from './schema/qr-workspace';
import * as freightSchema from './schema/freight';

// Create Edge Runtime compatible connection with all schemas
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

// Lazy initialization for Edge Runtime
let sql: ReturnType<typeof neon> | null = null;
let edgeDb: ReturnType<typeof drizzle> | null = null;

function initializeEdgeDb() {
  if (!sql && connectionString) {
    // Neon serverless driver optimized for Edge Runtime
    sql = neon(connectionString, {
      // Edge Runtime optimizations
      fetchConnectionCache: true,
      fullResults: false, // Smaller payloads for faster responses
    });
    
    // Create drizzle instance with all schemas for freight platform
    const schema = { ...qrSchema, ...freightSchema };
    edgeDb = drizzle(sql, { schema });
  }
  
  if (!edgeDb) {
    throw new Error('Edge database not initialized. Check DATABASE_URL.');
  }
  
  return edgeDb;
}

// Export optimized Edge Runtime database connection
export function getEdgeDb() {
  return initializeEdgeDb();
}

// Export raw SQL function for parameterized queries
export function getEdgeSql() {
  if (!sql && connectionString) {
    // Initialize if not already done
    initializeEdgeDb();
  }
  
  if (!sql) {
    throw new Error('Edge SQL not initialized. Check DATABASE_URL.');
  }
  
  return sql;
}

// Lightweight retry for Edge Runtime (faster timeout)
export async function withEdgeRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  timeoutMs = 5000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Edge request timeout')), timeoutMs);
  });

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await Promise.race([fn(), timeout]);
    } catch (error) {
      // Don't retry constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique constraint') ||
            error.message.includes('foreign key') ||
            error.message.includes('timeout')) {
          throw error;
        }
      }
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Fast retry for Edge (50ms)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  throw new Error('Edge retry failed');
}

// Quick health check for Edge
type HealthCheckRow = {
  health: number;
};

export async function checkEdgeHealth(): Promise<boolean> {
  try {
    if (!connectionString) return false;
    
    if (!sql) initializeEdgeDb();
    
    if (sql) {
      const result = await Promise.race([
        sql`SELECT 1 as health`,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 1000)
        )
      ]) as HealthCheckRow[];
      
      return result?.[0]?.health === 1;
    }
    
    return false;
  } catch {
    return false;
  }
}
