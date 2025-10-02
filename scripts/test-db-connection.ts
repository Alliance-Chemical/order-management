import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('After dotenv.config:');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

import { getDb, extractRows } from '@/lib/db/client';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.split('@')[1]); // Show only host/db part
    console.log('ANDRE_DATABASE_URL:', process.env.ANDRE_DATABASE_URL?.split('@')[1]);

    const db = getDb();

    // Test basic connection
    const resultRaw = await db.execute('SELECT current_database(), current_user');
    const result = extractRows(resultRaw);
    console.log('Connected to:', result[0]);
    
    // Check for existing schemas
    const schemas = await db.execute(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('qr_workspace', 'public')
      ORDER BY schema_name
    `);
    console.log('Available schemas:', schemas);
    
    // Check for existing tables
    const tables = await db.execute(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('qr_workspace', 'public')
      ORDER BY table_schema, table_name
    `);
    console.log('Existing tables:', tables);
    
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testConnection();