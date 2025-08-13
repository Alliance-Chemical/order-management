import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function initAuthTables() {
  console.log('Creating auth schema and tables...');
  
  try {
    // Create auth schema if it doesn't exist
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS auth`);
    
    // Create user table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth.user (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        name TEXT,
        image TEXT,
        role TEXT NOT NULL DEFAULT 'worker',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create session table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth.session (
        id TEXT PRIMARY KEY,
        "expiresAt" TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE
      )
    `);
    
    // Create account table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth.account (
        id TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        "refreshTokenExpiresAt" TIMESTAMP,
        scope TEXT,
        password TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create verification table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth.verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ Auth tables created successfully!');
    
    // Create a test supervisor user for development
    const testUserId = 'test-supervisor-' + Date.now();
    await db.execute(sql`
      INSERT INTO auth.user (id, email, name, role, "emailVerified")
      VALUES (${testUserId}, 'supervisor@test.com', 'Test Supervisor', 'supervisor', true)
      ON CONFLICT (email) DO NOTHING
    `);
    
    const testWorkerId = 'test-worker-' + Date.now();
    await db.execute(sql`
      INSERT INTO auth.user (id, email, name, role, "emailVerified")
      VALUES (${testWorkerId}, 'worker@test.com', 'Test Worker', 'worker', true)
      ON CONFLICT (email) DO NOTHING
    `);
    
    console.log('✅ Test users created (supervisor@test.com, worker@test.com)');
    
  } catch (error) {
    console.error('Error creating auth tables:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

initAuthTables();