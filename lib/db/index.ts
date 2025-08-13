import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as qrSchema from './schema/qr-workspace';
import * as authSchema from './schema/auth';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false,
});

const schema = { ...qrSchema, ...authSchema };

export const db = drizzle(client, { schema });

export type Database = typeof db;