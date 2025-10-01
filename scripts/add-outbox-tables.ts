/**
 * SAFE Migration Script: Add Outbox Pattern Tables
 *
 * This script is SAFE to run because it:
 * 1. Only CREATES new tables (no ALTER/DROP)
 * 2. Uses IF NOT EXISTS (idempotent)
 * 3. Doesn't touch existing data
 * 4. Can be rolled back easily (just drop the new tables)
 *
 * Run with: npx tsx scripts/add-outbox-tables.ts
 */

import { getDb } from '@/src/data/db/client';
import { sql } from 'drizzle-orm';

async function addOutboxTables() {
  const db = getDb();

  console.log('🔄 Adding outbox pattern tables (safe, additive only)...\n');

  try {
    // Create outbox_events table
    console.log('📦 Creating outbox_events table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        aggregate_id VARCHAR(255) NOT NULL,
        aggregate_type VARCHAR(100) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_version VARCHAR(10) DEFAULT '1.0',
        payload JSONB NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT false,
        processed_at TIMESTAMP,
        processing_attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP,
        last_error VARCHAR(1000),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255),
        idempotency_key VARCHAR(255)
      );
    `);

    // Create indexes for outbox_events
    console.log('📑 Creating indexes for outbox_events...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_outbox_processed
      ON outbox_events(processed, created_at);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
      ON outbox_events(aggregate_id, aggregate_type);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_outbox_event_type
      ON outbox_events(event_type);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_outbox_idempotency
      ON outbox_events(idempotency_key);
    `);

    // Create feature_flags table
    console.log('🚩 Creating feature_flags table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(500),
        enabled BOOLEAN NOT NULL DEFAULT false,
        rollout_percentage INTEGER DEFAULT 0,
        enabled_for_users JSONB DEFAULT '[]'::jsonb,
        enabled_for_tenants JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255)
      );
    `);

    // Create index for feature_flags
    console.log('📑 Creating indexes for feature_flags...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_feature_flags_name
      ON feature_flags(name);
    `);

    // Insert default feature flags (all disabled by default - SAFE!)
    console.log('🚩 Adding default feature flags (all disabled)...');
    await db.execute(sql`
      INSERT INTO feature_flags (name, description, enabled, rollout_percentage)
      VALUES
        ('outbox_pattern', 'Use outbox pattern for workspace creation', false, 0),
        ('batch_polling', 'Use batch operations in freight polling', false, 0),
        ('structured_logging', 'Use structured logging with Pino', false, 0)
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verification:');

    // Verify tables exist
    const outboxCheck = await db.execute(sql`
      SELECT COUNT(*) FROM outbox_events;
    `);
    console.log(`   ✓ outbox_events table exists (${outboxCheck.rows[0].count} rows)`);

    const flagsCheck = await db.execute(sql`
      SELECT COUNT(*) FROM feature_flags;
    `);
    console.log(`   ✓ feature_flags table exists (${flagsCheck.rows[0].count} rows)`);

    console.log('\n🎉 All new tables are ready! Your existing system is unchanged.');
    console.log('💡 Next step: Enable features gradually via feature flags.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔧 To rollback, run:');
    console.error('   DROP TABLE IF EXISTS outbox_events;');
    console.error('   DROP TABLE IF EXISTS feature_flags;');
    process.exit(1);
  }
}

// Run migration
addOutboxTables()
  .then(() => {
    console.log('\n👋 Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });