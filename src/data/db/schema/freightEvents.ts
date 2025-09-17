/**
 * Freight Events schema
 * Single responsibility: Order lifecycle event tracking
 */

import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { freightOrders } from './freightOrders';

export const freightEvents = pgTable('freight_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  freightOrderId: uuid('freight_order_id').references(() => freightOrders.id),
  
  // Event Details
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventDescription: varchar('event_description', { length: 500 }),
  
  // Event Data
  eventData: jsonb('event_data').$type<Record<string, unknown>>().default({}),
  
  // Tracking
  performedBy: varchar('performed_by', { length: 255 }),
  performedAt: timestamp('performed_at').defaultNow(),
  
  // Location (for shipping events)
  location: varchar('location', { length: 255 }),
}, (table) => ({
  freightOrderIdIdx: index('idx_event_freight_order_id').on(table.freightOrderId),
  eventTypeIdx: index('idx_event_type').on(table.eventType),
  performedAtIdx: index('idx_event_performed_at').on(table.performedAt),
}));
