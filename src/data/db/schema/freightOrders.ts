/**
 * Freight Orders schema
 * Single responsibility: Order tracking and lifecycle management
 */

import { pgTable, uuid, bigint, varchar, jsonb, timestamp, decimal, text, index } from 'drizzle-orm/pg-core';
import { workspaces } from '../../../../lib/db/schema/qr-workspace';

export const freightOrders = pgTable('freight_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  
  // Order Identification
  orderId: bigint('order_id', { mode: 'number' }).notNull().unique(),
  orderNumber: varchar('order_number', { length: 100 }).notNull(),
  
  // MyCarrier Integration
  myCarrierOrderId: varchar('mycarrier_order_id', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  
  // Freight Details
  carrierName: varchar('carrier_name', { length: 255 }),
  serviceType: varchar('service_type', { length: 100 }),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 10, scale: 2 }),
  
  // Shipping Information
  originAddress: jsonb('origin_address').$type<{
    company?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  }>(),
  destinationAddress: jsonb('destination_address').$type<{
    company?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  }>(),
  
  // Package Details
  packageDetails: jsonb('package_details').$type<{
    weight: { value: number; units: string; };
    dimensions: { length: number; width: number; height: number; units: string; };
    packageCount: number;
    description?: string;
  }>(),
  
  // Booking Status
  bookingStatus: varchar('booking_status', { length: 50 }).default('pending'),
  bookedAt: timestamp('booked_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  
  // AI Decision Data
  aiSuggestions: jsonb('ai_suggestions').$type<any>().default([]),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  decisionSource: varchar('decision_source', { length: 50 }),
  
  // Telemetry
  sessionId: uuid('session_id'),
  telemetryData: jsonb('telemetry_data').$type<any>().default({}),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by', { length: 255 }),
  
  // Notes
  specialInstructions: text('special_instructions'),
  internalNotes: text('internal_notes'),
}, (table) => ({
  workspaceIdIdx: index('idx_freight_workspace_id').on(table.workspaceId),
  orderIdIdx: index('idx_freight_order_id').on(table.orderId),
  bookingStatusIdx: index('idx_freight_booking_status').on(table.bookingStatus),
  carrierIdx: index('idx_freight_carrier').on(table.carrierName),
}));