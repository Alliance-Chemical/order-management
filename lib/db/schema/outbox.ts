/**
 * Outbox Pattern Schema
 *
 * This is a NEW additive schema - does not modify existing tables.
 * Safe to deploy - won't affect current system behavior.
 *
 * Purpose: Guarantee atomic writes + eventual consistency
 * Pattern: https://microservices.io/patterns/data/transactional-outbox.html
 */

import { pgTable, uuid, varchar, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';

type JsonObject = Record<string, unknown>;

/**
 * Outbox Events Table
 *
 * Stores events that need to be processed asynchronously.
 * Events are written in the SAME transaction as business data,
 * guaranteeing they won't be lost even if external systems fail.
 */
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Which aggregate this event belongs to (workspace, order, etc)
  aggregateId: varchar('aggregate_id', { length: 255 }).notNull(),
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(), // 'workspace', 'freight_order', etc

  // Event details
  eventType: varchar('event_type', { length: 100 }).notNull(), // 'WorkspaceCreated', 'QRGenerationRequested', etc
  eventVersion: varchar('event_version', { length: 10 }).default('1.0'),
  payload: jsonb('payload').$type<JsonObject>().notNull(),

  // Processing state
  processed: boolean('processed').default(false).notNull(),
  processedAt: timestamp('processed_at'),
  processingAttempts: jsonb('processing_attempts').$type<number>().default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  lastError: varchar('last_error', { length: 1000 }),

  // Metadata for debugging
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),

  // For idempotency (optional)
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
}, (table) => ({
  // Critical indexes for performance
  processedIdx: index('idx_outbox_processed').on(table.processed, table.createdAt),
  aggregateIdx: index('idx_outbox_aggregate').on(table.aggregateId, table.aggregateType),
  eventTypeIdx: index('idx_outbox_event_type').on(table.eventType),
  idempotencyIdx: index('idx_outbox_idempotency').on(table.idempotencyKey),
}));

/**
 * Feature Flags Table
 *
 * Controls gradual rollout of new features.
 * Can enable/disable features without code deployment.
 */
export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Flag identification
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 500 }),

  // Rollout control
  enabled: boolean('enabled').default(false).notNull(),
  rolloutPercentage: jsonb('rollout_percentage').$type<number>().default(0), // 0-100

  // Targeting (optional)
  enabledForUsers: jsonb('enabled_for_users').$type<string[]>().default([]),
  enabledForTenants: jsonb('enabled_for_tenants').$type<string[]>().default([]),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 255 }),
}, (table) => ({
  nameIdx: index('idx_feature_flags_name').on(table.name),
}));

// Type exports for use in application code
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type OutboxEventInsert = typeof outboxEvents.$inferInsert;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type FeatureFlagInsert = typeof featureFlags.$inferInsert;