#!/usr/bin/env node

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

async function createSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create the schema
    await client.query('CREATE SCHEMA IF NOT EXISTS qr_workspace;');
    console.log('✅ Schema qr_workspace created (or already exists)');

    await client.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error creating schema:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Initializing QR Workspace database schema\n');
  
  await createSchema();
  
  console.log('\n✨ Schema creation completed!');
  console.log('\nNow run: npm run db:push to create the tables');
}

main();