import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/lib/db/schema/qr-workspace'
import { sql } from 'drizzle-orm'
import { config } from 'dotenv'
import path from 'path'

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') })

// Create a test database connection
export function createTestDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL not found in .env.test file')
  }
  const client = postgres(connectionString, { max: 1 })
  return drizzle(client, { schema })
}

// Helper to clean up test data
export async function cleanupTestDb(db: ReturnType<typeof createTestDb>) {
  // Delete all test data in reverse order of dependencies
  await db.delete(schema.activityLog)
  await db.delete(schema.alertHistory)
  await db.delete(schema.documents)
  await db.delete(schema.qrCodes)
  await db.delete(schema.alertConfigs)
  await db.delete(schema.workspaces)
}

// Helper to seed test data
export async function seedTestWorkspace(db: ReturnType<typeof createTestDb>, orderId = '12345') {
  const workspace = await db.insert(schema.workspaces).values({
    orderId: parseInt(orderId),
    orderNumber: orderId,
    workspaceUrl: `http://localhost:3000/workspace/${orderId}`,
    status: 'pending',
    workflowPhase: 'pre_mix',
    currentUsers: [],
    activeModules: {
      preMix: true,
      warehouse: true,
      documents: true,
      freight: true
    },
    moduleStates: {}
  }).returning()

  return workspace[0]
}