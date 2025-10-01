#!/usr/bin/env node

/**
 * Add freight_hud feature flag to database
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/add-freight-hud-flag.ts
 */

// Load environment variables first
import { config } from 'dotenv';
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('Set DATABASE_URL or ensure .env.local contains it');
  process.exit(1);
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as outboxSchema from '../lib/db/schema/outbox';
import { eq } from 'drizzle-orm';

const { featureFlags } = outboxSchema;

// Create database connection
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

async function addFreightHudFlag() {
  console.log('Adding freight_hud feature flag...');

  const db = drizzle(client, { schema: outboxSchema });

  try {
    // Check if flag already exists
    const existing = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.name, 'freight_hud'),
    });

    if (existing) {
      console.log('✅ freight_hud flag already exists:', {
        id: existing.id,
        enabled: existing.enabled,
        rolloutPercentage: existing.rolloutPercentage,
      });

      // Update to ensure it's enabled at 100%
      await db
        .update(featureFlags)
        .set({
          enabled: true,
          rolloutPercentage: 100,
          description: 'Supervisor Freight HUD - shows workspaces in three lanes (unready, ready to book, booked)',
          updatedAt: new Date(),
        })
        .where(eq(featureFlags.name, 'freight_hud'));

      console.log('✅ Updated freight_hud flag to enabled=true, rollout=100%');
      return;
    }

    // Insert new flag
    const [inserted] = await db
      .insert(featureFlags)
      .values({
        name: 'freight_hud',
        description: 'Supervisor Freight HUD - shows workspaces in three lanes (unready, ready to book, booked)',
        enabled: true,
        rolloutPercentage: 100,
        enabledForUsers: [],
        enabledForTenants: [],
        createdBy: 'system',
      })
      .returning();

    console.log('✅ Created freight_hud feature flag:', {
      id: inserted.id,
      name: inserted.name,
      enabled: inserted.enabled,
      rolloutPercentage: inserted.rolloutPercentage,
    });
  } catch (error) {
    console.error('❌ Failed to add freight_hud flag:', error);
    throw error;
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  addFreightHudFlag()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export { addFreightHudFlag };
