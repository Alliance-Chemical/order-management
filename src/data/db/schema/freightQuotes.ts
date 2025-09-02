/**
 * Freight Quotes schema
 * Single responsibility: Carrier quote management and selection
 */

import { pgTable, uuid, varchar, decimal, integer, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { freightOrders } from './freightOrders';

export const freightQuotes = pgTable('freight_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  freightOrderId: uuid('freight_order_id').references(() => freightOrders.id),
  
  // Quote Details
  carrierName: varchar('carrier_name', { length: 255 }).notNull(),
  serviceType: varchar('service_type', { length: 100 }),
  quotedCost: decimal('quoted_cost', { precision: 10, scale: 2 }).notNull(),
  transitTime: integer('transit_time'), // in days
  
  // Quote Metadata
  quoteReference: varchar('quote_reference', { length: 255 }),
  validUntil: timestamp('valid_until'),
  
  // MyCarrier Response Data
  rawQuoteData: jsonb('raw_quote_data').$type<any>(),
  
  // Selection Status
  isSelected: boolean('is_selected').default(false),
  selectedAt: timestamp('selected_at'),
  selectedBy: varchar('selected_by', { length: 255 }),
  
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  freightOrderIdIdx: index('idx_quote_freight_order_id').on(table.freightOrderId),
  carrierIdx: index('idx_quote_carrier').on(table.carrierName),
  selectedIdx: index('idx_quote_selected').on(table.isSelected),
}));